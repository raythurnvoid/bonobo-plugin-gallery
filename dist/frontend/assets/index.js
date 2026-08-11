//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll('link[rel="modulepreload"]')) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes)
				if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true,
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
//#endregion
//#region node_modules/.pnpm/bonobo-plugin-sdk@https+++c_753255337dcfd61c1160f3a0efb1e975/node_modules/bonobo-plugin-sdk/frontend.js
/**
 * Bonobo plugin frontend bridge — hand-written browser ESM, no dependencies, no build step.
 *
 * Runs inside the host app's sandboxed plugin iframe (`sandbox="allow-scripts"`, so the document
 * has an opaque origin) for plugin pages and plugin file views alike, and talks to the embedding
 * host app over the current strict postMessage contract: the page announces `bonobo:ready`, the
 * host answers `bonobo:init` with a short-lived scoped bearer token, and from then on the client
 * calls the public `/api/v1/*` API on `apiOrigin` directly with `Authorization: Bearer <token>`.
 */
/** `getToken` refreshes when the token is expired or expires within this margin. */
var TOKEN_EXPIRY_MARGIN_MS = 6e4;
var READY_RETRY_MS = 500;
var REFRESH_DEADLINE_MS = 1e4;
var BRIDGE_NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/**
 * Validates the `bonobo:init` context union: `kind: "page"` or `kind: "file_view"`.
 *
 * @param {unknown} value
 */
function is_ui_context(value) {
	if (typeof value !== "object" || value === null) return false;
	const context = value;
	if (
		typeof context.pluginName !== "string" ||
		typeof context.organizationId !== "string" ||
		typeof context.workspaceId !== "string"
	)
		return false;
	if (context.kind === "page") return typeof context.pageId === "string" && typeof context.pageTitle === "string";
	if (context.kind === "file_view") {
		if (typeof context.fileViewId !== "string" || typeof context.fileViewTitle !== "string") return false;
		if (typeof context.file !== "object" || context.file === null) return false;
		const file = context.file;
		return (
			typeof file.fileNodeId === "string" &&
			typeof file.name === "string" &&
			typeof file.path === "string" &&
			typeof file.contentType === "string"
		);
	}
	return false;
}
/**
 * Reads the host origin and frame nonce from the URL fragment. The fragment is available to the
 * page but is not sent in the asset request, cache key, or referrer.
 */
function read_bridge_bootstrap() {
	const fragment = window.location.hash.slice(1);
	if (!fragment) throw new Error("Missing host bridge fragment — the page must be embedded by the Bonobo host app");
	const params = new URLSearchParams(fragment);
	const parentOrigins = params.getAll("parentOrigin");
	const bridgeNonces = params.getAll("bridgeNonce");
	if (params.size !== 2 || parentOrigins.length !== 1 || bridgeNonces.length !== 1)
		throw new Error("Invalid host bridge fragment");
	const parentOrigin = parentOrigins[0];
	const bridgeNonce = bridgeNonces[0];
	let parsedParentOrigin;
	try {
		parsedParentOrigin = new URL(parentOrigin);
	} catch {
		throw new Error("Invalid host bridge parent origin");
	}
	if (
		(parsedParentOrigin.protocol !== "http:" && parsedParentOrigin.protocol !== "https:") ||
		parsedParentOrigin.origin !== parentOrigin
	)
		throw new Error("Invalid host bridge parent origin");
	if (!BRIDGE_NONCE_PATTERN.test(bridgeNonce)) throw new Error("Invalid host bridge nonce");
	return {
		parentOrigin,
		bridgeNonce,
	};
}
/**
 * Connects the page to the embedding host app. It installs one shared `message` listener (for
 * init and token responses), posts `{ type: "bonobo:ready", bridgeNonce }` to `window.parent`,
 * and resolves with the frontend client when the host's `bonobo:init` arrives. `bonobo:init`
 * messages after the first are ignored.
 *
 * The host puts its canonical HTTP(S) origin and a fresh frame nonce in the URL fragment. The SDK
 * validates both before connecting, sends ready only to that exact origin, and accepts host
 * messages only from that origin, `window.parent`, and the matching nonce. The token travels over
 * postMessage only and is never placed in a URL.
 *
 * @returns {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient>}
 */
