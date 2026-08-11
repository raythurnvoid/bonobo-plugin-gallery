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
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/constants.js
/** Reset all mode flags */
var RESET_MODE = -161;
var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
var XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
var MATH_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
var EMPTY_OBJ = {};
var EMPTY_ARR = [];
var IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/util.js
var isArray$1 = Array.isArray;
/**
 * Assign properties from `props` to `obj`
 * @template O, P The obj and props types
 * @param {O} obj The object to copy properties to
 * @param {P} props The object to copy properties from
 * @returns {O & P}
 */
function assign$1(obj, props) {
	for (let i in props) obj[i] = props[i];
	return obj;
}
/**
 * Remove a child node from its parent if attached. This is a workaround for
 * IE11 which doesn't support `Element.prototype.remove()`. Using this function
 * is smaller than including a dedicated polyfill.
 * @param {import('./index').ContainerNode} node The node to remove
 */
function removeNode(node) {
	if (node && node.parentNode) node.parentNode.removeChild(node);
}
var slice = EMPTY_ARR.slice;
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/diff/catch-error.js
/**
 * Find the closest error boundary to a thrown error and call it
 * @param {object} error The thrown value
 * @param {import('../internal').VNode} vnode The vnode that threw the error that was caught (except
 * for unmounting when this parameter is the highest parent that was being
 * unmounted)
 * @param {import('../internal').VNode} [oldVNode]
 * @param {import('../internal').ErrorInfo} [errorInfo]
 */
