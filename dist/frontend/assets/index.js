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
function createRef() {
	return { current: null };
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
/**
 * Update an existing DOM element with data from a Preact virtual node
 * @param {import('./internal').ComponentChild} vnode The virtual node to render
 * @param {import('./internal').PreactElement} parentDom The DOM element to update
 */
function hydrate$1(vnode, parentDom) {
	render$1(vnode, parentDom, hydrate$1);
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/clone-element.js
/**
 * Clones the given VNode, optionally adding attributes/props and replacing its
 * children.
 * @param {import('./internal').VNode} vnode The virtual DOM element to clone
 * @param {object} props Attributes/props to add when cloning
 * @param {Array<import('./internal').ComponentChildren>} rest Any additional arguments will be used
 * as replacement children.
 * @returns {import('./internal').VNode}
 */
function cloneElement$1(vnode, props, children) {
	let normalizedProps = assign$1({}, vnode.props),
		key,
		ref,
		i;
	let defaultProps;
	if (vnode.type && vnode.type.defaultProps) defaultProps = vnode.type.defaultProps;
	for (i in props)
		if (i == "key") key = props[i];
		else if (i == "ref") ref = props[i];
		else if (props[i] === void 0 && defaultProps != void 0) normalizedProps[i] = defaultProps[i];
		else normalizedProps[i] = props[i];
	if (arguments.length > 2) normalizedProps.children = arguments.length > 3 ? slice.call(arguments, 2) : children;
	return createVNode$1(vnode.type, normalizedProps, key || vnode.key, ref || vnode.ref, null);
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/src/create-context.js
var i$1 = 0;
function createContext(defaultValue) {
	function Context(props) {
		if (!this.getChildContext) {
			/** @type {Set<import('./internal').Component> | null} */
			let subs = /* @__PURE__ */ new Set();
			let ctx = {};
			ctx[Context._id] = this;
			this.getChildContext = () => ctx;
			this.componentWillUnmount = () => {
				subs = null;
			};
			this.shouldComponentUpdate = function (_props) {
				if (this.props.value != _props.value)
					subs.forEach((c) => {
						c._force = true;
						enqueueRender(c);
					});
			};
			this.sub = (c) => {
				subs.add(c);
				let old = c.componentWillUnmount;
				c.componentWillUnmount = () => {
					if (subs) subs.delete(c);
					if (old) old.call(c);
				};
			};
		}
		return props.children;
	}
	Context._id = "__cC" + i$1++;
	Context._defaultValue = defaultValue;
	/** @type {import('./internal').FunctionComponent} */
	Context.Consumer = (props, contextValue) => {
		return props.children(contextValue);
	};
	Context.Provider = Context._contextRef = Context.Consumer.contextType = Context;
	return Context;
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
/**
 * @param {import('./internal').Effect} callback
 * @param {unknown[]} args
 * @returns {void}
 */
function useLayoutEffect(callback, args) {
	/** @type {import('./internal').EffectHookState} */
	const state = getHookState(currentIndex++, 4);
	if (!options._skipEffects && argsChanged(state._args, args)) {
		state._value = callback;
		state._pendingArgs = args;
		currentComponent$1._renderCallbacks.push(state);
	}
}
/** @type {(initialValue: unknown) => unknown} */
function useRef(initialValue) {
	currentHook = 5;
	return useMemo(() => ({ current: initialValue }), []);
}
/**
 * @param {object} ref
 * @param {() => object} createHandle
 * @param {unknown[]} args
 * @returns {void}
 */
function useImperativeHandle(ref, createHandle, args) {
	currentHook = 6;
	useLayoutEffect(
		() => {
			if (typeof ref == "function") {
				const result = ref(createHandle());
				return () => {
					ref(null);
					if (result && typeof result == "function") result();
				};
			} else if (ref) {
				ref.current = createHandle();
				return () => (ref.current = null);
			}
		},
		args == null ? args : args.concat(ref),
	);
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
 * @param {import('./internal').PreactContext} context
 */
function useContext(context) {
	const provider = currentComponent$1.context[context._id];
	/** @type {import('./internal').ContextHookState} */
	const state = getHookState(currentIndex++, 9);
	state._context = context;
	if (!provider) return context._defaultValue;
	if (state._value == null) {
		state._value = true;
		provider.sub(currentComponent$1);
	}
	return provider.props.value;
}
/**
 * Display a custom label for a custom hook for the devtools panel
 * @type {<T>(value: T, cb?: (value: T) => string | number) => void}
 */
function useDebugValue(value, formatter) {
	if (options.useDebugValue) options.useDebugValue(formatter ? formatter(value) : value);
}
/** @type {() => string} */
function useId() {
	/** @type {import('./internal').IdHookState} */
	const state = getHookState(currentIndex++, 11);
	if (!state._value) {
		/** @type {import('./internal').VNode} */
		let root = currentComponent$1._vnode;
		while (root !== null && !root._mask && root._parent !== null) root = root._parent;
		let mask = root._mask || (root._mask = [0, 0]);
		state._value = "P" + mask[0] + "-" + mask[1]++;
	}
	return state._value;
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
/**
 * Check if two values are the same value
 * @param {*} x
 * @param {*} y
 * @returns {boolean}
 */
function is(x, y) {
	return (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y);
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/hooks.js
/**
 * This is taken from https://github.com/facebook/react/blob/main/packages/use-sync-external-store/src/useSyncExternalStoreShimClient.js#L84
 * on a high level this cuts out the warnings, ... and attempts a smaller implementation
 * @typedef {{ _value: any; _getSnapshot: () => any }} Store
 */
function useSyncExternalStore(subscribe, getSnapshot) {
	const value = getSnapshot();
	/**
	 * @typedef {{ _instance: Store }} StoreRef
	 * @type {[StoreRef, (store: StoreRef) => void]}
	 */
	const [{ _instance }, forceUpdate] = useState({
		_instance: {
			_value: value,
			_getSnapshot: getSnapshot,
		},
	});
	useLayoutEffect(() => {
		_instance._value = value;
		_instance._getSnapshot = getSnapshot;
		if (didSnapshotChange(_instance)) forceUpdate({ _instance });
	}, [subscribe, value, getSnapshot]);
	useEffect(() => {
		if (didSnapshotChange(_instance)) forceUpdate({ _instance });
		return subscribe(() => {
			if (didSnapshotChange(_instance)) forceUpdate({ _instance });
		});
	}, [subscribe]);
	return value;
}
/** @type {(inst: Store) => boolean} */
function didSnapshotChange(inst) {
	try {
		return !is(inst._value, inst._getSnapshot());
	} catch (error) {
		return true;
	}
}
function startTransition(cb) {
	cb();
}
function useDeferredValue(val) {
	return val;
}
function useTransition() {
	return [false, startTransition];
}
var useInsertionEffect = useLayoutEffect;
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
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/memo.js
/**
 * Memoize a component, so that it only updates when the props actually have
 * changed. This was previously known as `React.pure`.
 * @param {import('./internal').FunctionComponent} c functional component
 * @param {(prev: object, next: object) => boolean} [comparer] Custom equality function
 * @returns {import('./internal').FunctionComponent}
 */
function memo(c, comparer) {
	function shouldUpdate(nextProps) {
		let ref = this.props.ref;
		if (ref != nextProps.ref && ref) typeof ref == "function" ? ref(null) : (ref.current = null);
		return comparer ? !comparer(this.props, nextProps) || ref != nextProps.ref : shallowDiffers(this.props, nextProps);
	}
	function Memoed(props) {
		this.shouldComponentUpdate = shouldUpdate;
		return createElement(c, props);
	}
	Memoed.displayName = "Memo(" + (c.displayName || c.name) + ")";
	Memoed._forwarded = Memoed.prototype.isReactComponent = true;
	Memoed.type = c;
	return Memoed;
}
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
var REACT_FORWARD_SYMBOL = (typeof Symbol != "undefined" && Symbol.for && Symbol.for("react.forward_ref")) || 3911;
/**
 * Pass ref down to a child. This is mainly used in libraries with HOCs that
 * wrap components. Using `forwardRef` there is an easy way to get a reference
 * of the wrapped component instead of one of the wrapper itself.
 * @param {import('./index').ForwardFn} fn
 * @returns {import('./internal').FunctionComponent}
 */
function forwardRef(fn) {
	function Forwarded(props) {
		let clone = assign({}, props);
		delete clone.ref;
		return fn(clone, props.ref || null);
	}
	Forwarded.$$typeof = REACT_FORWARD_SYMBOL;
	Forwarded.render = fn;
	Forwarded.prototype.isReactComponent = Forwarded._forwarded = true;
	Forwarded.displayName = "ForwardRef(" + (fn.displayName || fn.name) + ")";
	return Forwarded;
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/Children.js
var mapFn = (children, fn) => {
	if (children == null) return null;
	return toChildArray(toChildArray(children).map(fn));
};
var Children = {
	map: mapFn,
	forEach: mapFn,
	count(children) {
		return children ? toChildArray(children).length : 0;
	},
	only(children) {
		const normalized = toChildArray(children);
		if (normalized.length !== 1) throw "Children.only";
		return normalized[0];
	},
	toArray: toChildArray,
};
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
function lazy(loader) {
	let prom;
	let component = null;
	let error;
	let resolved;
	function Lazy(props) {
		if (!prom) {
			prom = loader();
			prom.then(
				(exports) => {
					if (exports) component = exports.default || exports;
					resolved = true;
				},
				(e) => {
					error = e;
					resolved = true;
				},
			);
		}
		if (error) throw error;
		if (!resolved) throw prom;
		return component ? createElement(component, props) : null;
	}
	Lazy.displayName = "Lazy";
	Lazy._forwarded = true;
	return Lazy;
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
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/portals.js
/**
 * @param {import('../../src/index').RenderableProps<{ context: any }>} props
 */
function ContextProvider(props) {
	this.getChildContext = () => props.context;
	return props.children;
}
/**
 * Portal component
 * @this {import('./internal').Component}
 * @param {object | null | undefined} props
 *
 * TODO: use createRoot() instead of fake root
 */
function Portal(props) {
	const _this = this;
	let container = props._container;
	_this.componentWillUnmount = function () {
		render$1(null, _this._temp);
		_this._temp = null;
		_this._container = null;
	};
	if (_this._container && _this._container !== container) _this.componentWillUnmount();
	if (!_this._temp) {
		let root = _this._vnode;
		while (root !== null && !root._mask && root._parent !== null) root = root._parent;
		_this._container = container;
		_this._temp = {
			nodeType: 1,
			parentNode: container,
			childNodes: [],
			_children: { _mask: root._mask },
			contains: () => true,
			namespaceURI: container.namespaceURI,
			insertBefore(child, before) {
				this.childNodes.push(child);
				_this._container.insertBefore(child, before);
			},
			removeChild(child) {
				this.childNodes.splice(this.childNodes.indexOf(child) >>> 1, 1);
				_this._container.removeChild(child);
			},
		};
	}
	render$1(createElement(ContextProvider, { context: _this.context }, props._vnode), _this._temp);
}
/**
 * Create a `Portal` to continue rendering the vnode tree at a different DOM node
 * @param {import('./internal').VNode} vnode The vnode to render
 * @param {import('./internal').PreactElement} container The DOM node to continue rendering in to.
 */
function createPortal(vnode, container) {
	const el = createElement(Portal, {
		_vnode: vnode,
		_container: container,
	});
	el.containerInfo = container;
	return el;
}
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
function hydrate(vnode, parent, callback) {
	hydrate$1(vnode, parent);
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
var currentComponent;
var oldBeforeRender = options$1._render;
options$1._render = function (vnode) {
	if (oldBeforeRender) oldBeforeRender(vnode);
	currentComponent = vnode._component;
};
var oldDiffed = options$1.diffed;
/** @type {(vnode: import('./internal').VNode) => void} */
options$1.diffed = function (vnode) {
	if (oldDiffed) oldDiffed(vnode);
	const props = vnode.props;
	const dom = vnode._dom;
	if (dom != null && vnode.type === "textarea" && "value" in props && props.value !== dom.value)
		dom.value = props.value == null ? "" : props.value;
	currentComponent = null;
};
var __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	ReactCurrentDispatcher: {
		current: {
			readContext(context) {
				return currentComponent._globalContext[context._id].props.value;
			},
			useCallback,
			useContext,
			useDebugValue,
			useDeferredValue,
			useEffect,
			useId,
			useImperativeHandle,
			useInsertionEffect,
			useLayoutEffect,
			useMemo,
			useReducer,
			useRef,
			useState,
			useSyncExternalStore,
			useTransition,
		},
	},
};
//#endregion
//#region node_modules/.pnpm/preact@10.29.8/node_modules/preact/compat/src/index.js
var version$1 = "18.3.1";
/**
 * Legacy version of createElement.
 * @param {import('./internal').VNode["type"]} type The node name or Component constructor
 */
function createFactory(type) {
	return createElement.bind(null, type);
}
/**
 * Check if the passed element is a valid (p)react node.
 * @param {*} element The element to check
 * @returns {boolean}
 */
function isValidElement(element) {
	return !!element && element.$$typeof === REACT_ELEMENT_TYPE;
}
/**
 * Check if the passed element is a Fragment node.
 * @param {*} element The element to check
 * @returns {boolean}
 */
function isFragment(element) {
	return isValidElement(element) && element.type === Fragment;
}
/**
 * Check if the passed element is a Memo node.
 * @param {*} element The element to check
 * @returns {boolean}
 */
function isMemo(element) {
	return !!element && typeof element.displayName == "string" && element.displayName.indexOf("Memo(") == 0;
}
/**
 * Wrap `cloneElement` to abort if the passed element is not a valid element and apply
 * all vnode normalizations.
 * @param {import('./internal').VNode} element The vnode to clone
 * @param {object} props Props to add when cloning
 * @param {Array<import('./internal').ComponentChildren>} rest Optional component children
 */
function cloneElement(element) {
	if (!isValidElement(element)) return element;
	return cloneElement$1.apply(null, arguments);
}
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
/**
 * Get the matching DOM node for a component
 * @param {import('./internal').Component} component
 * @returns {import('./internal').PreactElement | null}
 */
function findDOMNode(component) {
	return (component && (component.base || (component.nodeType === 1 && component))) || null;
}
/**
 * Deprecated way to control batched rendering inside the reconciler, but we
 * already schedule in batches inside our rendering code
 * @template Arg
 * @param {(arg: Arg) => void} callback function that triggers the updated
 * @param {Arg} [arg] Optional argument that can be passed to the callback
 */
var unstable_batchedUpdates = (callback, arg) => callback(arg);
/**
 * In React, `flushSync` flushes the entire tree and forces a rerender.
 * @template Arg
 * @template Result
 * @param {(arg: Arg) => Result} callback function that runs before the flush
 * @param {Arg} [arg] Optional argument that can be passed to the callback
 * @returns
 */
var flushSync = (callback, arg) => {
	const prevDebounce = options$1.debounceRendering;
	let flush;
	options$1.debounceRendering = (cb) => {
		flush = cb;
	};
	try {
		const res = callback(arg);
		if (flush) flush();
		return res;
	} finally {
		options$1.debounceRendering = prevDebounce;
	}
};
var src_default = {
	useState,
	useId,
	useReducer,
	useEffect,
	useLayoutEffect,
	useInsertionEffect,
	useTransition,
	useDeferredValue,
	useSyncExternalStore,
	startTransition,
	useRef,
	useImperativeHandle,
	useMemo,
	useCallback,
	useContext,
	useDebugValue,
	version: version$1,
	Children,
	render,
	hydrate,
	unmountComponentAtNode,
	createPortal,
	createElement,
	createContext,
	createFactory,
	cloneElement,
	createRef,
	Fragment,
	isValidElement,
	isElement: isValidElement,
	isFragment,
	isMemo,
	findDOMNode,
	Component: BaseComponent,
	PureComponent,
	memo,
	forwardRef,
	flushSync,
	unstable_batchedUpdates,
	StrictMode: Fragment,
	Suspense,
	SuspenseList,
	lazy,
	__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
};
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/values/base64.js
var lookup = [];
var revLookup = [];
var Arr = Uint8Array;
var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (var i = 0, len = code.length; i < len; ++i) {
	lookup[i] = code[i];
	revLookup[code.charCodeAt(i)] = i;
}
revLookup["-".charCodeAt(0)] = 62;
revLookup["_".charCodeAt(0)] = 63;
function getLens(b64) {
	var len = b64.length;
	if (len % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
	var validLen = b64.indexOf("=");
	if (validLen === -1) validLen = len;
	var placeHoldersLen = validLen === len ? 0 : 4 - (validLen % 4);
	return [validLen, placeHoldersLen];
}
function _byteLength(_b64, validLen, placeHoldersLen) {
	return ((validLen + placeHoldersLen) * 3) / 4 - placeHoldersLen;
}
function toByteArray(b64) {
	var tmp;
	var lens = getLens(b64);
	var validLen = lens[0];
	var placeHoldersLen = lens[1];
	var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
	var curByte = 0;
	var len = placeHoldersLen > 0 ? validLen - 4 : validLen;
	var i;
	for (i = 0; i < len; i += 4) {
		tmp =
			(revLookup[b64.charCodeAt(i)] << 18) |
			(revLookup[b64.charCodeAt(i + 1)] << 12) |
			(revLookup[b64.charCodeAt(i + 2)] << 6) |
			revLookup[b64.charCodeAt(i + 3)];
		arr[curByte++] = (tmp >> 16) & 255;
		arr[curByte++] = (tmp >> 8) & 255;
		arr[curByte++] = tmp & 255;
	}
	if (placeHoldersLen === 2) {
		tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
		arr[curByte++] = tmp & 255;
	}
	if (placeHoldersLen === 1) {
		tmp =
			(revLookup[b64.charCodeAt(i)] << 10) |
			(revLookup[b64.charCodeAt(i + 1)] << 4) |
			(revLookup[b64.charCodeAt(i + 2)] >> 2);
		arr[curByte++] = (tmp >> 8) & 255;
		arr[curByte++] = tmp & 255;
	}
	return arr;
}
function tripletToBase64(num) {
	return lookup[(num >> 18) & 63] + lookup[(num >> 12) & 63] + lookup[(num >> 6) & 63] + lookup[num & 63];
}
function encodeChunk(uint8, start, end) {
	var tmp;
	var output = [];
	for (var i = start; i < end; i += 3) {
		tmp = ((uint8[i] << 16) & 16711680) + ((uint8[i + 1] << 8) & 65280) + (uint8[i + 2] & 255);
		output.push(tripletToBase64(tmp));
	}
	return output.join("");
}
function fromByteArray(uint8) {
	var tmp;
	var len = uint8.length;
	var extraBytes = len % 3;
	var parts = [];
	var maxChunkLength = 16383;
	for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength)
		parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
	if (extraBytes === 1) {
		tmp = uint8[len - 1];
		parts.push(lookup[tmp >> 2] + lookup[(tmp << 4) & 63] + "==");
	} else if (extraBytes === 2) {
		tmp = (uint8[len - 2] << 8) + uint8[len - 1];
		parts.push(lookup[tmp >> 10] + lookup[(tmp >> 4) & 63] + lookup[(tmp << 2) & 63] + "=");
	}
	return parts.join("");
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/common/index.js
function parseArgs(args) {
	if (args === void 0) return {};
	if (!isSimpleObject(args)) throw new Error(`The arguments to a Convex function must be an object. Received: ${args}`);
	return args;
}
function validateDeploymentUrl(deploymentUrl) {
	if (typeof deploymentUrl === "undefined")
		throw new Error(
			`Client created with undefined deployment address. If you used an environment variable, check that it's set.`,
		);
	if (typeof deploymentUrl !== "string") throw new Error(`Invalid deployment address: found ${deploymentUrl}".`);
	if (!(deploymentUrl.startsWith("http:") || deploymentUrl.startsWith("https:")))
		throw new Error(`Invalid deployment address: Must start with "https://" or "http://". Found "${deploymentUrl}".`);
	try {
		new URL(deploymentUrl);
	} catch {
		throw new Error(
			`Invalid deployment address: "${deploymentUrl}" is not a valid URL. If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`,
		);
	}
	if (deploymentUrl.endsWith(".convex.site"))
		throw new Error(
			`Invalid deployment address: "${deploymentUrl}" ends with .convex.site, which is used for HTTP Actions. Convex deployment URLs typically end with .convex.cloud? If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`,
		);
}
function isSimpleObject(value) {
	const isObject = typeof value === "object";
	const prototype = Object.getPrototypeOf(value);
	const isSimple = prototype === null || prototype === Object.prototype || prototype?.constructor?.name === "Object";
	return isObject && isSimple;
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/values/value.js
var LITTLE_ENDIAN = true;
var MIN_INT64 = BigInt("-9223372036854775808");
var MAX_INT64 = BigInt("9223372036854775807");
var ZERO = BigInt("0");
var EIGHT = BigInt("8");
var TWOFIFTYSIX = BigInt("256");
var COMMIT_TS_UNRESOLVED =
	"This commit timestamp is unresolved: its value is assigned when the mutation commits. Read the document after the mutation completes to get its value.";
var CommitTsPlaceholder = class {
	[Symbol.toPrimitive](hint) {
		if (hint === "string") return this.toString();
		throw new Error(COMMIT_TS_UNRESOLVED);
	}
	valueOf() {
		throw new Error(COMMIT_TS_UNRESOLVED);
	}
	toJSON() {
		throw new Error(COMMIT_TS_UNRESOLVED);
	}
	toString() {
		return "[unresolved commit timestamp]";
	}
};
var commitTsPlaceholder = new CommitTsPlaceholder();
function isSpecial(n) {
	return Number.isNaN(n) || !Number.isFinite(n) || Object.is(n, -0);
}
function slowBigIntToBase64(value) {
	if (value < ZERO) value -= MIN_INT64 + MIN_INT64;
	let hex = value.toString(16);
	if (hex.length % 2 === 1) hex = "0" + hex;
	const bytes = new Uint8Array(/* @__PURE__ */ new ArrayBuffer(8));
	let i = 0;
	for (const hexByte of hex.match(/.{2}/g).reverse()) {
		bytes.set([parseInt(hexByte, 16)], i++);
		value >>= EIGHT;
	}
	return fromByteArray(bytes);
}
function slowBase64ToBigInt(encoded) {
	const integerBytes = toByteArray(encoded);
	if (integerBytes.byteLength !== 8)
		throw new Error(`Received ${integerBytes.byteLength} bytes, expected 8 for $integer`);
	let value = ZERO;
	let power = ZERO;
	for (const byte of integerBytes) {
		value += BigInt(byte) * TWOFIFTYSIX ** power;
		power++;
	}
	if (value > MAX_INT64) value += MIN_INT64 + MIN_INT64;
	return value;
}
function modernBigIntToBase64(value) {
	if (value < MIN_INT64 || MAX_INT64 < value)
		throw new Error(`BigInt ${value} does not fit into a 64-bit signed integer.`);
	const buffer = /* @__PURE__ */ new ArrayBuffer(8);
	new DataView(buffer).setBigInt64(0, value, true);
	return fromByteArray(new Uint8Array(buffer));
}
function modernBase64ToBigInt(encoded) {
	const integerBytes = toByteArray(encoded);
	if (integerBytes.byteLength !== 8)
		throw new Error(`Received ${integerBytes.byteLength} bytes, expected 8 for $integer`);
	return new DataView(integerBytes.buffer).getBigInt64(0, true);
}
var bigIntToBase64 = DataView.prototype.setBigInt64 ? modernBigIntToBase64 : slowBigIntToBase64;
var base64ToBigInt = DataView.prototype.getBigInt64 ? modernBase64ToBigInt : slowBase64ToBigInt;
var MAX_IDENTIFIER_LEN = 1024;
function validateObjectField(k) {
	if (k.length > MAX_IDENTIFIER_LEN)
		throw new Error(`Field name ${k} exceeds maximum field name length ${MAX_IDENTIFIER_LEN}.`);
	if (k.startsWith("$")) throw new Error(`Field name ${k} starts with a '$', which is reserved.`);
	for (let i = 0; i < k.length; i += 1) {
		const charCode = k.charCodeAt(i);
		if (charCode < 32 || charCode >= 127)
			throw new Error(
				`Field name ${k} has invalid character '${k[i]}': Field names can only contain non-control ASCII characters`,
			);
	}
}
function jsonToConvex(value) {
	if (value === null) return value;
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value;
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map((value2) => jsonToConvex(value2));
	if (typeof value !== "object") throw new Error(`Unexpected type of ${value}`);
	const entries = Object.entries(value);
	if (entries.length === 1) {
		const key = entries[0][0];
		if (key === "$bytes") {
			if (typeof value.$bytes !== "string") throw new Error(`Malformed $bytes field on ${value}`);
			return toByteArray(value.$bytes).buffer;
		}
		if (key === "$integer") {
			if (typeof value.$integer !== "string") throw new Error(`Malformed $integer field on ${value}`);
			return base64ToBigInt(value.$integer);
		}
		if (key === "$float") {
			if (typeof value.$float !== "string") throw new Error(`Malformed $float field on ${value}`);
			const floatBytes = toByteArray(value.$float);
			if (floatBytes.byteLength !== 8)
				throw new Error(`Received ${floatBytes.byteLength} bytes, expected 8 for $float`);
			const float = new DataView(floatBytes.buffer).getFloat64(0, LITTLE_ENDIAN);
			if (!isSpecial(float)) throw new Error(`Float ${float} should be encoded as a number`);
			return float;
		}
		if (key === "$commitTs") {
			if (value.$commitTs !== null) throw new Error(`Malformed $commitTs field on ${value}`);
			return commitTsPlaceholder;
		}
		if (key === "$set") throw new Error(`Received a Set which is no longer supported as a Convex type.`);
		if (key === "$map") throw new Error(`Received a Map which is no longer supported as a Convex type.`);
	}
	const out = {};
	for (const [k, v] of Object.entries(value)) {
		validateObjectField(k);
		out[k] = jsonToConvex(v);
	}
	return out;
}
var MAX_VALUE_FOR_ERROR_LEN = 16384;
function stringifyValueForError(value) {
	const str = JSON.stringify(value, (_key, value2) => {
		if (value2 === void 0) return "undefined";
		if (typeof value2 === "bigint") return `${value2.toString()}n`;
		return value2;
	});
	if (str.length > MAX_VALUE_FOR_ERROR_LEN) {
		const rest = "[...truncated]";
		let truncateAt = MAX_VALUE_FOR_ERROR_LEN - 14;
		const codePoint = str.codePointAt(truncateAt - 1);
		if (codePoint !== void 0 && codePoint > 65535) truncateAt -= 1;
		return str.substring(0, truncateAt) + rest;
	}
	return str;
}
function convexToJsonInternal(value, originalValue, context, includeTopLevelUndefined) {
	if (value === void 0) {
		const contextText =
			context && ` (present at path ${context} in original object ${stringifyValueForError(originalValue)})`;
		throw new Error(
			`undefined is not a valid Convex value${contextText}. To learn about Convex's supported types, see https://docs.convex.dev/using/types.`,
		);
	}
	if (value === null) return value;
	if (typeof value === "bigint") {
		if (value < MIN_INT64 || MAX_INT64 < value)
			throw new Error(`BigInt ${value} does not fit into a 64-bit signed integer.`);
		return { $integer: bigIntToBase64(value) };
	}
	if (typeof value === "number")
		if (isSpecial(value)) {
			const buffer = /* @__PURE__ */ new ArrayBuffer(8);
			new DataView(buffer).setFloat64(0, value, LITTLE_ENDIAN);
			return { $float: fromByteArray(new Uint8Array(buffer)) };
		} else return value;
	if (typeof value === "boolean") return value;
	if (typeof value === "string") return value;
	if (value instanceof ArrayBuffer) return { $bytes: fromByteArray(new Uint8Array(value)) };
	if (value instanceof CommitTsPlaceholder) return { $commitTs: null };
	if (Array.isArray(value))
		return value.map((value2, i) => convexToJsonInternal(value2, originalValue, context + `[${i}]`, false));
	if (value instanceof Set) throw new Error(errorMessageForUnsupportedType(context, "Set", [...value], originalValue));
	if (value instanceof Map) throw new Error(errorMessageForUnsupportedType(context, "Map", [...value], originalValue));
	if (!isSimpleObject(value)) {
		const theType = value?.constructor?.name;
		const typeName = theType ? `${theType} ` : "";
		throw new Error(errorMessageForUnsupportedType(context, typeName, value, originalValue));
	}
	const out = {};
	const entries = Object.entries(value);
	entries.sort(([k1, _v1], [k2, _v2]) => (k1 === k2 ? 0 : k1 < k2 ? -1 : 1));
	for (const [k, v] of entries)
		if (v !== void 0) {
			validateObjectField(k);
			out[k] = convexToJsonInternal(v, originalValue, context + `.${k}`, false);
		} else if (includeTopLevelUndefined) {
			validateObjectField(k);
			out[k] = convexOrUndefinedToJsonInternal(v, originalValue, context + `.${k}`);
		}
	return out;
}
function errorMessageForUnsupportedType(context, typeName, value, originalValue) {
	if (context)
		return `${typeName}${stringifyValueForError(value)} is not a supported Convex type (present at path ${context} in original object ${stringifyValueForError(originalValue)}). To learn about Convex's supported types, see https://docs.convex.dev/using/types.`;
	else return `${typeName}${stringifyValueForError(value)} is not a supported Convex type.`;
}
function convexOrUndefinedToJsonInternal(value, originalValue, context) {
	if (value === void 0) return { $undefined: null };
	else {
		if (originalValue === void 0)
			throw new Error(
				`Programming error. Current value is ${stringifyValueForError(value)} but original value is undefined`,
			);
		return convexToJsonInternal(value, originalValue, context, false);
	}
}
function convexToJson(value) {
	return convexToJsonInternal(value, value, "", false);
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/values/errors.js
var __defProp$11 = Object.defineProperty;
var __defNormalProp$11 = (obj, key, value) =>
	key in obj
		? __defProp$11(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$11 = (obj, key, value) => __defNormalProp$11(obj, typeof key !== "symbol" ? key + "" : key, value);
var _a;
var _b;
var IDENTIFYING_FIELD = Symbol.for("ConvexError");
var ConvexError = class extends ((_b = Error), (_a = IDENTIFYING_FIELD), _b) {
	constructor(data) {
		super(typeof data === "string" ? data : stringifyValueForError(data));
		__publicField$11(this, "name", "ConvexError");
		__publicField$11(this, "data");
		__publicField$11(this, _a, true);
		this.data = data;
	}
};
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/index.js
var version = "1.45.0";
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/logging.js
var __defProp$10 = Object.defineProperty;
var __defNormalProp$10 = (obj, key, value) =>
	key in obj
		? __defProp$10(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$10 = (obj, key, value) => __defNormalProp$10(obj, typeof key !== "symbol" ? key + "" : key, value);
var INFO_COLOR = "color:rgb(0, 145, 255)";
function prefix_for_source(source) {
	switch (source) {
		case "query":
			return "Q";
		case "mutation":
			return "M";
		case "action":
			return "A";
		case "any":
			return "?";
	}
}
var DefaultLogger = class {
	constructor(options) {
		__publicField$10(this, "_onLogLineFuncs");
		__publicField$10(this, "_verbose");
		this._onLogLineFuncs = {};
		this._verbose = options.verbose;
	}
	addLogLineListener(func) {
		let id = Math.random().toString(36).substring(2, 15);
		for (let i = 0; i < 10; i++) {
			if (this._onLogLineFuncs[id] === void 0) break;
			id = Math.random().toString(36).substring(2, 15);
		}
		this._onLogLineFuncs[id] = func;
		return () => {
			delete this._onLogLineFuncs[id];
		};
	}
	logVerbose(...args) {
		if (this._verbose)
			for (const func of Object.values(this._onLogLineFuncs))
				func("debug", `${/* @__PURE__ */ new Date().toISOString()}`, ...args);
	}
	log(...args) {
		for (const func of Object.values(this._onLogLineFuncs)) func("info", ...args);
	}
	warn(...args) {
		for (const func of Object.values(this._onLogLineFuncs)) func("warn", ...args);
	}
	error(...args) {
		for (const func of Object.values(this._onLogLineFuncs)) func("error", ...args);
	}
};
function instantiateDefaultLogger(options) {
	const logger = new DefaultLogger(options);
	logger.addLogLineListener((level, ...args) => {
		switch (level) {
			case "debug":
				console.debug(...args);
				break;
			case "info":
				console.log(...args);
				break;
			case "warn":
				console.warn(...args);
				break;
			case "error":
				console.error(...args);
				break;
			default:
				console.log(...args);
		}
	});
	return logger;
}
function instantiateNoopLogger(options) {
	return new DefaultLogger(options);
}
function logForFunction(logger, type, source, udfPath, message) {
	const prefix = prefix_for_source(source);
	if (typeof message === "object") message = `ConvexError ${JSON.stringify(message.errorData, null, 2)}`;
	if (type === "info") {
		const match = message.match(/^\[.*?\] /);
		if (match === null) {
			logger.error(`[CONVEX ${prefix}(${udfPath})] Could not parse console.log`);
			return;
		}
		const level = message.slice(1, match[0].length - 2);
		const args = message.slice(match[0].length);
		logger.log(`%c[CONVEX ${prefix}(${udfPath})] [${level}]`, INFO_COLOR, args);
	} else logger.error(`[CONVEX ${prefix}(${udfPath})] ${message}`);
}
function logFatalError(logger, message) {
	const errorMessage = `[CONVEX FATAL ERROR] ${message}`;
	logger.error(errorMessage);
	return new Error(errorMessage);
}
function createHybridErrorStacktrace(source, udfPath, result) {
	return `[CONVEX ${prefix_for_source(source)}(${udfPath})] ${result.errorMessage}
  Called by client`;
}
function forwardData(result, error) {
	error.data = result.errorData;
	return error;
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/udf_path_utils.js
function canonicalizeUdfPath(udfPath) {
	const pieces = udfPath.split(":");
	let moduleName;
	let functionName;
	if (pieces.length === 1) {
		moduleName = pieces[0];
		functionName = "default";
	} else {
		moduleName = pieces.slice(0, pieces.length - 1).join(":");
		functionName = pieces[pieces.length - 1];
	}
	if (moduleName.endsWith(".js")) moduleName = moduleName.slice(0, -3);
	return `${moduleName}:${functionName}`;
}
function serializePathAndArgs(udfPath, args) {
	return JSON.stringify({
		udfPath: canonicalizeUdfPath(udfPath),
		args: convexToJson(args),
	});
}
function serializePaginatedPathAndArgs(udfPath, args, options) {
	const { initialNumItems, id } = options;
	return JSON.stringify({
		type: "paginated",
		udfPath: canonicalizeUdfPath(udfPath),
		args: convexToJson(args),
		options: convexToJson({
			initialNumItems,
			id,
		}),
	});
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/local_state.js
var __defProp$9 = Object.defineProperty;
var __defNormalProp$9 = (obj, key, value) =>
	key in obj
		? __defProp$9(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$9 = (obj, key, value) => __defNormalProp$9(obj, typeof key !== "symbol" ? key + "" : key, value);
var LocalSyncState = class {
	constructor() {
		__publicField$9(this, "nextQueryId");
		__publicField$9(this, "querySetVersion");
		__publicField$9(this, "querySet");
		__publicField$9(this, "queryIdToToken");
		__publicField$9(this, "identityVersion");
		__publicField$9(this, "auth");
		__publicField$9(this, "outstandingQueriesOlderThanRestart");
		__publicField$9(this, "outstandingAuthOlderThanRestart");
		__publicField$9(this, "paused");
		__publicField$9(this, "pendingQuerySetModifications");
		this.nextQueryId = 0;
		this.querySetVersion = 0;
		this.identityVersion = 0;
		this.querySet = /* @__PURE__ */ new Map();
		this.queryIdToToken = /* @__PURE__ */ new Map();
		this.outstandingQueriesOlderThanRestart = /* @__PURE__ */ new Set();
		this.outstandingAuthOlderThanRestart = false;
		this.paused = false;
		this.pendingQuerySetModifications = /* @__PURE__ */ new Map();
	}
	hasSyncedPastLastReconnect() {
		return this.outstandingQueriesOlderThanRestart.size === 0 && !this.outstandingAuthOlderThanRestart;
	}
	markAuthCompletion() {
		this.outstandingAuthOlderThanRestart = false;
	}
	subscribe(udfPath, args, journal, componentPath) {
		const canonicalizedUdfPath = canonicalizeUdfPath(udfPath);
		const queryToken = serializePathAndArgs(canonicalizedUdfPath, args);
		const existingEntry = this.querySet.get(queryToken);
		if (existingEntry !== void 0) {
			existingEntry.numSubscribers += 1;
			return {
				queryToken,
				modification: null,
				unsubscribe: () => this.removeSubscriber(queryToken),
			};
		} else {
			const queryId = this.nextQueryId++;
			const query = {
				id: queryId,
				canonicalizedUdfPath,
				args,
				numSubscribers: 1,
				journal,
				componentPath,
			};
			this.querySet.set(queryToken, query);
			this.queryIdToToken.set(queryId, queryToken);
			const baseVersion = this.querySetVersion;
			const newVersion = this.querySetVersion + 1;
			const add = {
				type: "Add",
				queryId,
				udfPath: canonicalizedUdfPath,
				args: [convexToJson(args)],
				journal,
				componentPath,
			};
			if (this.paused) this.pendingQuerySetModifications.set(queryId, add);
			else this.querySetVersion = newVersion;
			return {
				queryToken,
				modification: {
					type: "ModifyQuerySet",
					baseVersion,
					newVersion,
					modifications: [add],
				},
				unsubscribe: () => this.removeSubscriber(queryToken),
			};
		}
	}
	transition(transition) {
		for (const modification of transition.modifications)
			switch (modification.type) {
				case "QueryUpdated":
				case "QueryFailed": {
					this.outstandingQueriesOlderThanRestart.delete(modification.queryId);
					const journal = modification.journal;
					if (journal !== void 0) {
						const queryToken = this.queryIdToToken.get(modification.queryId);
						if (queryToken !== void 0) this.querySet.get(queryToken).journal = journal;
					}
					break;
				}
				case "QueryRemoved":
					this.outstandingQueriesOlderThanRestart.delete(modification.queryId);
					break;
				default:
					throw new Error(`Invalid modification ${modification.type}`);
			}
	}
	queryId(udfPath, args) {
		const queryToken = serializePathAndArgs(canonicalizeUdfPath(udfPath), args);
		const existingEntry = this.querySet.get(queryToken);
		if (existingEntry !== void 0) return existingEntry.id;
		return null;
	}
	isCurrentOrNewerAuthVersion(version) {
		return version >= this.identityVersion;
	}
	getAuth() {
		return this.auth;
	}
	setAuth(value) {
		this.auth = {
			tokenType: "User",
			value,
		};
		const baseVersion = this.identityVersion;
		if (!this.paused) this.identityVersion = baseVersion + 1;
		return {
			type: "Authenticate",
			baseVersion,
			...this.auth,
		};
	}
	setAdminAuth(value, actingAs) {
		const auth = {
			tokenType: "Admin",
			value,
			impersonating: actingAs,
		};
		this.auth = auth;
		const baseVersion = this.identityVersion;
		if (!this.paused) this.identityVersion = baseVersion + 1;
		return {
			type: "Authenticate",
			baseVersion,
			...auth,
		};
	}
	clearAuth() {
		this.auth = void 0;
		this.markAuthCompletion();
		const baseVersion = this.identityVersion;
		if (!this.paused) this.identityVersion = baseVersion + 1;
		return {
			type: "Authenticate",
			tokenType: "None",
			baseVersion,
		};
	}
	hasAuth() {
		return !!this.auth;
	}
	isNewAuth(value) {
		return this.auth?.value !== value;
	}
	queryPath(queryId) {
		const pathAndArgs = this.queryIdToToken.get(queryId);
		if (pathAndArgs) return this.querySet.get(pathAndArgs).canonicalizedUdfPath;
		return null;
	}
	queryArgs(queryId) {
		const pathAndArgs = this.queryIdToToken.get(queryId);
		if (pathAndArgs) return this.querySet.get(pathAndArgs).args;
		return null;
	}
	queryToken(queryId) {
		return this.queryIdToToken.get(queryId) ?? null;
	}
	queryJournal(queryToken) {
		return this.querySet.get(queryToken)?.journal;
	}
	restart() {
		this.unpause();
		this.outstandingQueriesOlderThanRestart.clear();
		const modifications = [];
		for (const localQuery of this.querySet.values()) {
			const add = {
				type: "Add",
				queryId: localQuery.id,
				udfPath: localQuery.canonicalizedUdfPath,
				args: [convexToJson(localQuery.args)],
				journal: localQuery.journal,
				componentPath: localQuery.componentPath,
			};
			modifications.push(add);
			this.outstandingQueriesOlderThanRestart.add(localQuery.id);
		}
		this.querySetVersion = 1;
		const querySet = {
			type: "ModifyQuerySet",
			baseVersion: 0,
			newVersion: 1,
			modifications,
		};
		if (!this.auth) {
			this.identityVersion = 0;
			return [querySet, void 0];
		}
		this.outstandingAuthOlderThanRestart = true;
		const authenticate = {
			type: "Authenticate",
			baseVersion: 0,
			...this.auth,
		};
		this.identityVersion = 1;
		return [querySet, authenticate];
	}
	pause() {
		this.paused = true;
	}
	resume() {
		const querySet =
			this.pendingQuerySetModifications.size > 0
				? {
						type: "ModifyQuerySet",
						baseVersion: this.querySetVersion,
						newVersion: ++this.querySetVersion,
						modifications: Array.from(this.pendingQuerySetModifications.values()),
					}
				: void 0;
		const authenticate =
			this.auth !== void 0
				? {
						type: "Authenticate",
						baseVersion: this.identityVersion++,
						...this.auth,
					}
				: void 0;
		this.unpause();
		return [querySet, authenticate];
	}
	unpause() {
		this.paused = false;
		this.pendingQuerySetModifications.clear();
	}
	removeSubscriber(queryToken) {
		const localQuery = this.querySet.get(queryToken);
		if (localQuery.numSubscribers > 1) {
			localQuery.numSubscribers -= 1;
			return null;
		} else {
			this.querySet.delete(queryToken);
			this.queryIdToToken.delete(localQuery.id);
			this.outstandingQueriesOlderThanRestart.delete(localQuery.id);
			const baseVersion = this.querySetVersion;
			const newVersion = this.querySetVersion + 1;
			const remove = {
				type: "Remove",
				queryId: localQuery.id,
			};
			if (this.paused)
				if (this.pendingQuerySetModifications.has(localQuery.id))
					this.pendingQuerySetModifications.delete(localQuery.id);
				else this.pendingQuerySetModifications.set(localQuery.id, remove);
			else this.querySetVersion = newVersion;
			return {
				type: "ModifyQuerySet",
				baseVersion,
				newVersion,
				modifications: [remove],
			};
		}
	}
};
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/request_manager.js
var __defProp$8 = Object.defineProperty;
var __defNormalProp$8 = (obj, key, value) =>
	key in obj
		? __defProp$8(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$8 = (obj, key, value) => __defNormalProp$8(obj, typeof key !== "symbol" ? key + "" : key, value);
var RequestManager = class {
	constructor(logger, markConnectionStateDirty) {
		this.logger = logger;
		this.markConnectionStateDirty = markConnectionStateDirty;
		__publicField$8(this, "inflightRequests");
		__publicField$8(this, "requestsOlderThanRestart");
		__publicField$8(this, "inflightMutationsCount", 0);
		__publicField$8(this, "inflightActionsCount", 0);
		this.inflightRequests = /* @__PURE__ */ new Map();
		this.requestsOlderThanRestart = /* @__PURE__ */ new Set();
	}
	request(message, sent) {
		const result = new Promise((resolve) => {
			const status = sent ? "Requested" : "NotSent";
			this.inflightRequests.set(message.requestId, {
				message,
				status: {
					status,
					requestedAt: /* @__PURE__ */ new Date(),
					onResult: resolve,
				},
			});
			if (message.type === "Mutation") this.inflightMutationsCount++;
			else if (message.type === "Action") this.inflightActionsCount++;
		});
		this.markConnectionStateDirty();
		return result;
	}
	/**
	 * Update the state after receiving a response.
	 *
	 * @returns A RequestId if the request is complete and its optimistic update
	 * can be dropped, null otherwise.
	 */
	onResponse(response) {
		const requestInfo = this.inflightRequests.get(response.requestId);
		if (requestInfo === void 0) return null;
		if (requestInfo.status.status === "Completed") return null;
		const udfType = requestInfo.message.type === "Mutation" ? "mutation" : "action";
		const udfPath = requestInfo.message.udfPath;
		for (const line of response.logLines) logForFunction(this.logger, "info", udfType, udfPath, line);
		const status = requestInfo.status;
		let result;
		let onResolve;
		if (response.success) {
			result = {
				success: true,
				logLines: response.logLines,
				value: jsonToConvex(response.result),
			};
			onResolve = () => status.onResult(result);
		} else {
			const errorMessage = response.result;
			const { errorData } = response;
			logForFunction(this.logger, "error", udfType, udfPath, errorMessage);
			result = {
				success: false,
				errorMessage,
				errorData: errorData !== void 0 ? jsonToConvex(errorData) : void 0,
				logLines: response.logLines,
			};
			onResolve = () => status.onResult(result);
		}
		if (response.type === "ActionResponse" || !response.success) {
			onResolve();
			this.inflightRequests.delete(response.requestId);
			this.requestsOlderThanRestart.delete(response.requestId);
			if (requestInfo.message.type === "Action") this.inflightActionsCount--;
			else if (requestInfo.message.type === "Mutation") this.inflightMutationsCount--;
			this.markConnectionStateDirty();
			return {
				requestId: response.requestId,
				result,
			};
		}
		requestInfo.status = {
			status: "Completed",
			result,
			ts: response.ts,
			onResolve,
		};
		return null;
	}
	removeCompleted(ts) {
		const completeRequests = /* @__PURE__ */ new Map();
		for (const [requestId, requestInfo] of this.inflightRequests.entries()) {
			const status = requestInfo.status;
			if (status.status === "Completed" && status.ts.lessThanOrEqual(ts)) {
				status.onResolve();
				completeRequests.set(requestId, status.result);
				if (requestInfo.message.type === "Mutation") this.inflightMutationsCount--;
				else if (requestInfo.message.type === "Action") this.inflightActionsCount--;
				this.inflightRequests.delete(requestId);
				this.requestsOlderThanRestart.delete(requestId);
			}
		}
		if (completeRequests.size > 0) this.markConnectionStateDirty();
		return completeRequests;
	}
	restart() {
		this.requestsOlderThanRestart = new Set(this.inflightRequests.keys());
		const allMessages = [];
		for (const [requestId, value] of this.inflightRequests) {
			if (value.status.status === "NotSent") {
				value.status.status = "Requested";
				allMessages.push(value.message);
				continue;
			}
			if (value.message.type === "Mutation") allMessages.push(value.message);
			else if (value.message.type === "Action") {
				this.inflightRequests.delete(requestId);
				this.requestsOlderThanRestart.delete(requestId);
				this.inflightActionsCount--;
				if (value.status.status === "Completed") throw new Error("Action should never be in 'Completed' state");
				value.status.onResult({
					success: false,
					errorMessage: "Connection lost while action was in flight",
					logLines: [],
				});
			}
		}
		this.markConnectionStateDirty();
		return allMessages;
	}
	resume() {
		const allMessages = [];
		for (const [, value] of this.inflightRequests)
			if (value.status.status === "NotSent") {
				value.status.status = "Requested";
				allMessages.push(value.message);
				continue;
			}
		return allMessages;
	}
	/**
	 * @returns true if there are any requests that have been requested but have
	 * not be completed yet.
	 */
	hasIncompleteRequests() {
		for (const requestInfo of this.inflightRequests.values())
			if (requestInfo.status.status === "Requested") return true;
		return false;
	}
	/**
	 * @returns true if there are any inflight requests, including ones that have
	 * completed on the server, but have not been applied.
	 */
	hasInflightRequests() {
		return this.inflightRequests.size > 0;
	}
	/**
	 * @returns true if there are any inflight requests, that have been hanging around
	 * since prior to the most recent restart.
	 */
	hasSyncedPastLastReconnect() {
		return this.requestsOlderThanRestart.size === 0;
	}
	timeOfOldestInflightRequest() {
		if (this.inflightRequests.size === 0) return null;
		let oldestInflightRequest = Date.now();
		for (const request of this.inflightRequests.values())
			if (request.status.status !== "Completed") {
				if (request.status.requestedAt.getTime() < oldestInflightRequest)
					oldestInflightRequest = request.status.requestedAt.getTime();
			}
		return new Date(oldestInflightRequest);
	}
	/**
	 * @returns The number of mutations currently in flight.
	 */
	inflightMutations() {
		return this.inflightMutationsCount;
	}
	/**
	 * @returns The number of actions currently in flight.
	 */
	inflightActions() {
		return this.inflightActionsCount;
	}
};
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/server/functionName.js
var functionName = Symbol.for("functionName");
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/server/components/paths.js
var toReferencePath = Symbol.for("toReferencePath");
function extractReferencePath(reference) {
	return reference[toReferencePath] ?? null;
}
function isFunctionHandle(s) {
	return s.startsWith("function://");
}
function getFunctionAddress(functionReference) {
	let functionAddress;
	if (typeof functionReference === "string")
		if (isFunctionHandle(functionReference)) functionAddress = { functionHandle: functionReference };
		else functionAddress = { name: functionReference };
	else if (functionReference[functionName]) functionAddress = { name: functionReference[functionName] };
	else {
		const referencePath = extractReferencePath(functionReference);
		if (!referencePath) throw new Error(`${functionReference} is not a functionReference`);
		functionAddress = { reference: referencePath };
	}
	return functionAddress;
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/server/api.js
function getFunctionName(functionReference) {
	const address = getFunctionAddress(functionReference);
	if (address.name === void 0) {
		if (address.functionHandle !== void 0)
			throw new Error(
				`Expected function reference like "api.file.func" or "internal.file.func", but received function handle ${address.functionHandle}`,
			);
		else if (address.reference !== void 0)
			throw new Error(
				`Expected function reference in the current component like "api.file.func" or "internal.file.func", but received reference ${address.reference}`,
			);
		throw new Error(
			`Expected function reference like "api.file.func" or "internal.file.func", but received ${JSON.stringify(address)}`,
		);
	}
	if (typeof functionReference === "string") return functionReference;
	const name = functionReference[functionName];
	if (!name) throw new Error(`${functionReference} is not a functionReference`);
	return name;
}
function createApi(pathParts = []) {
	return new Proxy(
		{},
		{
			get(_, prop) {
				if (typeof prop === "string") return createApi([...pathParts, prop]);
				else if (prop === functionName) {
					if (pathParts.length < 2) {
						const found = ["api", ...pathParts].join(".");
						throw new Error(
							`API path is expected to be of the form \`api.moduleName.functionName\`. Found: \`${found}\``,
						);
					}
					const path = pathParts.slice(0, -1).join("/");
					const exportName = pathParts[pathParts.length - 1];
					if (exportName === "default") return path;
					else return path + ":" + exportName;
				} else if (prop === Symbol.toStringTag) return "FunctionReference";
				else return;
			},
		},
	);
}
var anyApi = createApi();
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/optimistic_updates_impl.js
var __defProp$7 = Object.defineProperty;
var __defNormalProp$7 = (obj, key, value) =>
	key in obj
		? __defProp$7(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$7 = (obj, key, value) => __defNormalProp$7(obj, typeof key !== "symbol" ? key + "" : key, value);
var OptimisticLocalStoreImpl = class OptimisticLocalStoreImpl {
	constructor(queryResults) {
		__publicField$7(this, "queryResults");
		__publicField$7(this, "modifiedQueries");
		this.queryResults = queryResults;
		this.modifiedQueries = [];
	}
	getQuery(query, ...args) {
		const queryArgs = parseArgs(args[0]);
		const name = getFunctionName(query);
		const queryResult = this.queryResults.get(serializePathAndArgs(name, queryArgs));
		if (queryResult === void 0) return;
		return OptimisticLocalStoreImpl.queryValue(queryResult.result);
	}
	getAllQueries(query) {
		const queriesWithName = [];
		const name = getFunctionName(query);
		for (const queryResult of this.queryResults.values())
			if (queryResult.udfPath === canonicalizeUdfPath(name))
				queriesWithName.push({
					args: queryResult.args,
					value: OptimisticLocalStoreImpl.queryValue(queryResult.result),
				});
		return queriesWithName;
	}
	setQuery(queryReference, args, value) {
		const queryArgs = parseArgs(args);
		const name = getFunctionName(queryReference);
		const queryToken = serializePathAndArgs(name, queryArgs);
		let result;
		if (value === void 0) result = void 0;
		else
			result = {
				success: true,
				value,
				logLines: [],
			};
		const query = {
			udfPath: name,
			args: queryArgs,
			result,
		};
		this.queryResults.set(queryToken, query);
		this.modifiedQueries.push(queryToken);
	}
	static queryValue(result) {
		if (result === void 0) return;
		else if (result.success) return result.value;
		else return;
	}
};
var OptimisticQueryResults = class {
	constructor() {
		__publicField$7(this, "queryResults");
		__publicField$7(this, "optimisticUpdates");
		this.queryResults = /* @__PURE__ */ new Map();
		this.optimisticUpdates = [];
	}
	/**
	 * Apply all optimistic updates on top of server query results
	 */
	ingestQueryResultsFromServer(serverQueryResults, optimisticUpdatesToDrop) {
		this.optimisticUpdates = this.optimisticUpdates.filter((updateAndId) => {
			return !optimisticUpdatesToDrop.has(updateAndId.mutationId);
		});
		const oldQueryResults = this.queryResults;
		this.queryResults = new Map(serverQueryResults);
		const localStore = new OptimisticLocalStoreImpl(this.queryResults);
		for (const updateAndId of this.optimisticUpdates) updateAndId.update(localStore);
		const changedQueries = [];
		for (const [queryToken, query] of this.queryResults) {
			const oldQuery = oldQueryResults.get(queryToken);
			if (oldQuery === void 0 || oldQuery.result !== query.result) changedQueries.push(queryToken);
		}
		return changedQueries;
	}
	applyOptimisticUpdate(update, mutationId) {
		this.optimisticUpdates.push({
			update,
			mutationId,
		});
		const localStore = new OptimisticLocalStoreImpl(this.queryResults);
		update(localStore);
		return localStore.modifiedQueries;
	}
	/**
	 * "Raw" with respect to errors vs values, but query results still have
	 * optimistic updates applied.
	 *
	 * @internal
	 */
	rawQueryResult(queryToken) {
		const query = this.queryResults.get(queryToken);
		if (query === void 0) return;
		return query.result;
	}
	queryResult(queryToken) {
		const query = this.queryResults.get(queryToken);
		if (query === void 0) return;
		const result = query.result;
		if (result === void 0) return;
		else if (result.success) return result.value;
		else {
			if (result.errorData !== void 0)
				throw forwardData(result, new ConvexError(createHybridErrorStacktrace("query", query.udfPath, result)));
			throw new Error(createHybridErrorStacktrace("query", query.udfPath, result));
		}
	}
	hasQueryResult(queryToken) {
		return this.queryResults.get(queryToken) !== void 0;
	}
	/**
	 * @internal
	 */
	queryLogs(queryToken) {
		return this.queryResults.get(queryToken)?.result?.logLines;
	}
};
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/vendor/long.js
var __defProp$6 = Object.defineProperty;
var __defNormalProp$6 = (obj, key, value) =>
	key in obj
		? __defProp$6(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$6 = (obj, key, value) => __defNormalProp$6(obj, typeof key !== "symbol" ? key + "" : key, value);
var Long = class Long {
	constructor(low, high) {
		__publicField$6(this, "low");
		__publicField$6(this, "high");
		__publicField$6(this, "__isUnsignedLong__");
		this.low = low | 0;
		this.high = high | 0;
		this.__isUnsignedLong__ = true;
	}
	static isLong(obj) {
		return (obj && obj.__isUnsignedLong__) === true;
	}
	static fromBytesLE(bytes) {
		return new Long(
			bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24),
			bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24),
		);
	}
	toBytesLE() {
		const hi = this.high;
		const lo = this.low;
		return [
			lo & 255,
			(lo >>> 8) & 255,
			(lo >>> 16) & 255,
			lo >>> 24,
			hi & 255,
			(hi >>> 8) & 255,
			(hi >>> 16) & 255,
			hi >>> 24,
		];
	}
	static fromNumber(value) {
		if (isNaN(value)) return UZERO;
		if (value < 0) return UZERO;
		if (value >= TWO_PWR_64_DBL) return MAX_UNSIGNED_VALUE;
		return new Long((value % TWO_PWR_32_DBL) | 0, (value / TWO_PWR_32_DBL) | 0);
	}
	toString() {
		return (BigInt(this.high) * BigInt(TWO_PWR_32_DBL) + BigInt(this.low)).toString();
	}
	equals(other) {
		if (!Long.isLong(other)) other = Long.fromValue(other);
		if (this.high >>> 31 === 1 && other.high >>> 31 === 1) return false;
		return this.high === other.high && this.low === other.low;
	}
	notEquals(other) {
		return !this.equals(other);
	}
	comp(other) {
		if (!Long.isLong(other)) other = Long.fromValue(other);
		if (this.equals(other)) return 0;
		return other.high >>> 0 > this.high >>> 0 || (other.high === this.high && other.low >>> 0 > this.low >>> 0)
			? -1
			: 1;
	}
	lessThanOrEqual(other) {
		return this.comp(other) <= 0;
	}
	static fromValue(val) {
		if (typeof val === "number") return Long.fromNumber(val);
		return new Long(val.low, val.high);
	}
};
var UZERO = new Long(0, 0);
var TWO_PWR_16_DBL = 65536;
var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
var MAX_UNSIGNED_VALUE = new Long(-1, -1);
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/remote_query_set.js
var __defProp$5 = Object.defineProperty;
var __defNormalProp$5 = (obj, key, value) =>
	key in obj
		? __defProp$5(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$5 = (obj, key, value) => __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
var RemoteQuerySet = class {
	constructor(queryPath, logger) {
		__publicField$5(this, "version");
		__publicField$5(this, "remoteQuerySet");
		__publicField$5(this, "queryPath");
		__publicField$5(this, "logger");
		this.version = {
			querySet: 0,
			ts: Long.fromNumber(0),
			identity: 0,
		};
		this.remoteQuerySet = /* @__PURE__ */ new Map();
		this.queryPath = queryPath;
		this.logger = logger;
	}
	transition(transition) {
		const start = transition.startVersion;
		if (
			this.version.querySet !== start.querySet ||
			this.version.ts.notEquals(start.ts) ||
			this.version.identity !== start.identity
		)
			throw new Error(
				`Invalid start version: ${start.ts.toString()}:${start.querySet}:${start.identity}, transitioning from ${this.version.ts.toString()}:${this.version.querySet}:${this.version.identity}`,
			);
		for (const modification of transition.modifications)
			switch (modification.type) {
				case "QueryUpdated": {
					const queryPath = this.queryPath(modification.queryId);
					if (queryPath)
						for (const line of modification.logLines) logForFunction(this.logger, "info", "query", queryPath, line);
					const value = jsonToConvex(modification.value ?? null);
					this.remoteQuerySet.set(modification.queryId, {
						success: true,
						value,
						logLines: modification.logLines,
					});
					break;
				}
				case "QueryFailed": {
					const queryPath = this.queryPath(modification.queryId);
					if (queryPath)
						for (const line of modification.logLines) logForFunction(this.logger, "info", "query", queryPath, line);
					const { errorData } = modification;
					this.remoteQuerySet.set(modification.queryId, {
						success: false,
						errorMessage: modification.errorMessage,
						errorData: errorData !== void 0 ? jsonToConvex(errorData) : void 0,
						logLines: modification.logLines,
					});
					break;
				}
				case "QueryRemoved":
					this.remoteQuerySet.delete(modification.queryId);
					break;
				default:
					throw new Error(`Invalid modification ${modification.type}`);
			}
		this.version = transition.endVersion;
	}
	remoteQueryResults() {
		return this.remoteQuerySet;
	}
	timestamp() {
		return this.version.ts;
	}
};
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/protocol.js
function u64ToLong(encoded) {
	const integerBytes = toByteArray(encoded);
	return Long.fromBytesLE(Array.from(integerBytes));
}
function longToU64(raw) {
	return fromByteArray(new Uint8Array(raw.toBytesLE()));
}
function parseServerMessage(encoded) {
	switch (encoded.type) {
		case "FatalError":
		case "AuthError":
		case "ActionResponse":
		case "TransitionChunk":
		case "Ping":
			return { ...encoded };
		case "MutationResponse":
			if (encoded.success)
				return {
					...encoded,
					ts: u64ToLong(encoded.ts),
				};
			else return { ...encoded };
		case "Transition":
			return {
				...encoded,
				startVersion: {
					...encoded.startVersion,
					ts: u64ToLong(encoded.startVersion.ts),
				},
				endVersion: {
					...encoded.endVersion,
					ts: u64ToLong(encoded.endVersion.ts),
				},
			};
		default:
	}
}
function encodeClientMessage(message) {
	switch (message.type) {
		case "Authenticate":
		case "ModifyQuerySet":
		case "Mutation":
		case "Action":
		case "Event":
			return { ...message };
		case "Connect":
			if (message.maxObservedTimestamp !== void 0)
				return {
					...message,
					maxObservedTimestamp: longToU64(message.maxObservedTimestamp),
				};
			else
				return {
					...message,
					maxObservedTimestamp: void 0,
				};
		default:
	}
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/web_socket_manager.js
var __defProp$4 = Object.defineProperty;
var __defNormalProp$4 = (obj, key, value) =>
	key in obj
		? __defProp$4(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$4 = (obj, key, value) => __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
var CLOSE_NORMAL = 1e3;
var CLOSE_GOING_AWAY = 1001;
var CLOSE_NO_STATUS = 1005;
var CLOSE_NOT_FOUND = 4040;
var firstTime;
function monotonicMillis() {
	if (firstTime === void 0) firstTime = Date.now();
	if (typeof performance === "undefined" || !performance.now) return Date.now();
	return Math.round(firstTime + performance.now());
}
function prettyNow() {
	return `t=${Math.round((monotonicMillis() - firstTime) / 100) / 10}s`;
}
var serverDisconnectErrors = {
	InternalServerError: { timeout: 1e3 },
	SubscriptionsWorkerFullError: { timeout: 3e3 },
	TooManyConcurrentRequests: { timeout: 3e3 },
	CommitterFullError: { timeout: 3e3 },
	AwsTooManyRequestsException: { timeout: 3e3 },
	ExecuteFullError: { timeout: 3e3 },
	SystemTimeoutError: { timeout: 3e3 },
	ExpiredInQueue: { timeout: 3e3 },
	VectorIndexesUnavailable: { timeout: 1e3 },
	SearchIndexesUnavailable: { timeout: 1e3 },
	TableSummariesUnavailable: { timeout: 1e3 },
	VectorIndexTooLarge: { timeout: 3e3 },
	SearchIndexTooLarge: { timeout: 3e3 },
	TooManyWritesInTimePeriod: { timeout: 3e3 },
};
function classifyDisconnectError(s) {
	if (s === void 0) return "Unknown";
	for (const prefix of Object.keys(serverDisconnectErrors)) if (s.startsWith(prefix)) return prefix;
	return "Unknown";
}
var WebSocketManager = class {
	constructor(uri, callbacks, webSocketConstructor, logger, markConnectionStateDirty, debug) {
		this.markConnectionStateDirty = markConnectionStateDirty;
		this.debug = debug;
		__publicField$4(this, "socket");
		__publicField$4(this, "connectionCount");
		__publicField$4(this, "_hasEverConnected", false);
		__publicField$4(this, "lastCloseReason");
		__publicField$4(this, "transitionChunkBuffer", null);
		/** Upon HTTPS/WSS failure, the first jittered backoff duration, in ms. */
		__publicField$4(this, "defaultInitialBackoff");
		/** We backoff exponentially, but we need to cap that--this is the jittered max. */
		__publicField$4(this, "maxBackoff");
		/** How many times have we failed consecutively? */
		__publicField$4(this, "retries");
		/** How long before lack of server response causes us to initiate a reconnect,
		 * in ms */
		__publicField$4(this, "serverInactivityThreshold");
		__publicField$4(this, "reconnectDueToServerInactivityTimeout");
		/** Scheduled reconnect state: timeout handle and timing info */
		__publicField$4(this, "scheduledReconnect", null);
		__publicField$4(this, "networkOnlineHandler", null);
		/** Pending event to send after reconnecting due to network recovery */
		__publicField$4(this, "pendingNetworkRecoveryInfo", null);
		__publicField$4(this, "uri");
		__publicField$4(this, "onOpen");
		__publicField$4(this, "onResume");
		__publicField$4(this, "onMessage");
		__publicField$4(this, "webSocketConstructor");
		__publicField$4(this, "logger");
		__publicField$4(this, "onServerDisconnectError");
		this.webSocketConstructor = webSocketConstructor;
		this.socket = { state: "disconnected" };
		this.connectionCount = 0;
		this.lastCloseReason = "InitialConnect";
		this.defaultInitialBackoff = 1e3;
		this.maxBackoff = 16e3;
		this.retries = 0;
		this.serverInactivityThreshold = 6e4;
		this.reconnectDueToServerInactivityTimeout = null;
		this.uri = uri;
		this.onOpen = callbacks.onOpen;
		this.onResume = callbacks.onResume;
		this.onMessage = callbacks.onMessage;
		this.onServerDisconnectError = callbacks.onServerDisconnectError;
		this.logger = logger;
		this.setupNetworkListener();
		this.connect();
	}
	setSocketState(state) {
		this.socket = state;
		this._logVerbose(
			`socket state changed: ${this.socket.state}, paused: ${"paused" in this.socket ? this.socket.paused : void 0}`,
		);
		this.markConnectionStateDirty();
	}
	setupNetworkListener() {
		if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
		if (this.networkOnlineHandler !== null) return;
		this.networkOnlineHandler = () => {
			this._logVerbose("network online event detected");
			this.tryReconnectImmediately();
		};
		window.addEventListener("online", this.networkOnlineHandler);
		this._logVerbose("network online event listener registered");
	}
	cleanupNetworkListener() {
		if (
			this.networkOnlineHandler &&
			typeof window !== "undefined" &&
			typeof window.removeEventListener === "function"
		) {
			window.removeEventListener("online", this.networkOnlineHandler);
			this.networkOnlineHandler = null;
			this._logVerbose("network online event listener removed");
		}
	}
	assembleTransition(chunk) {
		if (
			chunk.partNumber < 0 ||
			chunk.partNumber >= chunk.totalParts ||
			chunk.totalParts === 0 ||
			(this.transitionChunkBuffer &&
				(this.transitionChunkBuffer.totalParts !== chunk.totalParts ||
					this.transitionChunkBuffer.transitionId !== chunk.transitionId))
		) {
			this.transitionChunkBuffer = null;
			throw new Error("Invalid TransitionChunk");
		}
		if (this.transitionChunkBuffer === null)
			this.transitionChunkBuffer = {
				chunks: [],
				totalParts: chunk.totalParts,
				transitionId: chunk.transitionId,
			};
		if (chunk.partNumber !== this.transitionChunkBuffer.chunks.length) {
			const expectedLength = this.transitionChunkBuffer.chunks.length;
			this.transitionChunkBuffer = null;
			throw new Error(
				`TransitionChunk received out of order: expected part ${expectedLength}, got ${chunk.partNumber}`,
			);
		}
		this.transitionChunkBuffer.chunks.push(chunk.chunk);
		if (this.transitionChunkBuffer.chunks.length === chunk.totalParts) {
			const fullJson = this.transitionChunkBuffer.chunks.join("");
			this.transitionChunkBuffer = null;
			const transition = parseServerMessage(JSON.parse(fullJson));
			if (transition.type !== "Transition")
				throw new Error(`Expected Transition, got ${transition.type} after assembling chunks`);
			return transition;
		}
		return null;
	}
	connect() {
		if (this.socket.state === "terminated") return;
		if (this.socket.state !== "disconnected" && this.socket.state !== "stopped")
			throw new Error("Didn't start connection from disconnected state: " + this.socket.state);
		const ws = new this.webSocketConstructor(this.uri);
		this._logVerbose("constructed WebSocket");
		this.setSocketState({
			state: "connecting",
			ws,
			paused: "no",
		});
		this.resetServerInactivityTimeout();
		ws.onopen = () => {
			this.logger.logVerbose("begin ws.onopen");
			if (this.socket.state !== "connecting") throw new Error("onopen called with socket not in connecting state");
			this.setSocketState({
				state: "ready",
				ws,
				paused: this.socket.paused === "yes" ? "uninitialized" : "no",
			});
			this.resetServerInactivityTimeout();
			if (this.socket.paused === "no") {
				this._hasEverConnected = true;
				this.onOpen({
					connectionCount: this.connectionCount,
					lastCloseReason: this.lastCloseReason,
					clientTs: monotonicMillis(),
				});
			}
			if (this.lastCloseReason !== "InitialConnect")
				if (this.lastCloseReason)
					this.logger.log("WebSocket reconnected at", prettyNow(), "after disconnect due to", this.lastCloseReason);
				else this.logger.log("WebSocket reconnected at", prettyNow());
			this.connectionCount += 1;
			this.lastCloseReason = null;
			if (this.pendingNetworkRecoveryInfo !== null) {
				const { timeSavedMs } = this.pendingNetworkRecoveryInfo;
				this.pendingNetworkRecoveryInfo = null;
				this.sendMessage({
					type: "Event",
					eventType: "NetworkRecoveryReconnect",
					event: { timeSavedMs },
				});
				this.logger.log(`Network recovery reconnect saved ~${Math.round(timeSavedMs / 1e3)}s of waiting`);
			}
		};
		ws.onerror = (error) => {
			this.transitionChunkBuffer = null;
			const message = error.message;
			if (message) this.logger.log(`WebSocket error message: ${message}`);
		};
		ws.onmessage = (message) => {
			this.resetServerInactivityTimeout();
			const messageLength = message.data.length;
			let serverMessage = parseServerMessage(JSON.parse(message.data));
			this._logVerbose(`received ws message with type ${serverMessage.type}`);
			if (serverMessage.type === "Ping") return;
			if (serverMessage.type === "TransitionChunk") {
				const transition = this.assembleTransition(serverMessage);
				if (!transition) return;
				serverMessage = transition;
				this._logVerbose(`assembled full ws message of type ${serverMessage.type}`);
			}
			if (this.transitionChunkBuffer !== null) {
				this.transitionChunkBuffer = null;
				this.logger.log(`Received unexpected ${serverMessage.type} while buffering TransitionChunks`);
			}
			if (serverMessage.type === "Transition")
				this.reportLargeTransition({
					messageLength,
					transition: serverMessage,
				});
			if (this.onMessage(serverMessage).hasSyncedPastLastReconnect) {
				this.retries = 0;
				this.markConnectionStateDirty();
			}
		};
		ws.onclose = (event) => {
			this._logVerbose("begin ws.onclose");
			this.transitionChunkBuffer = null;
			if (this.lastCloseReason === null) this.lastCloseReason = event.reason || `closed with code ${event.code}`;
			if (
				event.code !== CLOSE_NORMAL &&
				event.code !== CLOSE_GOING_AWAY &&
				event.code !== CLOSE_NO_STATUS &&
				event.code !== CLOSE_NOT_FOUND
			) {
				let msg = `WebSocket closed with code ${event.code}`;
				if (event.reason) msg += `: ${event.reason}`;
				this.logger.log(msg);
				if (this.onServerDisconnectError && event.reason) this.onServerDisconnectError(msg);
			}
			const reason = classifyDisconnectError(event.reason);
			this.scheduleReconnect(reason);
		};
	}
	/**
	 * @returns The state of the {@link Socket}.
	 */
	socketState() {
		return this.socket.state;
	}
	/**
	 * @param message - A ClientMessage to send.
	 * @returns Whether the message (might have been) sent.
	 */
	sendMessage(message) {
		const messageForLog = {
			type: message.type,
			...(message.type === "Authenticate" && message.tokenType === "User"
				? { value: `...${message.value.slice(-7)}` }
				: {}),
		};
		if (this.socket.state === "ready" && this.socket.paused === "no") {
			const encodedMessage = encodeClientMessage(message);
			const request = JSON.stringify(encodedMessage);
			let sent = false;
			try {
				this.socket.ws.send(request);
				sent = true;
			} catch (error) {
				this.logger.log(`Failed to send message on WebSocket, reconnecting: ${error}`);
				this.closeAndReconnect("FailedToSendMessage");
			}
			this._logVerbose(
				`${sent ? "sent" : "failed to send"} message with type ${message.type}: ${JSON.stringify(messageForLog)}`,
			);
			return true;
		}
		this._logVerbose(
			`message not sent (socket state: ${this.socket.state}, paused: ${"paused" in this.socket ? this.socket.paused : void 0}): ${JSON.stringify(messageForLog)}`,
		);
		return false;
	}
	resetServerInactivityTimeout() {
		if (this.socket.state === "terminated") return;
		if (this.reconnectDueToServerInactivityTimeout !== null) {
			clearTimeout(this.reconnectDueToServerInactivityTimeout);
			this.reconnectDueToServerInactivityTimeout = null;
		}
		this.reconnectDueToServerInactivityTimeout = setTimeout(() => {
			this.closeAndReconnect("InactiveServer");
		}, this.serverInactivityThreshold);
	}
	scheduleReconnect(reason) {
		if (this.scheduledReconnect) {
			clearTimeout(this.scheduledReconnect.timeout);
			this.scheduledReconnect = null;
		}
		this.socket = { state: "disconnected" };
		const backoff = this.nextBackoff(reason);
		this.markConnectionStateDirty();
		this.logger.log(`Attempting reconnect in ${Math.round(backoff)}ms`);
		const scheduledAt = monotonicMillis();
		const timeoutId = setTimeout(() => {
			if (this.scheduledReconnect?.timeout === timeoutId) {
				this.scheduledReconnect = null;
				this.connect();
			}
		}, backoff);
		this.scheduledReconnect = {
			timeout: timeoutId,
			scheduledAt,
			backoffMs: backoff,
		};
	}
	/**
	 * Close the WebSocket and schedule a reconnect.
	 *
	 * This should be used when we hit an error and would like to restart the session.
	 */
	closeAndReconnect(closeReason) {
		this._logVerbose(`begin closeAndReconnect with reason ${closeReason}`);
		switch (this.socket.state) {
			case "disconnected":
			case "terminated":
			case "stopped":
				return;
			case "connecting":
			case "ready":
				this.lastCloseReason = closeReason;
				this.close();
				this.scheduleReconnect("client");
				return;
			default:
				this.socket;
		}
	}
	/**
	 * Close the WebSocket, being careful to clear the onclose handler to avoid re-entrant
	 * calls. Use this instead of directly calling `ws.close()`
	 *
	 * It is the callers responsibility to update the state after this method is called so that the
	 * closed socket is not accessible or used again after this method is called
	 */
	close() {
		this.transitionChunkBuffer = null;
		switch (this.socket.state) {
			case "disconnected":
			case "terminated":
			case "stopped":
				return Promise.resolve();
			case "connecting": {
				const ws = this.socket.ws;
				ws.onmessage = (_message) => {
					this._logVerbose("Ignoring message received after close");
				};
				return new Promise((r) => {
					ws.onclose = () => {
						this._logVerbose("Closed after connecting");
						r();
					};
					ws.onopen = () => {
						this._logVerbose("Opened after connecting");
						ws.close();
					};
				});
			}
			case "ready": {
				this._logVerbose("ws.close called");
				const ws = this.socket.ws;
				ws.onmessage = (_message) => {
					this._logVerbose("Ignoring message received after close");
				};
				const result = new Promise((r) => {
					ws.onclose = () => {
						r();
					};
				});
				ws.close();
				return result;
			}
			default:
				this.socket;
				return Promise.resolve();
		}
	}
	/**
	 * Close the WebSocket and do not reconnect.
	 * @returns A Promise that resolves when the WebSocket `onClose` callback is called.
	 */
	terminate() {
		if (this.reconnectDueToServerInactivityTimeout) clearTimeout(this.reconnectDueToServerInactivityTimeout);
		if (this.scheduledReconnect) {
			clearTimeout(this.scheduledReconnect.timeout);
			this.scheduledReconnect = null;
		}
		this.cleanupNetworkListener();
		switch (this.socket.state) {
			case "terminated":
			case "stopped":
			case "disconnected":
			case "connecting":
			case "ready": {
				const result = this.close();
				this.setSocketState({ state: "terminated" });
				return result;
			}
			default:
				this.socket;
				throw new Error(`Invalid websocket state: ${this.socket.state}`);
		}
	}
	stop() {
		switch (this.socket.state) {
			case "terminated":
				return Promise.resolve();
			case "connecting":
			case "stopped":
			case "disconnected":
			case "ready": {
				this.cleanupNetworkListener();
				const result = this.close();
				this.socket = { state: "stopped" };
				return result;
			}
			default:
				this.socket;
				return Promise.resolve();
		}
	}
	/**
	 * Create a new WebSocket after a previous `stop()`, unless `terminate()` was
	 * called before.
	 */
	tryRestart() {
		switch (this.socket.state) {
			case "stopped":
				break;
			case "terminated":
			case "connecting":
			case "ready":
			case "disconnected":
				this.logger.logVerbose("Restart called without stopping first");
				return;
			default:
				this.socket;
		}
		this.setupNetworkListener();
		this.connect();
	}
	pause() {
		switch (this.socket.state) {
			case "disconnected":
			case "stopped":
			case "terminated":
				return;
			case "connecting":
			case "ready":
				this.socket = {
					...this.socket,
					paused: "yes",
				};
				return;
			default:
				this.socket;
				return;
		}
	}
	/**
	 * Try to reconnect immediately, canceling any scheduled reconnect.
	 * This is useful when detecting network recovery.
	 * Only takes action if we're in disconnected state (waiting to reconnect).
	 */
	tryReconnectImmediately() {
		this._logVerbose("tryReconnectImmediately called");
		if (this.socket.state !== "disconnected") {
			this._logVerbose(`tryReconnectImmediately called but socket state is ${this.socket.state}, no action taken`);
			return;
		}
		let timeSavedMs = null;
		if (this.scheduledReconnect) {
			const elapsed = monotonicMillis() - this.scheduledReconnect.scheduledAt;
			timeSavedMs = Math.max(0, this.scheduledReconnect.backoffMs - elapsed);
			this._logVerbose(
				`would have waited ${Math.round(timeSavedMs)}ms more (backoff was ${Math.round(this.scheduledReconnect.backoffMs)}ms, elapsed ${Math.round(elapsed)}ms)`,
			);
			clearTimeout(this.scheduledReconnect.timeout);
			this.scheduledReconnect = null;
			this._logVerbose("canceled scheduled reconnect");
		}
		this.logger.log("Network recovery detected, reconnecting immediately");
		this.pendingNetworkRecoveryInfo = timeSavedMs !== null ? { timeSavedMs } : null;
		this.connect();
	}
	/**
	 * Resume the state machine if previously paused.
	 */
	resume() {
		switch (this.socket.state) {
			case "connecting":
				this.socket = {
					...this.socket,
					paused: "no",
				};
				return;
			case "ready":
				if (this.socket.paused === "uninitialized") {
					this.socket = {
						...this.socket,
						paused: "no",
					};
					this._hasEverConnected = true;
					this.onOpen({
						connectionCount: this.connectionCount,
						lastCloseReason: this.lastCloseReason,
						clientTs: monotonicMillis(),
					});
				} else if (this.socket.paused === "yes") {
					this.socket = {
						...this.socket,
						paused: "no",
					};
					this.onResume();
				}
				return;
			case "terminated":
			case "stopped":
			case "disconnected":
				return;
			default:
				this.socket;
		}
		this.connect();
	}
	connectionState() {
		return {
			isConnected: this.socket.state === "ready",
			hasEverConnected: this._hasEverConnected,
			connectionCount: this.connectionCount,
			connectionRetries: this.retries,
		};
	}
	_logVerbose(message) {
		this.logger.logVerbose(message);
	}
	nextBackoff(reason) {
		const baseBackoff =
			(reason === "client"
				? 100
				: reason === "Unknown"
					? this.defaultInitialBackoff
					: serverDisconnectErrors[reason].timeout) * Math.pow(2, this.retries);
		this.retries += 1;
		const actualBackoff = Math.min(baseBackoff, this.maxBackoff);
		return actualBackoff + actualBackoff * (Math.random() - 0.5);
	}
	reportLargeTransition({ transition, messageLength }) {
		if (transition.clientClockSkew === void 0 || transition.serverTs === void 0) return;
		const transitionTransitTime = monotonicMillis() - transition.clientClockSkew - transition.serverTs / 1e6;
		const prettyTransitionTime = `${Math.round(transitionTransitTime)}ms`;
		const prettyMessageMB = `${Math.round(messageLength / 1e4) / 100}MB`;
		const bytesPerSecond = messageLength / (transitionTransitTime / 1e3);
		const prettyBytesPerSecond = `${Math.round(bytesPerSecond / 1e4) / 100}MB per second`;
		this._logVerbose(`received ${prettyMessageMB} transition in ${prettyTransitionTime} at ${prettyBytesPerSecond}`);
		if (messageLength > 2e7)
			this.logger.log(
				`received query results totaling more that 20MB (${prettyMessageMB}) which will take a long time to download on slower connections`,
			);
		else if (transitionTransitTime > 2e4)
			this.logger.log(
				`received query results totaling ${prettyMessageMB} which took more than 20s to arrive (${prettyTransitionTime})`,
			);
		if (this.debug)
			this.sendMessage({
				type: "Event",
				eventType: "ClientReceivedTransition",
				event: {
					transitionTransitTime,
					messageLength,
				},
			});
	}
};
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/session.js
function newSessionId() {
	return uuidv4();
}
function uuidv4() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		return (c === "x" ? r : (r & 3) | 8).toString(16);
	});
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/vendor/jwt-decode/index.js
var InvalidTokenError = class extends Error {};
InvalidTokenError.prototype.name = "InvalidTokenError";
function b64DecodeUnicode(str) {
	return decodeURIComponent(
		atob(str).replace(/(.)/g, (_m, p) => {
			let code = p.charCodeAt(0).toString(16).toUpperCase();
			if (code.length < 2) code = "0" + code;
			return "%" + code;
		}),
	);
}
function base64UrlDecode(str) {
	let output = str.replace(/-/g, "+").replace(/_/g, "/");
	switch (output.length % 4) {
		case 0:
			break;
		case 2:
			output += "==";
			break;
		case 3:
			output += "=";
			break;
		default:
			throw new Error("base64 string is not of the correct length");
	}
	try {
		return b64DecodeUnicode(output);
	} catch {
		return atob(output);
	}
}
function jwtDecode(token, options) {
	if (typeof token !== "string") throw new InvalidTokenError("Invalid token specified: must be a string");
	options || (options = {});
	const pos = options.header === true ? 0 : 1;
	const part = token.split(".")[pos];
	if (typeof part !== "string") throw new InvalidTokenError(`Invalid token specified: missing part #${pos + 1}`);
	let decoded;
	try {
		decoded = base64UrlDecode(part);
	} catch (e) {
		throw new InvalidTokenError(`Invalid token specified: invalid base64 for part #${pos + 1} (${e.message})`);
	}
	try {
		return JSON.parse(decoded);
	} catch (e) {
		throw new InvalidTokenError(`Invalid token specified: invalid json for part #${pos + 1} (${e.message})`);
	}
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/authentication_manager.js
var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) =>
	key in obj
		? __defProp$3(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$3 = (obj, key, value) => __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
var MAXIMUM_REFRESH_DELAY = 480 * 60 * 60 * 1e3;
var MAX_TOKEN_CONFIRMATION_ATTEMPTS = 2;
var AuthenticationManager = class {
	constructor(syncState, callbacks, config) {
		__publicField$3(this, "authState", { state: "noAuth" });
		__publicField$3(this, "configVersion", 0);
		__publicField$3(this, "syncState");
		__publicField$3(this, "authenticate");
		__publicField$3(this, "stopSocket");
		__publicField$3(this, "tryRestartSocket");
		__publicField$3(this, "pauseSocket");
		__publicField$3(this, "resumeSocket");
		__publicField$3(this, "clearAuth");
		__publicField$3(this, "logger");
		__publicField$3(this, "refreshTokenLeewaySeconds");
		__publicField$3(this, "initialAuthTokenReuse");
		__publicField$3(this, "lastRefreshChange");
		__publicField$3(this, "tokenConfirmationAttempts", 0);
		this.syncState = syncState;
		this.authenticate = callbacks.authenticate;
		this.stopSocket = callbacks.stopSocket;
		this.tryRestartSocket = callbacks.tryRestartSocket;
		this.pauseSocket = callbacks.pauseSocket;
		this.resumeSocket = callbacks.resumeSocket;
		this.clearAuth = callbacks.clearAuth;
		this.logger = config.logger;
		this.refreshTokenLeewaySeconds = config.refreshTokenLeewaySeconds;
		this.initialAuthTokenReuse = config.initialAuthTokenReuse;
		this.lastRefreshChange = false;
	}
	notifyRefreshChange(isRefreshing) {
		if (
			this.authState.state !== "noAuth" &&
			this.authState.state !== "initialRefetch" &&
			this.authState.config.onRefreshChange &&
			this.lastRefreshChange !== isRefreshing
		) {
			this.lastRefreshChange = isRefreshing;
			this.authState.config.onRefreshChange(isRefreshing);
		}
	}
	async setConfig(fetchToken, onChange, onRefreshChange) {
		this.resetAuthState();
		this._logVerbose("pausing WS for auth token fetch");
		this.pauseSocket();
		const token = await this.fetchTokenAndGuardAgainstRace(fetchToken, { forceRefreshToken: false });
		if (token.isFromOutdatedConfig) return;
		const config = {
			fetchToken,
			onAuthChange: onChange,
			onRefreshChange,
		};
		if (token.value) {
			this.setAuthState({
				state: "waitingForServerConfirmationOfCachedToken",
				config,
				hasRetried: false,
			});
			this.authenticate(token.value);
		} else {
			this.setAuthState({
				state: "initialRefetch",
				config,
			});
			await this.refetchToken();
		}
		this._logVerbose("resuming WS after auth token fetch");
		this.resumeSocket();
	}
	onTransition(serverMessage) {
		if (!this.syncState.isCurrentOrNewerAuthVersion(serverMessage.endVersion.identity)) return;
		if (serverMessage.endVersion.identity <= serverMessage.startVersion.identity) return;
		this._logVerbose(`auth state is ${this.authState.state} when handling transition`);
		this.syncState.markAuthCompletion();
		if (this.authState.state === "waitingForServerConfirmationOfCachedToken") {
			this._logVerbose("server confirmed auth token is valid");
			const cachedToken = this.syncState.getAuth()?.value;
			if (this.initialAuthTokenReuse && cachedToken)
				this.scheduleTokenRefetch(cachedToken, serverMessage.clientClockSkew);
			else this.refetchToken();
			this.authState.config.onAuthChange(true);
			return;
		}
		if (this.authState.state === "waitingForServerConfirmationOfFreshToken") {
			this._logVerbose("server confirmed new auth token is valid");
			this.notifyRefreshChange(false);
			this.scheduleTokenRefetch(this.authState.token);
			this.tokenConfirmationAttempts = 0;
			if (!this.authState.hadAuth) this.authState.config.onAuthChange(true);
		}
	}
	onAuthError(serverMessage) {
		if (
			serverMessage.authUpdateAttempted === false &&
			(this.authState.state === "waitingForServerConfirmationOfFreshToken" ||
				this.authState.state === "waitingForServerConfirmationOfCachedToken")
		) {
			this._logVerbose("ignoring non-auth token expired error");
			return;
		}
		const { baseVersion } = serverMessage;
		if (!this.syncState.isCurrentOrNewerAuthVersion(baseVersion + 1)) {
			this._logVerbose("ignoring auth error for previous auth attempt");
			return;
		}
		this.tryToReauthenticate(serverMessage);
	}
	async tryToReauthenticate(serverMessage) {
		this._logVerbose(`attempting to reauthenticate: ${serverMessage.error}`);
		if (
			this.authState.state === "noAuth" ||
			(this.authState.state === "waitingForServerConfirmationOfFreshToken" &&
				this.tokenConfirmationAttempts >= MAX_TOKEN_CONFIRMATION_ATTEMPTS)
		) {
			this.logger.error(`Failed to authenticate: "${serverMessage.error}", check your server auth config`);
			if (this.syncState.hasAuth()) this.syncState.clearAuth();
			if (this.authState.state !== "noAuth") this.setAndReportAuthFailed(this.authState.config.onAuthChange);
			return;
		}
		if (this.authState.state === "waitingForServerConfirmationOfFreshToken") {
			this.tokenConfirmationAttempts++;
			this._logVerbose(
				`retrying reauthentication, ${MAX_TOKEN_CONFIRMATION_ATTEMPTS - this.tokenConfirmationAttempts} attempts remaining`,
			);
		}
		this.notifyRefreshChange(true);
		await this.stopSocket();
		if (this.authState.state === "noAuth") return;
		const token = await this.fetchTokenAndGuardAgainstRace(this.authState.config.fetchToken, {
			forceRefreshToken: true,
		});
		if (token.isFromOutdatedConfig) return;
		if (token.value && this.syncState.isNewAuth(token.value)) {
			this.authenticate(token.value);
			this.setAuthState({
				state: "waitingForServerConfirmationOfFreshToken",
				config: this.authState.config,
				token: token.value,
				hadAuth: this.authState.state === "notRefetching" || this.authState.state === "waitingForScheduledRefetch",
			});
		} else {
			this._logVerbose("reauthentication failed, could not fetch a new token");
			if (this.syncState.hasAuth()) this.syncState.clearAuth();
			this.setAndReportAuthFailed(this.authState.config.onAuthChange);
		}
		this.tryRestartSocket();
	}
	async refetchToken() {
		if (this.authState.state === "noAuth") return;
		this._logVerbose("refetching auth token");
		const token = await this.fetchTokenAndGuardAgainstRace(this.authState.config.fetchToken, {
			forceRefreshToken: true,
		});
		if (token.isFromOutdatedConfig) return;
		if (token.value)
			if (this.syncState.isNewAuth(token.value)) {
				this.setAuthState({
					state: "waitingForServerConfirmationOfFreshToken",
					hadAuth: this.syncState.hasAuth(),
					token: token.value,
					config: this.authState.config,
				});
				this.authenticate(token.value);
			} else
				this.setAuthState({
					state: "notRefetching",
					config: this.authState.config,
				});
		else {
			this._logVerbose("refetching token failed");
			if (this.syncState.hasAuth()) this.clearAuth();
			this.setAndReportAuthFailed(this.authState.config.onAuthChange);
		}
		this._logVerbose("restarting WS after auth token fetch (if currently stopped)");
		this.tryRestartSocket();
	}
	scheduleTokenRefetch(token, clientClockSkewMs) {
		if (this.authState.state === "noAuth") return;
		const decodedToken = this.decodeToken(token);
		if (!decodedToken) {
			this.logger.error("Auth token is not a valid JWT, cannot refetch the token");
			return;
		}
		const { iat, exp } = decodedToken;
		if (!iat || !exp) {
			this.logger.error("Auth token does not have required fields, cannot refetch the token");
			return;
		}
		const fullLifetimeSeconds = exp - iat;
		if (fullLifetimeSeconds <= 2) {
			this.logger.error("Auth token does not live long enough, cannot refetch the token");
			return;
		}
		let tokenValiditySeconds;
		if (clientClockSkewMs !== void 0) {
			tokenValiditySeconds = exp - (Date.now() - clientClockSkewMs) / 1e3;
			if (tokenValiditySeconds <= 0) tokenValiditySeconds = 0;
		} else tokenValiditySeconds = fullLifetimeSeconds;
		let delay = Math.min(MAXIMUM_REFRESH_DELAY, (tokenValiditySeconds - this.refreshTokenLeewaySeconds) * 1e3);
		if (delay <= 0) {
			this.logger.warn(
				`Refetching auth token immediately, configured leeway ${this.refreshTokenLeewaySeconds}s is larger than the token's lifetime ${tokenValiditySeconds}s`,
			);
			delay = 0;
		}
		const refetchTokenTimeoutId = setTimeout(() => {
			this._logVerbose("running scheduled token refetch");
			this.refetchToken();
		}, delay);
		this.setAuthState({
			state: "waitingForScheduledRefetch",
			refetchTokenTimeoutId,
			config: this.authState.config,
		});
		this._logVerbose(`scheduled preemptive auth token refetching in ${delay}ms`);
	}
	async fetchTokenAndGuardAgainstRace(fetchToken, fetchArgs) {
		const originalConfigVersion = ++this.configVersion;
		this._logVerbose(`fetching token with config version ${originalConfigVersion}`);
		const token = await fetchToken(fetchArgs);
		if (this.configVersion !== originalConfigVersion) {
			this._logVerbose(`stale config version, expected ${originalConfigVersion}, got ${this.configVersion}`);
			return { isFromOutdatedConfig: true };
		}
		return {
			isFromOutdatedConfig: false,
			value: token,
		};
	}
	stop() {
		this.resetAuthState();
		this.configVersion++;
		this._logVerbose(`config version bumped to ${this.configVersion}`);
	}
	setAndReportAuthFailed(onAuthChange) {
		onAuthChange(false);
		this.resetAuthState();
	}
	resetAuthState() {
		this.notifyRefreshChange(false);
		this.setAuthState({ state: "noAuth" });
	}
	setAuthState(newAuth) {
		const authStateForLog =
			newAuth.state === "waitingForServerConfirmationOfFreshToken"
				? {
						hadAuth: newAuth.hadAuth,
						state: newAuth.state,
						token: `...${newAuth.token.slice(-7)}`,
					}
				: { state: newAuth.state };
		this._logVerbose(`setting auth state to ${JSON.stringify(authStateForLog)}`);
		switch (newAuth.state) {
			case "waitingForScheduledRefetch":
			case "notRefetching":
			case "noAuth":
				this.tokenConfirmationAttempts = 0;
				break;
			case "waitingForServerConfirmationOfFreshToken":
			case "waitingForServerConfirmationOfCachedToken":
			case "initialRefetch":
				break;
			default:
		}
		if (this.authState.state === "waitingForScheduledRefetch") clearTimeout(this.authState.refetchTokenTimeoutId);
		this.authState = newAuth;
	}
	decodeToken(token) {
		try {
			return jwtDecode(token);
		} catch (e) {
			this._logVerbose(`Error decoding token: ${e instanceof Error ? e.message : "Unknown error"}`);
			return null;
		}
	}
	_logVerbose(message) {
		this.logger.logVerbose(`${message} [v${this.configVersion}]`);
	}
};
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/metrics.js
var markNames = ["convexClientConstructed", "convexWebSocketOpen", "convexFirstMessageReceived"];
function mark(name, sessionId) {
	const detail = { sessionId };
	if (typeof performance === "undefined" || !performance.mark) return;
	performance.mark(name, { detail });
}
function performanceMarkToJson(mark2) {
	let name = mark2.name.slice(6);
	name = name.charAt(0).toLowerCase() + name.slice(1);
	return {
		name,
		startTime: mark2.startTime,
	};
}
function getMarksReport(sessionId) {
	if (typeof performance === "undefined" || !performance.getEntriesByName) return [];
	const allMarks = [];
	for (const name of markNames) {
		const marks = performance
			.getEntriesByName(name)
			.filter((entry) => entry.entryType === "mark")
			.filter((mark2) => mark2.detail.sessionId === sessionId);
		allMarks.push(...marks);
	}
	return allMarks.map(performanceMarkToJson);
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/client.js
var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) =>
	key in obj
		? __defProp$2(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$2 = (obj, key, value) => __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
var BaseConvexClient = class {
	/**
	 * @param address - The url of your Convex deployment, often provided
	 * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
	 * @param onTransition - A callback receiving an array of query tokens
	 * corresponding to query results that have changed -- additional handlers
	 * can be added via `addOnTransitionHandler`.
	 * @param options - See {@link BaseConvexClientOptions} for a full description.
	 */
	constructor(address, onTransition, options) {
		__publicField$2(this, "address");
		__publicField$2(this, "state");
		__publicField$2(this, "requestManager");
		__publicField$2(this, "webSocketManager");
		__publicField$2(this, "authenticationManager");
		__publicField$2(this, "remoteQuerySet");
		__publicField$2(this, "optimisticQueryResults");
		__publicField$2(this, "_transitionHandlerCounter", 0);
		__publicField$2(this, "_nextRequestId");
		__publicField$2(this, "_onTransitionFns", /* @__PURE__ */ new Map());
		__publicField$2(this, "_sessionId");
		__publicField$2(this, "firstMessageReceived", false);
		__publicField$2(this, "debug");
		__publicField$2(this, "logger");
		__publicField$2(this, "maxObservedTimestamp");
		__publicField$2(this, "connectionStateSubscribers", /* @__PURE__ */ new Map());
		__publicField$2(this, "nextConnectionStateSubscriberId", 0);
		__publicField$2(this, "_lastPublishedConnectionState");
		/**
		 * Call this whenever the connection state may have changed in a way that could
		 * require publishing it. Schedules a possibly update.
		 */
		__publicField$2(this, "markConnectionStateDirty", () => {
			Promise.resolve().then(() => {
				const curConnectionState = this.connectionState();
				if (JSON.stringify(curConnectionState) !== JSON.stringify(this._lastPublishedConnectionState)) {
					this._lastPublishedConnectionState = curConnectionState;
					for (const cb of this.connectionStateSubscribers.values()) cb(curConnectionState);
				}
			});
		});
		__publicField$2(this, "mark", (name) => {
			if (this.debug) mark(name, this.sessionId);
		});
		if (typeof address === "object")
			throw new Error(
				"Passing a ClientConfig object is no longer supported. Pass the URL of the Convex deployment as a string directly.",
			);
		if (options?.skipConvexDeploymentUrlCheck !== true) validateDeploymentUrl(address);
		options = { ...options };
		const authRefreshTokenLeewaySeconds = options.authRefreshTokenLeewaySeconds ?? 10;
		let webSocketConstructor = options.webSocketConstructor;
		if (!webSocketConstructor && typeof WebSocket === "undefined")
			throw new Error(
				"No WebSocket global variable defined! To use Convex in an environment without WebSocket try the HTTP client: https://docs.convex.dev/api/classes/browser.ConvexHttpClient",
			);
		webSocketConstructor = webSocketConstructor || WebSocket;
		this.debug = options.reportDebugInfoToConvex ?? false;
		this.address = address;
		this.logger =
			options.logger === false
				? instantiateNoopLogger({ verbose: options.verbose ?? false })
				: options.logger !== true && options.logger
					? options.logger
					: instantiateDefaultLogger({ verbose: options.verbose ?? false });
		const i = address.search("://");
		if (i === -1) throw new Error("Provided address was not an absolute URL.");
		const origin = address.substring(i + 3);
		const protocol = address.substring(0, i);
		let wsProtocol;
		if (protocol === "http") wsProtocol = "ws";
		else if (protocol === "https") wsProtocol = "wss";
		else throw new Error(`Unknown parent protocol ${protocol}`);
		const wsUri = `${wsProtocol}://${origin}/api/${version}/sync`;
		this.state = new LocalSyncState();
		this.remoteQuerySet = new RemoteQuerySet((queryId) => this.state.queryPath(queryId), this.logger);
		this.requestManager = new RequestManager(this.logger, this.markConnectionStateDirty);
		const pauseSocket = () => {
			this.webSocketManager.pause();
			this.state.pause();
		};
		this.authenticationManager = new AuthenticationManager(
			this.state,
			{
				authenticate: (token) => {
					const message = this.state.setAuth(token);
					this.webSocketManager.sendMessage(message);
					return message.baseVersion;
				},
				stopSocket: () => this.webSocketManager.stop(),
				tryRestartSocket: () => this.webSocketManager.tryRestart(),
				pauseSocket,
				resumeSocket: () => this.webSocketManager.resume(),
				clearAuth: () => {
					this.clearAuth();
				},
			},
			{
				logger: this.logger,
				refreshTokenLeewaySeconds: authRefreshTokenLeewaySeconds,
				initialAuthTokenReuse: options.initialAuthTokenReuse ?? false,
			},
		);
		this.optimisticQueryResults = new OptimisticQueryResults();
		this.addOnTransitionHandler((transition) => {
			onTransition(transition.queries.map((q) => q.token));
		});
		this._nextRequestId = 0;
		this._sessionId = newSessionId();
		const { unsavedChangesWarning } = options;
		if (typeof window === "undefined" || typeof window.addEventListener === "undefined") {
			if (unsavedChangesWarning === true)
				throw new Error(
					"unsavedChangesWarning requested, but window.addEventListener not found! Remove {unsavedChangesWarning: true} from Convex client options.",
				);
		} else if (unsavedChangesWarning !== false)
			window.addEventListener("beforeunload", (e) => {
				if (this.requestManager.hasIncompleteRequests()) {
					e.preventDefault();
					const confirmationMessage = "Are you sure you want to leave? Your changes may not be saved.";
					(e || window.event).returnValue = confirmationMessage;
					return confirmationMessage;
				}
			});
		this.webSocketManager = new WebSocketManager(
			wsUri,
			{
				onOpen: (reconnectMetadata) => {
					this.mark("convexWebSocketOpen");
					this.webSocketManager.sendMessage({
						...reconnectMetadata,
						type: "Connect",
						sessionId: this._sessionId,
						maxObservedTimestamp: this.maxObservedTimestamp,
					});
					this.remoteQuerySet = new RemoteQuerySet((queryId) => this.state.queryPath(queryId), this.logger);
					const [querySetModification, authModification] = this.state.restart();
					if (authModification) this.webSocketManager.sendMessage(authModification);
					this.webSocketManager.sendMessage(querySetModification);
					for (const message of this.requestManager.restart()) this.webSocketManager.sendMessage(message);
				},
				onResume: () => {
					const [querySetModification, authModification] = this.state.resume();
					if (authModification) this.webSocketManager.sendMessage(authModification);
					if (querySetModification) this.webSocketManager.sendMessage(querySetModification);
					for (const message of this.requestManager.resume()) this.webSocketManager.sendMessage(message);
				},
				onMessage: (serverMessage) => {
					if (!this.firstMessageReceived) {
						this.firstMessageReceived = true;
						this.mark("convexFirstMessageReceived");
						this.reportMarks();
					}
					switch (serverMessage.type) {
						case "Transition": {
							this.observedTimestamp(serverMessage.endVersion.ts);
							this.authenticationManager.onTransition(serverMessage);
							this.remoteQuerySet.transition(serverMessage);
							this.state.transition(serverMessage);
							const completedRequests = this.requestManager.removeCompleted(this.remoteQuerySet.timestamp());
							this.notifyOnQueryResultChanges(completedRequests);
							break;
						}
						case "MutationResponse": {
							if (serverMessage.success) this.observedTimestamp(serverMessage.ts);
							const completedMutationInfo = this.requestManager.onResponse(serverMessage);
							if (completedMutationInfo !== null)
								this.notifyOnQueryResultChanges(
									/* @__PURE__ */ new Map([[completedMutationInfo.requestId, completedMutationInfo.result]]),
								);
							break;
						}
						case "ActionResponse":
							this.requestManager.onResponse(serverMessage);
							break;
						case "AuthError":
							this.authenticationManager.onAuthError(serverMessage);
							break;
						case "FatalError": {
							const error = logFatalError(this.logger, serverMessage.error);
							this.webSocketManager.terminate();
							throw error;
						}
						default:
					}
					return { hasSyncedPastLastReconnect: this.hasSyncedPastLastReconnect() };
				},
				onServerDisconnectError: options.onServerDisconnectError,
			},
			webSocketConstructor,
			this.logger,
			this.markConnectionStateDirty,
			this.debug,
		);
		this.mark("convexClientConstructed");
		if (options.expectAuth) pauseSocket();
	}
	/**
	 * Return true if there is outstanding work from prior to the time of the most recent restart.
	 * This indicates that the client has not proven itself to have gotten past the issue that
	 * potentially led to the restart. Use this to influence when to reset backoff after a failure.
	 */
	hasSyncedPastLastReconnect() {
		return this.requestManager.hasSyncedPastLastReconnect() && this.state.hasSyncedPastLastReconnect();
	}
	observedTimestamp(observedTs) {
		if (this.maxObservedTimestamp === void 0 || this.maxObservedTimestamp.lessThanOrEqual(observedTs))
			this.maxObservedTimestamp = observedTs;
	}
	getMaxObservedTimestamp() {
		return this.maxObservedTimestamp;
	}
	/**
	 * Compute the current query results based on the remoteQuerySet and the
	 * current optimistic updates and call `onTransition` for all the changed
	 * queries.
	 *
	 * @param completedMutations - A set of mutation IDs whose optimistic updates
	 * are no longer needed.
	 */
	notifyOnQueryResultChanges(completedRequests) {
		const remoteQueryResults = this.remoteQuerySet.remoteQueryResults();
		const queryTokenToValue = /* @__PURE__ */ new Map();
		for (const [queryId, result] of remoteQueryResults) {
			const queryToken = this.state.queryToken(queryId);
			if (queryToken !== null) {
				const query = {
					result,
					udfPath: this.state.queryPath(queryId),
					args: this.state.queryArgs(queryId),
				};
				queryTokenToValue.set(queryToken, query);
			}
		}
		const changedQueryTokens = this.optimisticQueryResults.ingestQueryResultsFromServer(
			queryTokenToValue,
			new Set(completedRequests.keys()),
		);
		this.handleTransition({
			queries: changedQueryTokens.map((token) => {
				return {
					token,
					modification: {
						kind: "Updated",
						result: this.optimisticQueryResults.rawQueryResult(token),
					},
				};
			}),
			reflectedMutations: Array.from(completedRequests).map(([requestId, result]) => ({
				requestId,
				result,
			})),
			timestamp: this.remoteQuerySet.timestamp(),
		});
	}
	handleTransition(transition) {
		for (const fn of this._onTransitionFns.values()) fn(transition);
	}
	/**
	 * Add a handler that will be called on a transition.
	 *
	 * Any external side effects (e.g. setting React state) should be handled here.
	 *
	 * @param fn
	 *
	 * @returns
	 */
	addOnTransitionHandler(fn) {
		const id = this._transitionHandlerCounter++;
		this._onTransitionFns.set(id, fn);
		return () => this._onTransitionFns.delete(id);
	}
	/**
	 * Get the current JWT auth token and decoded claims.
	 */
	getCurrentAuthClaims() {
		const authToken = this.state.getAuth();
		let decoded = {};
		if (authToken && authToken.tokenType === "User")
			try {
				decoded = authToken ? jwtDecode(authToken.value) : {};
			} catch {
				decoded = {};
			}
		else return;
		return {
			token: authToken.value,
			decoded,
		};
	}
	/**
	 * Set the authentication token to be used for subsequent queries and mutations.
	 * `fetchToken` will be called automatically again if a token expires.
	 * `fetchToken` should return `null` if the token cannot be retrieved, for example
	 * when the user's rights were permanently revoked.
	 * @param fetchToken - an async function returning the JWT-encoded OpenID Connect Identity Token
	 * @param onChange - a callback that will be called when the authentication status changes
	 * @param onRefreshChange - a callback called with `true` when the socket is paused to fetch a replacement token after a server rejection, and `false` when refresh completes
	 */
	setAuth(fetchToken, onChange, onRefreshChange) {
		this.authenticationManager.setConfig(fetchToken, onChange, onRefreshChange);
	}
	hasAuth() {
		return this.state.hasAuth();
	}
	/** @internal */
	setAdminAuth(value, fakeUserIdentity) {
		const message = this.state.setAdminAuth(value, fakeUserIdentity);
		this.webSocketManager.sendMessage(message);
	}
	clearAuth() {
		const message = this.state.clearAuth();
		this.webSocketManager.sendMessage(message);
	}
	/**
	* Subscribe to a query function.
	*
	* Whenever this query's result changes, the `onTransition` callback
	* passed into the constructor will be called.
	*
	* @param name - The name of the query.
	* @param args - An arguments object for the query. If this is omitted, the
	* arguments will be `{}`.
	* @param options - A {@link SubscribeOptions} options object for this query.
	
	* @returns An object containing a {@link QueryToken} corresponding to this
	* query and an `unsubscribe` callback.
	*/
	subscribe(name, args, options) {
		const argsObject = parseArgs(args);
		const { modification, queryToken, unsubscribe } = this.state.subscribe(
			name,
			argsObject,
			options?.journal,
			options?.componentPath,
		);
		if (modification !== null) this.webSocketManager.sendMessage(modification);
		return {
			queryToken,
			unsubscribe: () => {
				const modification2 = unsubscribe();
				if (modification2) this.webSocketManager.sendMessage(modification2);
			},
		};
	}
	/**
	 * A query result based only on the current, local state.
	 *
	 * The only way this will return a value is if we're already subscribed to the
	 * query or its value has been set optimistically.
	 */
	localQueryResult(udfPath, args) {
		const queryToken = serializePathAndArgs(udfPath, parseArgs(args));
		return this.optimisticQueryResults.queryResult(queryToken);
	}
	/**
	 * Get query result by query token based on current, local state
	 *
	 * The only way this will return a value is if we're already subscribed to the
	 * query or its value has been set optimistically.
	 *
	 * @internal
	 */
	localQueryResultByToken(queryToken) {
		return this.optimisticQueryResults.queryResult(queryToken);
	}
	/**
	 * Whether local query result is available for a token.
	 *
	 * This method does not throw if the result is an error.
	 *
	 * @internal
	 */
	hasLocalQueryResultByToken(queryToken) {
		return this.optimisticQueryResults.hasQueryResult(queryToken);
	}
	/**
	 * @internal
	 */
	localQueryLogs(udfPath, args) {
		const queryToken = serializePathAndArgs(udfPath, parseArgs(args));
		return this.optimisticQueryResults.queryLogs(queryToken);
	}
	/**
	 * Retrieve the current {@link QueryJournal} for this query function.
	 *
	 * If we have not yet received a result for this query, this will be `undefined`.
	 *
	 * @param name - The name of the query.
	 * @param args - The arguments object for this query.
	 * @returns The query's {@link QueryJournal} or `undefined`.
	 */
	queryJournal(name, args) {
		const queryToken = serializePathAndArgs(name, parseArgs(args));
		return this.state.queryJournal(queryToken);
	}
	/**
	 * Get the current {@link ConnectionState} between the client and the Convex
	 * backend.
	 *
	 * @returns The {@link ConnectionState} with the Convex backend.
	 */
	connectionState() {
		const wsConnectionState = this.webSocketManager.connectionState();
		return {
			hasInflightRequests: this.requestManager.hasInflightRequests(),
			isWebSocketConnected: wsConnectionState.isConnected,
			hasEverConnected: wsConnectionState.hasEverConnected,
			connectionCount: wsConnectionState.connectionCount,
			connectionRetries: wsConnectionState.connectionRetries,
			timeOfOldestInflightRequest: this.requestManager.timeOfOldestInflightRequest(),
			inflightMutations: this.requestManager.inflightMutations(),
			inflightActions: this.requestManager.inflightActions(),
		};
	}
	/**
	 * Subscribe to the {@link ConnectionState} between the client and the Convex
	 * backend, calling a callback each time it changes.
	 *
	 * Subscribed callbacks will be called when any part of ConnectionState changes.
	 * ConnectionState may grow in future versions (e.g. to provide a array of
	 * inflight requests) in which case callbacks would be called more frequently.
	 *
	 * @returns An unsubscribe function to stop listening.
	 */
	subscribeToConnectionState(cb) {
		const id = this.nextConnectionStateSubscriberId++;
		this.connectionStateSubscribers.set(id, cb);
		return () => {
			this.connectionStateSubscribers.delete(id);
		};
	}
	/**
	* Execute a mutation function.
	*
	* @param name - The name of the mutation.
	* @param args - An arguments object for the mutation. If this is omitted,
	* the arguments will be `{}`.
	* @param options - A {@link MutationOptions} options object for this mutation.
	
	* @returns - A promise of the mutation's result.
	*/
	async mutation(name, args, options) {
		const result = await this.mutationInternal(name, args, options);
		if (!result.success) {
			if (result.errorData !== void 0)
				throw forwardData(result, new ConvexError(createHybridErrorStacktrace("mutation", name, result)));
			throw new Error(createHybridErrorStacktrace("mutation", name, result));
		}
		return result.value;
	}
	/**
	 * @internal
	 */
	async mutationInternal(udfPath, args, options, componentPath) {
		const { mutationPromise } = this.enqueueMutation(udfPath, args, options, componentPath);
		return mutationPromise;
	}
	/**
	 * @internal
	 */
	enqueueMutation(udfPath, args, options, componentPath) {
		const mutationArgs = parseArgs(args);
		this.tryReportLongDisconnect();
		const requestId = this.nextRequestId;
		this._nextRequestId++;
		if (options !== void 0) {
			const optimisticUpdate = options.optimisticUpdate;
			if (optimisticUpdate !== void 0) {
				const wrappedUpdate = (localQueryStore) => {
					if (optimisticUpdate(localQueryStore, mutationArgs) instanceof Promise)
						this.logger.warn("Optimistic update handler returned a Promise. Optimistic updates should be synchronous.");
				};
				const changedQueries = this.optimisticQueryResults
					.applyOptimisticUpdate(wrappedUpdate, requestId)
					.map((token) => {
						const localResult = this.localQueryResultByToken(token);
						return {
							token,
							modification: {
								kind: "Updated",
								result:
									localResult === void 0
										? void 0
										: {
												success: true,
												value: localResult,
												logLines: [],
											},
							},
						};
					});
				this.handleTransition({
					queries: changedQueries,
					reflectedMutations: [],
					timestamp: this.remoteQuerySet.timestamp(),
				});
			}
		}
		const message = {
			type: "Mutation",
			requestId,
			udfPath,
			componentPath,
			args: [convexToJson(mutationArgs)],
		};
		const mightBeSent = this.webSocketManager.sendMessage(message);
		return {
			requestId,
			mutationPromise: this.requestManager.request(message, mightBeSent),
		};
	}
	/**
	 * Execute an action function.
	 *
	 * @param name - The name of the action.
	 * @param args - An arguments object for the action. If this is omitted,
	 * the arguments will be `{}`.
	 * @returns A promise of the action's result.
	 */
	async action(name, args) {
		const result = await this.actionInternal(name, args);
		if (!result.success) {
			if (result.errorData !== void 0)
				throw forwardData(result, new ConvexError(createHybridErrorStacktrace("action", name, result)));
			throw new Error(createHybridErrorStacktrace("action", name, result));
		}
		return result.value;
	}
	/**
	 * @internal
	 */
	async actionInternal(udfPath, args, componentPath) {
		const actionArgs = parseArgs(args);
		const requestId = this.nextRequestId;
		this._nextRequestId++;
		this.tryReportLongDisconnect();
		const message = {
			type: "Action",
			requestId,
			udfPath,
			componentPath,
			args: [convexToJson(actionArgs)],
		};
		const mightBeSent = this.webSocketManager.sendMessage(message);
		return this.requestManager.request(message, mightBeSent);
	}
	/**
	 * Close any network handles associated with this client and stop all subscriptions.
	 *
	 * Call this method when you're done with an {@link BaseConvexClient} to
	 * dispose of its sockets and resources.
	 *
	 * @returns A `Promise` fulfilled when the connection has been completely closed.
	 */
	async close() {
		this.authenticationManager.stop();
		return this.webSocketManager.terminate();
	}
	/**
	 * Return the address for this client, useful for creating a new client.
	 *
	 * Not guaranteed to match the address with which this client was constructed:
	 * it may be canonicalized.
	 */
	get url() {
		return this.address;
	}
	/**
	 * @internal
	 */
	get nextRequestId() {
		return this._nextRequestId;
	}
	/**
	 * @internal
	 */
	get sessionId() {
		return this._sessionId;
	}
	/**
	 * Reports performance marks to the server. This should only be called when
	 * we have a functional websocket.
	 */
	reportMarks() {
		if (this.debug) {
			const report = getMarksReport(this.sessionId);
			this.webSocketManager.sendMessage({
				type: "Event",
				eventType: "ClientConnect",
				event: report,
			});
		}
	}
	tryReportLongDisconnect() {
		if (!this.debug) return;
		const timeOfOldestRequest = this.connectionState().timeOfOldestInflightRequest;
		if (timeOfOldestRequest === null || Date.now() - timeOfOldestRequest.getTime() <= 60 * 1e3) return;
		const endpoint = `${this.address}/api/debug_event`;
		fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Convex-Client": `npm-${version}`,
			},
			body: JSON.stringify({ event: "LongWebsocketDisconnect" }),
		})
			.then((response) => {
				if (!response.ok) this.logger.warn("Analytics request failed with response:", response.body);
			})
			.catch((error) => {
				this.logger.warn("Analytics response failed with error:", error);
			});
	}
};
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/pagination.js
function asPaginationResult(value) {
	if (
		typeof value !== "object" ||
		value === null ||
		!Array.isArray(value.page) ||
		typeof value.isDone !== "boolean" ||
		typeof value.continueCursor !== "string"
	)
		throw new Error(`Not a valid paginated query result: ${value?.toString()}`);
	return value;
}
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/browser/sync/paginated_query_client.js
var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) =>
	key in obj
		? __defProp$1(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
var PaginatedQueryClient = class {
	constructor(client, onTransition) {
		this.client = client;
		this.onTransition = onTransition;
		__publicField$1(this, "paginatedQuerySet", /* @__PURE__ */ new Map());
		__publicField$1(this, "lastTransitionTs");
		this.lastTransitionTs = Long.fromNumber(0);
		this.client.addOnTransitionHandler((transition) => this.onBaseTransition(transition));
	}
	/**
	 * Subscribe to a paginated query.
	 *
	 * @param name - The name of the paginated query function
	 * @param args - Arguments for the query (excluding paginationOpts)
	 * @param options - Pagination options including initialNumItems
	 * @returns Object with paginatedQueryToken and unsubscribe function
	 */
	subscribe(name, args, options) {
		const canonicalizedUdfPath = canonicalizeUdfPath(name);
		const token = serializePaginatedPathAndArgs(canonicalizedUdfPath, args, options);
		const unsubscribe = () => this.removePaginatedQuerySubscriber(token);
		const existingEntry = this.paginatedQuerySet.get(token);
		if (existingEntry) {
			existingEntry.numSubscribers += 1;
			return {
				paginatedQueryToken: token,
				unsubscribe,
			};
		}
		this.paginatedQuerySet.set(token, {
			token,
			canonicalizedUdfPath,
			args,
			numSubscribers: 1,
			options: { initialNumItems: options.initialNumItems },
			nextPageKey: 0,
			pageKeys: [],
			pageKeyToQuery: /* @__PURE__ */ new Map(),
			ongoingSplits: /* @__PURE__ */ new Map(),
			skip: false,
			id: options.id,
		});
		this.addPageToPaginatedQuery(token, null, options.initialNumItems);
		return {
			paginatedQueryToken: token,
			unsubscribe,
		};
	}
	/**
	 * Get current results for a paginated query based on local state.
	 *
	 * Throws an error when one of the pages has errored.
	 */
	localQueryResult(name, args, options) {
		const token = serializePaginatedPathAndArgs(canonicalizeUdfPath(name), args, options);
		return this.localQueryResultByToken(token);
	}
	/**
	 * @internal
	 */
	localQueryResultByToken(token) {
		const paginatedQuery = this.paginatedQuerySet.get(token);
		if (!paginatedQuery) return;
		const activePages = this.activePageQueryTokens(paginatedQuery);
		if (activePages.length === 0)
			return {
				results: [],
				status: "LoadingFirstPage",
				loadMore: (numItems) => {
					return this.loadMoreOfPaginatedQuery(token, numItems);
				},
			};
		let allResults = [];
		let hasUndefined = false;
		let isDone = false;
		for (const pageToken of activePages) {
			const result = this.client.localQueryResultByToken(pageToken);
			if (result === void 0) {
				hasUndefined = true;
				isDone = false;
				continue;
			}
			const paginationResult = asPaginationResult(result);
			allResults = allResults.concat(paginationResult.page);
			isDone = !!paginationResult.isDone;
		}
		let status;
		if (hasUndefined) status = allResults.length === 0 ? "LoadingFirstPage" : "LoadingMore";
		else if (isDone) status = "Exhausted";
		else status = "CanLoadMore";
		return {
			results: allResults,
			status,
			loadMore: (numItems) => {
				return this.loadMoreOfPaginatedQuery(token, numItems);
			},
		};
	}
	onBaseTransition(transition) {
		const changedBaseTokens = transition.queries.map((q) => q.token);
		const changed = this.queriesContainingTokens(changedBaseTokens);
		let paginatedQueries = [];
		if (changed.length > 0) {
			this.processPaginatedQuerySplits(changed, (token) => this.client.localQueryResultByToken(token));
			paginatedQueries = changed.map((token) => ({
				token,
				modification: {
					kind: "Updated",
					result: this.localQueryResultByToken(token),
				},
			}));
		}
		const extendedTransition = {
			...transition,
			paginatedQueries,
		};
		this.onTransition(extendedTransition);
	}
	/**
	 * Load more items for a paginated query.
	 *
	 * This *always* causes a transition, the status of the query
	 * has probably changed from "CanLoadMore" to "LoadingMore".
	 * Data might have changed too: maybe a subscription to this page
	 * query already exists (unlikely but possible) or this page query
	 * has an optimistic update providing some initial data.
	 *
	 * @internal
	 */
	loadMoreOfPaginatedQuery(token, numItems) {
		this.mustGetPaginatedQuery(token);
		const lastPageToken = this.queryTokenForLastPageOfPaginatedQuery(token);
		const lastPageResult = this.client.localQueryResultByToken(lastPageToken);
		if (!lastPageResult) return false;
		const paginationResult = asPaginationResult(lastPageResult);
		if (paginationResult.isDone) return false;
		this.addPageToPaginatedQuery(token, paginationResult.continueCursor, numItems);
		const loadMoreTransition = {
			timestamp: this.lastTransitionTs,
			reflectedMutations: [],
			queries: [],
			paginatedQueries: [
				{
					token,
					modification: {
						kind: "Updated",
						result: this.localQueryResultByToken(token),
					},
				},
			],
		};
		this.onTransition(loadMoreTransition);
		return true;
	}
	/**
	 * @internal
	 */
	queriesContainingTokens(queryTokens) {
		if (queryTokens.length === 0) return [];
		const changed = [];
		const queryTokenSet = new Set(queryTokens);
		for (const [paginatedToken, paginatedQuery] of this.paginatedQuerySet)
			for (const pageToken of this.allQueryTokens(paginatedQuery))
				if (queryTokenSet.has(pageToken)) {
					changed.push(paginatedToken);
					break;
				}
		return changed;
	}
	/**
	 * @internal
	 */
	processPaginatedQuerySplits(changed, getResult) {
		for (const paginatedQueryToken of changed) {
			const paginatedQuery = this.mustGetPaginatedQuery(paginatedQueryToken);
			const { ongoingSplits, pageKeyToQuery, pageKeys } = paginatedQuery;
			for (const [pageKey, [splitKey1, splitKey2]] of ongoingSplits)
				if (
					getResult(pageKeyToQuery.get(splitKey1).queryToken) !== void 0 &&
					getResult(pageKeyToQuery.get(splitKey2).queryToken) !== void 0
				)
					this.completePaginatedQuerySplit(paginatedQuery, pageKey, splitKey1, splitKey2);
			for (const pageKey of pageKeys) {
				if (ongoingSplits.has(pageKey)) continue;
				const pageEntry = pageKeyToQuery.get(pageKey);
				if (!pageEntry) throw new Error(`No page query for active pageKey ${pageKey}`);
				const pageResult = getResult(pageEntry.queryToken);
				if (!pageResult) continue;
				const result = asPaginationResult(pageResult);
				if (
					result.splitCursor &&
					(result.pageStatus === "SplitRecommended" ||
						result.pageStatus === "SplitRequired" ||
						result.page.length > paginatedQuery.options.initialNumItems * 2)
				)
					this.splitPaginatedQueryPage(
						paginatedQuery,
						pageKey,
						pageEntry.cursor,
						result.splitCursor,
						result.continueCursor,
					);
			}
		}
	}
	splitPaginatedQueryPage(paginatedQuery, pageKey, startCursor, splitCursor, continueCursor) {
		const splitKey1 = paginatedQuery.nextPageKey++;
		const splitKey2 = paginatedQuery.nextPageKey++;
		const paginationOpts = {
			numItems: paginatedQuery.options.initialNumItems,
			id: paginatedQuery.id,
		};
		const firstSubscription = this.client.subscribe(paginatedQuery.canonicalizedUdfPath, {
			...paginatedQuery.args,
			paginationOpts: {
				...paginationOpts,
				cursor: startCursor,
				endCursor: splitCursor,
			},
		});
		paginatedQuery.pageKeyToQuery.set(splitKey1, {
			...firstSubscription,
			cursor: startCursor,
		});
		const secondSubscription = this.client.subscribe(paginatedQuery.canonicalizedUdfPath, {
			...paginatedQuery.args,
			paginationOpts: {
				...paginationOpts,
				cursor: splitCursor,
				endCursor: continueCursor,
			},
		});
		paginatedQuery.pageKeyToQuery.set(splitKey2, {
			...secondSubscription,
			cursor: splitCursor,
		});
		paginatedQuery.ongoingSplits.set(pageKey, [splitKey1, splitKey2]);
	}
	/**
	 * @internal
	 */
	addPageToPaginatedQuery(token, continueCursor, numItems) {
		const paginatedQuery = this.mustGetPaginatedQuery(token);
		const pageKey = paginatedQuery.nextPageKey++;
		const paginationOpts = {
			cursor: continueCursor,
			numItems,
			id: paginatedQuery.id,
		};
		const pageArgs = {
			...paginatedQuery.args,
			paginationOpts,
		};
		const subscription = this.client.subscribe(paginatedQuery.canonicalizedUdfPath, pageArgs);
		paginatedQuery.pageKeys.push(pageKey);
		paginatedQuery.pageKeyToQuery.set(pageKey, {
			...subscription,
			cursor: continueCursor,
		});
		return subscription;
	}
	removePaginatedQuerySubscriber(token) {
		const paginatedQuery = this.paginatedQuerySet.get(token);
		if (!paginatedQuery) return;
		paginatedQuery.numSubscribers -= 1;
		if (paginatedQuery.numSubscribers > 0) return;
		for (const subscription of paginatedQuery.pageKeyToQuery.values()) subscription.unsubscribe();
		this.paginatedQuerySet.delete(token);
	}
	completePaginatedQuerySplit(paginatedQuery, pageKey, splitKey1, splitKey2) {
		const originalQuery = paginatedQuery.pageKeyToQuery.get(pageKey);
		paginatedQuery.pageKeyToQuery.delete(pageKey);
		const pageIndex = paginatedQuery.pageKeys.indexOf(pageKey);
		paginatedQuery.pageKeys.splice(pageIndex, 1, splitKey1, splitKey2);
		paginatedQuery.ongoingSplits.delete(pageKey);
		originalQuery.unsubscribe();
	}
	/** The query tokens for all active pages, in result order */
	activePageQueryTokens(paginatedQuery) {
		return paginatedQuery.pageKeys.map((pageKey) => paginatedQuery.pageKeyToQuery.get(pageKey).queryToken);
	}
	allQueryTokens(paginatedQuery) {
		return Array.from(paginatedQuery.pageKeyToQuery.values()).map((sub) => sub.queryToken);
	}
	queryTokenForLastPageOfPaginatedQuery(token) {
		const paginatedQuery = this.mustGetPaginatedQuery(token);
		const lastPageKey = paginatedQuery.pageKeys[paginatedQuery.pageKeys.length - 1];
		if (lastPageKey === void 0) throw new Error(`No pages for paginated query ${token}`);
		return paginatedQuery.pageKeyToQuery.get(lastPageKey).queryToken;
	}
	mustGetPaginatedQuery(token) {
		const paginatedQuery = this.paginatedQuerySet.get(token);
		if (!paginatedQuery) throw new Error("paginated query no longer exists for token " + token);
		return paginatedQuery;
	}
};
//#endregion
//#region node_modules/.pnpm/convex@1.45.0_react@19.2.7/node_modules/convex/dist/esm/react/client.js
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) =>
	key in obj
		? __defProp(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var DEFAULT_EXTEND_SUBSCRIPTION_FOR = 5e3;
if (typeof src_default === "undefined") throw new Error("Required dependency 'react' not found");
var ConvexReactClient = class {
	/**
	 * @param address - The url of your Convex deployment, often provided
	 * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
	 * @param options - See {@link ConvexReactClientOptions} for a full description.
	 */
	constructor(address, options) {
		__publicField(this, "address");
		__publicField(this, "cachedSync");
		__publicField(this, "cachedPaginatedQueryClient");
		__publicField(this, "listeners");
		__publicField(this, "options");
		__publicField(this, "closed", false);
		__publicField(this, "_logger");
		__publicField(this, "adminAuth");
		__publicField(this, "fakeUserIdentity");
		if (address === void 0)
			throw new Error(
				"No address provided to ConvexReactClient.\nIf trying to deploy to production, make sure to follow all the instructions found at https://docs.convex.dev/production/hosting/\nIf running locally, make sure to run `convex dev` and ensure the .env.local file is populated.",
			);
		if (typeof address !== "string")
			throw new Error(
				`ConvexReactClient requires a URL like 'https://happy-otter-123.convex.cloud', received something of type ${typeof address} instead.`,
			);
		if (!address.includes("://")) throw new Error("Provided address was not an absolute URL.");
		this.address = address;
		this.listeners = /* @__PURE__ */ new Map();
		this._logger =
			options?.logger === false
				? instantiateNoopLogger({ verbose: options?.verbose ?? false })
				: options?.logger !== true && options?.logger
					? options.logger
					: instantiateDefaultLogger({ verbose: options?.verbose ?? false });
		this.options = {
			...options,
			logger: this._logger,
		};
	}
	/**
	 * Return the address for this client, useful for creating a new client.
	 *
	 * Not guaranteed to match the address with which this client was constructed:
	 * it may be canonicalized.
	 */
	get url() {
		return this.address;
	}
	/**
	 * Lazily instantiate the `BaseConvexClient` so we don't create the WebSocket
	 * when server-side rendering.
	 *
	 * @internal
	 */
	get sync() {
		if (this.closed) throw new Error("ConvexReactClient has already been closed.");
		if (this.cachedSync) return this.cachedSync;
		this.cachedSync = this.options.baseClient ?? new BaseConvexClient(this.address, () => {}, this.options);
		if (this.adminAuth) this.cachedSync.setAdminAuth(this.adminAuth, this.fakeUserIdentity);
		this.cachedPaginatedQueryClient = new PaginatedQueryClient(this.cachedSync, (transition) =>
			this.handleTransition(transition),
		);
		return this.cachedSync;
	}
	/**
	 * Lazily instantiate the `PaginatedQueryClient` so we don't create it
	 * when server-side rendering.
	 *
	 * @internal
	 */
	get paginatedQueryClient() {
		this.sync;
		if (this.cachedPaginatedQueryClient) return this.cachedPaginatedQueryClient;
		throw new Error("Should already be instantiated");
	}
	/**
	 * Set the authentication token to be used for subsequent queries and mutations.
	 * `fetchToken` will be called automatically again if a token expires.
	 * `fetchToken` should return `null` if the token cannot be retrieved, for example
	 * when the user's rights were permanently revoked.
	 * @param fetchToken - an async function returning the JWT-encoded OpenID Connect Identity Token
	 * @param onChange - a callback that will be called when the authentication status changes
	 * @param onRefreshChange - a callback called with `true` when the socket is paused to fetch a replacement token after a server rejection, and `false` when refresh completes
	 */
	setAuth(fetchToken, onChange, onRefreshChange) {
		if (typeof fetchToken === "string")
			throw new Error(
				"Passing a string to ConvexReactClient.setAuth is no longer supported, please upgrade to passing in an async function to handle reauthentication.",
			);
		this.sync.setAuth(fetchToken, onChange ?? (() => {}), onRefreshChange);
	}
	/**
	 * Clear the current authentication token if set.
	 */
	clearAuth() {
		this.sync.clearAuth();
	}
	/**
	 * @internal
	 */
	setAdminAuth(token, identity) {
		this.adminAuth = token;
		this.fakeUserIdentity = identity;
		if (this.closed) throw new Error("ConvexReactClient has already been closed.");
		if (this.cachedSync) this.sync.setAdminAuth(token, identity);
	}
	/**
	 * Construct a new {@link Watch} on a Convex query function.
	 *
	 * **Most application code should not call this method directly. Instead use
	 * the {@link useQuery} hook.**
	 *
	 * The act of creating a watch does nothing, a Watch is stateless.
	 *
	 * @param query - A {@link server.FunctionReference} for the public query to run.
	 * @param args - An arguments object for the query. If this is omitted,
	 * the arguments will be `{}`.
	 * @param options - A {@link WatchQueryOptions} options object for this query.
	 *
	 * @returns The {@link Watch} object.
	 */
	watchQuery(query, ...argsAndOptions) {
		const [args, options] = argsAndOptions;
		const name = getFunctionName(query);
		return {
			onUpdate: (callback) => {
				const { queryToken, unsubscribe } = this.sync.subscribe(name, args, options);
				const currentListeners = this.listeners.get(queryToken);
				if (currentListeners !== void 0) currentListeners.add(callback);
				else this.listeners.set(queryToken, /* @__PURE__ */ new Set([callback]));
				return () => {
					if (this.closed) return;
					const currentListeners2 = this.listeners.get(queryToken);
					currentListeners2.delete(callback);
					if (currentListeners2.size === 0) this.listeners.delete(queryToken);
					unsubscribe();
				};
			},
			localQueryResult: () => {
				if (this.cachedSync) return this.cachedSync.localQueryResult(name, args);
			},
			localQueryLogs: () => {
				if (this.cachedSync) return this.cachedSync.localQueryLogs(name, args);
			},
			journal: () => {
				if (this.cachedSync) return this.cachedSync.queryJournal(name, args);
			},
		};
	}
	/**
	 * Indicates likely future interest in a query subscription.
	 *
	 * The implementation currently immediately subscribes to a query. In the future this method
	 * may prioritize some queries over others, fetch the query result without subscribing, or
	 * do nothing in slow network connections or high load scenarios.
	 *
	 * To use this in a React component, call useQuery() and ignore the return value.
	 *
	 * @param queryOptions - A query (function reference from an api object) and its args, plus
	 * an optional extendSubscriptionFor for how long to subscribe to the query.
	 */
	prewarmQuery(queryOptions) {
		const extendSubscriptionFor = queryOptions.extendSubscriptionFor ?? DEFAULT_EXTEND_SUBSCRIPTION_FOR;
		const unsubscribe = this.watchQuery(queryOptions.query, queryOptions.args || {}).onUpdate(() => {});
		setTimeout(unsubscribe, extendSubscriptionFor);
	}
	/**
	 * Construct a new {@link PaginatedWatch} on a Convex paginated query function.
	 *
	 * **Most application code should not call this method directly. Instead use
	 * the {@link usePaginatedQuery} hook.**
	 *
	 * The act of creating a watch does nothing, a Watch is stateless.
	 *
	 * @param query - A {@link server.FunctionReference} for the public query to run.
	 * @param args - An arguments object for the query. If this is omitted,
	 * the arguments will be `{}`.
	 * @param options - A {@link WatchPaginatedQueryOptions} options object for this query.
	 *
	 * @returns The {@link PaginatedWatch} object.
	 *
	 * @internal
	 */
	watchPaginatedQuery(query, args, options) {
		const name = getFunctionName(query);
		return {
			onUpdate: (callback) => {
				const { paginatedQueryToken, unsubscribe } = this.paginatedQueryClient.subscribe(name, args || {}, options);
				const currentListeners = this.listeners.get(paginatedQueryToken);
				if (currentListeners !== void 0) currentListeners.add(callback);
				else this.listeners.set(paginatedQueryToken, /* @__PURE__ */ new Set([callback]));
				return () => {
					if (this.closed) return;
					const currentListeners2 = this.listeners.get(paginatedQueryToken);
					currentListeners2.delete(callback);
					if (currentListeners2.size === 0) this.listeners.delete(paginatedQueryToken);
					unsubscribe();
				};
			},
			localQueryResult: () => {
				return this.paginatedQueryClient.localQueryResult(name, args, options);
			},
		};
	}
	/**
	 * Execute a mutation function.
	 *
	 * @param mutation - A {@link server.FunctionReference} for the public mutation
	 * to run.
	 * @param args - An arguments object for the mutation. If this is omitted,
	 * the arguments will be `{}`.
	 * @param options - A {@link MutationOptions} options object for the mutation.
	 * @returns A promise of the mutation's result.
	 */
	mutation(mutation, ...argsAndOptions) {
		const [args, options] = argsAndOptions;
		const name = getFunctionName(mutation);
		return this.sync.mutation(name, args, options);
	}
	/**
	 * Execute an action function.
	 *
	 * @param action - A {@link server.FunctionReference} for the public action
	 * to run.
	 * @param args - An arguments object for the action. If this is omitted,
	 * the arguments will be `{}`.
	 * @returns A promise of the action's result.
	 */
	action(action, ...args) {
		const name = getFunctionName(action);
		return this.sync.action(name, ...args);
	}
	/**
	 * Fetch a query result once.
	 *
	 * **Most application code should subscribe to queries instead, using
	 * the {@link useQuery} hook.**
	 *
	 * @param query - A {@link server.FunctionReference} for the public query
	 * to run.
	 * @param args - An arguments object for the query. If this is omitted,
	 * the arguments will be `{}`.
	 * @returns A promise of the query's result.
	 */
	query(query, ...args) {
		const watch = this.watchQuery(query, ...args);
		const existingResult = watch.localQueryResult();
		if (existingResult !== void 0) return Promise.resolve(existingResult);
		return new Promise((resolve, reject) => {
			const unsubscribe = watch.onUpdate(() => {
				unsubscribe();
				try {
					resolve(watch.localQueryResult());
				} catch (e) {
					reject(e);
				}
			});
		});
	}
	/**
	 * Get the current {@link ConnectionState} between the client and the Convex
	 * backend.
	 *
	 * @returns The {@link ConnectionState} with the Convex backend.
	 */
	connectionState() {
		return this.sync.connectionState();
	}
	/**
	 * Subscribe to the {@link ConnectionState} between the client and the Convex
	 * backend, calling a callback each time it changes.
	 *
	 * Subscribed callbacks will be called when any part of ConnectionState changes.
	 * ConnectionState may grow in future versions (e.g. to provide a array of
	 * inflight requests) in which case callbacks would be called more frequently.
	 * ConnectionState may also *lose* properties in future versions as we figure
	 * out what information is most useful. As such this API is considered unstable.
	 *
	 * @returns An unsubscribe function to stop listening.
	 */
	subscribeToConnectionState(cb) {
		return this.sync.subscribeToConnectionState(cb);
	}
	/**
	 * Get the logger for this client.
	 *
	 * @returns The {@link Logger} for this client.
	 */
	get logger() {
		return this._logger;
	}
	/**
	 * Close any network handles associated with this client and stop all subscriptions.
	 *
	 * Call this method when you're done with a {@link ConvexReactClient} to
	 * dispose of its sockets and resources.
	 *
	 * @returns A `Promise` fulfilled when the connection has been completely closed.
	 */
	async close() {
		this.closed = true;
		this.listeners = /* @__PURE__ */ new Map();
		if (this.cachedPaginatedQueryClient) this.cachedPaginatedQueryClient = void 0;
		if (this.cachedSync) {
			const sync = this.cachedSync;
			this.cachedSync = void 0;
			await sync.close();
		}
	}
	/**
	 * Handle transitions from both base client and paginated client.
	 * This ensures all transitions are processed synchronously and in order.
	 */
	handleTransition(transition) {
		const simple = transition.queries.map((q) => q.token);
		const paginated = transition.paginatedQueries.map((q) => q.token);
		this.transition([...simple, ...paginated]);
	}
	transition(updatedQueries) {
		for (const queryToken of updatedQueries) {
			const callbacks = this.listeners.get(queryToken);
			if (callbacks) for (const callback of callbacks) callback();
		}
	}
};
src_default.createContext(void 0);
//#endregion
//#region node_modules/.pnpm/bonobo-plugin-sdk@https+++c_f01d8a3bd905813ac2f394f783d14d3b/node_modules/bonobo-plugin-sdk/frontend.js
/**
 * Bonobo plugin frontend SDK — hand-written browser ESM, no build step.
 *
 * Runs inside the host app's sandboxed plugin iframe for plugin pages and plugin file views alike.
 * The comments below say "page" for both kinds, the way the host app's own notes do. Any text a
 * MEMBER can end up reading must not: it has to say "plugin frame", because a member sitting in a
 * file view is not on a page and never read these notes. That covers every `new Error(...)` the SDK
 * rejects with, and every `_nay.message` it resolves — plugin code renders those verbatim.
 *
 * The host handshake is a strict postMessage contract: the page announces `bonobo:ready`, the host
 * answers `bonobo:init` with a short-lived scoped session token (`plu_...`), the page context, and
 * the Convex deployment URL. From then on the page acts on its own:
 *
 * - Public `/api/v1/*` calls go straight to the iframe's own origin with
 *   `Authorization: Bearer <token>`.
 * - Plugin data runs on the page's OWN Convex client, a `ConvexReactClient` the page uses with the
 *   `convex/react` hooks and the typed door references in `api`. The client authenticates with
 *   the plugin-session JWT the host delivers beside the session token, in `bonobo:init` and in
 *   every `bonobo:token`. A host that sends no JWT is covered by the same-origin
 *   `/plugins-ui/session-jwt` exchange. The host window is not part of that data path; it only
 *   answers session-token refreshes over the bridge.
 */
/**
 * The plugin doors with the types the app generated into `convex-api.d.ts`. `anyApi` builds any
 * reference at runtime, so this cast is the one place the SDK trusts that the generated file
 * describes the deployment the frame talks to.
 *
 * @type {import("bonobo-plugin-sdk/convex-api").BonoboConvexApi}
 */
var bonobo_convex_api = anyApi;
/**
 * `getToken` refreshes when the token is expired or expires within this margin. The Convex auth
 * callback treats the stored JWT the same way. The Convex client itself asks for a new JWT 10
 * seconds before it expires, which is inside this margin, so that ask always ends in a host refresh.
 */
var TOKEN_EXPIRY_MARGIN_MS = 6e4;
var READY_RETRY_MS = 500;
var REFRESH_DEADLINE_MS = 1e4;
var AUTH_WAKE_POLL_MS = 1e3;
var AUTH_WAKE_GAP_MS = 3e4;
var NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/**
 * Reads a host theme off a bridge message.
 *
 * The host resolves its colour scales and sends the values under their custom property names,
 * because a plugin page is a cross-origin document and inherits none of the host's custom
 * properties. This comes over postMessage, so every field is checked before the page can see it.
 *
 * @param {unknown} value
 * @returns {import("bonobo-plugin-sdk/frontend").BonoboTheme | null}
 */
function read_theme(value) {
	if (typeof value !== "object" || value === null) return null;
	const candidate = value;
	if (candidate.mode !== "light" && candidate.mode !== "dark") return null;
	if (typeof candidate.tokens !== "object" || candidate.tokens === null) return null;
	/** @type {Record<string, string>} */
	const tokens = {};
	for (const [name, tokenValue] of Object.entries(candidate.tokens)) {
		if (typeof tokenValue !== "string") return null;
		tokens[name] = tokenValue;
	}
	return {
		mode: candidate.mode,
		tokens,
	};
}
/**
 * Paints a host theme onto this document.
 *
 * The frame is a cross-origin document, so the host's stylesheet never reaches it. The SDK writes
 * each scale value onto the root element under the app's own custom property name, and puts the
 * app's `light` / `dark` class on the root too. A plugin stylesheet can then use
 * `var(--color-base-1-03)` and `.dark &` exactly as the app does, and no plugin has to copy this loop.
 *
 * @param {import("bonobo-plugin-sdk/frontend").BonoboTheme} theme
 */
function apply_theme(theme) {
	const root = document.documentElement;
	for (const [name, value] of Object.entries(theme.tokens)) root.style.setProperty(name, value);
	root.classList.toggle("light", theme.mode === "light");
	root.classList.toggle("dark", theme.mode === "dark");
}
/**
 * Reads the invoke route's success body before plugin code can use it. The route is an outside
 * boundary; `undefined` means the shape was not the contract, which the caller reports as
 * unavailable rather than handing the page a half-checked object.
 *
 * @param {unknown} value
 * @returns {{ runId: string, pluginStatus: number, output: string, outputTruncated: boolean } | undefined}
 */
function read_backend_invoke_success(value) {
	if (typeof value !== "object" || value === null) return;
	const body = value;
	if (
		typeof body.runId !== "string" ||
		typeof body.pluginStatus !== "number" ||
		typeof body.output !== "string" ||
		typeof body.outputTruncated !== "boolean"
	)
		return;
	return {
		runId: body.runId,
		pluginStatus: body.pluginStatus,
		output: body.output,
		outputTruncated: body.outputTruncated,
	};
}
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
		typeof context.userId !== "string" ||
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
 *
 * Why the host passes its origin at all: `postMessage` needs a target origin, and the SDK must
 * never send with `"*"`. The same SDK file runs under a localhost host and under the deployed
 * host, so it cannot hardcode the value, and it cannot discover it reliably either
 * (`document.referrer` depends on the referrer policy, `location.ancestorOrigins` is not in
 * Firefox). A wrong value only makes the SDK talk to nobody; it never grants anything. The value
 * is not authentication of the embedder. CSP `frame-ancestors` on the asset response decides who
 * may embed the frame, and only the host's session mint can produce a token.
 *
 * The checks below are format checks, not an allowlist: exactly these two keys, an origin with
 * no path or query, a UUIDv4 nonce.
 */
function read_bridge_bootstrap() {
	const fragment = window.location.hash.slice(1);
	if (!fragment)
		throw new Error("Missing host bridge fragment — this plugin frame must be embedded by the Bonobo host app");
	const params = new URLSearchParams(fragment);
	const parentOrigins = params.getAll("parentOrigin");
	const nonces = params.getAll("nonce");
	if (params.size !== 2 || parentOrigins.length !== 1 || nonces.length !== 1)
		throw new Error("Invalid host bridge fragment");
	const parentOrigin = parentOrigins[0];
	const nonce = nonces[0];
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
	if (!NONCE_PATTERN.test(nonce)) throw new Error("Invalid host bridge nonce");
	return {
		parentOrigin,
		nonce,
	};
}
/**
 * Connects the page to the embedding host app. It installs one shared `message` listener (for
 * init and token responses), posts `{ type: "bonobo:ready", nonce }` to `window.parent`,
 * and resolves with the frontend client when the host's `bonobo:init` arrives. `bonobo:init`
 * messages after the first are ignored.
 *
 * The host puts its canonical HTTP(S) origin and a fresh frame nonce in the URL fragment. The SDK
 * validates both before connecting, sends ready only to that exact origin, and accepts host
 * messages only from that origin, `window.parent`, and the matching nonce. The session token
 * travels over postMessage only and is never placed in a URL.
 *
 * The nonce is a conversation id for one mount of one iframe, not a secret. The host makes a new
 * one per mount and puts it in the URL, so a new mount always loads a fresh document. It does
 * three jobs: the host releases the token only after a ready message that carries it, which
 * proves this document read this mount's fragment; a late init or token from a previous mount
 * carries the old nonce and is dropped; and it backs up the `window.parent` check, because a
 * window keeps its identity across navigations while the document behind it changes.
 *
 * On init the SDK also opens the page's own Convex client against the init's `convexUrl`. The
 * client authenticates with the plugin-session JWT the host delivers beside the session token;
 * the page calls the plugin doors on that client directly. A host that sends no JWT is covered
 * by the same-origin `/plugins-ui/session-jwt` exchange.
 *
 * Token lifetimes, so plugin code never handles refresh itself: the session token and its JWT
 * live 30 minutes and expire together. `getToken` refreshes both through the host when they are
 * expired or within 60 seconds of expiry, and a normal API call that meets a 401 refreshes once
 * and retries once. The Convex client asks for a new JWT 10 seconds before it expires, which is
 * inside that margin, so its own ask is what drives the host refresh: one cadence for both
 * credentials. The host rotates the token on the same session while that session lives. When the
 * session is already gone (the device slept past its expiry), the host mints a new session for
 * this same frame and answers the same refresh with its token and JWT, so the page keeps its
 * state; the SDK treats that answer like any rotation. The session record on the host is the
 * kill switch: every plugin door reads it on each call, so revoking it ends every live
 * subscription at once whatever a JWT says.
 *
 * Secrets never reach this frame. A `plu_` token has no secrets scope, and the SDK has no
 * secrets API. A page that needs a secret calls its own backend through `backend.invoke`; the
 * backend run reads the secret with `env.BONOBO.secrets.get(name)`.
 *
 * @returns {Promise<import("bonobo-plugin-sdk/frontend").BonoboClient>}
 */
async function bonobo_connect() {
	const { parentOrigin, nonce } = read_bridge_bootstrap();
	let apiOrigin = "";
	let token = "";
	let tokenExpiresAt = 0;
	let jwt = "";
	let jwtExpiresAt = 0;
	/**
	 * Theme state — set by `bonobo:init`, replaced by `bonobo:theme` when the member switches the
	 * host's theme. Each one is painted onto the document as it arrives. It stays null when the host
	 * sends none, and then the document keeps the page's own colours.
	 *
	 * @type {import("bonobo-plugin-sdk/frontend").BonoboTheme | null}
	 */
	let theme = null;
	/** @type {Set<(theme: import("bonobo-plugin-sdk/frontend").BonoboTheme) => void>} */
	const themeSubscribers = /* @__PURE__ */ new Set();
	/** @type {Map<string, { resolve: (token: string) => void, reject: (error: Error) => void, timeout: ReturnType<typeof setTimeout> }>} */
	const pending_refreshes = /* @__PURE__ */ new Map();
	/** @type {Promise<string> | null} */
	let refresh_in_flight = null;
	/**
	 * Returns the current session token, refreshing it first when it is expired or within
	 * `TOKEN_EXPIRY_MARGIN_MS` of `tokenExpiresAt`.
	 *
	 * @returns {Promise<string>}
	 */
	async function getToken() {
		if (Date.now() >= tokenExpiresAt - TOKEN_EXPIRY_MARGIN_MS) return refreshToken();
		return token;
	}
	/**
	 * Asks the host for a fresh session token. Concurrent callers share one in-flight
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
				reject(/* @__PURE__ */ new Error("Plugin frame token refresh timed out"));
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
						nonce,
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
	const jwt_is_fresh = () => jwt !== "" && Date.now() < jwtExpiresAt - TOKEN_EXPIRY_MARGIN_MS;
	/**
	 * Stores the JWT a host message delivered beside the token, or clears it when the message
	 * carried none (an older host): the exchange fallback then takes over.
	 *
	 * @param {{ jwt?: unknown, jwtExpiresAt?: unknown }} message
	 */
	const store_delivered_jwt = (message) => {
		if (
			typeof message.jwt === "string" &&
			typeof message.jwtExpiresAt === "number" &&
			Number.isFinite(message.jwtExpiresAt)
		) {
			jwt = message.jwt;
			jwtExpiresAt = message.jwtExpiresAt;
		} else {
			jwt = "";
			jwtExpiresAt = 0;
		}
	};
	/**
	 * `fetch` against `apiOrigin + path` with `Authorization: Bearer <token>`. When `init.body`
	 * is set it is JSON-encoded and sent with `Content-Type: application/json`, and the default
	 * method is `POST`; without a body the default method is `GET`. On a `401` the client
	 * refreshes the token and retries exactly once. Ok responses resolve with the parsed JSON
	 * body; non-ok responses throw an `Error` carrying `status` and `responseText`.
	 *
	 * @param {string} path - Public API path starting with `/`, e.g. `"/api/v1/files/list"`.
	 * @param {{ method?: string, headers?: Record<string, string>, body?: unknown }} [init]
	 * @returns {Promise<unknown>}
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
	/** @type {import("bonobo-plugin-sdk/frontend").BonoboClient["backend"]} */
	const backend = {
		invoke(opts) {
			return fetchJson("/api/v1/plugin-backend/invoke", {
				body: {
					endpoint: opts.endpoint,
					...(opts.input === void 0 ? {} : { input: opts.input }),
					...(opts.serializationKey === void 0 ? {} : { serializationKey: opts.serializationKey }),
				},
			})
				.then((response) => {
					const result = read_backend_invoke_success(response);
					if (result === void 0) {
						console.error("[bonobo-plugin-sdk] Plugin backend invoke response was invalid");
						return {
							_nay: {
								name: "unavailable",
								message: "Failed to run the plugin backend",
							},
						};
					}
					return { _yay: result };
				})
				.catch((error) => {
					const errorRecord = typeof error === "object" && error !== null ? error : null;
					const status = typeof errorRecord?.status === "number" ? errorRecord.status : null;
					/** @type {Record<string, unknown> | null} */
					let refusal = null;
					if (typeof errorRecord?.responseText === "string")
						try {
							const parsed = JSON.parse(errorRecord.responseText);
							refusal = typeof parsed === "object" && parsed !== null ? parsed : null;
						} catch {
							refusal = null;
						}
					const message = typeof refusal?.message === "string" ? refusal.message : null;
					if (status === 409 || status === 429)
						return {
							_nay: {
								name: "busy",
								message: message ?? "The plugin backend is busy",
								...(typeof refusal?.retryAfterMs === "number" ? { retryAfterMs: refusal.retryAfterMs } : {}),
							},
						};
					if (status === 401 || status === 403) {
						if (Date.now() >= tokenExpiresAt)
							return {
								_nay: {
									name: "session_expired",
									message: "This plugin session expired",
								},
							};
						return {
							_nay: {
								name: "denied",
								message: message ?? "This plugin may not run its backend here",
							},
						};
					}
					if (status !== null && status < 500 && message !== null)
						return {
							_nay: {
								name: "invalid",
								message,
							},
						};
					if (Date.now() >= tokenExpiresAt)
						return {
							_nay: {
								name: "session_expired",
								message: "This plugin session expired",
							},
						};
					console.error("[bonobo-plugin-sdk] Plugin backend invoke failed:", error);
					return {
						_nay: {
							name: "unavailable",
							message: "Failed to run the plugin backend",
						},
					};
				});
		},
	};
	/**
	 * Fallback for a host that delivered no JWT: exchanges the session token for the plugin-session
	 * JWT at the asset origin's `/plugins-ui/session-jwt` route. For a published frame this is a
	 * same-origin JSON POST with no preflight, and the route answers no other origin, so the JWT
	 * never becomes readable cross-origin. The one exception is the app's development-only frame
	 * override: a dev deployment may allowlist exactly one extra origin for this route, and the
	 * same POST then runs preflighted from there.
	 *
	 * @param {string} sessionToken
	 */
	const exchange_session_jwt = (sessionToken) =>
		fetch(apiOrigin + "/plugins-ui/session-jwt", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token: sessionToken }),
		});
	/**
	 * The Convex client's auth callback. The stored JWT answers while it is fresh, so a startup or
	 * a wake from a short sleep costs no request at all.
	 *
	 * This chain is also what keeps an open page alive. When the stored JWT is inside the 60-second
	 * margin, or Convex refused the very JWT it holds (a forced refetch for it), one host refresh
	 * replaces both credentials, and that host refresh EXTENDS the session and moves its scheduled
	 * deletion. A page that slept past the session expiry recovers here too: the host finds the
	 * session doc gone, mints a new session for this same frame, and answers the refresh with the
	 * new token and JWT, so the Convex client re-runs its query set under the new session. Only
	 * when the host refuses to mint (uninstalled, membership ended, rate limit) does every path
	 * below answer null, and null tells the Convex client this page is unauthenticated (its
	 * subscriptions die; by then the host has replaced the frame with its error state and Retry).
	 *
	 * A host that sends no JWT falls through to the exchange.
	 *
	 * @param {{ forceRefreshToken: boolean }} [args]
	 */
	async function fetch_convex_jwt(args) {
		const forceRefreshToken = args?.forceRefreshToken === true;
		for (let attempt = 0; ; attempt += 1) {
			if (jwt_is_fresh() && !forceRefreshToken) return jwt;
			/** @type {Response | null} */
			let response = null;
			try {
				if (jwt !== "") {
					await refreshToken();
					if (jwt_is_fresh()) return jwt;
				}
				response = await exchange_session_jwt(await getToken());
				if (response.status === 401) response = await exchange_session_jwt(await refreshToken());
			} catch {
				response = null;
			}
			if (response?.ok) {
				const body = await response.json().catch(() => null);
				const exchangedJwt = body?._yay?.jwt;
				const sessionExpiresAt = body?._yay?.sessionExpiresAt;
				if (typeof exchangedJwt !== "string" || typeof sessionExpiresAt !== "number") return null;
				tokenExpiresAt = sessionExpiresAt;
				jwt = exchangedJwt;
				jwtExpiresAt = sessionExpiresAt;
				return exchangedJwt;
			}
			if (!(response === null || response.status === 429 || response.status >= 500) || attempt >= 2) return null;
			await new Promise((resolveWait) => setTimeout(resolveWait, 1e3 * (attempt + 1)));
		}
	}
	return new Promise((resolve) => {
		let initialized = false;
		/** @type {ReturnType<typeof setInterval> | undefined} */
		let readyInterval;
		const post_ready = () => {
			window.parent.postMessage(
				{
					type: "bonobo:ready",
					nonce,
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
				message.nonce === nonce &&
				typeof message.apiOrigin === "string" &&
				typeof message.convexUrl === "string" &&
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
				store_delivered_jwt(message);
				const convexClient = new ConvexReactClient(message.convexUrl, {
					expectAuth: true,
					unsavedChangesWarning: false,
					initialAuthTokenReuse: true,
				});
				let lastAuthWakePollAt = Date.now();
				const authWakeInterval = setInterval(() => {
					const now = Date.now();
					if (now - lastAuthWakePollAt >= AUTH_WAKE_GAP_MS) convexClient.setAuth(fetch_convex_jwt);
					lastAuthWakePollAt = now;
				}, AUTH_WAKE_POLL_MS);
				convexClient.setAuth(fetch_convex_jwt);
				window.addEventListener(
					"pagehide",
					() => {
						clearInterval(authWakeInterval);
						convexClient.close();
					},
					{ once: true },
				);
				theme = read_theme(message.theme);
				if (theme) apply_theme(theme);
				resolve({
					context: message.context,
					apiOrigin,
					getToken,
					refreshToken,
					fetchJson,
					backend,
					convex: convexClient,
					api: bonobo_convex_api,
					session: {
						expiresAt: () => tokenExpiresAt,
						fetchJwt: fetch_convex_jwt,
					},
					theme: {
						current: () => theme,
						subscribe(onChange) {
							themeSubscribers.add(onChange);
							return () => {
								themeSubscribers.delete(onChange);
							};
						},
					},
				});
			} else if (
				initialized &&
				message.nonce === nonce &&
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
					store_delivered_jwt(message);
					pending.resolve(message.token);
				}
			} else if (initialized && message.nonce === nonce && message.type === "bonobo:theme") {
				const next = read_theme(message.theme);
				if (next) {
					theme = next;
					apply_theme(next);
					for (const onChange of themeSubscribers) onChange(next);
				}
			} else if (
				initialized &&
				message.nonce === nonce &&
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
bonobo_connect().then(
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