async function bonobo_ui_connect() {
	const { parentOrigin, bridgeNonce } = read_bridge_bootstrap();
	let apiOrigin = "";
	let token = "";
	let tokenExpiresAt = 0;
	/** @type {Map<string, { resolve: (token: string) => void, reject: (error: Error) => void, timeout: ReturnType<typeof setTimeout> }>} */
	const pending_refreshes = /* @__PURE__ */ new Map();
	/** @type {Promise<string> | null} */
	let refresh_in_flight = null;
	/**
	 * Returns the current token, refreshing it first when it is expired or within
	 * `TOKEN_EXPIRY_MARGIN_MS` of `tokenExpiresAt`.
	 *
	 * @returns {Promise<string>}
	 */
	async function getToken() {
		if (Date.now() >= tokenExpiresAt - TOKEN_EXPIRY_MARGIN_MS) return refreshToken();
		return token;
	}
	/**
	 * Asks the host for a fresh token. Concurrent callers share one in-flight
	 * `bonobo:token-refresh-request`; it resolves on the matching `bonobo:token` and rejects on
	 * the matching `bonobo:token-error`.
	 *
	 * @returns {Promise<string>}
	 */
	function refreshToken() {
		if (refresh_in_flight) return refresh_in_flight;
		const requestId = crypto.randomUUID();
		refresh_in_flight = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				pending_refreshes.delete(requestId);
				reject(/* @__PURE__ */ new Error("Plugin page token refresh timed out"));
			}, REFRESH_DEADLINE_MS);
			pending_refreshes.set(requestId, {
				resolve,
				reject,
				timeout,
			});
			try {
				window.parent.postMessage(
					{
						type: "bonobo:token-refresh-request",
						bridgeNonce,
						requestId,
					},
					parentOrigin,
				);
			} catch (error) {
				clearTimeout(timeout);
				pending_refreshes.delete(requestId);
				reject(error);
			}
		}).finally(() => {
			refresh_in_flight = null;
		});
		return refresh_in_flight;
	}
	/**
	 * `fetch` against `apiOrigin + path` with `Authorization: Bearer <token>`. When `init.body`
	 * is set it is JSON-encoded and sent with `Content-Type: application/json`, and the default
	 * method is `POST`; without a body the default method is `GET`. On a `401` the client
	 * refreshes the token and retries exactly once. Ok responses resolve with the parsed JSON
	 * body; non-ok responses throw an `Error` carrying `status` and `responseText`.
	 *
	 * @param {string} path - Public API path starting with `/`, e.g. `"/api/v1/files/list"`.
	 * @param {{ method?: string, headers?: Record<string, string>, body?: unknown }} [init]
	 * @returns {Promise<any>}
	 */
	async function fetchJson(path, init) {
		const has_body = init?.body !== void 0;
		/** @param {string} bearer */
		const send = (bearer) => {
			const headers = new Headers(init?.headers);
			headers.set("Authorization", `Bearer ${bearer}`);
			if (has_body) headers.set("Content-Type", "application/json");
			return fetch(apiOrigin + path, {
				method: init?.method ?? (has_body ? "POST" : "GET"),
				headers,
				body: has_body ? JSON.stringify(init.body) : void 0,
			});
		};
		const firstBearer = await getToken();
		let response = await send(firstBearer);
		if (response.status === 401) response = await send(token !== firstBearer ? token : await refreshToken());
		if (!response.ok) {
			const responseText = await response.text();
			throw Object.assign(/* @__PURE__ */ new Error(`${path} responded ${response.status}: ${responseText}`), {
				status: response.status,
				responseText,
			});
		}
		return response.json();
	}
	return new Promise((resolve) => {
		let initialized = false;
		/** @type {ReturnType<typeof setInterval> | undefined} */
		let readyInterval;
		const post_ready = () => {
			window.parent.postMessage(
				{
					type: "bonobo:ready",
					bridgeNonce,
				},
				parentOrigin,
			);
		};
		const stop_ready = () => {
			clearInterval(readyInterval);
		};
		/** @param {MessageEvent} event */
		const handle_message = (event) => {
			if (event.source !== window.parent || event.origin !== parentOrigin) return;
			const message = event.data;
			if (typeof message !== "object" || message === null) return;
			if (
				message.type === "bonobo:init" &&
				!initialized &&
				message.bridgeNonce === bridgeNonce &&
				typeof message.apiOrigin === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt) &&
				is_ui_context(message.context)
			) {
				initialized = true;
				stop_ready();
				window.removeEventListener("pagehide", stop_ready);
				apiOrigin = message.apiOrigin;
				token = message.token;
				tokenExpiresAt = message.tokenExpiresAt;
				resolve({
					context: message.context,
					apiOrigin,
					getToken,
					refreshToken,
					fetchJson,
				});
			} else if (
				initialized &&
				message.bridgeNonce === bridgeNonce &&
				message.type === "bonobo:token" &&
				typeof message.requestId === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt)
			) {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					clearTimeout(pending.timeout);
					token = message.token;
					tokenExpiresAt = message.tokenExpiresAt;
					pending.resolve(message.token);
				}
			} else if (
				initialized &&
				message.bridgeNonce === bridgeNonce &&
				message.type === "bonobo:token-error" &&
				typeof message.requestId === "string" &&
				typeof message.message === "string"
			) {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					clearTimeout(pending.timeout);
					pending.reject(new Error(message.message));
				}
			}
		};
		window.addEventListener("message", handle_message);
		window.addEventListener("pagehide", stop_ready, { once: true });
		post_ready();
		readyInterval = setInterval(post_ready, READY_RETRY_MS);
	});
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/dist/preact.module.js
var n;
var l$1;
var u$2;
var i$2;
var r$1;
var o$1;
var e$1;
var f$2;
var c$1;
var a$1;
var s$1;
var h$1;
var p$1;
var v$1;
var d$1 = {};
var w$1 = [];
var _ = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var g$1 = Array.isArray;
function m$1(n, l) {
	for (var u in l) n[u] = l[u];
	return n;
}
function b(n) {
	n && n.parentNode && n.parentNode.removeChild(n);
}
function k$1(l, u, t) {
	var i,
		r,
		o,
		e = {};
	for (o in u) "key" == o ? (i = u[o]) : "ref" == o ? (r = u[o]) : (e[o] = u[o]);
	if (
		(arguments.length > 2 && (e.children = arguments.length > 3 ? n.call(arguments, 2) : t),
		"function" == typeof l && null != l.defaultProps)
	)
		for (o in l.defaultProps) void 0 === e[o] && (e[o] = l.defaultProps[o]);
	return x(l, e, i, r, null);
}
function x(n, t, i, r, o) {
	var e = {
		type: n,
		props: t,
		key: i,
		ref: r,
		__k: null,
		__: null,
		__b: 0,
		__e: null,
		__c: null,
		constructor: void 0,
		__v: null == o ? ++u$2 : o,
		__i: -1,
		__u: 0,
	};
	return (null == o && null != l$1.vnode && l$1.vnode(e), e);
}
function S(n) {
	return n.children;
}
function C$1(n, l) {
	((this.props = n), (this.context = l));
}
function $(n, l) {
	if (null == l) return n.__ ? $(n.__, n.__i + 1) : null;
	for (var u; l < n.__k.length; l++) if (null != (u = n.__k[l]) && null != u.__e) return u.__e;
	return "function" == typeof n.type ? $(n) : null;
}
function I(n) {
	if (n.__P && n.__d) {
		var u = n.__v,
			t = u.__e,
			i = [],
			r = [],
			o = m$1({}, u);
		((o.__v = u.__v + 1),
			l$1.vnode && l$1.vnode(o),
			q$2(n.__P, o, u, n.__n, n.__P.namespaceURI, 32 & u.__u ? [t] : null, i, null == t ? $(u) : t, !!(32 & u.__u), r),
			(o.__v = u.__v),
			(o.__.__k[o.__i] = o),
			D$1(i, o, r),
			(u.__e = u.__ = null),
			o.__e != t && P$1(o));
	}
}
function P$1(n) {
	if (null != (n = n.__) && null != n.__c)
		return (
			(n.__e = n.__c.base = null),
			n.__k.some(function (l) {
				if (null != l && null != l.__e) return (n.__e = n.__c.base = l.__e);
			}),
			P$1(n)
		);
}
function A$2(n) {
	((!n.__d && (n.__d = !0) && i$2.push(n) && !H$1.__r++) || r$1 != l$1.debounceRendering) &&
		((r$1 = l$1.debounceRendering) || o$1)(H$1);
}
function H$1() {
	try {
		for (var n, l = 1; i$2.length; ) (i$2.length > l && i$2.sort(e$1), (n = i$2.shift()), (l = i$2.length), I(n));
	} finally {
		i$2.length = H$1.__r = 0;
	}
}
function L(n, l, u, t, i, r, o, e, f, c, a) {
	var s,
		h,
		p,
		v,
		y,
		_,
		g = (t && t.__k) || w$1,
		m = l.length;
	for (f = T$2(u, l, g, f, m), s = 0; s < m; s++)
		null != (p = u.__k[s]) &&
			((h = (-1 != p.__i && g[p.__i]) || d$1),
			(p.__i = s),
			(_ = q$2(n, p, h, i, r, o, e, f, c, a)),
			(v = p.__e),
			p.ref && h.ref != p.ref && (h.ref && J$1(h.ref, null, p), a.push(p.ref, p.__c || v, p)),
			null == y && null != v && (y = v),
			4 & p.__u
				? ((f = j$2(p, f, n)), h.__e && (h.__e = null))
				: "function" == typeof p.type && void 0 !== _
					? (f = _)
					: v && (f = v.nextSibling),
			(p.__u &= -7));
	return ((u.__e = y), f);
}
function T$2(n, l, u, t, i) {
	var r,
		o,
		e,
		f,
		c,
		a = u.length,
		s = a,
		h = 0;
	for (n.__k = new Array(i), r = 0; r < i; r++)
		null != (o = l[r]) && "boolean" != typeof o && "function" != typeof o
			? ("string" == typeof o || "number" == typeof o || "bigint" == typeof o || o.constructor == String
					? (o = n.__k[r] = x(null, o, null, null, null))
					: g$1(o)
						? (o = n.__k[r] = x(S, { children: o }, null, null, null))
						: void 0 === o.constructor && o.__b > 0
							? (o = n.__k[r] = x(o.type, o.props, o.key, o.ref ? o.ref : null, o.__v))
							: (n.__k[r] = o),
				(f = r + h),
				(o.__ = n),
				(o.__b = n.__b + 1),
				(e = null),
				-1 != (c = o.__i = O$1(o, u, f, s)) && (s--, (e = u[c]) && (e.__u |= 2)),
				null == e || null == e.__v
					? (-1 == c && (i > a ? h-- : i < a && h++), "function" != typeof o.type && (o.__u |= 4))
					: c != f && (c == f - 1 ? h-- : c == f + 1 ? h++ : (c > f ? h-- : h++, (o.__u |= 4))))
			: (n.__k[r] = null);
	if (s) for (r = 0; r < a; r++) null != (e = u[r]) && 0 == (2 & e.__u) && (e.__e == t && (t = $(e)), K$1(e, e));
	return t;
}
function j$2(n, l, u) {
	var t, i;
	if ("function" == typeof n.type) {
		for (t = n.__k, i = 0; t && i < t.length; i++) t[i] && ((t[i].__ = n), (l = j$2(t[i], l, u)));
		return l;
	}
	n.__e != l && (l && n.type && !l.parentNode && (l = $(n)), (l = u.insertBefore(n.__e, l || null)));
	do l = l && l.nextSibling;
	while (null != l && 8 == l.nodeType);
	return l;
}
function F(n, l) {
	return (
		(l = l || []),
		null == n ||
			"boolean" == typeof n ||
			(g$1(n)
				? n.some(function (n) {
						F(n, l);
					})
				: l.push(n)),
		l
	);
}
function O$1(n, l, u, t) {
	var i,
		r,
		o,
		e = n.key,
		f = n.type,
		c = l[u],
		a = null != c && 0 == (2 & c.__u);
	if ((null === c && null == e) || (a && e == c.key && f == c.type)) return u;
	if (t > (a ? 1 : 0)) {
		for (i = u - 1, r = u + 1; i >= 0 || r < l.length; )
			if (null != (c = l[(o = i >= 0 ? i-- : r++)]) && 0 == (2 & c.__u) && e == c.key && f == c.type) return o;
	}
	return -1;
}
function z$1(n, l, u) {
	"-" == l[0]
		? n.setProperty(l, null == u ? "" : u)
		: (n[l] = null == u ? "" : "number" != typeof u || _.test(l) ? u : u + "px");
}
function N(n, l, u, t, i) {
	var r, o;
	n: if ("style" == l)
		if ("string" == typeof u) n.style.cssText = u;
		else {
			if (("string" == typeof t && (n.style.cssText = t = ""), t)) for (l in t) (u && l in u) || z$1(n.style, l, "");
			if (u) for (l in u) (t && u[l] == t[l]) || z$1(n.style, l, u[l]);
		}
	else if ("o" == l[0] && "n" == l[1])
		((r = l != (l = l.replace(s$1, "$1"))),
			(o = l.toLowerCase()),
			(l = o in n || "onFocusOut" == l || "onFocusIn" == l ? o.slice(2) : l.slice(2)),
			n.l || (n.l = {}),
			(n.l[l + r] = u),
			u
				? t
					? (u[a$1] = t[a$1])
					: ((u[a$1] = h$1), n.addEventListener(l, r ? v$1 : p$1, r))
				: n.removeEventListener(l, r ? v$1 : p$1, r));
	else {
		if ("http://www.w3.org/2000/svg" == i) l = l.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
		else if (
			"width" != l &&
			"height" != l &&
			"href" != l &&
			"list" != l &&
			"form" != l &&
			"tabIndex" != l &&
			"download" != l &&
			"rowSpan" != l &&
			"colSpan" != l &&
			"role" != l &&
			"popover" != l &&
			l in n
		)
			try {
				n[l] = null == u ? "" : u;
				break n;
			} catch (n) {}
		"function" == typeof u ||
			(null == u || (!1 === u && "-" != l[4])
				? n.removeAttribute(l)
				: n.setAttribute(l, "popover" == l && 1 == u ? "" : u));
	}
}
function V$1(n) {
	return function (u) {
		if (this.l) {
			var t = this.l[u.type + n];
			if (null == u[c$1]) u[c$1] = h$1++;
			else if (u[c$1] < t[a$1]) return;
			return t(l$1.event ? l$1.event(u) : u);
		}
	};
}
function q$2(n, u, t, i, r, o, e, f, c, a) {
	var s,
		h,
		p,
		v,
		y,
		d,
		_,
		k,
		x,
		M,
		I,
		P,
		A,
		H,
		T,
		j,
		F = u.type;
	if (void 0 !== u.constructor) return null;
	(128 & t.__u && ((c = !!(32 & t.__u)), (o = [(f = u.__e = t.__e)])), (s = l$1.__b) && s(u));
	n: if ("function" == typeof F) {
		h = e.length;
		try {
			if (
				((x = u.props),
				(M = F.prototype && F.prototype.render),
				(I = (s = F.contextType) && i[s.__c]),
				(P = s ? (I ? I.props.value : s.__) : i),
				t.__c
					? (k = (p = u.__c = t.__c).__ = p.__E)
					: (M ? (u.__c = p = new F(x, P)) : ((u.__c = p = new C$1(x, P)), (p.constructor = F), (p.render = Q$1)),
						I && I.sub(p),
						p.state || (p.state = {}),
						(p.__n = i),
						(v = p.__d = !0),
						(p.__h = []),
						(p._sb = [])),
				M && null == p.__s && (p.__s = p.state),
				M &&
					null != F.getDerivedStateFromProps &&
					(p.__s == p.state && (p.__s = m$1({}, p.__s)), m$1(p.__s, F.getDerivedStateFromProps(x, p.__s))),
				(y = p.props),
				(d = p.state),
				(p.__v = u),
				v)
			)
				(M && null == F.getDerivedStateFromProps && null != p.componentWillMount && p.componentWillMount(),
					M && null != p.componentDidMount && p.__h.push(p.componentDidMount));
			else {
				if (
					(M &&
						null == F.getDerivedStateFromProps &&
						x !== y &&
						null != p.componentWillReceiveProps &&
						p.componentWillReceiveProps(x, P),
					u.__v == t.__v || (!p.__e && null != p.shouldComponentUpdate && !1 === p.shouldComponentUpdate(x, p.__s, P)))
				) {
					(u.__v != t.__v && ((p.props = x), (p.state = p.__s), (p.__d = !1)),
						(u.__e = t.__e),
						(u.__k = t.__k),
						u.__k.some(function (n) {
							n && (n.__ = u);
						}),
						w$1.push.apply(p.__h, p._sb),
						(p._sb = []),
						p.__h.length && e.push(p),
						(f = $(t)));
					break n;
				}
				(null != p.componentWillUpdate && p.componentWillUpdate(x, p.__s, P),
					M &&
						null != p.componentDidUpdate &&
						p.__h.push(function () {
							p.componentDidUpdate(y, d, _);
						}));
			}
			if (((p.context = P), (p.props = x), (p.__P = n), (p.__e = !1), (A = l$1.__r), (H = 0), M))
				((p.state = p.__s),
					(p.__d = !1),
					A && A(u),
					(s = p.render(p.props, p.state, p.context)),
					w$1.push.apply(p.__h, p._sb),
					(p._sb = []));
			else
				do ((p.__d = !1), A && A(u), (s = p.render(p.props, p.state, p.context)), (p.state = p.__s));
				while (p.__d && ++H < 25);
			((p.state = p.__s),
				null != p.getChildContext && (i = m$1(m$1({}, i), p.getChildContext())),
				M && !v && null != p.getSnapshotBeforeUpdate && (_ = p.getSnapshotBeforeUpdate(y, d)),
				(T = null != s && s.type === S && null == s.key ? E$1(s.props.children) : s),
				(f = L(n, g$1(T) ? T : [T], u, t, i, r, o, e, f, c, a)),
				(p.base = u.__e),
				(u.__u &= -161),
				p.__h.length && e.push(p),
				k && (p.__E = p.__ = null));
		} catch (n) {
			if (((e.length = h), (u.__v = null), c || null != o)) {
				if (n.then) {
					for (u.__u |= c ? 160 : 128; f && 8 == f.nodeType && f.nextSibling; ) f = f.nextSibling;
					(null != o && (o[o.indexOf(f)] = null), (u.__e = f));
				} else if (null != o) for (j = o.length; j--; ) b(o[j]);
			} else u.__e = t.__e;
			((u.__k ??= t.__k || []), n.then || B$2(u), l$1.__e(n, u, t));
		}
	} else
		null == o && u.__v == t.__v ? ((u.__k = t.__k), (u.__e = t.__e)) : (f = u.__e = G$1(t.__e, u, t, i, r, o, e, c, a));
	return ((s = l$1.diffed) && s(u), 128 & u.__u ? void 0 : f);
}
function B$2(n) {
	n && (n.__c && (n.__c.__e = !0), n.__k && n.__k.some(B$2));
}
function D$1(n, u, t) {
	for (var i = 0; i < t.length; i++) J$1(t[i], t[++i], t[++i]);
	(l$1.__c && l$1.__c(u, n),
		n.some(function (u) {
			try {
				((n = u.__h),
					(u.__h = []),
					n.some(function (n) {
						n.call(u);
					}));
			} catch (n) {
				l$1.__e(n, u.__v);
			}
		}));
}
function E$1(n) {
	return "object" != typeof n || null == n || n.__b > 0
		? n
		: g$1(n)
			? n.map(E$1)
			: void 0 !== n.constructor
				? null
				: m$1({}, n);
}
function G$1(u, t, i, r, o, e, f, c, a) {
	var s,
		h,
		p,
		v,
		y,
		w,
		_,
		m = i.props || d$1,
		k = t.props,
		x = t.type;
	if (
		("svg" == x
			? (o = "http://www.w3.org/2000/svg")
			: "math" == x
				? (o = "http://www.w3.org/1998/Math/MathML")
				: o || (o = "http://www.w3.org/1999/xhtml"),
		null != e)
	) {
		for (s = 0; s < e.length; s++)
			if ((y = e[s]) && "setAttribute" in y == !!x && (x ? y.localName == x : 3 == y.nodeType)) {
				((u = y), (e[s] = null));
				break;
			}
	}
	if (null == u) {
		if (null == x) return document.createTextNode(k);
		((u = document.createElementNS(o, x, k.is && k)), c && (l$1.__m && l$1.__m(t, e), (c = !1)), (e = null));
	}
	if (null == x) m === k || (c && u.data == k) || (u.data = k);
	else {
		if (((e = "textarea" == x && null != k.defaultValue ? null : e && n.call(u.childNodes)), !c && null != e))
			for (m = {}, s = 0; s < u.attributes.length; s++) m[(y = u.attributes[s]).name] = y.value;
		for (s in m)
			((y = m[s]),
				"dangerouslySetInnerHTML" == s
					? (p = y)
					: "children" == s ||
						s in k ||
						("value" == s && "defaultValue" in k) ||
						("checked" == s && "defaultChecked" in k) ||
						N(u, s, null, y, o));
		for (s in k)
			((y = k[s]),
				"children" == s
					? (v = y)
					: "dangerouslySetInnerHTML" == s
						? (h = y)
						: "value" == s
							? (w = y)
							: "checked" == s
								? (_ = y)
								: (c && "function" != typeof y) || m[s] === y || N(u, s, y, m[s], o));
		if (h) (c || (p && (h.__html == p.__html || h.__html == u.innerHTML)) || (u.innerHTML = h.__html), (t.__k = []));
		else if (
			(p && (u.innerHTML = ""),
			L(
				"template" == t.type ? u.content : u,
				g$1(v) ? v : [v],
				t,
				i,
				r,
				"foreignObject" == x ? "http://www.w3.org/1999/xhtml" : o,
				e,
				f,
				e ? e[0] : i.__k && $(i, 0),
				c,
				a,
			),
			null != e)
		)
			for (s = e.length; s--; ) b(e[s]);
		(c && "textarea" != x) ||
			((s = "value"),
			"progress" == x && null == w
				? u.removeAttribute("value")
				: null != w && (w !== u[s] || ("progress" == x && !w) || ("option" == x && w != m[s])) && N(u, s, w, m[s], o),
			(s = "checked"),
			null != _ && _ != u[s] && N(u, s, _, m[s], o));
	}
	return u;
}
function J$1(n, u, t) {
	try {
		if ("function" == typeof n) {
			var i = "function" == typeof n.__u;
			(i && n.__u(), (i && null == u) || (n.__u = n(u)));
		} else n.current = u;
	} catch (n) {
		l$1.__e(n, t);
	}
}
function K$1(n, u, t) {
	var i, r;
	if (
		(l$1.unmount && l$1.unmount(n),
		(i = n.ref) && ((i.current && i.current != n.__e) || J$1(i, null, u)),
		null != (i = n.__c))
	) {
		if (i.componentWillUnmount)
			try {
				i.componentWillUnmount();
			} catch (n) {
				l$1.__e(n, u);
			}
		i.base = i.__P = i.__n = null;
	}
	if ((i = n.__k)) for (r = 0; r < i.length; r++) i[r] && K$1(i[r], u, t || "function" != typeof n.type);
	(t || b(n.__e), (n.__c = n.__ = n.__e = void 0));
}
function Q$1(n, l, u) {
	return this.constructor(n, u);
}
function R(u, t, i) {
	var r, o, e, f;
	(t == document && (t = document.documentElement),
		l$1.__ && l$1.__(u, t),
		(o = (r = "function" == typeof i) ? null : (i && i.__k) || t.__k),
		(e = []),
		(f = []),
		q$2(
			t,
			(u = ((!r && i) || t).__k = k$1(S, null, [u])),
			o || d$1,
			d$1,
			t.namespaceURI,
			!r && i ? [i] : o ? null : t.firstChild ? n.call(t.childNodes) : null,
			e,
			!r && i ? i : o ? o.__e : t.firstChild,
			r,
			f,
		),
		D$1(e, u, f),
		(u.props.children = null));
}
((n = w$1.slice),
	(l$1 = {
		__e: function (n, l, u, t) {
			for (var i, r, o; (l = l.__); )
				if ((i = l.__c) && !i.__)
					try {
						if (
							((r = i.constructor) &&
								null != r.getDerivedStateFromError &&
								(i.setState(r.getDerivedStateFromError(n)), (o = i.__d)),
							null != i.componentDidCatch && (i.componentDidCatch(n, t || {}), (o = i.__d)),
							o)
						)
							return (i.__E = i);
					} catch (l) {
						n = l;
					}
			throw n;
		},
	}),
	(u$2 = 0),
	(C$1.prototype.setState = function (n, l) {
		var u = null != this.__s && this.__s != this.state ? this.__s : (this.__s = m$1({}, this.state));
		("function" == typeof n && (n = n(m$1({}, u), this.props)),
			n && m$1(u, n),
			null != n && this.__v && (l && this._sb.push(l), A$2(this)));
	}),
	(C$1.prototype.forceUpdate = function (n) {
		this.__v && ((this.__e = !0), n && this.__h.push(n), A$2(this));
	}),
	(C$1.prototype.render = S),
	(i$2 = []),
	(o$1 = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout),
	(e$1 = function (n, l) {
		return n.__v.__b - l.__v.__b;
	}),
	(H$1.__r = 0),
	(f$2 = Math.random().toString(8)),
	(c$1 = "__d" + f$2),
	(a$1 = "__a" + f$2),
	(s$1 = /(PointerCapture)$|Capture$/i),
	(h$1 = 0),
	(p$1 = V$1(!1)),
	(v$1 = V$1(!0)));
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/hooks/dist/hooks.module.js
var t;
var r;
var u$1;
var i$1;
var o = 0;
var f$1 = [];
var c = l$1;
var e = c.__b;
var a = c.__r;
var v = c.diffed;
var l = c.__c;
var m = c.unmount;
var p = c.__;
function s(n, t) {
	(c.__h && c.__h(r, n, o || t), (o = 0));
	var u =
		r.__H ||
		(r.__H = {
			__: [],
			__h: [],
		});
	return (n >= u.__.length && u.__.push({}), u.__[n]);
}
function d(n) {
	return ((o = 1), y(D, n));
}
function y(n, u, i) {
	var o = s(t++, 2);
	if (
		((o.t = n),
		!o.__c &&
			((o.__ = [
				i ? i(u) : D(void 0, u),
				function (n) {
					var t = o.__N ? o.__N[0] : o.__[0],
						r = o.t(t, n);
					t !== r && ((o.__N = [r, o.__[1]]), o.__c.setState({}));
				},
			]),
			(o.__c = r),
			!r.__f))
	) {
		var f = function (n, t, r) {
			if (!o.__c.__H) return !0;
			var u = !1,
				i = o.__c.props !== n;
			if (
				(o.__c.__H.__.some(function (n) {
					if (n.__N) {
						u = !0;
						var t = n.__[0];
						((n.__ = n.__N), (n.__N = void 0), t !== n.__[0] && (i = !0));
					}
				}),
				c)
			) {
				var f = c.call(this, n, t, r);
				return u ? f || i : f;
			}
			return !u || i;
		};
		r.__f = !0;
		var c = r.shouldComponentUpdate,
			e = r.componentWillUpdate;
		((r.componentWillUpdate = function (n, t, r) {
			if (this.__e) {
				var u = c;
				((c = void 0), f(n, t, r), (c = u));
			}
			e && e.call(this, n, t, r);
		}),
			(r.shouldComponentUpdate = f));
	}
	return o.__N || o.__;
}
function h(n, u) {
	var i = s(t++, 3);
	!c.__s && C(i.__H, u) && ((i.__ = n), (i.u = u), r.__H.__h.push(i));
}
function A$1(n) {
	return (
		(o = 5),
		T$1(function () {
			return { current: n };
		}, [])
	);
}
function T$1(n, r) {
	var u = s(t++, 7);
	return (C(u.__H, r) && ((u.__ = n()), (u.__H = r), (u.__h = n)), u.__);
}
function q$1(n, t) {
	return (
		(o = 8),
		T$1(function () {
			return n;
		}, t)
	);
}
function j$1() {
	for (var n; (n = f$1.shift()); ) {
		var t = n.__H;
		if (n.__P && t)
			try {
				(t.__h.some(z), t.__h.some(B$1), (t.__h = []));
			} catch (r) {
				((t.__h = []), c.__e(r, n.__v));
			}
	}
}
((c.__b = function (n) {
	((r = null), e && e(n));
}),
	(c.__ = function (n, t) {
		(n && t.__k && t.__k.__m && (n.__m = t.__k.__m), p && p(n, t));
	}),
	(c.__r = function (n) {
		(a && a(n), (t = 0));
		var i = (r = n.__c).__H;
		(i &&
			(u$1 === r
				? ((i.__h = []),
					(r.__h = []),
					i.__.some(function (n) {
						(n.__N && (n.__ = n.__N), (n.u = n.__N = void 0));
					}))
				: (i.__h.some(z), i.__h.some(B$1), (i.__h = []), (t = 0))),
			(u$1 = r));
	}),
	(c.diffed = function (n) {
		v && v(n);
		var t = n.__c;
		(t &&
			t.__H &&
			(t.__H.__h.length &&
				((1 !== f$1.push(t) && i$1 === c.requestAnimationFrame) || ((i$1 = c.requestAnimationFrame) || w)(j$1)),
			t.__H.__.some(function (n) {
				n.u && ((n.__H = n.u), (n.u = void 0));
			})),
			(u$1 = r = null));
	}),
	(c.__c = function (n, t) {
		(t.some(function (n) {
			try {
				(n.__h.some(z),
					(n.__h = n.__h.filter(function (n) {
						return !n.__ || B$1(n);
					})));
			} catch (r) {
				(t.some(function (n) {
					n.__h && (n.__h = []);
				}),
					(t = []),
					c.__e(r, n.__v));
			}
		}),
			l && l(n, t));
	}),
	(c.unmount = function (n) {
		m && m(n);
		var t,
			r = n.__c;
		r &&
			r.__H &&
			(r.__H.__.some(function (n) {
				try {
					z(n);
				} catch (n) {
					t = n;
				}
			}),
			(r.__H = void 0),
			t && c.__e(t, r.__v));
	}));
