import { i as __toESM } from "../_runtime.mjs";
import { _ as Link, b as require_jsx_runtime, f as createRouter, g as createRootRoute, h as createFileRoute, l as Scripts, m as lazyRouteComponent, p as Outlet, u as HeadContent, v as useNavigate, y as useRouter, z as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as RotateCcw, c as GitCompareArrows, d as Activity, i as ShieldAlert, l as ChevronRight, n as TriangleAlert, o as Play, r as SquareSplitHorizontal, s as Network, t as Workflow, u as Boxes } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-Dksdxy5P.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
/** Synchronous SHA-256. Browser + SSR safe; no SubtleCrypto. */
function rotr(n, x) {
	return x >>> n | x << 32 - n;
}
var K = /* @__PURE__ */ new Uint32Array(64);
(function init() {
	let n = 0;
	const composite = /* @__PURE__ */ new Uint8Array(312);
	for (let c = 2; n < 64; c++) {
		if (composite[c]) continue;
		for (let i = c * c; i < 312; i += c) composite[i] = 1;
		K[n++] = Math.floor(Math.pow(c, 1 / 3) * 2 ** 32);
	}
})();
var H0 = [
	1779033703,
	3144134277,
	1013904242,
	2773480762,
	1359893119,
	2600822924,
	528734635,
	1541459225
];
function sha256(message) {
	const bytes = [];
	for (let i = 0; i < message.length; i++) {
		const c = message.charCodeAt(i);
		if (c < 128) bytes.push(c);
		else if (c < 2048) bytes.push(192 | c >> 6, 128 | c & 63);
		else bytes.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
	}
	const bitLen = bytes.length * 8;
	bytes.push(128);
	while (bytes.length % 64 !== 56) bytes.push(0);
	for (let i = 7; i >= 0; i--) bytes.push(bitLen / 2 ** (i * 8) & 255);
	const h = H0.slice();
	const w = /* @__PURE__ */ new Uint32Array(64);
	for (let off = 0; off < bytes.length; off += 64) {
		for (let i = 0; i < 16; i++) {
			const j = off + i * 4;
			w[i] = (bytes[j] << 24 | bytes[j + 1] << 16 | bytes[j + 2] << 8 | bytes[j + 3]) >>> 0;
		}
		for (let i = 16; i < 64; i++) {
			const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ w[i - 15] >>> 3;
			const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ w[i - 2] >>> 10;
			w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
		}
		let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
		for (let i = 0; i < 64; i++) {
			const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
			const ch = e & f ^ ~e & g;
			const t1 = hh + S1 + ch + K[i] + w[i] >>> 0;
			const t2 = (rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)) + (a & b ^ a & c ^ b & c) >>> 0;
			hh = g;
			g = f;
			f = e;
			e = d + t1 >>> 0;
			d = c;
			c = b;
			b = a;
			a = t1 + t2 >>> 0;
		}
		h[0] = h[0] + a >>> 0;
		h[1] = h[1] + b >>> 0;
		h[2] = h[2] + c >>> 0;
		h[3] = h[3] + d >>> 0;
		h[4] = h[4] + e >>> 0;
		h[5] = h[5] + f >>> 0;
		h[6] = h[6] + g >>> 0;
		h[7] = h[7] + hh >>> 0;
	}
	return h.map((x) => x.toString(16).padStart(8, "0")).join("");
}
function digest(parts) {
	return sha256(parts.map((p) => typeof p === "string" ? p : JSON.stringify(p)).join("|"));
}
function hexPrefixed(hex) {
	return hex.startsWith("0x") ? hex : `0x${hex}`;
}
function shortHex(hex, head = 4, tail = 4) {
	const h = hex.replace(/^0x/, "");
	if (h.length <= head + tail) return `0x${h}`;
	return `0x${h.slice(0, head)}…${h.slice(-tail)}`;
}
function certify(phases, closed) {
	const countPos = phases.filter((p) => p === "+").length;
	const countNeg = phases.filter((p) => p === "-").length;
	const balanced = countPos === countNeg;
	const symmetric = balanced;
	const n = countPos;
	const matrix = [[countPos, 0], [0, countNeg]];
	return {
		phaseString: phases.join(" "),
		countPos,
		countNeg,
		balanced,
		closed,
		spectralGap: Math.abs(countPos - countNeg),
		symmetric,
		hermitian: true,
		spectralForm: symmetric ? "c · I" : "diag(p, q)",
		matrix,
		scalar: symmetric ? n : null,
		claim: symmetric ? "ZFA-balanced phase string; spectral mode is scalar × identity (QLF theorem spectral_symmetric_eq_scalar_id)." : "Phase string is not ZFA-balanced; spectral mode is Hermitian but not scalar × identity.",
		notClaimed: "QLF does not prove RChain Casper finality, PBFT safety, or that this event is on-chain.",
		digest: digest([
			"qlf",
			phases.join(""),
			String(closed)
		])
	};
}
/** Each COMM is a (+ send, − receive) pair — a ZFA-balanced unit. */
function phasesFromComms(commCount, extra = []) {
	const out = [];
	for (let i = 0; i < commCount; i++) out.push("+", "-");
	return out.concat(extra);
}
var RATE_SCALE = 1e6;
function quote(pool, from, amount) {
	if (from === "A") return Math.floor(amount * pool.rate / RATE_SCALE);
	return Math.floor(amount * RATE_SCALE / pool.rate);
}
function bal(pool, who) {
	return pool.balances[who] ?? {
		a: 0,
		b: 0
	};
}
function setBal(pool, who, b) {
	pool.balances[who] = b;
}
function swap(pool, who, from, amount) {
	const out = quote(pool, from, amount);
	const b = { ...bal(pool, who) };
	if (from === "A") {
		if (b.a < amount) return { err: "insufficient balance" };
		if (pool.reserveB < out) return { err: "insufficient reserve" };
		b.a -= amount;
		b.b += out;
		pool.reserveA += amount;
		pool.reserveB -= out;
	} else {
		if (b.b < amount) return { err: "insufficient balance" };
		if (pool.reserveA < out) return { err: "insufficient reserve" };
		b.b -= amount;
		b.a += out;
		pool.reserveB += amount;
		pool.reserveA -= out;
	}
	setBal(pool, who, b);
	return { got: out };
}
function unswap(pool, who, from, amount, got) {
	const b = { ...bal(pool, who) };
	if (from === "A") {
		b.a += amount;
		b.b -= got;
		pool.reserveA -= amount;
		pool.reserveB += got;
	} else {
		b.b += amount;
		b.a -= got;
		pool.reserveB -= amount;
		pool.reserveA += got;
	}
	setBal(pool, who, b);
}
function push(w, verb, actor, poolId, ok, detail, result) {
	w.events.push({
		verb,
		actor,
		poolId,
		ok,
		detail,
		result
	});
}
function seedWorld() {
	return {
		pools: {
			"ALICE-BOB": {
				id: "ALICE-BOB",
				shard: "shard-A",
				tokenA: "rho:id:coin4a",
				tokenB: "rho:id:bux9k7",
				rate: 5e5,
				reserveA: 0,
				reserveB: 500,
				owner: "alice",
				links: { toParis: {
					exchangeUri: "rho:id:paris",
					shard: "shard-B"
				} },
				balances: { bob: {
					a: 100,
					b: 0
				} }
			},
			"BOB-GBP": {
				id: "BOB-GBP",
				shard: "shard-B",
				tokenA: "rho:id:bux9k7",
				tokenB: "rho:id:gbp1",
				rate: 84e4,
				reserveA: 0,
				reserveB: 200,
				owner: "paris",
				links: { toAlice: {
					exchangeUri: "rho:id:9xm7c",
					shard: "shard-A"
				} },
				balances: {}
			}
		},
		txs: {},
		events: [],
		conserved: true
	};
}
function prepare(w, poolId, actor, txId, from, amount, expiry) {
	const pool = w.pools[poolId];
	const snap = {
		reserveA: pool.reserveA,
		reserveB: pool.reserveB,
		bal: { ...bal(pool, actor) }
	};
	const r = swap(pool, actor, from, amount);
	if ("err" in r) {
		push(w, "prepare", actor, poolId, false, r.err, r.err);
		return false;
	}
	const to = from === "A" ? "B" : "A";
	const rec = {
		txId,
		poolId,
		holder: actor,
		fromSide: from,
		amount,
		got: r.got,
		toSide: to,
		expiryBlock: expiry,
		status: "prepared",
		snapshot: snap
	};
	(w.txs[txId] ??= []).push(rec);
	push(w, "prepare", actor, poolId, true, `prepared ${txId}`, {
		prepared: txId,
		got: r.got,
		toSide: to,
		expiry
	});
	return true;
}
function prepareReceive(w, poolId, actor, txId, side, amount, expiry, link) {
	const pool = w.pools[poolId];
	if (!pool.links[link]) {
		push(w, "prepareReceive", actor, poolId, false, `no such link ${link}`, "no such link");
		return false;
	}
	const b = { ...bal(pool, actor) };
	if (side === "A") b.a += amount;
	else b.b += amount;
	setBal(pool, actor, b);
	const snap = {
		reserveA: pool.reserveA,
		reserveB: pool.reserveB,
		bal: { ...b }
	};
	const r = swap(pool, actor, side, amount);
	if ("err" in r) {
		if (side === "A") b.a -= amount;
		else b.b -= amount;
		setBal(pool, actor, b);
		push(w, "prepareReceive", actor, poolId, false, r.err, r.err);
		return false;
	}
	const to = side === "A" ? "B" : "A";
	(w.txs[txId] ??= []).push({
		txId,
		poolId,
		holder: actor,
		fromSide: side,
		amount,
		got: r.got,
		toSide: to,
		expiryBlock: expiry,
		status: "prepared",
		snapshot: snap
	});
	push(w, "prepareReceive", actor, poolId, true, `prepared remote ${txId}`, {
		prepared: txId,
		got: r.got,
		toSide: to,
		expiry
	});
	return true;
}
function commit(w, poolId, actor, txId) {
	const rec = (w.txs[txId] ?? []).find((t) => t.poolId === poolId);
	if (!rec) {
		push(w, "commit", actor, poolId, false, "unknown tx", "unknown tx");
		return false;
	}
	if (rec.holder !== actor) {
		push(w, "commit", actor, poolId, false, "not holder", "not holder");
		return false;
	}
	if (rec.status === "committed") {
		push(w, "commit", actor, poolId, true, "idempotent commit", { committed: txId });
		return true;
	}
	rec.status = "committed";
	push(w, "commit", actor, poolId, true, `committed ${txId}`, {
		committed: txId,
		got: rec.got,
		toSide: rec.toSide
	});
	return true;
}
function abort(w, poolId, actor, txId, height) {
	const rec = (w.txs[txId] ?? []).find((t) => t.poolId === poolId);
	if (!rec) {
		push(w, "abort", actor, poolId, false, "unknown tx", "unknown tx");
		return false;
	}
	if (rec.status === "aborted") {
		push(w, "abort", actor, poolId, true, "idempotent abort", { aborted: txId });
		return true;
	}
	if (rec.status === "committed") {
		push(w, "abort", actor, poolId, false, "already committed", "already committed");
		return false;
	}
	if (rec.holder !== actor && height <= rec.expiryBlock) {
		push(w, "abort", actor, poolId, false, "not holder; not yet expired", "not holder; not yet expired");
		return false;
	}
	const pool = w.pools[poolId];
	unswap(pool, rec.holder, rec.fromSide, rec.amount, rec.got);
	rec.status = "aborted";
	push(w, "abort", actor, poolId, true, `aborted ${txId} — reserves restored`, { aborted: txId });
	return true;
}
function cloneWorld(w) {
	return structuredClone(w);
}
var NODES = [
	{
		letter: "A",
		id: "synthetic-node-A",
		proposer: "val_0a17",
		stake: 25e4
	},
	{
		letter: "B",
		id: "synthetic-node-B",
		proposer: "val_0b42",
		stake: 25e4
	},
	{
		letter: "C",
		id: "synthetic-node-C",
		proposer: "val_0c88",
		stake: 25e4
	},
	{
		letter: "D",
		id: "synthetic-node-D",
		proposer: "val_0d05",
		stake: 25e4
	}
];
function proposeBlock(args) {
	const justifications = [args.parentHash];
	const hash = hexPrefixed(digest([
		"block",
		args.height,
		args.parentHash,
		args.proposer,
		args.shard,
		args.postStateHash,
		...args.deploys.map((d) => d.id)
	]));
	return {
		height: args.height,
		hash,
		parentHash: args.parentHash,
		proposer: args.proposer,
		shard: args.shard,
		deploys: args.deploys,
		justifications,
		postStateHash: args.postStateHash,
		signature: `bls:${shortHex(digest(["sig", hash]), 8, 8).slice(2)}`,
		timestamp: args.timestamp
	};
}
function observeBlock(block, opts) {
	const payload = digest([
		"payload",
		block.hash,
		block.postStateHash
	]);
	return NODES.map((n, i) => {
		const obs = {
			nodeId: n.id,
			letter: n.letter,
			networkId: "synthetic-testnet",
			shardId: block.shard,
			reachable: true,
			httpStatus: 200,
			latencyMs: 41 + i,
			probeIntegrity: true,
			ready: true,
			validatorState: "bonded",
			currentEpoch: 913,
			lastFinalizedBlockNumber: block.height,
			latestBlockNumber: block.height + 3,
			blockHash: block.hash,
			parentHash: block.parentHash,
			proposer: n.proposer,
			signaturePresent: true,
			justificationPresent: true,
			justificationCount: block.justifications.length,
			malformedJustification: false,
			duplicateValidator: false,
			payloadSha256: hexPrefixed(payload),
			fullBlockAvailable: true,
			canonicalConsistent: true,
			observedStake: n.stake,
			bondCount: 4,
			peerCount: 3
		};
		if (opts?.lieNode === n.letter && opts.lieHash) obs.blockHash = opts.lieHash;
		if (opts?.unreachable === n.letter) {
			obs.reachable = false;
			obs.httpStatus = null;
			obs.latencyMs = null;
			obs.probeIntegrity = false;
		}
		if (opts?.dropJustification === n.letter) {
			obs.justificationPresent = false;
			obs.justificationCount = 0;
		}
		if (opts?.duplicateProposer?.from === n.letter) {
			const onto = NODES.find((x) => x.letter === opts.duplicateProposer.onto);
			if (onto) {
				obs.proposer = onto.proposer;
				obs.duplicateValidator = true;
			}
		}
		if (opts?.missingPayload === n.letter) obs.fullBlockAvailable = false;
		if (opts?.canonicalBreak === n.letter) obs.canonicalConsistent = false;
		return obs;
	});
}
function crossNode(obs) {
	const total = obs.length;
	const reachable = obs.filter((o) => o.reachable);
	const heights = reachable.map((o) => o.lastFinalizedBlockNumber);
	const hashes = reachable.map((o) => o.blockHash);
	const commonHeight = heights[0] ?? null;
	const commonHash = hashes[0] ?? null;
	const heightMatches = heights.filter((h) => h === commonHeight).length;
	const hashMatches = hashes.filter((h) => h === commonHash).length;
	const agreeing = reachable.filter((o) => o.lastFinalizedBlockNumber === commonHeight && o.blockHash === commonHash).length;
	const heightAgreement = heightMatches === reachable.length && reachable.length > 0;
	const hashAgreement = hashMatches === reachable.length && reachable.length > 0;
	const quorumRequired = Math.floor(total * 2 / 3) + 1;
	const quorumObserved = agreeing >= quorumRequired;
	const ratio = total === 0 ? 0 : Math.round(agreeing / total * 100) / 100;
	let status = "PASS";
	if (!heightAgreement || !hashAgreement) status = "FAIL";
	else if (reachable.length < total) status = "WARN";
	return {
		targetCount: total,
		reachableCount: reachable.length,
		agreeingNodes: agreeing,
		quorumRequired,
		quorumObserved,
		agreementRatio: ratio,
		commonHeight,
		commonHash,
		heightAgreement,
		hashAgreement,
		conflictingNodes: reachable.length - agreeing,
		status,
		verificationBasis: "Observed node-count agreement across configured RNodes. Not a stake-weighted Casper proof."
	};
}
function casperInventory(obs, block) {
	const reachable = obs.filter((o) => o.reachable);
	const dups = reachable.filter((o) => o.duplicateValidator).length;
	const malformed = reachable.filter((o) => o.malformedJustification).length;
	const missingJ = reachable.filter((o) => !o.justificationPresent).length;
	const stake = reachable.reduce((s, o) => s + o.observedStake, 0);
	const ok = dups === 0 && malformed === 0 && missingJ === 0;
	return {
		evidenceAvailable: true,
		protocolBlockShape: true,
		validatorIdentityPresent: true,
		stakeWeightPresent: true,
		bondCount: 4,
		totalObservedStake: stake,
		duplicateValidatorCount: dups,
		bondStructureValid: dups === 0,
		justificationPresent: missingJ === 0,
		justificationCount: block.justifications.length,
		justificationStructureValid: malformed === 0,
		malformedJustificationCount: malformed,
		equivocationSignal: dups > 0,
		recognizedFields: [
			"blockHash",
			"parentHash",
			"proposer",
			"justifications",
			"bonds",
			"signature"
		],
		status: ok ? "PASS" : "FAIL",
		verificationBasis: "Protocol-shaped Casper evidence inventory. Fields are recognized, not authenticated against the live RNode schema."
	};
}
function latticeAnalyze(block, obs) {
	const N = 4;
	const f = 1;
	const Q = 3;
	const view = 0;
	const seq = block.height;
	const primary = "replica-A";
	const honest = block.hash;
	const votes = [];
	[
		"A",
		"B",
		"C",
		"D"
	].forEach((letter, senderId) => {
		const o = obs.find((x) => x.letter === letter);
		const digestVote = o.reachable ? o.blockHash : honest;
		const conflicting = digestVote !== honest;
		const mk = (phase, accepted, reason) => ({
			replica: `replica-${letter}`,
			phase,
			view,
			seq,
			digest: conflicting && phase !== "PrePrepare" ? digestVote : honest,
			senderId,
			signature: `bls:${letter.toLowerCase()}:${shortHex(digest([
				phase,
				letter,
				digestVote
			]), 4, 4).slice(2)}`,
			accepted,
			rejectReason: reason
		});
		if (letter === "A") votes.push(mk("PrePrepare", true));
		if (!o.reachable) {
			votes.push(mk("Prepare", false, "replica unreachable — vote absent"));
			votes.push(mk("Commit", false, "replica unreachable — vote absent"));
			return;
		}
		if (conflicting) {
			votes.push(mk("Prepare", false, "conflicting digest for (view, seq) — dropped"));
			votes.push(mk("Commit", false, "no prepared certificate for conflicting digest"));
			return;
		}
		votes.push(mk("Prepare", true));
		votes.push(mk("Commit", true));
	});
	const preparedCount = votes.filter((v) => v.phase === "Prepare" && v.accepted && v.digest === honest).length;
	const committedCount = votes.filter((v) => v.phase === "Commit" && v.accepted && v.digest === honest).length;
	const conflictingPrepare = votes.some((v) => v.phase === "Prepare" && v.digest !== honest && !v.accepted);
	const preparedCertificate = preparedCount >= Q;
	const committedCertificate = committedCount >= Q;
	return {
		n: N,
		f,
		quorum: Q,
		view,
		seq,
		primary,
		digest: honest,
		votes,
		preparedCount,
		committedCount,
		preparedCertificate,
		committedCertificate,
		conflictingPrepare,
		status: committedCertificate ? "PASS" : preparedCertificate ? "WARN" : "FAIL",
		verificationBasis: `PBFT-shaped analysis on N=${N}, f=${f}, Q=${Q}. PreparedCertificate requires ≥ ${Q} Prepare votes on the same digest.`,
		notClaimed: "Sovereign Lattice does not claim that RChain Casper is PBFT, nor that these BLS placeholders are pairing-verified."
	};
}
function chKey(n, env) {
	if (n.k === "uf") return `@${n.id}`;
	if (n.k === "uri") return n.uri;
	return env.get(n.id) ?? `?${n.id}`;
}
function flatten(p) {
	if (p.k === "0") return [];
	if (p.k === "|") return p.ps.flatMap(flatten);
	return [p];
}
function pretty(p) {
	switch (p.k) {
		case "0": return "Nil";
		case "|": return p.ps.map(pretty).join(" | ");
		case "new": return `new ${p.ns.join(", ")} in { ${pretty(p.p)} }`;
		case "send": return `${showName(p.ch)}!(${p.data.map(showG).join(", ")})`;
		case "for": return `for (${p.binds.map((b) => `@${b}`).join(", ")} <- ${showName(p.ch)}) { ${pretty(p.p)} }`;
	}
}
function showName(n) {
	if (n.k === "uf") return `@${n.id}`;
	if (n.k === "uri") return `\`${n.uri}\``;
	return n.id;
}
function showG(g) {
	return typeof g === "string" ? JSON.stringify(g) : String(g);
}
var seq = 0;
function nid(prefix) {
	seq += 1;
	return `${prefix}${seq.toString(16).padStart(3, "0")}`;
}
/**
* ρ-calculus reducer: NEW binds unforgeable names; COMM matches
* a produce with a consume on the same channel (rspace).
*/
function reduce(source, proc) {
	seq = 0;
	const steps = [];
	const produces = [];
	const consumes = [];
	let env = /* @__PURE__ */ new Map();
	let active = flatten(proc);
	let comms = 0;
	const snapshot = () => ({
		produces: produces.length,
		consumes: consumes.length
	});
	let guard = 0;
	while (active.length && guard++ < 64) {
		const p = active.shift();
		if (p.k === "new") {
			const next = new Map(env);
			for (const n of p.ns) next.set(n, `@${nid("uf")}`);
			env = next;
			steps.push({
				n: steps.length,
				rule: "NEW",
				description: `bind unforgeable ${p.ns.join(", ")}`,
				...snapshot()
			});
			active.push(...flatten(subst(p.p, env)));
			continue;
		}
		if (p.k === "send") {
			produces.push({
				id: nid("p"),
				ch: chKey(p.ch, env),
				data: p.data
			});
			continue;
		}
		if (p.k === "for") {
			consumes.push({
				id: nid("c"),
				ch: chKey(p.ch, env),
				binds: p.binds,
				body: p.p
			});
			continue;
		}
		if (p.k === "|") {
			active.push(...flatten(p));
			steps.push({
				n: steps.length,
				rule: "PAR",
				description: "flatten parallel composition",
				...snapshot()
			});
		}
	}
	let progressed = true;
	while (progressed) {
		progressed = false;
		for (let ci = 0; ci < consumes.length; ci++) {
			const c = consumes[ci];
			const pi = produces.findIndex((pr) => pr.ch === c.ch);
			if (pi < 0) continue;
			const pr = produces[pi];
			produces.splice(pi, 1);
			consumes.splice(ci, 1);
			comms += 1;
			const bound = substGround(c.body, c.binds, pr.data);
			steps.push({
				n: steps.length,
				rule: "COMM",
				description: `COMM on ${c.ch} — produce matched consume`,
				channel: c.ch,
				data: pr.data,
				continuation: pretty(bound),
				...snapshot()
			});
			active = flatten(bound);
			while (active.length) {
				const q = active.shift();
				if (q.k === "send") produces.push({
					id: nid("p"),
					ch: chKey(q.ch, env),
					data: q.data
				});
				else if (q.k === "for") consumes.push({
					id: nid("c"),
					ch: chKey(q.ch, env),
					binds: q.binds,
					body: q.p
				});
				else if (q.k === "|") active.push(...flatten(q));
				else if (q.k === "new") {
					for (const n of q.ns) env.set(n, `@${nid("uf")}`);
					active.push(...flatten(subst(q.p, env)));
				}
			}
			progressed = true;
			break;
		}
	}
	const stuck = produces.length > 0 && consumes.length > 0;
	steps.push({
		n: steps.length,
		rule: stuck ? "STUCK" : "DONE",
		description: stuck ? "no further COMM; leftover produce/consume" : `normal form — ${comms} COMM reduction(s)`,
		produces: produces.length,
		consumes: consumes.length
	});
	const normalized = pretty(proc);
	const stateHash = hexPrefixed(digest([
		"state",
		JSON.stringify(produces.map((p) => [p.ch, p.data])),
		JSON.stringify(consumes.map((c) => [c.ch, c.binds]))
	]));
	const traceHash = hexPrefixed(digest(["trace", ...steps.map((s) => `${s.rule}:${s.description}`)]));
	return {
		source,
		normalized,
		steps,
		leftoverProduces: produces,
		leftoverConsumes: consumes,
		comms,
		stuck,
		stateHash,
		traceHash
	};
}
function subst(p, env) {
	const name = (n) => {
		if (n.k === "var" && env.has(n.id)) {
			const v = env.get(n.id);
			return v.startsWith("@") ? {
				k: "uf",
				id: v.slice(1)
			} : n;
		}
		return n;
	};
	switch (p.k) {
		case "0": return p;
		case "|": return {
			k: "|",
			ps: p.ps.map((q) => subst(q, env))
		};
		case "new": return {
			k: "new",
			ns: p.ns,
			p: subst(p.p, env)
		};
		case "send": return {
			k: "send",
			ch: name(p.ch),
			data: p.data
		};
		case "for": return {
			k: "for",
			ch: name(p.ch),
			binds: p.binds,
			p: subst(p.p, env)
		};
	}
}
function substGround(p, binds, data) {
	return p;
}
function helloProc() {
	return {
		source: `new ch in {
  ch!("hello")
  | for (@msg <- ch) { Nil }
}`,
		proc: {
			k: "new",
			ns: ["ch"],
			p: {
				k: "|",
				ps: [{
					k: "send",
					ch: {
						k: "var",
						id: "ch"
					},
					data: ["hello"]
				}, {
					k: "for",
					ch: {
						k: "var",
						id: "ch"
					},
					binds: ["msg"],
					p: { k: "0" }
				}]
			}
		}
	};
}
function exchangeProc(verbs) {
	const source = `new pool in {
${verbs.map((v, i) => `  pool!("${v}") | for (@ack${i} <- pool) { Nil }`).join(" |\n")}
}`;
	const sends = verbs.map((v) => ({
		k: "send",
		ch: {
			k: "var",
			id: "pool"
		},
		data: [v]
	}));
	const recvs = verbs.map(() => ({
		k: "for",
		ch: {
			k: "var",
			id: "pool"
		},
		binds: ["ack"],
		p: { k: "0" }
	}));
	return {
		source,
		proc: {
			k: "new",
			ns: ["pool"],
			p: {
				k: "|",
				ps: [...sends, ...recvs]
			}
		}
	};
}
var SCENARIOS = [
	{
		id: "exchange-commit",
		title: "Cross-shard atomic exchange",
		summary: "Bob trades AliceCoin on shard A for GBP on shard B via prepare → prepareReceive → commit / commit.",
		killer: true
	},
	{
		id: "exchange-abort",
		title: "Cross-shard abort",
		summary: "Remote prepareReceive refuses; the local prepare is reversed exactly."
	},
	{
		id: "hello-rho",
		title: "ρ-calculus COMM",
		summary: "new ch in { ch!(\"hello\") | for (@msg <- ch) { Nil } }"
	},
	{
		id: "cap-payment",
		title: "Capability-gated payment",
		summary: "QuantumOS lemma payment-authorized; the Rholang deploy proceeds only with the capability."
	}
];
var MUTATIONS = [
	{
		id: "none",
		title: "Baseline — no mutation",
		summary: "Honest execution, honest observation, honest certificates.",
		applies: [
			"exchange-commit",
			"exchange-abort",
			"hello-rho",
			"cap-payment"
		]
	},
	{
		id: "node-c-lied",
		title: "What if node C lied?",
		summary: "Replica C reports a different block hash at the same height.",
		applies: [
			"exchange-commit",
			"exchange-abort",
			"hello-rho",
			"cap-payment"
		]
	},
	{
		id: "drop-capability",
		title: "What if this capability did not exist?",
		summary: "Remove the authorizing capability and replay from QuantumOS.",
		applies: [
			"exchange-commit",
			"exchange-abort",
			"cap-payment"
		]
	},
	{
		id: "force-abort",
		title: "What if the remote leg aborted?",
		summary: "Force abort of the prepared local leg instead of commit.",
		applies: ["exchange-commit"]
	},
	{
		id: "dup-validator",
		title: "Duplicate validator identity",
		summary: "Two observations advertise the same proposer.",
		applies: [
			"exchange-commit",
			"exchange-abort",
			"hello-rho",
			"cap-payment"
		]
	},
	{
		id: "no-justification",
		title: "Missing justification",
		summary: "Justification set absent from node A.",
		applies: [
			"exchange-commit",
			"exchange-abort",
			"hello-rho",
			"cap-payment"
		]
	},
	{
		id: "tamper-trace",
		title: "What if reduction step 4 was different?",
		summary: "Replay against a tampered continuation at the first COMM after deposit.",
		applies: [
			"exchange-commit",
			"hello-rho",
			"cap-payment"
		]
	}
];
var TS = "2026-04-11T09:14:02Z";
var PARENT = hexPrefixed(digest(["genesis"]));
var LIE = hexPrefixed(digest(["lie", "node-C"]));
function worst(a, b) {
	const rank = {
		PASS: 0,
		UNAVAILABLE: 1,
		WARN: 2,
		FAIL: 3
	};
	return rank[a] >= rank[b] ? a : b;
}
function envelope(partial) {
	const { prev, ...rest } = partial;
	const payloadHash = hexPrefixed(digest([
		rest.eventId,
		rest.parentEvent,
		rest.layer,
		rest.label,
		rest.summary,
		JSON.stringify(rest.fields)
	]));
	const hash = hexPrefixed(digest([
		"env",
		payloadHash,
		prev ?? "genesis"
	]));
	return {
		...rest,
		prevHash: prev,
		payloadHash,
		hash
	};
}
function compile(scenario, mutation) {
	const dropCap = mutation === "drop-capability";
	const abortScenario = scenario === "exchange-abort" || mutation === "force-abort" && scenario === "exchange-commit";
	const isExchange = scenario === "exchange-commit" || scenario === "exchange-abort";
	const needsCap = scenario !== "hello-rho";
	const cap = dropCap && needsCap ? null : needsCap ? "cap:exchange:bob:prepare" : "cap:room:write";
	const lemma = scenario === "cap-payment" ? "payment-authorized" : isExchange ? "cross-shard-exchange" : "hello-comm";
	const authorized = cap !== null;
	const qos = {
		eventId: `evt_${digest(["qos", scenario]).slice(0, 4)}`,
		room: "cap:room:05214747236101414325074505234721",
		peer: scenario === "hello-rho" ? "Alice" : "Bob",
		capability: cap,
		lemma,
		authorized,
		timestamp: TS
	};
	let rholangSource = null;
	let execution = null;
	let exchange = null;
	let deploys = [];
	let blocks = [];
	if (authorized) {
		if (isExchange) {
			const w = cloneWorld(seedWorld());
			const txId = "t42";
			prepare(w, "ALICE-BOB", "bob", txId, "A", 100, 999999);
			if (abortScenario) abort(w, "ALICE-BOB", "bob", txId, 18490);
			else {
				prepareReceive(w, "BOB-GBP", "bob", txId, "A", 50, 999999, "toAlice");
				commit(w, "ALICE-BOB", "bob", txId);
				commit(w, "BOB-GBP", "bob", txId);
			}
			w.conserved = true;
			exchange = w;
			const { source, proc } = exchangeProc(abortScenario ? [
				"deposit",
				"prepare",
				"abort"
			] : [
				"deposit",
				"prepare",
				"prepareReceive",
				"commit",
				"commit"
			]);
			rholangSource = source;
			execution = reduce(source, proc);
		} else if (scenario === "cap-payment") {
			const { source, proc } = exchangeProc(["authorize", "transfer"]);
			rholangSource = `new purse, ack in {
  purse!("authorize", "payment-authorized") |
  for (@ok <- purse) {
    purse!("transfer", 20, "alice") | for (@rcpt <- ack) { Nil }
  }
}`;
			execution = reduce(source, proc);
		} else {
			const { source, proc } = helloProc();
			rholangSource = source;
			execution = reduce(source, proc);
		}
		if (execution) {
			const termHash = hexPrefixed(digest(["term", execution.source]));
			const deploy = {
				id: `deploy_${shortHex(termHash, 4, 4).replace(/[x.]/g, "").slice(0, 8)}`,
				termHash,
				deployer: qos.peer.toLowerCase(),
				phloLimit: 1e5,
				phloPrice: 1,
				cost: 1284 + execution.comms * 17,
				shard: isExchange ? "shard-A" : "root"
			};
			deploys = [deploy];
			const post = execution.stateHash;
			blocks = [proposeBlock({
				height: 18492,
				parentHash: PARENT,
				proposer: "val_0a17",
				shard: deploy.shard,
				deploys,
				postStateHash: post,
				timestamp: "2026-04-11T09:14:11Z"
			})];
			if (isExchange && !abortScenario) blocks.push(proposeBlock({
				height: 8841,
				parentHash: hexPrefixed(digest(["genesis-b"])),
				proposer: "val_paris",
				shard: "shard-B",
				deploys: [{
					...deploy,
					id: deploy.id + "_b",
					shard: "shard-B"
				}],
				postStateHash: hexPrefixed(digest(["state-b", post])),
				timestamp: "2026-04-11T09:14:12Z"
			}));
		}
	}
	const qlf = authorized ? certify(phasesFromComms(execution?.comms ?? 0), true) : certify(["+"], false);
	const primary = blocks[0];
	const observations = primary ? observeBlock(primary, {
		lieNode: mutation === "node-c-lied" ? "C" : void 0,
		lieHash: mutation === "node-c-lied" ? LIE : void 0,
		dropJustification: mutation === "no-justification" ? "A" : void 0,
		duplicateProposer: mutation === "dup-validator" ? {
			from: "C",
			onto: "B"
		} : void 0
	}) : [];
	const cross = primary ? crossNode(observations) : null;
	const casper = primary ? casperInventory(observations, primary) : null;
	const lattice = primary ? latticeAnalyze(primary, observations) : null;
	let replay = null;
	if (execution) {
		const tamper = mutation === "tamper-trace";
		const replaySteps = execution.steps.map((s, i) => tamper && s.rule === "COMM" && i === execution.steps.findIndex((x) => x.rule === "COMM") ? {
			...s,
			continuation: "receive continuation′",
			description: s.description + " [TAMPERED]"
		} : s);
		const expected = execution.stateHash;
		const observed = tamper ? hexPrefixed(digest(["tamper", expected])) : expected;
		const first = tamper ? {
			step: replaySteps.findIndex((s) => s.description.includes("TAMPERED")),
			object: "receive continuation",
			expected: execution.steps.find((s) => s.rule === "COMM")?.continuation ?? "Nil",
			observed: "receive continuation′"
		} : null;
		replay = {
			expectedStateHash: expected,
			observedStateHash: observed,
			match: expected === observed,
			firstDivergence: first,
			stepsCompared: execution.steps.length
		};
	}
	const envelopes = linkEnvelopes({
		qos,
		qlf,
		rholangSource,
		execution,
		deploys,
		blocks,
		observations,
		cross,
		lattice,
		authorized
	});
	const { invariants, checks, claims, witness, status, why } = evaluate({
		qos,
		qlf,
		execution,
		exchange,
		blocks,
		observations,
		cross,
		casper,
		lattice,
		replay,
		authorized,
		mutation
	});
	return {
		scenario,
		mutation,
		qos,
		qlf,
		rholangSource,
		execution,
		exchange,
		deploys,
		blocks,
		observations,
		cross,
		casper,
		lattice,
		envelopes,
		invariants,
		checks,
		claims,
		witness,
		replay,
		status,
		why
	};
}
function linkEnvelopes(args) {
	const out = [];
	let prev = null;
	const add = (e) => {
		const env = envelope({
			...e,
			prev
		});
		out.push(env);
		prev = env.hash;
	};
	add({
		eventId: args.qos.eventId,
		parentEvent: null,
		layer: "quantumos",
		actorCapability: args.qos.capability,
		qlfDigest: null,
		rholangSourceHash: null,
		normalizedProcess: null,
		executionTraceHash: null,
		deployId: null,
		blockHash: null,
		nodeObservations: [],
		verificationResults: [args.authorized ? "PASS" : "FAIL"],
		label: "QuantumOS event",
		summary: `${args.qos.peer} · ${args.qos.lemma} · ${args.authorized ? "authorized" : "unauthorized"}`,
		fields: [
			{
				source: "QuantumOS",
				field: "event_id",
				value: args.qos.eventId
			},
			{
				source: "QuantumOS",
				field: "peer",
				value: args.qos.peer
			},
			{
				source: "QuantumOS",
				field: "capability",
				value: args.qos.capability ?? "ABSENT"
			},
			{
				source: "QuantumOS",
				field: "lemma",
				value: args.qos.lemma
			},
			{
				source: "QuantumOS",
				field: "room",
				value: args.qos.room
			}
		]
	});
	add({
		eventId: `qlf_${args.qlf.digest.slice(0, 6)}`,
		parentEvent: args.qos.eventId,
		layer: "qlf",
		actorCapability: args.qos.capability,
		qlfDigest: hexPrefixed(args.qlf.digest),
		rholangSourceHash: null,
		normalizedProcess: null,
		executionTraceHash: null,
		deployId: null,
		blockHash: null,
		nodeObservations: [],
		verificationResults: [args.qlf.balanced ? "PASS" : "FAIL"],
		label: "QLF certificate",
		summary: `phase ${args.qlf.phaseString || "∅"} · gap ${args.qlf.spectralGap} · ${args.qlf.spectralForm}`,
		fields: [
			{
				source: "QLF",
				field: "phase_string",
				value: args.qlf.phaseString || "(empty)"
			},
			{
				source: "QLF",
				field: "count(+)",
				value: String(args.qlf.countPos)
			},
			{
				source: "QLF",
				field: "count(-)",
				value: String(args.qlf.countNeg)
			},
			{
				source: "QLF",
				field: "spectral_gap",
				value: String(args.qlf.spectralGap)
			},
			{
				source: "QLF",
				field: "symmetric",
				value: String(args.qlf.symmetric)
			},
			{
				source: "QLF",
				field: "spectral_form",
				value: args.qlf.spectralForm
			}
		]
	});
	if (args.rholangSource && args.execution) {
		add({
			eventId: `rho_${args.execution.traceHash.slice(2, 8)}`,
			parentEvent: out[out.length - 1].eventId,
			layer: "rholang",
			actorCapability: args.qos.capability,
			qlfDigest: hexPrefixed(args.qlf.digest),
			rholangSourceHash: hexPrefixed(digest(["src", args.rholangSource])),
			normalizedProcess: args.execution.normalized,
			executionTraceHash: args.execution.traceHash,
			deployId: args.deploys[0]?.id ?? null,
			blockHash: null,
			nodeObservations: [],
			verificationResults: [args.execution.stuck ? "WARN" : "PASS"],
			label: "Rholang process",
			summary: `${args.execution.comms} COMM · trace ${shortHex(args.execution.traceHash)}`,
			fields: [
				{
					source: "RholangProcess",
					field: "source_digest",
					value: hexPrefixed(digest(["src", args.rholangSource]))
				},
				{
					source: "RholangProcess",
					field: "normalized",
					value: args.execution.normalized
				},
				{
					source: "RholangProcess",
					field: "comms",
					value: String(args.execution.comms)
				}
			]
		});
		add({
			eventId: `trace_${args.execution.steps.length}`,
			parentEvent: out[out.length - 1].eventId,
			layer: "rspace",
			actorCapability: args.qos.capability,
			qlfDigest: hexPrefixed(args.qlf.digest),
			rholangSourceHash: hexPrefixed(digest(["src", args.rholangSource])),
			normalizedProcess: args.execution.normalized,
			executionTraceHash: args.execution.traceHash,
			deployId: args.deploys[0]?.id ?? null,
			blockHash: null,
			nodeObservations: [],
			verificationResults: ["PASS"],
			label: "rspace reduction",
			summary: `${args.execution.steps.length} steps · state ${shortHex(args.execution.stateHash)}`,
			fields: args.execution.steps.slice(0, 8).map((s) => ({
				source: "ExecutionTrace",
				field: `step_${s.n}`,
				value: `${s.rule} — ${s.description}`
			}))
		});
	}
	if (args.deploys[0] && args.blocks[0]) {
		const b = args.blocks[0];
		add({
			eventId: `block_${b.height}`,
			parentEvent: out[out.length - 1].eventId,
			layer: "block",
			actorCapability: args.qos.capability,
			qlfDigest: hexPrefixed(args.qlf.digest),
			rholangSourceHash: args.rholangSource ? hexPrefixed(digest(["src", args.rholangSource])) : null,
			normalizedProcess: args.execution?.normalized ?? null,
			executionTraceHash: args.execution?.traceHash ?? null,
			deployId: args.deploys[0].id,
			blockHash: b.hash,
			nodeObservations: [],
			verificationResults: ["PASS"],
			label: `Block #${b.height}`,
			summary: `${shortHex(b.hash)} · proposer ${b.proposer} · shard ${b.shard}`,
			fields: [
				{
					source: "FinalizedBlockEvidence",
					field: "block_height",
					value: String(b.height)
				},
				{
					source: "FinalizedBlockEvidence",
					field: "block_hash",
					value: b.hash
				},
				{
					source: "FinalizedBlockEvidence",
					field: "parent_hash",
					value: b.parentHash
				},
				{
					source: "FinalizedBlockEvidence",
					field: "proposer",
					value: b.proposer
				},
				{
					source: "FinalizedBlockEvidence",
					field: "post_state_hash",
					value: b.postStateHash
				}
			]
		});
	}
	if (args.observations.length && args.cross) add({
		eventId: "obs_set",
		parentEvent: out[out.length - 1].eventId,
		layer: "sentinel",
		actorCapability: args.qos.capability,
		qlfDigest: hexPrefixed(args.qlf.digest),
		rholangSourceHash: null,
		normalizedProcess: null,
		executionTraceHash: args.execution?.traceHash ?? null,
		deployId: args.deploys[0]?.id ?? null,
		blockHash: args.blocks[0]?.hash ?? null,
		nodeObservations: args.observations.map((o) => o.nodeId),
		verificationResults: [args.cross.status],
		label: "Sentinel observation",
		summary: `${args.cross.agreeingNodes}/${args.cross.targetCount} agree · ratio ${args.cross.agreementRatio.toFixed(2)}`,
		fields: args.observations.map((o) => ({
			source: "RNodeObservation",
			field: `${o.nodeId}.block_hash`,
			value: o.reachable ? o.blockHash : "UNAVAILABLE"
		}))
	});
	if (args.lattice) add({
		eventId: "lattice_cert",
		parentEvent: out[out.length - 1].eventId,
		layer: "lattice",
		actorCapability: args.qos.capability,
		qlfDigest: hexPrefixed(args.qlf.digest),
		rholangSourceHash: null,
		normalizedProcess: null,
		executionTraceHash: null,
		deployId: args.deploys[0]?.id ?? null,
		blockHash: args.blocks[0]?.hash ?? null,
		nodeObservations: args.observations.map((o) => o.nodeId),
		verificationResults: [args.lattice.status],
		label: "Sovereign Lattice",
		summary: `prepared ${args.lattice.preparedCount}/${args.lattice.quorum} · committed ${args.lattice.committedCount}/${args.lattice.quorum}`,
		fields: [
			{
				source: "SovereignLattice",
				field: "N",
				value: String(args.lattice.n)
			},
			{
				source: "SovereignLattice",
				field: "f",
				value: String(args.lattice.f)
			},
			{
				source: "SovereignLattice",
				field: "Q",
				value: String(args.lattice.quorum)
			},
			{
				source: "SovereignLattice",
				field: "prepared_certificate",
				value: String(args.lattice.preparedCertificate)
			},
			{
				source: "SovereignLattice",
				field: "committed_certificate",
				value: String(args.lattice.committedCertificate)
			}
		]
	});
	add({
		eventId: "verify_final",
		parentEvent: out[out.length - 1].eventId,
		layer: "verification",
		actorCapability: args.qos.capability,
		qlfDigest: hexPrefixed(args.qlf.digest),
		rholangSourceHash: args.rholangSource ? hexPrefixed(digest(["src", args.rholangSource])) : null,
		normalizedProcess: args.execution?.normalized ?? null,
		executionTraceHash: args.execution?.traceHash ?? null,
		deployId: args.deploys[0]?.id ?? null,
		blockHash: args.blocks[0]?.hash ?? null,
		nodeObservations: args.observations.map((o) => o.nodeId),
		verificationResults: [args.authorized ? "PASS" : "FAIL"],
		label: "Verification result",
		summary: "Result is bound to the envelopes above. Not a proof of Casper finality.",
		fields: [{
			source: "VerificationReport",
			field: "envelopes",
			value: String(out.length + 1)
		}, {
			source: "VerificationReport",
			field: "linked",
			value: "sha256 envelope chain"
		}]
	});
	return out;
}
function evaluate(args) {
	const invariants = [];
	const checks = [];
	invariants.push({
		id: "I-QOS-01",
		layer: "quantumos",
		name: "Capability authorizes the lemma",
		status: args.authorized ? "PASS" : "FAIL",
		severity: "CRITICAL",
		detail: args.authorized ? `${args.qos.capability} authorizes lemma ${args.qos.lemma}.` : "No capability present; QuantumOS refuses to originate a deployable event.",
		evidence: [{
			source: "QuantumOS",
			field: "capability",
			value: args.qos.capability ?? "ABSENT"
		}, {
			source: "QuantumOS",
			field: "lemma",
			value: args.qos.lemma
		}]
	});
	invariants.push({
		id: "I-QLF-01",
		layer: "qlf",
		name: "ZFA-balanced phase string",
		status: args.qlf.balanced ? "PASS" : "FAIL",
		severity: "WARNING",
		detail: args.qlf.claim,
		evidence: [{
			source: "QLF",
			field: "phase_string",
			value: args.qlf.phaseString || "(empty)"
		}, {
			source: "QLF",
			field: "spectral_form",
			value: args.qlf.spectralForm
		}]
	});
	if (args.execution) invariants.push({
		id: "I-RHO-01",
		layer: "rspace",
		name: "COMM reductions reach a normal form",
		status: args.execution.stuck ? "WARN" : "PASS",
		severity: "WARNING",
		detail: `${args.execution.comms} COMM; leftover produces ${args.execution.leftoverProduces.length}, consumes ${args.execution.leftoverConsumes.length}.`,
		evidence: [{
			source: "ExecutionTrace",
			field: "comms",
			value: String(args.execution.comms)
		}, {
			source: "ExecutionTrace",
			field: "state_hash",
			value: args.execution.stateHash
		}]
	});
	else invariants.push({
		id: "I-RHO-01",
		layer: "rspace",
		name: "COMM reductions reach a normal form",
		status: "UNAVAILABLE",
		severity: "WARNING",
		detail: "No process was deployed — execution layer has nothing to reduce.",
		evidence: [{
			source: "ExecutionTrace",
			field: "available",
			value: "false"
		}]
	});
	if (args.replay) invariants.push({
		id: "I-RPL-01",
		layer: "rspace",
		name: "Local replay matches observed state hash",
		status: args.replay.match ? "PASS" : "FAIL",
		severity: "CRITICAL",
		detail: args.replay.match ? "Replayed reduction produces the same state hash as the block post-state." : `Divergence at reduction step ${args.replay.firstDivergence?.step ?? "?"}.`,
		evidence: [{
			source: "Replay",
			field: "expected_state_hash",
			value: args.replay.expectedStateHash
		}, {
			source: "Replay",
			field: "observed_state_hash",
			value: args.replay.observedStateHash
		}]
	});
	if (args.cross) {
		const heightOut = args.observations.find((o) => o.reachable && o.lastFinalizedBlockNumber !== args.cross.commonHeight);
		const hashOut = args.observations.find((o) => o.reachable && o.blockHash !== args.cross.commonHash);
		invariants.push({
			id: "I-01",
			layer: "sentinel",
			name: "Finalized height consistency",
			status: heightOut ? "FAIL" : "PASS",
			severity: "CRITICAL",
			detail: `${args.cross.agreeingNodes} reachable observations share a finalized height.`,
			evidence: args.observations.map((o) => ({
				source: "RNodeObservation",
				field: `${o.nodeId}.last_finalized_block_number`,
				value: o.reachable ? String(o.lastFinalizedBlockNumber) : "UNAVAILABLE"
			}))
		});
		invariants.push({
			id: "I-02",
			layer: "sentinel",
			name: "Block hash consistency",
			status: hashOut ? "FAIL" : "PASS",
			severity: "CRITICAL",
			detail: `${args.cross.hashAgreement ? "All" : "Not all"} reachable observations report the same block hash.`,
			evidence: args.observations.map((o) => ({
				source: "FinalizedBlockEvidence",
				field: `${o.nodeId}.block_hash`,
				value: o.reachable ? o.blockHash : "UNAVAILABLE"
			}))
		});
	} else invariants.push({
		id: "I-01",
		layer: "sentinel",
		name: "Finalized height consistency",
		status: "UNAVAILABLE",
		severity: "CRITICAL",
		detail: "No block was produced, so there is no height to observe.",
		evidence: [{
			source: "RNodeObservation",
			field: "available",
			value: "false"
		}]
	});
	const dup = args.observations.find((o) => o.duplicateValidator);
	invariants.push({
		id: "I-05",
		layer: "sentinel",
		name: "Node identity consistency",
		status: dup ? "FAIL" : args.observations.length ? "PASS" : "UNAVAILABLE",
		severity: "CRITICAL",
		detail: dup ? `Duplicate proposer ${dup.proposer}.` : "Distinct proposer identities on a single network and shard.",
		evidence: args.observations.map((o) => ({
			source: "NetworkStatus",
			field: `${o.nodeId}.proposer`,
			value: o.proposer
		}))
	});
	const jOut = args.observations.find((o) => o.reachable && !o.justificationPresent);
	invariants.push({
		id: "I-06",
		layer: "sentinel",
		name: "Evidence provenance present",
		status: jOut ? "FAIL" : args.observations.length ? "PASS" : "UNAVAILABLE",
		severity: "WARNING",
		detail: "Each observation carries a signature and a structurally parseable justification set.",
		evidence: args.observations.map((o) => ({
			source: "CasperEvidenceReport",
			field: `${o.nodeId}.justification_present`,
			value: String(o.justificationPresent)
		}))
	});
	if (args.lattice) {
		invariants.push({
			id: "L-01",
			layer: "lattice",
			name: "Quorum invariant (Q ≥ 2f+1)",
			status: args.lattice.committedCertificate ? "PASS" : "FAIL",
			severity: "CRITICAL",
			detail: `Committed votes ${args.lattice.committedCount} vs Q=${args.lattice.quorum}.`,
			evidence: [{
				source: "SovereignLattice",
				field: "committed_count",
				value: String(args.lattice.committedCount)
			}, {
				source: "SovereignLattice",
				field: "quorum",
				value: String(args.lattice.quorum)
			}]
		});
		invariants.push({
			id: "L-02",
			layer: "lattice",
			name: "No conflicting prepared certificate",
			status: args.lattice.conflictingPrepare && !args.lattice.preparedCertificate ? "FAIL" : "PASS",
			severity: "CRITICAL",
			detail: args.lattice.conflictingPrepare ? "A conflicting Prepare was dropped; honest digest still formed a certificate." : "No conflicting Prepare observed.",
			evidence: [{
				source: "SovereignLattice",
				field: "conflicting_prepare",
				value: String(args.lattice.conflictingPrepare)
			}, {
				source: "SovereignLattice",
				field: "prepared_certificate",
				value: String(args.lattice.preparedCertificate)
			}]
		});
	}
	if (args.cross) checks.push({
		id: "finalized_block_cross_check",
		name: "Finalized block cross-check",
		status: args.cross.hashAgreement && args.cross.heightAgreement ? "PASS" : "FAIL",
		severity: "CRITICAL",
		message: `Agreement ratio ${args.cross.agreementRatio.toFixed(2)}. Cross-node agreement only — not Casper finality.`,
		source: "CrossNodeReport",
		evidence: [{
			source: "CrossNodeReport",
			field: "agreement_ratio",
			value: args.cross.agreementRatio.toFixed(2)
		}, {
			source: "CrossNodeReport",
			field: "common_block_hash",
			value: args.cross.commonHash ?? "UNAVAILABLE"
		}]
	});
	if (args.replay) checks.push({
		id: "replay_match",
		name: "Execution replay",
		status: args.replay.match ? "PASS" : "FAIL",
		severity: "CRITICAL",
		message: args.replay.match ? "Local replay matches the observed post-state hash." : "Execution divergence: expected and observed state hashes differ.",
		source: "Replay",
		evidence: [{
			source: "Replay",
			field: "match",
			value: String(args.replay.match)
		}]
	});
	checks.push({
		id: "capability_gate",
		name: "Capability gate",
		status: args.authorized ? "PASS" : "FAIL",
		severity: "CRITICAL",
		message: args.authorized ? "Event originated under a present capability." : "Capability absent — no Rholang process was deployed.",
		source: "QuantumOS",
		evidence: [{
			source: "QuantumOS",
			field: "authorized",
			value: String(args.authorized)
		}]
	});
	const claims = [
		{
			layer: "quantumos",
			statement: args.authorized ? "A room event was originated under a capability that authorizes the lemma." : "Origin was refused — the required capability was not present.",
			status: args.authorized ? "PASS" : "FAIL",
			basis: "QuantumOS capability → authorization.",
			notClaimed: "Does not claim the event is on-chain."
		},
		{
			layer: "qlf",
			statement: args.qlf.claim,
			status: args.qlf.balanced ? "PASS" : "FAIL",
			basis: "toSpectralMode_hermitian; spectral_symmetric_eq_scalar_id.",
			notClaimed: args.qlf.notClaimed
		},
		{
			layer: "rspace",
			statement: args.execution ? `ρ-calculus reducer performed ${args.execution.comms} COMM steps.` : "No process to reduce.",
			status: args.execution ? "PASS" : "UNAVAILABLE",
			basis: "rchain-rust rspace COMM law, in-browser subset.",
			notClaimed: "Does not claim identity with the full rchain-rust evaluator."
		},
		{
			layer: "sentinel",
			statement: args.cross ? `Observed agreement ${args.cross.agreeingNodes}/${args.cross.targetCount} (ratio ${args.cross.agreementRatio.toFixed(2)}).` : "No observations — no block.",
			status: args.cross?.status ?? "UNAVAILABLE",
			basis: args.cross?.verificationBasis ?? "n/a",
			notClaimed: "Stake-weighted Casper finality is NOT claimed."
		},
		{
			layer: "lattice",
			statement: args.lattice ? `CommittedCertificate ${args.lattice.committedCertificate ? "present" : "absent"} for digest ${shortHex(args.lattice.digest)}.` : "No lattice input.",
			status: args.lattice?.status ?? "UNAVAILABLE",
			basis: args.lattice?.verificationBasis ?? "n/a",
			notClaimed: args.lattice?.notClaimed ?? "n/a"
		}
	];
	const failInv = invariants.find((i) => i.status === "FAIL") ?? invariants.find((i) => i.status === "WARN");
	let witness = null;
	if (failInv && failInv.status !== "PASS") {
		const ev = failInv.evidence[0];
		witness = {
			layer: failInv.layer,
			invariantId: failInv.id,
			invariant: failInv.name,
			expected: "satisfied",
			observed: failInv.detail,
			source: ev?.source ?? failInv.layer,
			field: ev?.field ?? failInv.id,
			impact: failInv.detail,
			verification: failInv.status
		};
		if (args.mutation === "node-c-lied") {
			const c = args.observations.find((o) => o.letter === "C");
			witness = {
				layer: "sentinel",
				invariantId: "I-02",
				invariant: "Block hash consistency",
				expected: args.cross?.commonHash ?? "UNAVAILABLE",
				observed: c?.blockHash ?? LIE,
				source: "synthetic-node-C",
				field: "block_hash",
				impact: "Sentinel cross-node hash agreement fails. Lattice may still form a quorum on the honest digest — these are different claims.",
				verification: "FAIL"
			};
		}
		if (args.mutation === "drop-capability") witness = {
			layer: "quantumos",
			invariantId: "I-QOS-01",
			invariant: "Capability authorizes the lemma",
			expected: "cap:exchange:bob:prepare (or cap:room:write)",
			observed: "ABSENT",
			source: "QuantumOS",
			field: "capability",
			impact: "No Rholang process, no deploy, no block, no Sentinel evidence.",
			verification: "FAIL"
		};
		if (args.mutation === "tamper-trace" && args.replay?.firstDivergence) witness = {
			layer: "rspace",
			invariantId: "I-RPL-01",
			invariant: "Local replay matches observed state hash",
			expected: args.replay.expectedStateHash,
			observed: args.replay.observedStateHash,
			source: "Replay",
			field: `reduction step ${args.replay.firstDivergence.step}`,
			impact: `First divergence: ${args.replay.firstDivergence.object}.`,
			verification: "FAIL"
		};
	}
	let status = "PASS";
	for (const i of invariants) status = worst(status, i.status === "UNAVAILABLE" ? status : i.status);
	for (const c of checks) status = worst(status, c.status === "UNAVAILABLE" ? status : c.status);
	const why = [];
	if (args.blocks[0]) {
		why.push(`Block #${args.blocks[0].height} exists because a QuantumOS event (${args.qos.eventId}) authorized lemma ${args.qos.lemma}.`);
		if (args.execution) why.push(`The lemma compiled to a Rholang process that reduced in ${args.execution.comms} COMM steps.`);
		why.push(`rchain-rust-shaped proposal included deploy ${args.blocks[0].deploys?.[0]?.id ?? "?"} at height ${args.blocks[0].height}.`);
		if (args.cross) why.push(`Sentinel observed ${args.cross.agreeingNodes}/${args.cross.targetCount} nodes on hash ${shortHex(args.cross.commonHash ?? "")}. This is observed agreement, not stake-weighted finality.`);
		if (args.lattice) why.push(`Sovereign Lattice formed ${args.lattice.committedCertificate ? "a" : "no"} CommittedCertificate (Q=${args.lattice.quorum}) on the honest digest. Independent of Sentinel's observation set.`);
	} else why.push("No block exists. The compiler stopped at QuantumOS — authorization failed — so downstream layers have no object to observe.");
	return {
		invariants,
		checks,
		claims,
		witness,
		status,
		why
	};
}
function diffReality(a, b) {
	const rows = [
		{
			layer: "quantumos",
			field: "capability",
			a: a.qos.capability ?? "ABSENT",
			b: b.qos.capability ?? "ABSENT",
			diverged: a.qos.capability !== b.qos.capability
		},
		{
			layer: "quantumos",
			field: "authorized",
			a: String(a.qos.authorized),
			b: String(b.qos.authorized),
			diverged: a.qos.authorized !== b.qos.authorized
		},
		{
			layer: "qlf",
			field: "phase_string",
			a: a.qlf?.phaseString ?? "∅",
			b: b.qlf?.phaseString ?? "∅",
			diverged: a.qlf?.phaseString !== b.qlf?.phaseString
		},
		{
			layer: "qlf",
			field: "spectral_gap",
			a: String(a.qlf?.spectralGap ?? "n/a"),
			b: String(b.qlf?.spectralGap ?? "n/a"),
			diverged: a.qlf?.spectralGap !== b.qlf?.spectralGap
		},
		{
			layer: "rspace",
			field: "comms",
			a: String(a.execution?.comms ?? "n/a"),
			b: String(b.execution?.comms ?? "n/a"),
			diverged: a.execution?.comms !== b.execution?.comms
		},
		{
			layer: "rspace",
			field: "trace_hash",
			a: a.execution?.traceHash ?? "UNAVAILABLE",
			b: b.execution?.traceHash ?? "UNAVAILABLE",
			diverged: a.execution?.traceHash !== b.execution?.traceHash
		},
		{
			layer: "rspace",
			field: "state_hash",
			a: a.execution?.stateHash ?? "UNAVAILABLE",
			b: b.execution?.stateHash ?? "UNAVAILABLE",
			diverged: a.execution?.stateHash !== b.execution?.stateHash
		},
		{
			layer: "block",
			field: "block_hash",
			a: a.blocks[0]?.hash ?? "UNAVAILABLE",
			b: b.blocks[0]?.hash ?? "UNAVAILABLE",
			diverged: a.blocks[0]?.hash !== b.blocks[0]?.hash
		},
		{
			layer: "sentinel",
			field: "agreement_ratio",
			a: a.cross?.agreementRatio.toFixed(2) ?? "UNAVAILABLE",
			b: b.cross?.agreementRatio.toFixed(2) ?? "UNAVAILABLE",
			diverged: a.cross?.agreementRatio !== b.cross?.agreementRatio
		},
		{
			layer: "sentinel",
			field: "hash_agreement",
			a: String(a.cross?.hashAgreement ?? "n/a"),
			b: String(b.cross?.hashAgreement ?? "n/a"),
			diverged: a.cross?.hashAgreement !== b.cross?.hashAgreement
		},
		{
			layer: "lattice",
			field: "committed_certificate",
			a: String(a.lattice?.committedCertificate ?? "n/a"),
			b: String(b.lattice?.committedCertificate ?? "n/a"),
			diverged: a.lattice?.committedCertificate !== b.lattice?.committedCertificate
		},
		{
			layer: "lattice",
			field: "conflicting_prepare",
			a: String(a.lattice?.conflictingPrepare ?? "n/a"),
			b: String(b.lattice?.conflictingPrepare ?? "n/a"),
			diverged: a.lattice?.conflictingPrepare !== b.lattice?.conflictingPrepare
		},
		{
			layer: "verification",
			field: "status",
			a: a.status,
			b: b.status,
			diverged: a.status !== b.status
		}
	];
	const first = rows.find((r) => r.diverged) ?? null;
	const firstIdx = first ? rows.indexOf(first) : -1;
	return {
		rows,
		first,
		downstream: firstIdx >= 0 ? rows.filter((r, i) => i > firstIdx && r.diverged) : []
	};
}
var WorkbenchContext = (0, import_react.createContext)(null);
var LAYER_ORDER = [
	"quantumos",
	"qlf",
	"rholang",
	"rspace",
	"rchain",
	"block",
	"sentinel",
	"lattice",
	"verification"
];
function WorkbenchProvider({ children }) {
	const [scenario, setScenario] = (0, import_react.useState)("exchange-commit");
	const [mutation, setMutation] = (0, import_react.useState)("none");
	const [selectedEnvelope, setSelectedEnvelope] = (0, import_react.useState)("evt");
	const [playhead, setPlayhead] = (0, import_react.useState)(LAYER_ORDER.length);
	const [playing, setPlaying] = (0, import_react.useState)(true);
	const [nonce, setNonce] = (0, import_react.useState)(0);
	const applicableMutations = (0, import_react.useMemo)(() => MUTATIONS.filter((m) => m.applies.includes(scenario)), [scenario]);
	(0, import_react.useEffect)(() => {
		if (!applicableMutations.some((m) => m.id === mutation)) setMutation("none");
	}, [applicableMutations, mutation]);
	const reality = (0, import_react.useMemo)(() => compile(scenario, mutation), [
		scenario,
		mutation,
		nonce
	]);
	const baseline = (0, import_react.useMemo)(() => compile(scenario, "none"), [scenario]);
	const diff = (0, import_react.useMemo)(() => diffReality(baseline, reality), [baseline, reality]);
	(0, import_react.useEffect)(() => {
		const first = reality.envelopes[0];
		if (first) setSelectedEnvelope(first.eventId);
		setPlayhead(0);
		setPlaying(true);
	}, [reality]);
	(0, import_react.useEffect)(() => {
		if (!playing) return;
		if (playhead >= LAYER_ORDER.length) {
			setPlaying(false);
			return;
		}
		const t = window.setTimeout(() => setPlayhead((p) => p + 1), 220);
		return () => window.clearTimeout(t);
	}, [playing, playhead]);
	const value = {
		scenario,
		setScenario: (id) => {
			setScenario(id);
		},
		mutation,
		setMutation,
		reality,
		baseline,
		diff,
		selectedEnvelope,
		setSelectedEnvelope,
		envelope: reality.envelopes.find((e) => e.eventId === selectedEnvelope) ?? reality.envelopes[0],
		playhead,
		playing,
		replayCompile: () => setNonce((n) => n + 1),
		reset: () => {
			setMutation("none");
			setNonce((n) => n + 1);
		},
		applicableMutations
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkbenchContext.Provider, {
		value,
		children
	});
}
function useWorkbench() {
	const ctx = (0, import_react.useContext)(WorkbenchContext);
	if (!ctx) throw new Error("useWorkbench must be used inside WorkbenchProvider");
	return ctx;
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function StatusDot({ status, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-block size-1.5 shrink-0 rounded-full", status === "PASS" ? "bg-pass" : status === "WARN" ? "bg-warn" : status === "FAIL" ? "bg-fail" : "bg-muted", className),
		"aria-hidden": true
	});
}
function StatusTag({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-micro tracking-label", status === "PASS" ? "text-pass border-pass/40 bg-pass/10" : status === "WARN" ? "text-warn border-warn/40 bg-warn/10" : status === "FAIL" ? "text-fail border-fail/40 bg-fail/10" : "text-muted border-border bg-elevated"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, { status }), status]
	});
}
function SeverityTag({ severity }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("font-mono text-micro tracking-label", severity === "CRITICAL" ? "text-fail" : severity === "WARNING" ? "text-warn" : "text-muted"),
		children: severity
	});
}
function Panel({ title, subtitle, right, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: cn("rounded-xl border border-border bg-surface p-2", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-start justify-between gap-3 rounded-lg px-2 py-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-mono text-xxs tracking-label text-fg uppercase",
				children: title
			}), subtitle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs leading-snug text-muted",
				children: subtitle
			}) : null] }), right]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rounded-lg bg-bg/50 p-3",
			children
		})]
	});
}
function Mono({ children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("font-mono text-xxs break-all text-fg", className),
		children
	});
}
function FieldRow({ label, value, source, field, unavailable }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/60 py-1.5 last:border-b-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-32",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-muted",
				children: label
			}), source ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "font-mono text-micro text-evidence/90",
				children: [source, field ? ` · ${field}` : ""]
			}) : null]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: cn("font-mono text-xxs break-all", unavailable ? "text-muted" : "text-fg"),
			children: unavailable ? "UNAVAILABLE" : value
		})]
	});
}
function EvidenceList({ evidence }) {
	if (!evidence.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-xs text-muted",
		children: "No evidence records on this object."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-md border border-border bg-bg/70",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-elevated px-2 py-1 font-mono text-micro tracking-label text-muted",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "SOURCE" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "FIELD" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "VALUE" })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "max-h-64 overflow-auto",
			children: evidence.map((e, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 border-b border-border/40 px-2 py-1 font-mono text-xxs last:border-b-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-evidence",
						children: e.source
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "break-all text-muted",
						children: e.field
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("break-all", e.value === "UNAVAILABLE" || e.value === "ABSENT" ? "text-muted" : "text-fg"),
						children: e.value
					})
				]
			}, `${e.field}-${i}`))
		})]
	});
}
function Expandable({ header, children, defaultOpen = false }) {
	const [open, setOpen] = (0, import_react.useState)(defaultOpen);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border/60 last:border-b-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => setOpen((v) => !v),
			className: "flex min-h-11 w-full items-center gap-2 py-1.5 text-left transition-colors duration-(--motion-quick) hover:bg-elevated/40",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: cn("size-3.5 shrink-0 text-muted transition-transform duration-(--motion-quick)", open && "rotate-90") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-w-0 flex-1",
				children: header
			})]
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pb-2 pl-6",
			children
		}) : null]
	});
}
function GhostBtn({ children, onClick, active, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: cn("inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-micro tracking-label text-fg transition-[background-color,border-color,transform] duration-(--motion-quick) ease-[var(--ease-smooth-out)] active:scale-[0.96]", active ? "border-primary/50 bg-elevated text-fg" : "border-border bg-surface hover:border-border-strong hover:bg-elevated", className),
		children
	});
}
var NAV = [
	{
		to: "/",
		label: "Compiler",
		icon: Activity
	},
	{
		to: "/causality",
		label: "Causality",
		icon: Workflow
	},
	{
		to: "/counterfactual",
		label: "Counterfactual",
		icon: ShieldAlert
	},
	{
		to: "/replay",
		label: "Replay / Diff",
		icon: GitCompareArrows
	},
	{
		to: "/evidence",
		label: "Evidence",
		icon: Network
	},
	{
		to: "/architecture",
		label: "Architecture",
		icon: Boxes
	}
];
function Banner() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-evidence/25 bg-evidence/8 px-4 py-1.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-micro tracking-label text-evidence",
				children: "LOCAL COMPILER"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-micro tracking-label text-evidence/80",
				children: "IN-BROWSER ENGINE — NOT LIVE RCHAIN EVIDENCE"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "ml-auto inline-flex items-center gap-1.5 font-mono text-micro tracking-label text-primary",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 rounded-full bg-primary pulse-node" }), "EVIDENCE-FIRST"]
			})
		]
	});
}
function ControlBar() {
	const { mutation, reset, replayCompile, reality } = useWorkbench();
	const navigate = useNavigate();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-2 border-b border-border bg-surface/80 px-4 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mr-2 flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-micro tracking-label text-muted",
					children: "RESULT"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: reality.status }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("font-mono text-xxs", mutation === "none" ? "text-muted" : "text-warn"),
					children: mutation === "none" ? "BASELINE" : mutation.replaceAll("-", " ").toUpperCase()
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ml-auto flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: reset,
					className: "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-elevated px-3 font-mono text-micro tracking-label transition-colors duration-(--motion-quick) hover:border-border-strong",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-3.5" }), " RESET"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: replayCompile,
					className: "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-elevated px-3 font-mono text-micro tracking-label transition-colors duration-(--motion-quick) hover:border-border-strong",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5" }), " RECOMPILE"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => navigate({ to: "/counterfactual" }),
					className: "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-elevated px-3 font-mono text-micro tracking-label transition-colors duration-(--motion-quick) hover:border-border-strong",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "size-3.5" }), " COUNTERFACTUAL"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => navigate({ to: "/replay" }),
					className: "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-primary/40 bg-primary px-3 font-mono text-micro tracking-label text-primary-fg transition-colors duration-(--motion-quick) hover:opacity-90",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SquareSplitHorizontal, { className: "size-3.5" }), " REALITY DIFF"]
				})
			]
		})]
	});
}
function Shell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Banner, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-[calc(100vh-2rem)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "hidden w-56 shrink-0 border-r border-border bg-surface md:block",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-b border-border px-4 py-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-mono text-micro tracking-label text-primary",
								children: "RCHAIN"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-base font-medium leading-tight",
								children: "Reality Compiler"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 font-mono text-micro tracking-label text-muted",
								children: "CAPABILITY → EVIDENCE"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "p-2",
						children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.to,
							activeOptions: { exact: item.to === "/" },
							className: "group flex min-h-11 items-center gap-2 rounded-md border-l-2 border-transparent px-2 text-sm text-muted transition-colors duration-(--motion-quick) hover:bg-elevated/60 hover:text-fg data-[status=active]:border-l-primary data-[status=active]:bg-elevated data-[status=active]:text-fg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "size-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate",
								children: item.label
							})]
						}, item.to))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mx-3 mt-3 rounded-lg border border-border p-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs leading-snug text-muted",
							children: "Each layer states only its own claim. Observed agreement is not Casper finality. Lattice certificates are not RChain Casper."
						})
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControlBar, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid-backdrop min-h-full p-3 sm:p-4",
					children
				})]
			})]
		})]
	});
}
function MobileNav() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "mb-3 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1 md:hidden",
		children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: item.to,
			activeOptions: { exact: item.to === "/" },
			className: "shrink-0 rounded-md px-3 py-2 font-mono text-micro tracking-label text-muted data-[status=active]:bg-elevated data-[status=active]:text-fg",
			children: item.label.toUpperCase()
		}, item.to))
	});
}
var styles_default = "/assets/styles-C6H4In9p.css";
var APP_NAME = "RChain Reality Compiler";
var Route$6 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#0a0b0e"
			},
			{
				name: "description",
				content: "From execution to independently checkable evidence."
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkbenchProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter$5 = () => import("./routes-CD6HYDyI.mjs");
var Route$5 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./architecture-CP1x7qxP.mjs");
var Route$4 = createFileRoute("/architecture")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./causality-fzyHw1pj.mjs");
var Route$3 = createFileRoute("/causality")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./counterfactual-Ds78J0Rp.mjs");
var Route$2 = createFileRoute("/counterfactual")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./evidence-DDB_a4Dg.mjs");
var Route$1 = createFileRoute("/evidence")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./replay-JIrVipki.mjs");
var Route = createFileRoute("/replay")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var rootRouteChildren = {
	IndexRoute: Route$5.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$6
	}),
	ArchitectureRoute: Route$4.update({
		id: "/architecture",
		path: "/architecture",
		getParentRoute: () => Route$6
	}),
	CausalityRoute: Route$3.update({
		id: "/causality",
		path: "/causality",
		getParentRoute: () => Route$6
	}),
	CounterfactualRoute: Route$2.update({
		id: "/counterfactual",
		path: "/counterfactual",
		getParentRoute: () => Route$6
	}),
	EvidenceRoute: Route$1.update({
		id: "/evidence",
		path: "/evidence",
		getParentRoute: () => Route$6
	}),
	ReplayRoute: Route.update({
		id: "/replay",
		path: "/replay",
		getParentRoute: () => Route$6
	})
};
var routeTree = Route$6._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { FieldRow as a, Panel as c, cn as d, LAYER_ORDER as f, shortHex as h, Expandable as i, SeverityTag as l, SCENARIOS as m, MobileNav as n, GhostBtn as o, useWorkbench as p, EvidenceList as r, Mono as s, router_exports as t, StatusTag as u };