function _catchError(error, vnode, oldVNode, errorInfo) {
	/** @type {import('../internal').Component} */
	let component, ctor, handled;
	for (; (vnode = vnode._parent); )
		if ((component = vnode._component) && !component._processingException)
			try {
				ctor = component.constructor;
				if (ctor && ctor.getDerivedStateFromError != null) {
					component.setState(ctor.getDerivedStateFromError(error));
					handled = component._dirty;
				}
				if (component.componentDidCatch != null) {
					component.componentDidCatch(error, errorInfo || {});
					handled = component._dirty;
				}
				if (handled) return (component._pendingError = component);
			} catch (e) {
				error = e;
			}
	throw error;
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/options.js
/**
 * The `option` object can potentially contain callback functions
 * that are called during various stages of our renderer. This is the
 * foundation on which all our addons like `preact/debug`, `preact/compat`,
 * and `preact/hooks` are based on. See the `Options` type in `internal.d.ts`
 * for a full list of available option hooks (most editors/IDEs allow you to
 * ctrl+click or cmd+click on mac the type definition below).
 * @type {import('./internal').Options}
 */
var options$1 = { _catchError };
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/create-element.js
var vnodeId$1 = 0;
/**
 * Create an virtual node (used for JSX)
 * @param {import('./internal').VNode["type"]} type The node name or Component constructor for this
 * virtual node
 * @param {object | null | undefined} [props] The properties of the virtual node
 * @param {Array<import('.').ComponentChildren>} [children] The children of the
 * virtual node
 * @returns {import('./internal').VNode}
 */
function createElement(type, props, children) {
	let normalizedProps = {},
		key,
		ref,
		i;
	for (i in props)
		if (i == "key") key = props[i];
		else if (i == "ref") ref = props[i];
		else normalizedProps[i] = props[i];
	if (arguments.length > 2) normalizedProps.children = arguments.length > 3 ? slice.call(arguments, 2) : children;
	if (typeof type == "function" && type.defaultProps != null) {
		for (i in type.defaultProps) if (normalizedProps[i] === void 0) normalizedProps[i] = type.defaultProps[i];
	}
	return createVNode$1(type, normalizedProps, key, ref, null);
}
/**
 * Create a VNode (used internally by Preact)
 * @param {import('./internal').VNode["type"]} type The node name or Component
 * Constructor for this virtual node
 * @param {object | string | number | null} props The properties of this virtual node.
 * If this virtual node represents a text node, this is the text of the node (string or number).
 * @param {string | number | null} key The key for this virtual node, used when
 * diffing it against its children
 * @param {import('./internal').VNode["ref"]} ref The ref property that will
 * receive a reference to its created child
 * @returns {import('./internal').VNode}
 */
function createVNode$1(type, props, key, ref, original) {
	/** @type {import('./internal').VNode} */
	const vnode = {
		type,
		props,
		key,
		ref,
		_children: null,
		_parent: null,
		_depth: 0,
		_dom: null,
		_component: null,
		constructor: void 0,
		_original: original == null ? ++vnodeId$1 : original,
		_index: -1,
		_flags: 0,
	};
	if (original == null && options$1.vnode != null) options$1.vnode(vnode);
	return vnode;
}
function Fragment(props) {
	return props.children;
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/component.js
/**
 * Base Component class. Provides `setState()` and `forceUpdate()`, which
 * trigger rendering
 * @param {object} props The initial component props
 * @param {object} context The initial context from parent components'
 * getChildContext
 */
function BaseComponent(props, context) {
	this.props = props;
	this.context = context;
}
/**
 * Update component state and schedule a re-render.
 * @this {import('./internal').Component}
 * @param {object | ((s: object, p: object) => object)} update A hash of state
 * properties to update with new values or a function that given the current
 * state and props returns a new partial state
 * @param {() => void} [callback] A function to be called once component state is
 * updated
 */
BaseComponent.prototype.setState = function (update, callback) {
	let s;
	if (this._nextState != null && this._nextState != this.state) s = this._nextState;
	else s = this._nextState = assign$1({}, this.state);
	if (typeof update == "function") update = update(assign$1({}, s), this.props);
	if (update) assign$1(s, update);
	if (update == null) return;
	if (this._vnode) {
		if (callback) this._stateCallbacks.push(callback);
		enqueueRender(this);
	}
};
/**
 * Immediately perform a synchronous re-render of the component
 * @this {import('./internal').Component}
 * @param {() => void} [callback] A function to be called after component is
 * re-rendered
 */
BaseComponent.prototype.forceUpdate = function (callback) {
	if (this._vnode) {
		this._force = true;
		if (callback) this._renderCallbacks.push(callback);
		enqueueRender(this);
	}
};
/**
 * Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
 * Virtual DOM is generally constructed via [JSX](https://jasonformat.com/wtf-is-jsx).
 * @param {object} props Props (eg: JSX attributes) received from parent
 * element/component
 * @param {object} state The component's current state
 * @param {object} context Context object, as returned by the nearest
 * ancestor's `getChildContext()`
 * @returns {ComponentChildren | void}
 */
BaseComponent.prototype.render = Fragment;
/**
 * @param {import('./internal').VNode} vnode
 * @param {number | null} [childIndex]
 */
function getDomSibling(vnode, childIndex) {
	if (childIndex == null) return vnode._parent ? getDomSibling(vnode._parent, vnode._index + 1) : null;
	let sibling;
	for (; childIndex < vnode._children.length; childIndex++) {
		sibling = vnode._children[childIndex];
		if (sibling != null && sibling._dom != null) return sibling._dom;
	}
	return typeof vnode.type == "function" ? getDomSibling(vnode) : null;
}
/**
 * Trigger in-place re-rendering of a component.
 * @param {import('./internal').Component} component The component to rerender
 */
function renderComponent(component) {
	if (component._parentDom && component._dirty) {
		let oldVNode = component._vnode,
			oldDom = oldVNode._dom,
			commitQueue = [],
			refQueue = [],
			newVNode = assign$1({}, oldVNode);
		newVNode._original = oldVNode._original + 1;
		if (options$1.vnode) options$1.vnode(newVNode);
		diff(
			component._parentDom,
			newVNode,
			oldVNode,
			component._globalContext,
			component._parentDom.namespaceURI,
			oldVNode._flags & 32 ? [oldDom] : null,
			commitQueue,
			oldDom == null ? getDomSibling(oldVNode) : oldDom,
			!!(oldVNode._flags & 32),
			refQueue,
		);
		newVNode._original = oldVNode._original;
		newVNode._parent._children[newVNode._index] = newVNode;
		commitRoot(commitQueue, newVNode, refQueue);
		oldVNode._dom = oldVNode._parent = null;
		if (newVNode._dom != oldDom) updateParentDomPointers(newVNode);
	}
}
/**
 * @param {import('./internal').VNode} vnode
 */
function updateParentDomPointers(vnode) {
	if ((vnode = vnode._parent) != null && vnode._component != null) {
		vnode._dom = vnode._component.base = null;
		vnode._children.some((child) => {
			if (child != null && child._dom != null) return (vnode._dom = vnode._component.base = child._dom);
		});
		return updateParentDomPointers(vnode);
	}
}
/**
 * The render queue
 * @type {Array<import('./internal').Component>}
 */
var rerenderQueue = [];
var prevDebounce;
var defer = typeof Promise == "function" ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout;
/**
 * Enqueue a rerender of a component
 * @param {import('./internal').Component} c The component to rerender
 */
function enqueueRender(c) {
	if (
		(!c._dirty && (c._dirty = true) && rerenderQueue.push(c) && !process._rerenderCount++) ||
		prevDebounce != options$1.debounceRendering
	) {
		prevDebounce = options$1.debounceRendering;
		(prevDebounce || defer)(process);
	}
}
/**
 * @param {import('./internal').Component} a
 * @param {import('./internal').Component} b
 */
var depthSort = (a, b) => a._vnode._depth - b._vnode._depth;
/** Flush the render queue by rerendering all queued components */
function process() {
	try {
		let c,
			l = 1;
		while (rerenderQueue.length) {
			if (rerenderQueue.length > l) rerenderQueue.sort(depthSort);
			c = rerenderQueue.shift();
			l = rerenderQueue.length;
			renderComponent(c);
		}
	} finally {
		rerenderQueue.length = process._rerenderCount = 0;
	}
}
process._rerenderCount = 0;
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/diff/children.js
/**
 * @typedef {import('../internal').ComponentChildren} ComponentChildren
 * @typedef {import('../internal').Component} Component
 * @typedef {import('../internal').PreactElement} PreactElement
 * @typedef {import('../internal').VNode} VNode
 */
/**
 * Diff the children of a virtual node
 * @param {PreactElement} parentDom The DOM element whose children are being
 * diffed
 * @param {ComponentChildren[]} renderResult
 * @param {VNode} newParentVNode The new virtual node whose children should be
 * diff'ed against oldParentVNode
 * @param {VNode} oldParentVNode The old virtual node whose children should be
 * diff'ed against newParentVNode
 * @param {object} globalContext The current context object - modified by
 * getChildContext
 * @param {string} namespace Current namespace of the DOM node (HTML, SVG, or MathML)
 * @param {Array<PreactElement>} excessDomChildren
 * @param {Array<Component>} commitQueue List of components which have callbacks
 * to invoke in commitRoot
 * @param {PreactElement} oldDom The current attached DOM element any new dom
 * elements should be placed around. Likely `null` on first render (except when
 * hydrating). Can be a sibling DOM element when diffing Fragments that have
 * siblings. In most cases, it starts out as `oldChildren[0]._dom`.
 * @param {boolean} isHydrating Whether or not we are in hydration
 * @param {any[]} refQueue an array of elements needed to invoke refs
 */
function diffChildren(
	parentDom,
	renderResult,
	newParentVNode,
	oldParentVNode,
	globalContext,
	namespace,
	excessDomChildren,
	commitQueue,
	oldDom,
	isHydrating,
	refQueue,
) {
	let i, oldVNode, childVNode, newDom, firstChildDom;
	/** @type {VNode[]} */
	let oldChildren = (oldParentVNode && oldParentVNode._children) || EMPTY_ARR;
	let newChildrenLength = renderResult.length;
	oldDom = constructNewChildrenArray(newParentVNode, renderResult, oldChildren, oldDom, newChildrenLength);
	for (i = 0; i < newChildrenLength; i++) {
		childVNode = newParentVNode._children[i];
		if (childVNode == null) continue;
		oldVNode = (childVNode._index != -1 && oldChildren[childVNode._index]) || EMPTY_OBJ;
		childVNode._index = i;
		let result = diff(
			parentDom,
			childVNode,
			oldVNode,
			globalContext,
			namespace,
			excessDomChildren,
			commitQueue,
			oldDom,
			isHydrating,
			refQueue,
		);
		newDom = childVNode._dom;
		if (childVNode.ref && oldVNode.ref != childVNode.ref) {
			if (oldVNode.ref) applyRef(oldVNode.ref, null, childVNode);
			refQueue.push(childVNode.ref, childVNode._component || newDom, childVNode);
		}
		if (firstChildDom == null && newDom != null) firstChildDom = newDom;
		if (childVNode._flags & 4) {
			oldDom = insert(childVNode, oldDom, parentDom);
			if (oldVNode._dom) oldVNode._dom = null;
		} else if (typeof childVNode.type == "function" && result !== void 0) oldDom = result;
		else if (newDom) oldDom = newDom.nextSibling;
		childVNode._flags &= -7;
	}
	newParentVNode._dom = firstChildDom;
	return oldDom;
}
/**
 * @param {VNode} newParentVNode
 * @param {ComponentChildren[]} renderResult
 * @param {VNode[]} oldChildren
 */
function constructNewChildrenArray(newParentVNode, renderResult, oldChildren, oldDom, newChildrenLength) {
	/** @type {number} */
	let i;
	/** @type {VNode} */
	let childVNode;
	/** @type {VNode} */
	let oldVNode;
	let oldChildrenLength = oldChildren.length,
		remainingOldChildren = oldChildrenLength;
	let skew = 0;
	newParentVNode._children = new Array(newChildrenLength);
	for (i = 0; i < newChildrenLength; i++) {
		childVNode = renderResult[i];
		if (childVNode == null || typeof childVNode == "boolean" || typeof childVNode == "function") {
			newParentVNode._children[i] = null;
			continue;
		} else if (
			typeof childVNode == "string" ||
			typeof childVNode == "number" ||
			typeof childVNode == "bigint" ||
			childVNode.constructor == String
		)
			childVNode = newParentVNode._children[i] = createVNode$1(null, childVNode, null, null, null);
		else if (isArray$1(childVNode))
			childVNode = newParentVNode._children[i] = createVNode$1(Fragment, { children: childVNode }, null, null, null);
		else if (childVNode.constructor === void 0 && childVNode._depth > 0)
			childVNode = newParentVNode._children[i] = createVNode$1(
				childVNode.type,
				childVNode.props,
				childVNode.key,
				childVNode.ref ? childVNode.ref : null,
				childVNode._original,
			);
		else newParentVNode._children[i] = childVNode;
		const skewedIndex = i + skew;
		childVNode._parent = newParentVNode;
		childVNode._depth = newParentVNode._depth + 1;
		const matchingIndex = (childVNode._index = findMatchingIndex(
			childVNode,
			oldChildren,
			skewedIndex,
			remainingOldChildren,
		));
		oldVNode = null;
		if (matchingIndex != -1) {
			oldVNode = oldChildren[matchingIndex];
			remainingOldChildren--;
			if (oldVNode) oldVNode._flags |= 2;
		}
		if (oldVNode == null || oldVNode._original == null) {
			if (matchingIndex == -1) {
				if (newChildrenLength > oldChildrenLength) skew--;
				else if (newChildrenLength < oldChildrenLength) skew++;
			}
			if (typeof childVNode.type != "function") childVNode._flags |= 4;
		} else if (matchingIndex != skewedIndex)
			if (matchingIndex == skewedIndex - 1) skew--;
			else if (matchingIndex == skewedIndex + 1) skew++;
			else {
				if (matchingIndex > skewedIndex) skew--;
				else skew++;
				childVNode._flags |= 4;
			}
	}
	if (remainingOldChildren)
		for (i = 0; i < oldChildrenLength; i++) {
			oldVNode = oldChildren[i];
			if (oldVNode != null && (oldVNode._flags & 2) == 0) {
				if (oldVNode._dom == oldDom) oldDom = getDomSibling(oldVNode);
				unmount(oldVNode, oldVNode);
			}
		}
	return oldDom;
}
/**
 * @param {VNode} parentVNode
 * @param {PreactElement} oldDom
 * @param {PreactElement} parentDom
 * @returns {PreactElement}
 */
function insert(parentVNode, oldDom, parentDom) {
	if (typeof parentVNode.type == "function") {
		let children = parentVNode._children;
		for (let i = 0; children && i < children.length; i++)
			if (children[i]) {
				children[i]._parent = parentVNode;
				oldDom = insert(children[i], oldDom, parentDom);
			}
		return oldDom;
	} else if (parentVNode._dom != oldDom) {
		if (oldDom && parentVNode.type && !oldDom.parentNode) oldDom = getDomSibling(parentVNode);
		oldDom = parentDom.insertBefore(parentVNode._dom, oldDom || null);
	}
	do oldDom = oldDom && oldDom.nextSibling;
	while (oldDom != null && oldDom.nodeType == 8);
	return oldDom;
}
/**
 * Flatten and loop through the children of a virtual node
 * @param {ComponentChildren} children The unflattened children of a virtual
 * node
 * @returns {VNode[]}
 */
function toChildArray(children, out) {
	out = out || [];
	if (children == null || typeof children == "boolean") {
	} else if (isArray$1(children))
		children.some((child) => {
			toChildArray(child, out);
		});
	else out.push(children);
	return out;
}
/**
 * @param {VNode} childVNode
 * @param {VNode[]} oldChildren
 * @param {number} skewedIndex
 * @param {number} remainingOldChildren
 * @returns {number}
 */
function findMatchingIndex(childVNode, oldChildren, skewedIndex, remainingOldChildren) {
	const key = childVNode.key;
	const type = childVNode.type;
	let oldVNode = oldChildren[skewedIndex];
	const matched = oldVNode != null && (oldVNode._flags & 2) == 0;
	let shouldSearch = remainingOldChildren > (matched ? 1 : 0);
	if ((oldVNode === null && key == null) || (matched && key == oldVNode.key && type == oldVNode.type))
		return skewedIndex;
	else if (shouldSearch) {
		let x = skewedIndex - 1;
		let y = skewedIndex + 1;
		while (x >= 0 || y < oldChildren.length) {
			const childIndex = x >= 0 ? x-- : y++;
			oldVNode = oldChildren[childIndex];
			if (oldVNode != null && (oldVNode._flags & 2) == 0 && key == oldVNode.key && type == oldVNode.type)
				return childIndex;
		}
	}
	return -1;
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/diff/props.js
var _id = Math.random().toString(8);
var EVENT_DISPATCHED = "__d" + _id;
var EVENT_ATTACHED = "__a" + _id;
function setStyle(style, key, value) {
	if (key[0] == "-") style.setProperty(key, value == null ? "" : value);
	else if (value == null) style[key] = "";
	else if (typeof value != "number" || IS_NON_DIMENSIONAL.test(key)) style[key] = value;
	else style[key] = value + "px";
}
var CAPTURE_REGEX = /(PointerCapture)$|Capture$/i;
var eventClock = 0;
/**
 * Set a property value on a DOM node
 * @param {import('../internal').PreactElement} dom The DOM node to modify
 * @param {string} name The name of the property to set
 * @param {*} value The value to set the property to
 * @param {*} oldValue The old value the property had
 * @param {string} namespace Whether or not this DOM node is an SVG node or not
 */
function setProperty(dom, name, value, oldValue, namespace) {
	let useCapture;
	o: if (name == "style")
		if (typeof value == "string") dom.style.cssText = value;
		else {
			if (typeof oldValue == "string") dom.style.cssText = oldValue = "";
			if (oldValue) {
				for (name in oldValue) if (!(value && name in value)) setStyle(dom.style, name, "");
			}
			if (value) {
				for (name in value) if (!oldValue || value[name] != oldValue[name]) setStyle(dom.style, name, value[name]);
			}
		}
	else if (name[0] == "o" && name[1] == "n") {
		useCapture = name != (name = name.replace(CAPTURE_REGEX, "$1"));
		const lowerCaseName = name.toLowerCase();
		if (lowerCaseName in dom || name == "onFocusOut" || name == "onFocusIn") name = lowerCaseName.slice(2);
		else name = name.slice(2);
		if (!dom._listeners) dom._listeners = {};
		dom._listeners[name + useCapture] = value;
		if (value)
			if (!oldValue) {
				value[EVENT_ATTACHED] = eventClock;
				dom.addEventListener(name, useCapture ? eventProxyCapture : eventProxy, useCapture);
			} else value[EVENT_ATTACHED] = oldValue[EVENT_ATTACHED];
		else dom.removeEventListener(name, useCapture ? eventProxyCapture : eventProxy, useCapture);
	} else {
		if (namespace == "http://www.w3.org/2000/svg") name = name.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
		else if (
			name != "width" &&
			name != "height" &&
			name != "href" &&
			name != "list" &&
			name != "form" &&
			name != "tabIndex" &&
			name != "download" &&
			name != "rowSpan" &&
			name != "colSpan" &&
			name != "role" &&
			name != "popover" &&
			name in dom
		)
			try {
				dom[name] = value == null ? "" : value;
				break o;
			} catch (e) {}
		if (typeof value == "function") {
		} else if (value != null && (value !== false || name[4] == "-"))
			dom.setAttribute(name, name == "popover" && value == true ? "" : value);
		else dom.removeAttribute(name);
	}
}
/**
 * Create an event proxy function.
 * @param {boolean} useCapture Is the event handler for the capture phase.
 * @private
 */
function createEventProxy(useCapture) {
	/**
	 * Proxy an event to hooked event handlers
	 * @param {import('../internal').PreactEvent} e The event object from the browser
	 * @private
	 */
	return function (e) {
		if (this._listeners) {
			const eventHandler = this._listeners[e.type + useCapture];
			if (e[EVENT_DISPATCHED] == null) e[EVENT_DISPATCHED] = eventClock++;
			else if (e[EVENT_DISPATCHED] < eventHandler[EVENT_ATTACHED]) return;
			return eventHandler(options$1.event ? options$1.event(e) : e);
		}
	};
}
var eventProxy = createEventProxy(false);
var eventProxyCapture = createEventProxy(true);
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/diff/index.js
/**
 * @typedef {import('../internal').ComponentChildren} ComponentChildren
 * @typedef {import('../internal').Component} Component
 * @typedef {import('../internal').PreactElement} PreactElement
 * @typedef {import('../internal').VNode} VNode
 */
/**
 * @template {any} T
 * @typedef {import('../internal').Ref<T>} Ref<T>
 */
/**
 * Diff two virtual nodes and apply proper changes to the DOM
 * @param {PreactElement} parentDom The parent of the DOM element
 * @param {VNode} newVNode The new virtual node
 * @param {VNode} oldVNode The old virtual node
 * @param {object} globalContext The current context object. Modified by
 * getChildContext
 * @param {string} namespace Current namespace of the DOM node (HTML, SVG, or MathML)
 * @param {Array<PreactElement>} excessDomChildren
 * @param {Array<Component>} commitQueue List of components which have callbacks
 * to invoke in commitRoot
 * @param {PreactElement} oldDom The current attached DOM element any new dom
 * elements should be placed around. Likely `null` on first render (except when
 * hydrating). Can be a sibling DOM element when diffing Fragments that have
 * siblings. In most cases, it starts out as `oldChildren[0]._dom`.
 * @param {boolean} isHydrating Whether or not we are in hydration
 * @param {any[]} refQueue an array of elements needed to invoke refs
 */
function diff(
	parentDom,
	newVNode,
	oldVNode,
	globalContext,
	namespace,
	excessDomChildren,
	commitQueue,
	oldDom,
	isHydrating,
	refQueue,
) {
	/** @type {any} */
	let tmp,
		newType = newVNode.type;
	if (newVNode.constructor !== void 0) return null;
	if (oldVNode._flags & 128) {
		isHydrating = !!(oldVNode._flags & 32);
		oldDom = newVNode._dom = oldVNode._dom;
		excessDomChildren = [oldDom];
	}
	if ((tmp = options$1._diff)) tmp(newVNode);
	outer: if (typeof newType == "function") {
		let oldCommitQueueLength = commitQueue.length;
		try {
			let c, isNew, oldProps, oldState, snapshot, clearProcessingException;
			let newProps = newVNode.props;
			const isClassComponent = newType.prototype && newType.prototype.render;
			tmp = newType.contextType;
			let provider = tmp && globalContext[tmp._id];
			let componentContext = tmp ? (provider ? provider.props.value : tmp._defaultValue) : globalContext;
			if (oldVNode._component) {
				c = newVNode._component = oldVNode._component;
				clearProcessingException = c._processingException = c._pendingError;
			} else {
				if (isClassComponent) newVNode._component = c = new newType(newProps, componentContext);
				else {
					newVNode._component = c = new BaseComponent(newProps, componentContext);
					c.constructor = newType;
					c.render = doRender;
				}
				if (provider) provider.sub(c);
				if (!c.state) c.state = {};
				c._globalContext = globalContext;
				isNew = c._dirty = true;
				c._renderCallbacks = [];
				c._stateCallbacks = [];
			}
			if (isClassComponent && c._nextState == null) c._nextState = c.state;
			if (isClassComponent && newType.getDerivedStateFromProps != null) {
				if (c._nextState == c.state) c._nextState = assign$1({}, c._nextState);
				assign$1(c._nextState, newType.getDerivedStateFromProps(newProps, c._nextState));
			}
			oldProps = c.props;
			oldState = c.state;
			c._vnode = newVNode;
			if (isNew) {
				if (isClassComponent && newType.getDerivedStateFromProps == null && c.componentWillMount != null)
					c.componentWillMount();
				if (isClassComponent && c.componentDidMount != null) c._renderCallbacks.push(c.componentDidMount);
			} else {
				if (
					isClassComponent &&
					newType.getDerivedStateFromProps == null &&
					newProps !== oldProps &&
					c.componentWillReceiveProps != null
				)
					c.componentWillReceiveProps(newProps, componentContext);
				if (
					newVNode._original == oldVNode._original ||
					(!c._force &&
						c.shouldComponentUpdate != null &&
						c.shouldComponentUpdate(newProps, c._nextState, componentContext) === false)
				) {
					if (newVNode._original != oldVNode._original) {
						c.props = newProps;
						c.state = c._nextState;
						c._dirty = false;
					}
					newVNode._dom = oldVNode._dom;
					newVNode._children = oldVNode._children;
					newVNode._children.some((vnode) => {
						if (vnode) vnode._parent = newVNode;
					});
					EMPTY_ARR.push.apply(c._renderCallbacks, c._stateCallbacks);
					c._stateCallbacks = [];
					if (c._renderCallbacks.length) commitQueue.push(c);
					oldDom = getDomSibling(oldVNode);
					break outer;
				}
				if (c.componentWillUpdate != null) c.componentWillUpdate(newProps, c._nextState, componentContext);
				if (isClassComponent && c.componentDidUpdate != null)
					c._renderCallbacks.push(() => {
						c.componentDidUpdate(oldProps, oldState, snapshot);
					});
			}
			c.context = componentContext;
			c.props = newProps;
			c._parentDom = parentDom;
			c._force = false;
			let renderHook = options$1._render,
				count = 0;
			if (isClassComponent) {
				c.state = c._nextState;
				c._dirty = false;
				if (renderHook) renderHook(newVNode);
				tmp = c.render(c.props, c.state, c.context);
				EMPTY_ARR.push.apply(c._renderCallbacks, c._stateCallbacks);
				c._stateCallbacks = [];
			} else
				do {
					c._dirty = false;
					if (renderHook) renderHook(newVNode);
					tmp = c.render(c.props, c.state, c.context);
					c.state = c._nextState;
				} while (c._dirty && ++count < 25);
			c.state = c._nextState;
			if (c.getChildContext != null) globalContext = assign$1(assign$1({}, globalContext), c.getChildContext());
			if (isClassComponent && !isNew && c.getSnapshotBeforeUpdate != null)
				snapshot = c.getSnapshotBeforeUpdate(oldProps, oldState);
			let renderResult = tmp != null && tmp.type === Fragment && tmp.key == null ? cloneNode(tmp.props.children) : tmp;
			oldDom = diffChildren(
				parentDom,
				isArray$1(renderResult) ? renderResult : [renderResult],
				newVNode,
				oldVNode,
				globalContext,
				namespace,
				excessDomChildren,
				commitQueue,
				oldDom,
				isHydrating,
				refQueue,
			);
			c.base = newVNode._dom;
			newVNode._flags &= RESET_MODE;
			if (c._renderCallbacks.length) commitQueue.push(c);
			if (clearProcessingException) c._pendingError = c._processingException = null;
		} catch (e) {
			commitQueue.length = oldCommitQueueLength;
			newVNode._original = null;
			if (isHydrating || excessDomChildren != null) {
				if (e.then) {
					newVNode._flags |= isHydrating ? 160 : 128;
					while (oldDom && oldDom.nodeType == 8 && oldDom.nextSibling) oldDom = oldDom.nextSibling;
					if (excessDomChildren != null) excessDomChildren[excessDomChildren.indexOf(oldDom)] = null;
					newVNode._dom = oldDom;
				} else if (excessDomChildren != null)
					for (let i = excessDomChildren.length; i--; ) removeNode(excessDomChildren[i]);
			} else newVNode._dom = oldVNode._dom;
			if (newVNode._children == null) newVNode._children = oldVNode._children || [];
			if (!e.then) markAsForce(newVNode);
			options$1._catchError(e, newVNode, oldVNode);
		}
	} else if (excessDomChildren == null && newVNode._original == oldVNode._original) {
		newVNode._children = oldVNode._children;
		newVNode._dom = oldVNode._dom;
	} else
		oldDom = newVNode._dom = diffElementNodes(
			oldVNode._dom,
			newVNode,
			oldVNode,
			globalContext,
			namespace,
			excessDomChildren,
			commitQueue,
			isHydrating,
			refQueue,
		);
	if ((tmp = options$1.diffed)) tmp(newVNode);
	return newVNode._flags & 128 ? void 0 : oldDom;
}
function markAsForce(vnode) {
	if (vnode) {
		if (vnode._component) vnode._component._force = true;
		if (vnode._children) vnode._children.some(markAsForce);
	}
}
/**
 * @param {Array<Component>} commitQueue List of components
 * which have callbacks to invoke in commitRoot
 * @param {VNode} root
 */
function commitRoot(commitQueue, root, refQueue) {
	for (let i = 0; i < refQueue.length; i++) applyRef(refQueue[i], refQueue[++i], refQueue[++i]);
	if (options$1._commit) options$1._commit(root, commitQueue);
	commitQueue.some((c) => {
		try {
			commitQueue = c._renderCallbacks;
			c._renderCallbacks = [];
			commitQueue.some((cb) => {
				cb.call(c);
			});
		} catch (e) {
			options$1._catchError(e, c._vnode);
		}
	});
}
function cloneNode(node) {
	if (typeof node != "object" || node == null || node._depth > 0) return node;
	if (isArray$1(node)) return node.map(cloneNode);
	if (node.constructor !== void 0) return null;
	return assign$1({}, node);
}
/**
 * Diff two virtual nodes representing DOM element
 * @param {PreactElement} dom The DOM element representing the virtual nodes
 * being diffed
 * @param {VNode} newVNode The new virtual node
 * @param {VNode} oldVNode The old virtual node
 * @param {object} globalContext The current context object
 * @param {string} namespace Current namespace of the DOM node (HTML, SVG, or MathML)
 * @param {Array<PreactElement>} excessDomChildren
 * @param {Array<Component>} commitQueue List of components which have callbacks
 * to invoke in commitRoot
 * @param {boolean} isHydrating Whether or not we are in hydration
 * @param {any[]} refQueue an array of elements needed to invoke refs
 * @returns {PreactElement}
 */
function diffElementNodes(
	dom,
	newVNode,
	oldVNode,
	globalContext,
	namespace,
	excessDomChildren,
	commitQueue,
	isHydrating,
	refQueue,
) {
	let oldProps = oldVNode.props || EMPTY_OBJ;
	let newProps = newVNode.props;
	let nodeType = newVNode.type;
	/** @type {any} */
	let i;
	/** @type {{ __html?: string }} */
	let newHtml;
	/** @type {{ __html?: string }} */
	let oldHtml;
	/** @type {ComponentChildren} */
	let newChildren;
	let value;
	let inputValue;
	let checked;
	if (nodeType == "svg") namespace = SVG_NAMESPACE;
	else if (nodeType == "math") namespace = MATH_NAMESPACE;
	else if (!namespace) namespace = XHTML_NAMESPACE;
	if (excessDomChildren != null)
		for (i = 0; i < excessDomChildren.length; i++) {
			value = excessDomChildren[i];
			if (
				value &&
				"setAttribute" in value == !!nodeType &&
				(nodeType ? value.localName == nodeType : value.nodeType == 3)
			) {
				dom = value;
				excessDomChildren[i] = null;
				break;
			}
		}
	if (dom == null) {
		if (nodeType == null) return document.createTextNode(newProps);
		dom = document.createElementNS(namespace, nodeType, newProps.is && newProps);
		if (isHydrating) {
			if (options$1._hydrationMismatch) options$1._hydrationMismatch(newVNode, excessDomChildren);
			isHydrating = false;
		}
		excessDomChildren = null;
	}
	if (nodeType == null) {
		if (oldProps !== newProps && (!isHydrating || dom.data != newProps)) dom.data = newProps;
	} else {
		excessDomChildren =
			nodeType == "textarea" && newProps.defaultValue != null ? null : excessDomChildren && slice.call(dom.childNodes);
		if (!isHydrating && excessDomChildren != null) {
			oldProps = {};
			for (i = 0; i < dom.attributes.length; i++) {
				value = dom.attributes[i];
				oldProps[value.name] = value.value;
			}
		}
		for (i in oldProps) {
			value = oldProps[i];
			if (i == "dangerouslySetInnerHTML") oldHtml = value;
			else if (
				i != "children" &&
				!(i in newProps) &&
				!(i == "value" && "defaultValue" in newProps) &&
				!(i == "checked" && "defaultChecked" in newProps)
			)
				setProperty(dom, i, null, value, namespace);
		}
		for (i in newProps) {
			value = newProps[i];
			if (i == "children") newChildren = value;
			else if (i == "dangerouslySetInnerHTML") newHtml = value;
			else if (i == "value") inputValue = value;
			else if (i == "checked") checked = value;
			else if ((!isHydrating || typeof value == "function") && oldProps[i] !== value)
				setProperty(dom, i, value, oldProps[i], namespace);
		}
		if (newHtml) {
			if (!isHydrating && (!oldHtml || (newHtml.__html != oldHtml.__html && newHtml.__html != dom.innerHTML)))
				dom.innerHTML = newHtml.__html;
			newVNode._children = [];
		} else {
			if (oldHtml) dom.innerHTML = "";
			diffChildren(
				newVNode.type == "template" ? dom.content : dom,
				isArray$1(newChildren) ? newChildren : [newChildren],
				newVNode,
				oldVNode,
				globalContext,
				nodeType == "foreignObject" ? XHTML_NAMESPACE : namespace,
				excessDomChildren,
				commitQueue,
				excessDomChildren ? excessDomChildren[0] : oldVNode._children && getDomSibling(oldVNode, 0),
				isHydrating,
				refQueue,
			);
			if (excessDomChildren != null) for (i = excessDomChildren.length; i--; ) removeNode(excessDomChildren[i]);
		}
		if (!isHydrating || nodeType == "textarea") {
			i = "value";
			if (nodeType == "progress" && inputValue == null) dom.removeAttribute("value");
			else if (
				inputValue != void 0 &&
				(inputValue !== dom[i] ||
					(nodeType == "progress" && !inputValue) ||
					(nodeType == "option" && inputValue != oldProps[i]))
			)
				setProperty(dom, i, inputValue, oldProps[i], namespace);
			i = "checked";
			if (checked != void 0 && checked != dom[i]) setProperty(dom, i, checked, oldProps[i], namespace);
		}
	}
	return dom;
}
/**
 * Invoke or update a ref, depending on whether it is a function or object ref.
 * @param {Ref<any> & { _unmount?: unknown }} ref
 * @param {any} value
 * @param {VNode} vnode
 */
function applyRef(ref, value, vnode) {
	try {
		if (typeof ref == "function") {
			let hasRefUnmount = typeof ref._unmount == "function";
			if (hasRefUnmount) ref._unmount();
			if (!hasRefUnmount || value != null) ref._unmount = ref(value);
		} else ref.current = value;
	} catch (e) {
		options$1._catchError(e, vnode);
	}
}
/**
 * Unmount a virtual node from the tree and apply DOM changes
 * @param {VNode} vnode The virtual node to unmount
 * @param {VNode} parentVNode The parent of the VNode that initiated the unmount
 * @param {boolean} [skipRemove] Flag that indicates that a parent node of the
 * current element is already detached from the DOM.
 */
function unmount(vnode, parentVNode, skipRemove) {
	let r;
	if (options$1.unmount) options$1.unmount(vnode);
	if ((r = vnode.ref)) {
		if (!r.current || r.current == vnode._dom) applyRef(r, null, parentVNode);
	}
	if ((r = vnode._component) != null) {
		if (r.componentWillUnmount)
			try {
				r.componentWillUnmount();
			} catch (e) {
				options$1._catchError(e, parentVNode);
			}
		r.base = r._parentDom = r._globalContext = null;
	}
	if ((r = vnode._children)) {
		for (let i = 0; i < r.length; i++)
			if (r[i]) unmount(r[i], parentVNode, skipRemove || typeof vnode.type != "function");
	}
	if (!skipRemove) removeNode(vnode._dom);
	vnode._component = vnode._parent = vnode._dom = void 0;
}
/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
	return this.constructor(props, context);
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/render.js
/**
 * Render a Preact virtual node into a DOM element
 * @param {import('./internal').ComponentChild} vnode The virtual node to render
 * @param {import('./internal').PreactElement} parentDom The DOM element to render into
 * @param {import('./internal').PreactElement | object} [replaceNode] Optional: Attempt to re-use an
 * existing DOM tree rooted at `replaceNode`
 */
function render$1(vnode, parentDom, replaceNode) {
	if (parentDom == document) parentDom = document.documentElement;
	if (options$1._root) options$1._root(vnode, parentDom);
	let isHydrating = typeof replaceNode == "function";
	let oldVNode = isHydrating ? null : (replaceNode && replaceNode._children) || parentDom._children;
	vnode = ((!isHydrating && replaceNode) || parentDom)._children = createElement(Fragment, null, [vnode]);
	let commitQueue = [],
		refQueue = [];
	diff(
		parentDom,
		vnode,
		oldVNode || EMPTY_OBJ,
		EMPTY_OBJ,
		parentDom.namespaceURI,
		!isHydrating && replaceNode
			? [replaceNode]
			: oldVNode
				? null
				: parentDom.firstChild
					? slice.call(parentDom.childNodes)
					: null,
		commitQueue,
		!isHydrating && replaceNode ? replaceNode : oldVNode ? oldVNode._dom : parentDom.firstChild,
		isHydrating,
		refQueue,
	);
	commitRoot(commitQueue, vnode, refQueue);
	vnode.props.children = null;
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/hooks/src/index.js
/** @type {number} */
var currentIndex;
/** @type {import('./internal').Component} */
var currentComponent$1;
/** @type {import('./internal').Component} */
var previousComponent;
/** @type {number} */
var currentHook = 0;
/** @type {Array<import('./internal').Component>} */
var afterPaintEffects = [];
var options = options$1;
var oldBeforeDiff = options._diff;
var oldBeforeRender$1 = options._render;
var oldAfterDiff = options.diffed;
var oldCommit = options._commit;
var oldBeforeUnmount = options.unmount;
var oldRoot = options._root;
var RAF_TIMEOUT = 35;
var prevRaf;
/** @type {(vnode: import('./internal').VNode) => void} */
options._diff = (vnode) => {
	currentComponent$1 = null;
	if (oldBeforeDiff) oldBeforeDiff(vnode);
};
options._root = (vnode, parentDom) => {
	if (vnode && parentDom._children && parentDom._children._mask) vnode._mask = parentDom._children._mask;
	if (oldRoot) oldRoot(vnode, parentDom);
};
/** @type {(vnode: import('./internal').VNode) => void} */
options._render = (vnode) => {
	if (oldBeforeRender$1) oldBeforeRender$1(vnode);
	currentComponent$1 = vnode._component;
	currentIndex = 0;
	const hooks = currentComponent$1.__hooks;
	if (hooks)
		if (previousComponent === currentComponent$1) {
			hooks._pendingEffects = [];
			currentComponent$1._renderCallbacks = [];
			hooks._list.some((hookItem) => {
				if (hookItem._nextValue) hookItem._value = hookItem._nextValue;
				hookItem._pendingArgs = hookItem._nextValue = void 0;
			});
		} else {
			hooks._pendingEffects.some(invokeCleanup);
			hooks._pendingEffects.some(invokeEffect);
			hooks._pendingEffects = [];
			currentIndex = 0;
		}
	previousComponent = currentComponent$1;
};
/** @type {(vnode: import('./internal').VNode) => void} */
options.diffed = (vnode) => {
	if (oldAfterDiff) oldAfterDiff(vnode);
	const c = vnode._component;
	if (c && c.__hooks) {
		if (c.__hooks._pendingEffects.length) afterPaint(afterPaintEffects.push(c));
		c.__hooks._list.some((hookItem) => {
			if (hookItem._pendingArgs) {
				hookItem._args = hookItem._pendingArgs;
				hookItem._pendingArgs = void 0;
			}
		});
	}
	previousComponent = currentComponent$1 = null;
};
/** @type {(vnode: import('./internal').VNode, commitQueue: any) => void} */
options._commit = (vnode, commitQueue) => {
	commitQueue.some((component) => {
		try {
			component._renderCallbacks.some(invokeCleanup);
			component._renderCallbacks = component._renderCallbacks.filter((cb) => (cb._value ? invokeEffect(cb) : true));
		} catch (e) {
			commitQueue.some((c) => {
				if (c._renderCallbacks) c._renderCallbacks = [];
			});
			commitQueue = [];
			options._catchError(e, component._vnode);
		}
	});
	if (oldCommit) oldCommit(vnode, commitQueue);
};
/** @type {(vnode: import('./internal').VNode) => void} */
options.unmount = (vnode) => {
	if (oldBeforeUnmount) oldBeforeUnmount(vnode);
	const c = vnode._component;
	if (c && c.__hooks) {
		let hasErrored;
		c.__hooks._list.some((s) => {
			try {
				invokeCleanup(s);
			} catch (e) {
				hasErrored = e;
			}
		});
		c.__hooks = void 0;
		if (hasErrored) options._catchError(hasErrored, c._vnode);
	}
};
/**
 * Get a hook's state from the currentComponent
 * @param {number} index The index of the hook to get
 * @param {number} type The index of the hook to get
 * @returns {any}
 */
function getHookState(index, type) {
	if (options._hook) options._hook(currentComponent$1, index, currentHook || type);
	currentHook = 0;
	const hooks =
		currentComponent$1.__hooks ||
		(currentComponent$1.__hooks = {
			_list: [],
			_pendingEffects: [],
		});
	if (index >= hooks._list.length) hooks._list.push({});
	return hooks._list[index];
}
/**
 * @template {unknown} S
 * @param {import('./index').Dispatch<import('./index').StateUpdater<S>>} [initialState]
 * @returns {[S, (state: S) => void]}
 */
function useState(initialState) {
	currentHook = 1;
	return useReducer(invokeOrReturn, initialState);
}
/**
 * @template {unknown} S
 * @template {unknown} A
 * @param {import('./index').Reducer<S, A>} reducer
 * @param {import('./index').Dispatch<import('./index').StateUpdater<S>>} initialState
 * @param {(initialState: any) => void} [init]
 * @returns {[ S, (state: S) => void ]}
 */
function useReducer(reducer, initialState, init) {
	/** @type {import('./internal').ReducerHookState} */
	const hookState = getHookState(currentIndex++, 2);
	hookState._reducer = reducer;
	if (!hookState._component) {
		hookState._value = [
			!init ? invokeOrReturn(void 0, initialState) : init(initialState),
			(action) => {
				const currentValue = hookState._nextValue ? hookState._nextValue[0] : hookState._value[0];
				const nextValue = hookState._reducer(currentValue, action);
				if (currentValue !== nextValue) {
					hookState._nextValue = [nextValue, hookState._value[1]];
					hookState._component.setState({});
				}
			},
		];
		hookState._component = currentComponent$1;
		if (!currentComponent$1._hasScuFromHooks) {
			currentComponent$1._hasScuFromHooks = true;
			let prevScu = currentComponent$1.shouldComponentUpdate;
			const prevCWU = currentComponent$1.componentWillUpdate;
			currentComponent$1.componentWillUpdate = function (p, s, c) {
				if (this._force) {
					let tmp = prevScu;
					prevScu = void 0;
					updateHookState(p, s, c);
					prevScu = tmp;
				}
				if (prevCWU) prevCWU.call(this, p, s, c);
			};
			/**
			 *
			 * @type {import('./internal').Component["shouldComponentUpdate"]}
			 */
			function updateHookState(p, s, c) {
				if (!hookState._component.__hooks) return true;
				let updatedHook = false;
				let shouldUpdate = hookState._component.props !== p;
				hookState._component.__hooks._list.some((hookItem) => {
					if (hookItem._nextValue) {
						updatedHook = true;
						const currentValue = hookItem._value[0];
						hookItem._value = hookItem._nextValue;
						hookItem._nextValue = void 0;
						if (currentValue !== hookItem._value[0]) shouldUpdate = true;
					}
				});
				if (prevScu) {
					const result = prevScu.call(this, p, s, c);
					return updatedHook ? result || shouldUpdate : result;
				}
				return !updatedHook || shouldUpdate;
			}
			currentComponent$1.shouldComponentUpdate = updateHookState;
		}
	}
	return hookState._nextValue || hookState._value;
}
/**
 * @param {import('./internal').Effect} callback
 * @param {unknown[]} args
 * @returns {void}
 */
function useEffect(callback, args) {
	/** @type {import('./internal').EffectHookState} */
	const state = getHookState(currentIndex++, 3);
	if (!options._skipEffects && argsChanged(state._args, args)) {
		state._value = callback;
		state._pendingArgs = args;
		currentComponent$1.__hooks._pendingEffects.push(state);
	}
}
/** @type {(initialValue: unknown) => unknown} */
function useRef(initialValue) {
	currentHook = 5;
	return useMemo(() => ({ current: initialValue }), []);
}
/**
 * @template {unknown} T
 * @param {() => T} factory
 * @param {unknown[]} args
 * @returns {T}
 */
function useMemo(factory, args) {
	/** @type {import('./internal').MemoHookState<T>} */
	const state = getHookState(currentIndex++, 7);
	if (argsChanged(state._args, args)) {
		state._value = factory();
		state._args = args;
		state._factory = factory;
	}
	return state._value;
}
/**
 * @param {() => void} callback
 * @param {unknown[]} args
 * @returns {() => void}
 */
function useCallback(callback, args) {
	currentHook = 8;
	return useMemo(() => callback, args);
}
/**
 * After paint effects consumer.
 */
function flushAfterPaintEffects() {
	let component;
	while ((component = afterPaintEffects.shift())) {
		const hooks = component.__hooks;
		if (!component._parentDom || !hooks) continue;
		try {
			hooks._pendingEffects.some(invokeCleanup);
			hooks._pendingEffects.some(invokeEffect);
			hooks._pendingEffects = [];
		} catch (e) {
			hooks._pendingEffects = [];
			options._catchError(e, component._vnode);
		}
	}
}
var HAS_RAF = typeof requestAnimationFrame == "function";
/**
 * Schedule a callback to be invoked after the browser has a chance to paint a new frame.
 * Do this by combining requestAnimationFrame (rAF) + setTimeout to invoke a callback after
 * the next browser frame.
 *
 * Also, schedule a timeout in parallel to the the rAF to ensure the callback is invoked
 * even if RAF doesn't fire (for example if the browser tab is not visible)
 *
 * @param {() => void} callback
 */
function afterNextFrame(callback) {
	const done = () => {
		clearTimeout(timeout);
		if (HAS_RAF) cancelAnimationFrame(raf);
		setTimeout(callback);
	};
	const timeout = setTimeout(done, RAF_TIMEOUT);
	let raf;
	if (HAS_RAF) raf = requestAnimationFrame(done);
}
/**
 * Schedule afterPaintEffects flush after the browser paints
 * @param {number} newQueueLength
 * @returns {void}
 */
function afterPaint(newQueueLength) {
	if (newQueueLength === 1 || prevRaf !== options.requestAnimationFrame) {
		prevRaf = options.requestAnimationFrame;
		(prevRaf || afterNextFrame)(flushAfterPaintEffects);
	}
}
/**
 * @param {import('./internal').HookState} hook
 * @returns {void}
 */
function invokeCleanup(hook) {
	const comp = currentComponent$1;
	let cleanup = hook._cleanup;
	if (typeof cleanup == "function") {
		hook._cleanup = void 0;
		cleanup();
	}
	currentComponent$1 = comp;
}
/**
 * Invoke a Hook's effect
 * @param {import('./internal').EffectHookState} hook
 * @returns {void}
 */
function invokeEffect(hook) {
	const comp = currentComponent$1;
	hook._cleanup = hook._value();
	currentComponent$1 = comp;
}
/**
 * @param {unknown[]} oldArgs
 * @param {unknown[]} newArgs
 * @returns {boolean}
 */
function argsChanged(oldArgs, newArgs) {
	return !oldArgs || oldArgs.length !== newArgs.length || newArgs.some((arg, index) => arg !== oldArgs[index]);
}
/**
 * @template Arg
 * @param {Arg} arg
 * @param {(arg: Arg) => any} f
 * @returns {any}
 */
function invokeOrReturn(arg, f) {
	return typeof f == "function" ? f(arg) : f;
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/util.js
/**
 * Assign properties from `props` to `obj`
 * @template O, P The obj and props types
 * @param {O} obj The object to copy properties to
 * @param {P} props The object to copy properties from
 * @returns {O & P}
 */
function assign(obj, props) {
	for (let i in props) obj[i] = props[i];
	return obj;
}
/**
 * Check if two objects have a different shape
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
function shallowDiffers(a, b) {
	for (let i in a) if (i !== "__source" && !(i in b)) return true;
	for (let i in b) if (i !== "__source" && a[i] !== b[i]) return true;
	return false;
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/PureComponent.js
/**
 * Component class with a predefined `shouldComponentUpdate` implementation
 */
function PureComponent(p, c) {
	this.props = p;
	this.context = c;
}
PureComponent.prototype = new BaseComponent();
PureComponent.prototype.isPureReactComponent = true;
PureComponent.prototype.shouldComponentUpdate = function (props, state) {
	return shallowDiffers(this.props, props) || shallowDiffers(this.state, state);
};
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/forwardRef.js
var oldDiffHook = options$1._diff;
options$1._diff = (vnode) => {
	if (vnode.type && vnode.type._forwarded && vnode.ref) {
		vnode.props.ref = vnode.ref;
		vnode.ref = null;
	}
	if (oldDiffHook) oldDiffHook(vnode);
};
typeof Symbol != "undefined" && Symbol.for;
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/suspense.js
var oldCatchError = options$1._catchError;
options$1._catchError = function (error, newVNode, oldVNode, errorInfo) {
	if (error.then) {
		/** @type {import('./internal').Component} */
		let component;
		let vnode = newVNode;
		for (; (vnode = vnode._parent); )
			if ((component = vnode._component) && component._childDidSuspend) {
				if (newVNode._dom == null) {
					newVNode._dom = oldVNode._dom;
					newVNode._children = oldVNode._children || [];
				}
				return component._childDidSuspend(error, newVNode);
			}
	}
	oldCatchError(error, newVNode, oldVNode, errorInfo);
};
var oldUnmount = options$1.unmount;
options$1.unmount = function (vnode) {
	/** @type {import('./internal').Component} */
	const component = vnode._component;
	if (component) component._unmounted = true;
	if (component && component._onResolve) component._onResolve();
	if (component && vnode._flags & 32) vnode.type = null;
	if (oldUnmount) oldUnmount(vnode);
};
function detachedClone(vnode, detachedParent, parentDom) {
	if (vnode) {
		if (vnode._component && vnode._component.__hooks) {
			vnode._component.__hooks._list.forEach((effect) => {
				if (typeof effect._cleanup == "function") effect._cleanup();
			});
			vnode._component.__hooks = null;
		}
		vnode = assign({}, vnode);
		if (vnode._component != null) {
			if (vnode._component._parentDom === parentDom) vnode._component._parentDom = detachedParent;
			vnode._component._force = true;
			vnode._component = null;
		}
		vnode._children =
			vnode._children && vnode._children.map((child) => detachedClone(child, detachedParent, parentDom));
	}
	return vnode;
}
function removeOriginal(vnode, detachedParent, originalParent) {
	if (vnode && originalParent) {
		vnode._original = null;
		vnode._children =
			vnode._children && vnode._children.map((child) => removeOriginal(child, detachedParent, originalParent));
		if (vnode._component) {
			if (vnode._component._parentDom === detachedParent) {
				if (vnode._dom) originalParent.appendChild(vnode._dom);
				vnode._component._force = true;
				vnode._component._parentDom = originalParent;
			}
		}
	}
	return vnode;
}
function Suspense() {
	this._pendingSuspensionCount = 0;
	this._suspenders = null;
	this._detachOnNextRender = null;
}
Suspense.prototype = new BaseComponent();
/**
 * @this {import('./internal').SuspenseComponent}
 * @param {Promise} promise The thrown promise
 * @param {import('./internal').VNode<any, any>} suspendingVNode The suspending component
 */
Suspense.prototype._childDidSuspend = function (promise, suspendingVNode) {
	const suspendingComponent = suspendingVNode._component;
	/** @type {import('./internal').SuspenseComponent} */
	const c = this;
	if (c._suspenders == null) c._suspenders = [];
	c._suspenders.push(suspendingComponent);
	const resolve = suspended(c._vnode);
	let resolved = false;
	const onResolved = () => {
		if (resolved || c._unmounted) return;
		resolved = true;
		suspendingComponent._onResolve = null;
		if (resolve) resolve(onSuspensionComplete);
		else onSuspensionComplete();
	};
	suspendingComponent._onResolve = onResolved;
	const originalParentDom = suspendingComponent._parentDom;
	suspendingComponent._parentDom = null;
	const onSuspensionComplete = () => {
		if (!--c._pendingSuspensionCount) {
			if (c.state._suspended) {
				const suspendedVNode = c.state._suspended;
				c._vnode._children[0] = removeOriginal(
					suspendedVNode,
					suspendedVNode._component._parentDom,
					suspendedVNode._component._originalParentDom,
				);
			}
			c.setState({ _suspended: (c._detachOnNextRender = null) });
			let suspended;
			while ((suspended = c._suspenders.pop())) {
				suspended._parentDom = originalParentDom;
				suspended.forceUpdate();
			}
		}
	};
	/**
	 * We do not set `suspended: true` during hydration because we want the actual markup
	 * to remain on screen and hydrate it when the suspense actually gets resolved.
	 * While in non-hydration cases the usual fallback -> component flow would occour.
	 */
	if (!c._pendingSuspensionCount++ && !(suspendingVNode._flags & 32))
		c.setState({ _suspended: (c._detachOnNextRender = c._vnode._children[0]) });
	promise.then(onResolved, onResolved);
};
Suspense.prototype.componentWillUnmount = function () {
	this._suspenders = [];
};
/**
 * @this {import('./internal').SuspenseComponent}
 * @param {import('./internal').SuspenseComponent["props"]} props
 * @param {import('./internal').SuspenseState} state
 */
Suspense.prototype.render = function (props, state) {
	if (this._detachOnNextRender) {
		if (this._vnode._children) {
			const detachedParent = document.createElement("div");
			const detachedComponent = this._vnode._children[0]._component;
			this._vnode._children[0] = detachedClone(
				this._detachOnNextRender,
				detachedParent,
				(detachedComponent._originalParentDom = detachedComponent._parentDom),
			);
		}
		this._detachOnNextRender = null;
	}
	/** @type {import('./internal').VNode} */
	const fallback = state._suspended && createElement(Fragment, null, props.fallback);
	if (fallback) fallback._flags &= -33;
	return [createElement(Fragment, null, state._suspended ? null : props.children), fallback];
};
/**
 * Checks and calls the parent component's _suspended method, passing in the
 * suspended vnode. This is a way for a parent (e.g. SuspenseList) to get notified
 * that one of its children/descendants suspended.
 *
 * The parent MAY return a callback. The callback will get called when the
 * suspension resolves, notifying the parent of the fact.
 * Moreover, the callback gets function `unsuspend` as a parameter. The resolved
 * child descendant will not actually get unsuspended until `unsuspend` gets called.
 * This is a way for the parent to delay unsuspending.
 *
 * If the parent does not return a callback then the resolved vnode
 * gets unsuspended immediately when it resolves.
 *
 * @param {import('./internal').VNode} vnode
 * @returns {((unsuspend: () => void) => void)?}
 */
function suspended(vnode) {
	let component = vnode._parent && vnode._parent._component;
	return component && component._suspended && component._suspended(vnode);
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/suspense-list.js
var SUSPENDED_COUNT = 0;
var RESOLVED_COUNT = 1;
var NEXT_NODE = 2;
function SuspenseList() {
	this._next = null;
	this._map = null;
}
var resolve = (list, child, node) => {
	if (++node[RESOLVED_COUNT] === node[SUSPENDED_COUNT]) list._map.delete(child);
	if (!list.props.revealOrder || (list.props.revealOrder[0] === "t" && list._map.size)) return;
	node = list._next;
	while (node) {
		while (node.length > 3) node.pop()();
		if (node[RESOLVED_COUNT] < node[SUSPENDED_COUNT]) break;
		list._next = node = node[NEXT_NODE];
	}
};
SuspenseList.prototype = new BaseComponent();
SuspenseList.prototype._suspended = function (child) {
	const list = this;
	const delegated = suspended(list._vnode);
	let node = list._map.get(child);
	node[SUSPENDED_COUNT]++;
	return (unsuspend) => {
		const wrappedUnsuspend = () => {
			if (!list.props.revealOrder) unsuspend();
			else {
				node.push(unsuspend);
				resolve(list, child, node);
			}
		};
		if (delegated) delegated(wrappedUnsuspend);
		else wrappedUnsuspend();
	};
};
SuspenseList.prototype.render = function (props) {
	this._next = null;
	this._map = /* @__PURE__ */ new Map();
	const children = toChildArray(props.children);
	if (props.revealOrder && props.revealOrder[0] === "b") children.reverse();
	for (let i = children.length; i--; ) this._map.set(children[i], (this._next = [1, 0, this._next]));
	return props.children;
};
SuspenseList.prototype.componentDidUpdate = SuspenseList.prototype.componentDidMount = function () {
	this._map.forEach((node, child) => {
		resolve(this, child, node);
	});
};
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/render.js
var REACT_ELEMENT_TYPE = (typeof Symbol != "undefined" && Symbol.for && Symbol.for("react.element")) || 60103;
var CAMEL_PROPS =
	/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/;
var ON_ANI = /^on(Ani|Tra|Tou|BeforeInp|Compo)/;
var CAMEL_REPLACE = /[A-Z0-9]/g;
var IS_DOM = typeof document !== "undefined";
var onChangeInputType = (type) =>
	(typeof Symbol != "undefined" && typeof Symbol() == "symbol" ? /fil|che|rad/ : /fil|che|ra/).test(type);
BaseComponent.prototype.isReactComponent = true;
["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach((key) => {
	Object.defineProperty(BaseComponent.prototype, key, {
		configurable: true,
		get() {
			return this["UNSAFE_" + key];
		},
		set(v) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				value: v,
			});
		},
	});
});
/**
 * Proxy render() since React returns a Component reference.
 * @param {import('./internal').VNode} vnode VNode tree to render
 * @param {import('./internal').PreactElement} parent DOM node to render vnode tree into
 * @param {() => void} [callback] Optional callback that will be called after rendering
 * @returns {import('./internal').Component | null} The root component reference or null
 */
function render(vnode, parent, callback) {
	if (parent._children == null) parent.textContent = "";
	render$1(vnode, parent);
	if (typeof callback == "function") callback();
	return vnode ? vnode._component : null;
}
var oldEventHook = options$1.event;
options$1.event = (e) => {
	if (oldEventHook) e = oldEventHook(e);
	e.persist = () => {};
	e.isPropagationStopped = function isPropagationStopped() {
		return this.cancelBubble;
	};
	e.isDefaultPrevented = function isDefaultPrevented() {
		return this.defaultPrevented;
	};
	return (e.nativeEvent = e);
};
var classNameDescriptorNonEnumberable = {
	configurable: true,
	get() {
		return this.class;
	},
};
function handleDomVNode(vnode) {
	let props = vnode.props,
		type = vnode.type,
		normalizedProps = {},
		isNonDashedType = type.indexOf("-") == -1;
	for (let i in props) {
		let value = props[i];
		if (
			(i === "value" && "defaultValue" in props && value == null) ||
			(IS_DOM && i === "children" && type === "noscript") ||
			i === "class" ||
			i === "className"
		)
			continue;
		let lowerCased = i.toLowerCase();
		if (i === "defaultValue" && "value" in props && props.value == null) i = "value";
		else if (i === "download" && value === true) value = "";
		else if (lowerCased === "translate" && value === "no") value = false;
		else if (lowerCased[0] === "o" && lowerCased[1] === "n") {
			if (lowerCased === "ondoubleclick") i = "ondblclick";
			else if (lowerCased === "onchange" && (type === "input" || type === "textarea") && !onChangeInputType(props.type))
				lowerCased = i = "oninput";
			else if (lowerCased === "onfocus") i = "onfocusin";
			else if (lowerCased === "onblur") i = "onfocusout";
			else if (ON_ANI.test(i)) i = lowerCased;
		} else if (isNonDashedType && CAMEL_PROPS.test(i)) i = i.replace(CAMEL_REPLACE, "-$&").toLowerCase();
		else if (value === null) value = void 0;
		if (lowerCased === "oninput") {
			i = lowerCased;
			if (normalizedProps[i]) i = "oninputCapture";
		}
		normalizedProps[i] = value;
	}
	if (type == "select") {
		if (normalizedProps.multiple && Array.isArray(normalizedProps.value))
			normalizedProps.value = toChildArray(props.children).forEach((child) => {
				child.props.selected = normalizedProps.value.indexOf(child.props.value) != -1;
			});
		if (normalizedProps.defaultValue != null)
			normalizedProps.value = toChildArray(props.children).forEach((child) => {
				if (normalizedProps.multiple)
					child.props.selected = normalizedProps.defaultValue.indexOf(child.props.value) != -1;
				else child.props.selected = normalizedProps.defaultValue == child.props.value;
			});
	}
	if (props.class && !props.className) {
		normalizedProps.class = props.class;
		Object.defineProperty(normalizedProps, "className", classNameDescriptorNonEnumberable);
	} else if (props.className) normalizedProps.class = normalizedProps.className = props.className;
	vnode.props = normalizedProps;
}
var oldVNodeHook = options$1.vnode;
options$1.vnode = (vnode) => {
	if (typeof vnode.type === "string") handleDomVNode(vnode);
	vnode.$$typeof = REACT_ELEMENT_TYPE;
	if (oldVNodeHook) oldVNodeHook(vnode);
};
var oldBeforeRender = options$1._render;
options$1._render = function (vnode) {
	if (oldBeforeRender) oldBeforeRender(vnode);
	vnode._component;
};
var oldDiffed = options$1.diffed;
/** @type {(vnode: import('./internal').VNode) => void} */
options$1.diffed = function (vnode) {
	if (oldDiffed) oldDiffed(vnode);
	const props = vnode.props;
	const dom = vnode._dom;
	if (dom != null && vnode.type === "textarea" && "value" in props && props.value !== dom.value)
		dom.value = props.value == null ? "" : props.value;
};
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/index.js
/**
 * Remove a component tree from the DOM, including state and event handlers.
 * @param {import('./internal').PreactElement} container
 * @returns {boolean}
 */
function unmountComponentAtNode(container) {
	if (container._children) {
		render$1(null, container);
		return true;
	}
	return false;
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/client.mjs
function createRoot(container) {
	return {
		render: function (children) {
			render(children, container);
		},
		unmount: function () {
			unmountComponentAtNode(container);
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
var LIST_SCAN_MAX_ROWS_READ = 1e4;
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
						scanLimit: LIST_SCAN_MAX_ROWS_READ,
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
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/jsx-runtime/src/index.js
var vnodeId = 0;
Array.isArray;
/**
 * @fileoverview
 * This file exports various methods that implement Babel's "automatic" JSX runtime API:
 * - jsx(type, props, key)
 * - jsxs(type, props, key)
 * - jsxDEV(type, props, key, __source, __self)
 *
 * The implementation of createVNode here is optimized for performance.
 * Benchmarks: https://esbench.com/bench/5f6b54a0b4632100a7dcd2b3
 */
/**
 * JSX.Element factory used by Babel's {runtime:"automatic"} JSX transform
 * @param {VNode['type']} type
 * @param {VNode['props']} props
 * @param {VNode['key']} [key]
 * @param {unknown} [isStaticChildren]
 * @param {unknown} [__source]
 * @param {unknown} [__self]
 */
function createVNode(type, props, key, isStaticChildren, __source, __self) {
	if (!props) props = {};
	let normalizedProps = props,
		ref,
		i;
	if ("ref" in normalizedProps) {
		normalizedProps = {};
		for (i in props)
			if (i == "ref") ref = props[i];
			else normalizedProps[i] = props[i];
	}
	/** @type {VNode & { __source: any; __self: any }} */
	const vnode = {
		type,
		props: normalizedProps,
		key,
		ref,
		_children: null,
		_parent: null,
		_depth: 0,
		_dom: null,
		_component: null,
		constructor: void 0,
		_original: --vnodeId,
		_index: -1,
		_flags: 0,
		__source,
		__self,
	};
	if (typeof type === "function" && (ref = type.defaultProps)) {
		for (i in ref) if (normalizedProps[i] === void 0) normalizedProps[i] = ref[i];
	}
	if (options$1.vnode) options$1.vnode(vnode);
	return vnode;
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
	const media = useMemo(() => create_media_url_manager(props.client), [props.client]);
	const scan = useMemo(() => create_list_scan(props.client), [props.client]);
	const [route, setRoute] = useState(() => parse_route(window.location.hash));
	const [items, setItems] = useState([]);
	const [hasMore, setHasMore] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const loadingRef = useRef(false);
	useEffect(() => {
		const handle_hash_change = () => setRoute(parse_route(window.location.hash));
		window.addEventListener("hashchange", handle_hash_change);
		return () => window.removeEventListener("hashchange", handle_hash_change);
	}, []);
	const load_more = useCallback(async () => {
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
	useEffect(() => {
		load_more();
	}, [load_more]);
	if (route.view === "file") {
		const item = items.find((candidate) => candidate.nodeId === route.nodeId);
		return /* @__PURE__ */ createVNode(FileDetail, {
			nodeId: route.nodeId,
			item,
			media,
		});
	}
	return /* @__PURE__ */ createVNode("div", {
		className: "gallery",
		children: [
			/* @__PURE__ */ createVNode("header", {
				className: "gallery-header",
				children: /* @__PURE__ */ createVNode("h1", { children: "Gallery" }),
			}),
			items.length > 0
				? /* @__PURE__ */ createVNode("div", {
						className: "gallery-grid",
						children: items.map((item) =>
							/* @__PURE__ */ createVNode(
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
				? /* @__PURE__ */ createVNode("div", {
						className: "gallery-status",
						role: "status",
						"aria-live": "polite",
						children: "Loading…",
					})
				: null,
			error !== null
				? /* @__PURE__ */ createVNode("div", {
						className: "gallery-status is-error",
						role: "alert",
						children: [
							/* @__PURE__ */ createVNode("span", { children: error }),
							/* @__PURE__ */ createVNode("button", {
								className: "button",
								onClick: () => void load_more(),
								children: "Retry",
							}),
						],
					})
				: null,
			!loading && error === null && !hasMore && items.length === 0
				? /* @__PURE__ */ createVNode("div", {
						className: "gallery-status",
						children: "No images or videos yet.",
					})
				: null,
			hasMore && !loading && error === null
				? /* @__PURE__ */ createVNode("div", {
						className: "gallery-more",
						children: /* @__PURE__ */ createVNode("button", {
							className: "button",
							onClick: () => void load_more(),
							children: "Load more",
						}),
					})
				: null,
			items.length > 0
				? /* @__PURE__ */ createVNode("div", {
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
	const [mediaUrl, setMediaUrl] = useState(null);
	const [errorMessage, setErrorMessage] = useState(null);
	const autoRenewSpentRef = useRef(false);
	const generationRef = useRef(0);
	const request_url = useCallback(
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
	useEffect(() => {
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
		notify_load_success: useCallback(() => {
			autoRenewSpentRef.current = false;
		}, []),
		notify_load_error: useCallback(() => {
			if (autoRenewSpentRef.current) {
				setMediaUrl(null);
				setErrorMessage("Failed to load media");
				return;
			}
			autoRenewSpentRef.current = true;
			request_url(true);
		}, [request_url]),
		retry: useCallback(() => {
			setErrorMessage(null);
			request_url(true);
		}, [request_url]),
	};
}
function GalleryTile(props) {
	const media_url = use_media_url(props.media, props.item.nodeId);
	const is_video = props.item.contentType !== null && props.item.contentType.startsWith("video/");
	return /* @__PURE__ */ createVNode("div", {
		className: "tile",
		children: [
			/* @__PURE__ */ createVNode("a", {
				className: "tile-link",
				href: `#/file/${encodeURIComponent(props.item.nodeId)}`,
				children: [
					media_url.mediaUrl === null
						? /* @__PURE__ */ createVNode("span", {
								className: media_url.errorMessage !== null ? "tile-placeholder is-failed" : "tile-placeholder",
							})
						: is_video
							? /* @__PURE__ */ createVNode(Fragment, {
									children: [
										/* @__PURE__ */ createVNode("video", {
											className: "tile-media",
											src: media_url.mediaUrl.url,
											preload: "metadata",
											muted: true,
											onLoadedMetadata: media_url.notify_load_success,
											onError: media_url.notify_load_error,
										}),
										/* @__PURE__ */ createVNode("span", {
											className: "tile-play",
											"aria-hidden": "true",
											children: "▶",
										}),
									],
								})
							: /* @__PURE__ */ createVNode("img", {
									className: "tile-media",
									src: media_url.mediaUrl.url,
									alt: "",
									loading: "lazy",
									onLoad: media_url.notify_load_success,
									onError: media_url.notify_load_error,
								}),
					/* @__PURE__ */ createVNode("span", {
						className: "tile-name",
						children: props.item.name,
					}),
				],
			}),
			media_url.errorMessage !== null
				? /* @__PURE__ */ createVNode("button", {
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
	const videoRef = useRef(null);
	const restoreRef = useRef(null);
	const handle_video_error = useCallback(() => {
		const video = videoRef.current;
		if (video && Number.isFinite(video.currentTime))
			restoreRef.current = {
				currentTime: video.currentTime,
				paused: video.paused,
			};
		media_url.notify_load_error();
	}, [media_url.notify_load_error]);
	const handle_video_loaded_metadata = useCallback(() => {
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
	return /* @__PURE__ */ createVNode("div", {
		className: "viewer",
		children: [
			/* @__PURE__ */ createVNode("div", {
				className: "viewer-topbar",
				children: [
					/* @__PURE__ */ createVNode("a", {
						className: "viewer-back",
						href: "#/",
						children: "← Gallery",
					}),
					item !== void 0
						? /* @__PURE__ */ createVNode("div", {
								className: "viewer-titles",
								children: [
									/* @__PURE__ */ createVNode("div", {
										className: "viewer-name",
										children: item.name,
									}),
									/* @__PURE__ */ createVNode("div", {
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
			/* @__PURE__ */ createVNode("div", {
				className: "viewer-stage",
				children:
					media_url.errorMessage !== null
						? /* @__PURE__ */ createVNode("div", {
								className: "viewer-status is-error",
								role: "alert",
								children: [
									/* @__PURE__ */ createVNode("span", { children: media_url.errorMessage }),
									/* @__PURE__ */ createVNode("button", {
										className: "button",
										onClick: media_url.retry,
										children: "Retry",
									}),
								],
							})
						: media_url.mediaUrl === null
							? /* @__PURE__ */ createVNode("div", {
									className: "viewer-status",
									role: "status",
									"aria-live": "polite",
									children: "Loading…",
								})
							: is_video
								? /* @__PURE__ */ createVNode("video", {
										ref: videoRef,
										src: media_url.mediaUrl.url,
										controls: true,
										onLoadedMetadata: handle_video_loaded_metadata,
										onError: handle_video_error,
									})
								: /* @__PURE__ */ createVNode("img", {
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
	return /* @__PURE__ */ createVNode("div", {
		className: props.isError ? "boot-screen is-error" : "boot-screen",
		role: props.isError ? "alert" : "status",
		"aria-live": props.isError ? void 0 : "polite",
		children: props.message,
	});
}
var container = document.getElementById("root");
if (!container) throw new Error("index.html is missing the #root element");
var root = createRoot(container);
root.render(/* @__PURE__ */ createVNode(BootScreen, { message: "Connecting…" }));
bonobo_ui_connect().then(
	(client) => {
		if (client.context.kind === "page") document.title = client.context.pageTitle;
		root.render(/* @__PURE__ */ createVNode(App, { client }));
	},
	(error) => {
		root.render(
			/* @__PURE__ */ createVNode(BootScreen, {
				message: error instanceof Error ? error.message : String(error),
				isError: true,
			}),
		);
	},
);
//#endregion