var k = "function" == typeof requestAnimationFrame;
function w(n) {
	var t,
		r = function () {
			(clearTimeout(u), k && cancelAnimationFrame(t), setTimeout(n));
		},
		u = setTimeout(r, 35);
	k && (t = requestAnimationFrame(r));
}
function z(n) {
	var t = r,
		u = n.__c;
	("function" == typeof u && ((n.__c = void 0), u()), (r = t));
}
function B$1(n) {
	var t = r;
	((n.__c = n.__()), (r = t));
}
function C(n, t) {
	return (
		!n ||
		n.length !== t.length ||
		t.some(function (t, r) {
			return t !== n[r];
		})
	);
}
function D(n, t) {
	return "function" == typeof t ? t(n) : t;
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/dist/compat.module.js
function g(n, t) {
	for (var e in t) n[e] = t[e];
	return n;
}
function E(n, t) {
	for (var e in n) if ("__source" !== e && !(e in t)) return !0;
	for (var r in t) if ("__source" !== r && n[r] !== t[r]) return !0;
	return !1;
}
function M(n, t) {
	((this.props = n), (this.context = t));
}
(((M.prototype = new C$1()).isPureReactComponent = !0),
	(M.prototype.shouldComponentUpdate = function (n, t) {
		return E(this.props, n) || E(this.state, t);
	}));
var T = l$1.__b;
l$1.__b = function (n) {
	(n.type && n.type.__f && n.ref && ((n.props.ref = n.ref), (n.ref = null)), T && T(n));
};
"undefined" != typeof Symbol && Symbol.for;
var O = l$1.__e;
l$1.__e = function (n, t, e, r) {
	if (n.then) {
		for (var u, o = t; (o = o.__); )
			if ((u = o.__c) && u.__c) return (t.__e ?? ((t.__e = e.__e), (t.__k = e.__k || [])), u.__c(n, t));
	}
	O(n, t, e, r);
};
var U = l$1.unmount;
function V(n, t, e) {
	return (
		n &&
			(n.__c &&
				n.__c.__H &&
				(n.__c.__H.__.forEach(function (n) {
					"function" == typeof n.__c && n.__c();
				}),
				(n.__c.__H = null)),
			null != (n = g({}, n)).__c && (n.__c.__P === e && (n.__c.__P = t), (n.__c.__e = !0), (n.__c = null)),
			(n.__k =
				n.__k &&
				n.__k.map(function (n) {
					return V(n, t, e);
				}))),
		n
	);
}
function W(n, t, e) {
	return (
		n &&
			e &&
			((n.__v = null),
			(n.__k =
				n.__k &&
				n.__k.map(function (n) {
					return W(n, t, e);
				})),
			n.__c && n.__c.__P === t && (n.__e && e.appendChild(n.__e), (n.__c.__e = !0), (n.__c.__P = e))),
		n
	);
}
function P() {
	((this.__u = 0), (this.o = null), (this.__b = null));
}
function j(n) {
	var t = n.__ && n.__.__c;
	return t && t.__a && t.__a(n);
}
function B() {
	((this.i = null), (this.l = null));
}
((l$1.unmount = function (n) {
	var t = n.__c;
	(t && (t.__z = !0), t && t.__R && t.__R(), t && 32 & n.__u && (n.type = null), U && U(n));
}),
	((P.prototype = new C$1()).__c = function (n, t) {
		var e = t.__c,
			r = this;
		((r.o ??= []), r.o.push(e));
		var u = j(r.__v),
			o = !1,
			i = function () {
				o || r.__z || ((o = !0), (e.__R = null), u ? u(f) : f());
			};
		e.__R = i;
		var l = e.__P;
		e.__P = null;
		var f = function () {
			if (!--r.__u) {
				if (r.state.__a) {
					var n = r.state.__a;
					r.__v.__k[0] = W(n, n.__c.__P, n.__c.__O);
				}
				var t;
				for (r.setState({ __a: (r.__b = null) }); (t = r.o.pop()); ) ((t.__P = l), t.forceUpdate());
			}
		};
		(r.__u++ || 32 & t.__u || r.setState({ __a: (r.__b = r.__v.__k[0]) }), n.then(i, i));
	}),
	(P.prototype.componentWillUnmount = function () {
		this.o = [];
	}),
	(P.prototype.render = function (n, e) {
		if (this.__b) {
			if (this.__v.__k) {
				var r = document.createElement("div"),
					o = this.__v.__k[0].__c;
				this.__v.__k[0] = V(this.__b, r, (o.__O = o.__P));
			}
			this.__b = null;
		}
		var i = e.__a && k$1(S, null, n.fallback);
		return (i && (i.__u &= -33), [k$1(S, null, e.__a ? null : n.children), i]);
	}));
var H = function (n, t, e) {
	if ((++e[1] === e[0] && n.l.delete(t), n.props.revealOrder && ("t" !== n.props.revealOrder[0] || !n.l.size)))
		for (e = n.i; e; ) {
			for (; e.length > 3; ) e.pop()();
			if (e[1] < e[0]) break;
			n.i = e = e[2];
		}
};
(((B.prototype = new C$1()).__a = function (n) {
	var t = this,
		e = j(t.__v),
		r = t.l.get(n);
	return (
		r[0]++,
		function (u) {
			var o = function () {
				t.props.revealOrder ? (r.push(u), H(t, n, r)) : u();
			};
			e ? e(o) : o();
		}
	);
}),
	(B.prototype.render = function (n) {
		((this.i = null), (this.l = /* @__PURE__ */ new Map()));
		var t = F(n.children);
		n.revealOrder && "b" === n.revealOrder[0] && t.reverse();
		for (var e = t.length; e--; ) this.l.set(t[e], (this.i = [1, 0, this.i]));
		return n.children;
	}),
	(B.prototype.componentDidUpdate = B.prototype.componentDidMount =
		function () {
			var n = this;
			this.l.forEach(function (t, e) {
				H(n, e, t);
			});
		}));
var q = ("undefined" != typeof Symbol && Symbol.for && Symbol.for("react.element")) || 60103;
var G =
	/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/;
var J = /^on(Ani|Tra|Tou|BeforeInp|Compo)/;
var K = /[A-Z0-9]/g;
var Q = "undefined" != typeof document;
var X = function (n) {
	return ("undefined" != typeof Symbol && "symbol" == typeof Symbol() ? /fil|che|rad/ : /fil|che|ra/).test(n);
};
function nn(n, t, e) {
	return (t.__k ?? (t.textContent = ""), R(n, t), "function" == typeof e && e(), n ? n.__c : null);
}
((C$1.prototype.isReactComponent = !0),
	["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function (t) {
		Object.defineProperty(C$1.prototype, t, {
			configurable: !0,
			get: function () {
				return this["UNSAFE_" + t];
			},
			set: function (n) {
				Object.defineProperty(this, t, {
					configurable: !0,
					writable: !0,
					value: n,
				});
			},
		});
	}));
var en = l$1.event;
l$1.event = function (n) {
	return (
		en && (n = en(n)),
		(n.persist = function () {}),
		(n.isPropagationStopped = function () {
			return this.cancelBubble;
		}),
		(n.isDefaultPrevented = function () {
			return this.defaultPrevented;
		}),
		(n.nativeEvent = n)
	);
};
var un = {
	configurable: !0,
	get: function () {
		return this.class;
	},
};
var on = l$1.vnode;
l$1.vnode = function (n) {
	("string" == typeof n.type &&
		(function (n) {
			var t = n.props,
				e = n.type,
				u = {},
				o = -1 == e.indexOf("-");
			for (var i in t) {
				var l = t[i];
				if (
					!(
						("value" === i && "defaultValue" in t && null == l) ||
						(Q && "children" === i && "noscript" === e) ||
						"class" === i ||
						"className" === i
					)
				) {
					var f = i.toLowerCase();
					("defaultValue" === i && "value" in t && null == t.value
						? (i = "value")
						: "download" === i && !0 === l
							? (l = "")
							: "translate" === f && "no" === l
								? (l = !1)
								: "o" === f[0] && "n" === f[1]
									? "ondoubleclick" === f
										? (i = "ondblclick")
										: "onchange" !== f || ("input" !== e && "textarea" !== e) || X(t.type)
											? "onfocus" === f
												? (i = "onfocusin")
												: "onblur" === f
													? (i = "onfocusout")
													: J.test(i) && (i = f)
											: (f = i = "oninput")
									: o && G.test(i)
										? (i = i.replace(K, "-$&").toLowerCase())
										: null === l && (l = void 0),
						"oninput" === f && u[(i = f)] && (i = "oninputCapture"),
						(u[i] = l));
				}
			}
			("select" == e &&
				(u.multiple &&
					Array.isArray(u.value) &&
					(u.value = F(t.children).forEach(function (n) {
						n.props.selected = -1 != u.value.indexOf(n.props.value);
					})),
				null != u.defaultValue &&
					(u.value = F(t.children).forEach(function (n) {
						n.props.selected = u.multiple
							? -1 != u.defaultValue.indexOf(n.props.value)
							: u.defaultValue == n.props.value;
					}))),
				t.class && !t.className
					? ((u.class = t.class), Object.defineProperty(u, "className", un))
					: t.className && (u.class = u.className = t.className),
				(n.props = u));
		})(n),
		(n.$$typeof = q),
		on && on(n));
};
var ln = l$1.__r;
l$1.__r = function (n) {
	(ln && ln(n), n.__c);
};
var fn = l$1.diffed;
l$1.diffed = function (n) {
	fn && fn(n);
	var t = n.props,
		e = n.__e;
	null != e &&
		"textarea" === n.type &&
		"value" in t &&
		t.value !== e.value &&
		(e.value = null == t.value ? "" : t.value);
};
function pn(n) {
	return !!n.__k && (R(null, n), !0);
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/client.mjs
function createRoot(container) {
	return {
		render: function (children) {
			nn(children, container);
		},
		unmount: function () {
			pn(container);
		},
	};
}
//#endregion
//#region src/retry.ts
/** Back-off delays after a 429, one per retry. */
var RETRY_429_DELAYS_MS = [3e3, 6e3];
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function get_error_status(error) {
	if (error instanceof Error && "status" in error && typeof error.status === "number") return error.status;
}
function get_error_message(error) {
	return error instanceof Error ? error.message : String(error);
}
/**
 * `client.fetchJson` with the shared 429 back-off: a rate-limited call is retried with the
 * exact same body (including any cursor) after 3s, then 6s, then the error propagates.
 */
async function fetch_json_with_429_retry(client, path, body) {
	for (let attempt = 0; ; attempt += 1)
		try {
			return await client.fetchJson(path, { body });
		} catch (error) {
			const delay_ms = RETRY_429_DELAYS_MS[attempt];
			if (get_error_status(error) === 429 && delay_ms !== void 0) {
				await sleep(delay_ms);
				continue;
			}
			throw error;
		}
}
/** Prefixes the server filters each page by; only media files come back. */
var MEDIA_CONTENT_TYPE_PREFIXES = ["image/", "video/"];
function create_list_scan(client) {
	let cursor = null;
	let source_is_done = false;
	const pending_items = [];
	const seen_node_ids = /* @__PURE__ */ new Set();
	return {
		async load_next() {
			const items = pending_items.splice(0, 12);
			let error_message = null;
			try {
				for (let pages = 0; items.length < 12 && !source_is_done && pages < 30; pages += 1) {
					const page = await fetch_json_with_429_retry(client, "/api/v1/files/list", {
						recursive: true,
						limit: 100,
						cursor,
						kind: "file",
						contentTypePrefixes: MEDIA_CONTENT_TYPE_PREFIXES,
					});
					cursor = page.cursor;
					source_is_done = page.isDone;
					for (const item of page.items) {
						if (seen_node_ids.has(item.nodeId)) continue;
						seen_node_ids.add(item.nodeId);
						if (items.length < 12) items.push(item);
						else pending_items.push(item);
					}
				}
			} catch (error) {
				error_message = get_error_message(error);
			}
			return {
				items,
				errorMessage: error_message,
			};
		},
		has_more() {
			return !(source_is_done && pending_items.length === 0);
		},
	};
}
function create_media_url_manager(client) {
	const cache = /* @__PURE__ */ new Map();
	const pending = /* @__PURE__ */ new Map();
	const waiters = [];
	let active_requests = 0;
	const batch_queue = [];
	let batch_flush_active = false;
	function acquire_slot() {
		if (active_requests < 4) {
			active_requests += 1;
			return Promise.resolve();
		}
		return new Promise((resolve) => waiters.push(resolve));
	}
	function release_slot() {
		const next = waiters.shift();
		if (next) next();
		else active_requests -= 1;
	}
	function request_download_url(nodeId) {
		const in_flight = pending.get(nodeId);
		if (in_flight) return in_flight;
		const request = (async () => {
			await acquire_slot();
			try {
				const response = await fetch_json_with_429_retry(client, "/api/v1/files/download-urls", {
					fileNodeIds: [nodeId],
				});
				const item = response.items[0];
				if (!item) throw new Error(response.errors[0]?.message ?? "Not found");
				const media = {
					url: item.url,
					expiresAt: item.expiresAt,
				};
				cache.set(nodeId, media);
				return media;
			} finally {
				release_slot();
				pending.delete(nodeId);
			}
		})();
		pending.set(nodeId, request);
		return request;
	}
	function request_download_url_batched(nodeId) {
		const in_flight = pending.get(nodeId);
		if (in_flight) return in_flight;
		const request = new Promise((resolve, reject) => {
			batch_queue.push({
				nodeId,
				resolve,
				reject,
			});
		});
		pending.set(nodeId, request);
		if (!batch_flush_active) {
			batch_flush_active = true;
			setTimeout(() => void flush_batch_queue(), 0);
		}
		return request;
	}
	async function flush_batch_queue() {
		while (batch_queue.length > 0) {
			const entries = batch_queue.splice(0, 12);
			await acquire_slot();
			try {
				const response = await fetch_json_with_429_retry(client, "/api/v1/files/download-urls", {
					fileNodeIds: entries.map((entry) => entry.nodeId),
				});
				const items_by_node_id = new Map(response.items.map((item) => [item.fileNodeId, item]));
				const errors_by_node_id = new Map(response.errors.map((item) => [item.fileNodeId, item.message]));
				for (const entry of entries) {
					pending.delete(entry.nodeId);
					const item = items_by_node_id.get(entry.nodeId);
					if (item) {
						const media = {
							url: item.url,
							expiresAt: item.expiresAt,
						};
						cache.set(entry.nodeId, media);
						entry.resolve(media);
					} else entry.reject(new Error(errors_by_node_id.get(entry.nodeId) ?? "Not found"));
				}
			} catch (error) {
				for (const entry of entries) {
					pending.delete(entry.nodeId);
					entry.reject(error);
				}
			} finally {
				release_slot();
			}
		}
		batch_flush_active = false;
	}
	return {
		get_url(nodeId) {
			const cached = cache.get(nodeId);
			if (cached && Date.now() < cached.expiresAt - 6e4) return Promise.resolve(cached);
			return request_download_url_batched(nodeId);
		},
		get_fresh_url(nodeId) {
			return request_download_url(nodeId);
		},
	};
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
var f = 0;
Array.isArray;
function u(e, t, n, o, i, u) {
	t || (t = {});
	var a,
		c,
		p = t;
	if ("ref" in p) for (c in ((p = {}), t)) "ref" == c ? (a = t[c]) : (p[c] = t[c]);
	var l = {
		type: e,
		props: p,
		key: n,
		ref: a,
		__k: null,
		__: null,
		__b: 0,
		__e: null,
		__c: null,
		constructor: void 0,
		__v: --f,
		__i: -1,
		__u: 0,
		__source: i,
		__self: u,
	};
	if ("function" == typeof e && (a = e.defaultProps)) for (c in a) void 0 === p[c] && (p[c] = a[c]);
	return (l$1.vnode && l$1.vnode(l), l);
}
//#endregion
//#region src/app.tsx
function parse_route(hash) {
	const match = /^#\/file\/(.+)$/.exec(hash);
	if (match)
		return {
			view: "file",
			nodeId: decodeURIComponent(match[1]),
		};
	return { view: "grid" };
}
function App(props) {
	const media = T$1(() => create_media_url_manager(props.client), [props.client]);
	const scan = T$1(() => create_list_scan(props.client), [props.client]);
	const [route, setRoute] = d(() => parse_route(window.location.hash));
	const [items, setItems] = d([]);
	const [hasMore, setHasMore] = d(true);
	const [loading, setLoading] = d(false);
	const [error, setError] = d(null);
	const loadingRef = A$1(false);
	h(() => {
		const handle_hash_change = () => setRoute(parse_route(window.location.hash));
		window.addEventListener("hashchange", handle_hash_change);
		return () => window.removeEventListener("hashchange", handle_hash_change);
	}, []);
	const load_more = q$1(async () => {
		if (loadingRef.current) return;
		loadingRef.current = true;
		setLoading(true);
		setError(null);
		const result = await scan.load_next();
		if (result.items.length > 0) setItems((prev) => [...prev, ...result.items]);
		setError(result.errorMessage);
		setHasMore(scan.has_more());
		loadingRef.current = false;
		setLoading(false);
	}, [scan]);
	h(() => {
		load_more();
	}, [load_more]);
	if (route.view === "file") {
		const item = items.find((candidate) => candidate.nodeId === route.nodeId);
		return /* @__PURE__ */ u(FileDetail, {
			nodeId: route.nodeId,
			item,
			media,
		});
	}
	return /* @__PURE__ */ u("div", {
		className: "gallery",
		children: [
			/* @__PURE__ */ u("header", {
				className: "gallery-header",
				children: /* @__PURE__ */ u("h1", { children: "Gallery" }),
			}),
			items.length > 0
				? /* @__PURE__ */ u("div", {
						className: "gallery-grid",
						children: items.map((item) =>
							/* @__PURE__ */ u(
								GalleryTile,
								{
									item,
									media,
								},
								item.nodeId,
							),
						),
					})
				: null,
			loading
				? /* @__PURE__ */ u("div", {
						className: "gallery-status",
						role: "status",
						"aria-live": "polite",
						children: "Loading…",
					})
				: null,
			error !== null
				? /* @__PURE__ */ u("div", {
						className: "gallery-status is-error",
						role: "alert",
						children: [
							/* @__PURE__ */ u("span", { children: error }),
							/* @__PURE__ */ u("button", {
								className: "button",
								onClick: () => void load_more(),
								children: "Retry",
							}),
						],
					})
				: null,
			!loading && error === null && !hasMore && items.length === 0
				? /* @__PURE__ */ u("div", {
						className: "gallery-status",
						children: "No images or videos yet.",
					})
				: null,
			hasMore && !loading && error === null
				? /* @__PURE__ */ u("div", {
						className: "gallery-more",
						children: /* @__PURE__ */ u("button", {
							className: "button",
							onClick: () => void load_more(),
							children: "Load more",
						}),
					})
				: null,
			items.length > 0
				? /* @__PURE__ */ u("div", {
						className: "gallery-count",
						children: [items.length, " item", items.length === 1 ? "" : "s"],
					})
				: null,
		],
	});
}
/**
 * A component's signed media URL with failure recovery: one automatic renewal per failure
 * episode (`notify_load_error`), reset only by a successful load (`notify_load_success`),
 * then a manual `retry`. Initial requests coalesce into the manager's batched calls;
 * renewals go through its single-node pool — both with per-node dedup.
 */
function use_media_url(media, nodeId) {
	const [mediaUrl, setMediaUrl] = d(null);
	const [errorMessage, setErrorMessage] = d(null);
	const autoRenewSpentRef = A$1(false);
	const generationRef = A$1(0);
	const request_url = q$1(
		(fresh) => {
			const generation = generationRef.current;
			(fresh ? media.get_fresh_url(nodeId) : media.get_url(nodeId)).then(
				(media_url) => {
					if (generationRef.current === generation) {
						setMediaUrl(media_url);
						setErrorMessage(null);
					}
				},
				(error) => {
					if (generationRef.current === generation) {
						setMediaUrl(null);
						setErrorMessage(get_error_message(error));
					}
				},
			);
		},
		[media, nodeId],
	);
	h(() => {
		autoRenewSpentRef.current = false;
		setMediaUrl(null);
		setErrorMessage(null);
		request_url(false);
		return () => {
			generationRef.current += 1;
		};
	}, [request_url]);
	return {
		mediaUrl,
		errorMessage,
		notify_load_success: q$1(() => {
			autoRenewSpentRef.current = false;
		}, []),
		notify_load_error: q$1(() => {
			if (autoRenewSpentRef.current) {
				setMediaUrl(null);
				setErrorMessage("Failed to load media");
				return;
			}
			autoRenewSpentRef.current = true;
			request_url(true);
		}, [request_url]),
		retry: q$1(() => {
			setErrorMessage(null);
			request_url(true);
		}, [request_url]),
	};
}
function GalleryTile(props) {
	const media_url = use_media_url(props.media, props.item.nodeId);
	const is_video = props.item.contentType !== null && props.item.contentType.startsWith("video/");
	return /* @__PURE__ */ u("div", {
		className: "tile",
		children: [
			/* @__PURE__ */ u("a", {
				className: "tile-link",
				href: `#/file/${encodeURIComponent(props.item.nodeId)}`,
				children: [
					media_url.mediaUrl === null
						? /* @__PURE__ */ u("span", {
								className: media_url.errorMessage !== null ? "tile-placeholder is-failed" : "tile-placeholder",
							})
						: is_video
							? /* @__PURE__ */ u(S, {
									children: [
										/* @__PURE__ */ u("video", {
											className: "tile-media",
											src: media_url.mediaUrl.url,
											preload: "metadata",
											muted: true,
											onLoadedMetadata: media_url.notify_load_success,
											onError: media_url.notify_load_error,
										}),
										/* @__PURE__ */ u("span", {
											className: "tile-play",
											"aria-hidden": "true",
											children: "▶",
										}),
									],
								})
							: /* @__PURE__ */ u("img", {
									className: "tile-media",
									src: media_url.mediaUrl.url,
									alt: "",
									loading: "lazy",
									onLoad: media_url.notify_load_success,
									onError: media_url.notify_load_error,
								}),
					/* @__PURE__ */ u("span", {
						className: "tile-name",
						children: props.item.name,
					}),
				],
			}),
			media_url.errorMessage !== null
				? /* @__PURE__ */ u("button", {
						className: "button tile-retry",
						"aria-label": `Retry ${props.item.name}`,
						onClick: media_url.retry,
						children: "Retry",
					})
				: null,
		],
	});
}
function FileDetail(props) {
	const media_url = use_media_url(props.media, props.nodeId);
	const videoRef = A$1(null);
	const restoreRef = A$1(null);
	const handle_video_error = q$1(() => {
		const video = videoRef.current;
		if (video && Number.isFinite(video.currentTime))
			restoreRef.current = {
				currentTime: video.currentTime,
				paused: video.paused,
			};
		media_url.notify_load_error();
	}, [media_url.notify_load_error]);
	const handle_video_loaded_metadata = q$1(() => {
		media_url.notify_load_success();
		const video = videoRef.current;
		if (!video) return;
		const restore = restoreRef.current;
		restoreRef.current = null;
		if (restore) {
			video.currentTime = restore.currentTime;
			if (!restore.paused) video.play().catch(() => {});
		} else video.play().catch(() => {});
	}, [media_url.notify_load_success]);
	const item = props.item;
	const is_video = item !== void 0 && item.contentType !== null && item.contentType.startsWith("video/");
	return /* @__PURE__ */ u("div", {
		className: "viewer",
		children: [
			/* @__PURE__ */ u("div", {
				className: "viewer-topbar",
				children: [
					/* @__PURE__ */ u("a", {
						className: "viewer-back",
						href: "#/",
						children: "← Gallery",
					}),
					item !== void 0
						? /* @__PURE__ */ u("div", {
								className: "viewer-titles",
								children: [
									/* @__PURE__ */ u("div", {
										className: "viewer-name",
										children: item.name,
									}),
									/* @__PURE__ */ u("div", {
										className: "viewer-meta",
										children: [
											item.contentType ?? "unknown type",
											" · ",
											item.path,
											" · ",
											new Date(item.updatedAt).toLocaleString(),
										],
									}),
								],
							})
						: null,
				],
			}),
			/* @__PURE__ */ u("div", {
				className: "viewer-stage",
				children:
					media_url.errorMessage !== null
						? /* @__PURE__ */ u("div", {
								className: "viewer-status is-error",
								role: "alert",
								children: [
									/* @__PURE__ */ u("span", { children: media_url.errorMessage }),
									/* @__PURE__ */ u("button", {
										className: "button",
										onClick: media_url.retry,
										children: "Retry",
									}),
								],
							})
						: media_url.mediaUrl === null
							? /* @__PURE__ */ u("div", {
									className: "viewer-status",
									role: "status",
									"aria-live": "polite",
									children: "Loading…",
								})
							: is_video
								? /* @__PURE__ */ u("video", {
										ref: videoRef,
										src: media_url.mediaUrl.url,
										controls: true,
										onLoadedMetadata: handle_video_loaded_metadata,
										onError: handle_video_error,
									})
								: /* @__PURE__ */ u("img", {
										src: media_url.mediaUrl.url,
										alt: item !== void 0 ? item.name : "File preview",
										onLoad: media_url.notify_load_success,
										onError: media_url.notify_load_error,
									}),
			}),
		],
	});
}
//#endregion
//#region src/main.tsx
function BootScreen(props) {
	return /* @__PURE__ */ u("div", {
		className: props.isError ? "boot-screen is-error" : "boot-screen",
		role: props.isError ? "alert" : "status",
		"aria-live": props.isError ? void 0 : "polite",
		children: props.message,
	});
}
var container = document.getElementById("root");
if (!container) throw new Error("index.html is missing the #root element");
var root = createRoot(container);
root.render(/* @__PURE__ */ u(BootScreen, { message: "Connecting…" }));
bonobo_ui_connect().then(
	(client) => {
		if (client.context.kind === "page") document.title = client.context.pageTitle;
		root.render(/* @__PURE__ */ u(App, { client }));
	},
	(error) => {
		root.render(
			/* @__PURE__ */ u(BootScreen, {
				message: error instanceof Error ? error.message : String(error),
				isError: true,
			}),
		);
	},
);
//#endregion
