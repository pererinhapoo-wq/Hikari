import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { G as isRedirect, S as useRouter, _ as createFileRoute, d as HeadContent, f as useRouterState, g as lazyRouteComponent, h as Outlet, m as createRouter, u as Scripts, v as createRootRoute, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { p as stripSearchParams, t as json } from "../_libs/@tanstack/router-core+[...].mjs";
import { i as createServerFn, u as __exportAll } from "./ssr.mjs";
import { Dt as boolean, Ft as string, It as union, Mt as object, jt as number, kt as literal, wt as _enum } from "../_libs/@better-auth/core+[...].mjs";
import { t as authClient } from "./client-cOaGlUWb.mjs";
import { a as useHikariStore, i as overlaySlim, n as displayTitle, r as localToAnime } from "./types-CX6YV1cu.mjs";
import { i as stripHtml, t as cn } from "./utils-Cws_m9jY.mjs";
import { i as getSql, t as dbSource } from "./db-Dxw4oGVx.mjs";
import { t as auth } from "./server-B8XoIhuu.mjs";
import { t as createSsrRpc } from "./createSsrRpc-Cbx5Q3_U.mjs";
import { t as authMiddleware } from "./middleware-NjrpD292.mjs";
import { c as scoreLabel } from "./labels-BsexCKFj.mjs";
import { D as Search, F as Newspaper, T as Settings2, V as Menu, X as House, bt as Bell, d as TriangleAlert, ft as ChevronDown, gt as CalendarDays, m as Tags, ot as Clapperboard, st as CircleUser, t as X, vt as Bookmark, yt as BookmarkCheck } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { t as Analytics } from "../_libs/vercel__analytics.mjs";
import { t as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
import { n as handleUpload, t as put } from "../_libs/@vercel/blob+[...].mjs";
import { createHash } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/api-H4BjpE4l.js
var fetchHomeCatalog = createServerFn({ method: "GET" }).handler(createSsrRpc("d3b9b89920391ed81aae2521622fa9c80548287d9302fbe6eeae13a8f28bf360"));
var searchSchema = object({
	q: string().optional(),
	genre: string().optional(),
	year: string().optional(),
	format: string().optional(),
	status: string().optional(),
	sort: string().optional(),
	page: number().optional(),
	adult: boolean().optional()
});
var searchCatalog = createServerFn({ method: "GET" }).validator(searchSchema).handler(createSsrRpc("1aba2ecb2c3d3034b6e5626ce7aa323dbe8a6377fd2a3a06673ff30cc0db79c0"));
var fetchAdultCatalog = createServerFn({ method: "GET" }).handler(createSsrRpc("536087411b44da1d2870172c15468b103292f21b26d7d42389c9f26c71f19c9f"));
var fetchAdultTags = createServerFn({ method: "GET" }).handler(createSsrRpc("da0af59a524d5adfc58ff1c99f18cb3f440b25666e961a003ce0fa77074274b8"));
var idSchema = object({ id: string() });
var fetchAnimeDetail = createServerFn({ method: "GET" }).validator(idSchema).handler(createSsrRpc("360b5d0dac3f25b0b4b525917f3925b73dd02a3596d0c36a27307ec961b976f9"));
var fetchGenres = createServerFn({ method: "GET" }).handler(createSsrRpc("70100f70c2f1d2d8f996f900c08336cce9b5fe3ef0bc6a06b79fecdcd2c190b3"));
var browseSchema = object({
	section: _enum([
		"popular",
		"season",
		"top",
		"trending"
	]),
	page: number().optional(),
	season: _enum([
		"WINTER",
		"SPRING",
		"SUMMER",
		"FALL"
	]).optional(),
	year: number().optional(),
	genre: string().optional()
});
var fetchBrowse = createServerFn({ method: "GET" }).validator(browseSchema).handler(createSsrRpc("e33500c3c281a5f6a547ed12cbad641f00fef7783a8c9729d18cdbf27e717ed4"));
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/anime-card-B9tRXWat.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName$14 = "/app/applet/src/components/anime-card.tsx";
function AnimeCard({ anime, size = "md" }) {
	const inList = useHikariStore((s) => s.myList.includes(anime.id));
	const toggleList = useHikariStore((s) => s.toggleList);
	const title = displayTitle(anime);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("article", {
		className: cn("group relative shrink-0", size === "sm" ? "w-28 sm:w-28" : size === "lg" ? "w-full sm:w-full" : "w-32 sm:w-34"),
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
			to: "/anime/$id",
			params: { id: anime.id },
			className: "\n          block\n          overflow-hidden\n          rounded-xl\n          bg-elevated\n          shadow-[var(--shadow-border)]\n          transition-[transform,box-shadow]\n          duration-200\n          ease-[var(--ease-out)]\n          hover:-translate-y-0.5\n          hover:shadow-[var(--shadow-border-hover)]\n        ",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "relative aspect-2/3 overflow-hidden bg-surface",
				children: [anime.cover ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
					src: anime.cover,
					alt: "",
					className: "\n                size-full\n                object-cover\n                transition-transform\n                duration-500\n                ease-[var(--ease-out)]\n                group-hover:scale-[1.03]\n              ",
					loading: "lazy"
				}, void 0, false, {
					fileName: _jsxFileName$14,
					lineNumber: 70,
					columnNumber: 13
				}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex size-full items-center justify-center px-2 text-center font-display text-lg text-subtle",
					children: title.slice(0, 1)
				}, void 0, false, {
					fileName: _jsxFileName$14,
					lineNumber: 84,
					columnNumber: 13
				}, this), anime.score != null && /* @__PURE__ */ (void 0)("span", {
					className: "\n                absolute\n                top-1.5\n                left-1.5\n                rounded-md\n                bg-bg/80\n                px-1.5\n                py-0.5\n                text-[10px]\n                font-medium\n                tabular-nums\n                text-score\n                backdrop-blur-sm\n              ",
					children: scoreLabel(anime.score)
				}, void 0, false, {
					fileName: _jsxFileName$14,
					lineNumber: 90,
					columnNumber: 13
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$14,
				lineNumber: 68,
				columnNumber: 9
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "px-2 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
					className: "line-clamp-2 text-xs leading-snug text-fg sm:text-sm",
					children: title
				}, void 0, false, {
					fileName: _jsxFileName$14,
					lineNumber: 114,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-0.5 truncate text-[10px] text-subtle sm:text-[11px]",
					children: [
						anime.year ?? "",
						anime.year && anime.format ? " · " : "",
						anime.format === "TV" ? "Série" : anime.format === "MOVIE" ? "Filme" : ""
					]
				}, void 0, true, {
					fileName: _jsxFileName$14,
					lineNumber: 118,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$14,
				lineNumber: 113,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName$14,
			lineNumber: 50,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
			type: "button",
			"aria-label": inList ? "Remover da Minha Lista" : "Adicionar à Minha Lista",
			onClick: (e) => {
				e.preventDefault();
				e.stopPropagation();
				toggleList(anime);
			},
			className: "\n          absolute\n          top-1.5\n          right-1.5\n          flex\n          size-8\n          items-center\n          justify-center\n          rounded-md\n          bg-bg/70\n          text-fg\n          opacity-100\n          backdrop-blur-sm\n          transition-opacity\n          sm:opacity-0\n          sm:group-hover:opacity-100\n        ",
			children: inList ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(BookmarkCheck, { className: "size-4" }, void 0, false, {
				fileName: _jsxFileName$14,
				lineNumber: 166,
				columnNumber: 11
			}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bookmark, { className: "size-4" }, void 0, false, {
				fileName: _jsxFileName$14,
				lineNumber: 168,
				columnNumber: 11
			}, this)
		}, void 0, false, {
			fileName: _jsxFileName$14,
			lineNumber: 135,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName$14,
		lineNumber: 44,
		columnNumber: 5
	}, this);
}
function AnimeCardSkeleton({ size = "md" }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: cn(size === "sm" ? "w-28 sm:w-28" : size === "lg" ? "w-full sm:w-full" : "w-32 sm:w-34", "shrink-0"),
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "aspect-2/3 animate-pulse rounded-xl bg-elevated" }, void 0, false, {
				fileName: _jsxFileName$14,
				lineNumber: 194,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-3 w-4/5 animate-pulse rounded bg-elevated" }, void 0, false, {
				fileName: _jsxFileName$14,
				lineNumber: 196,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-elevated" }, void 0, false, {
				fileName: _jsxFileName$14,
				lineNumber: 198,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName$14,
		lineNumber: 188,
		columnNumber: 5
	}, this);
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/news-api-DeaVgmaw.js
var fetchAutomaticNews = createServerFn({ method: "GET" }).handler(createSsrRpc("f1ea62b78b432fed6ec1bf43cf8f2ba5b3df45c894c267b3e9df637937f58c52"));
createServerFn({ method: "GET" }).handler(createSsrRpc("b2c77178d85209ea05f26a484f1b5f00d6861d0a5ca93642cfa26ebc34cc900b"));
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/news-api-adulto-separado-Dh1saS3x.js
`${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
      <rect width="800" height="450" fill="#17131f"/>
      <text x="400" y="225" fill="#a855f7" font-family="Arial, sans-serif" font-size="42" text-anchor="middle" dominant-baseline="middle">Hikari +18</text>
    </svg>
  `)}`;
createServerFn({ method: "GET" }).handler(createSsrRpc("2408c7aaba9fc9016c2215b439cac163d811f6952160ab01aa2ead2d191d6b8a"));
var fetchAdultNews = createServerFn({ method: "GET" }).handler(createSsrRpc("5cc973c32ede02a65485e2adfda14684d5de9105f544e48c223da6362c746cf0"));
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-Dx2-dd95.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function useServerFn(serverFn) {
	const router = useRouter();
	return import_react.useCallback(async (...args) => {
		try {
			const res = await serverFn(...args);
			if (isRedirect(res)) throw res;
			return res;
		} catch (err) {
			if (isRedirect(err)) {
				err.options._fromLocation = router.stores.location.get();
				return router.navigate(router.resolveRedirect(err).options);
			}
			throw err;
		}
	}, [router, serverFn]);
}
var _jsxFileName$13 = "/app/applet/src/lib/error-component.tsx";
var FALLBACK_MESSAGE = "Algo deu errado. Recarregue a página.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
				className: "text-danger",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				}, void 0, false, {
					fileName: _jsxFileName$13,
					lineNumber: 16,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName$13,
				lineNumber: 15,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
				className: "text-lg font-semibold",
				children: "Algo deu errado"
			}, void 0, false, {
				fileName: _jsxFileName$13,
				lineNumber: 18,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "max-w-md text-sm break-words text-muted",
				children: errorMessage(error)
			}, void 0, false, {
				fileName: _jsxFileName$13,
				lineNumber: 19,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName$13,
		lineNumber: 14,
		columnNumber: 5
	}, this);
}
var _jsxFileName$12 = "/app/applet/src/lib/auth/provider.tsx";
function makeQueryClient() {
	return new QueryClient({ defaultOptions: { queries: {
		staleTime: 6e4,
		refetchOnWindowFocus: false,
		retry: 1
	} } });
}
function AuthProvider({ children }) {
	const [client] = (0, import_react.useState)(makeQueryClient);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(QueryClientProvider, {
		client,
		children: [children, /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Toaster, {
			theme: "dark",
			position: "bottom-center",
			toastOptions: {
				className: "font-sans",
				style: {
					background: "var(--color-elevated)",
					color: "var(--color-fg)",
					border: "1px solid var(--color-border)"
				}
			}
		}, void 0, false, {
			fileName: _jsxFileName$12,
			lineNumber: 18,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName$12,
		lineNumber: 16,
		columnNumber: 5
	}, this);
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
var _jsxFileName$11 = "/app/applet/src/components/logo.tsx";
function Logo({ className }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
		to: "/",
		className: cn("flex items-baseline gap-2", className),
		"aria-label": "Hikari",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
			className: "font-display text-2xl leading-none tracking-tight text-fg",
			children: "光"
		}, void 0, false, {
			fileName: _jsxFileName$11,
			lineNumber: 7,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
			className: "text-[11px] font-medium tracking-[0.32em] text-muted uppercase",
			children: "Hikari"
		}, void 0, false, {
			fileName: _jsxFileName$11,
			lineNumber: 8,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName$11,
		lineNumber: 6,
		columnNumber: 5
	}, this);
}
var HIKARI_ADMIN_EMAIL = "pererinhapoo@gmail.com";
function isHikariAdmin(email) {
	return email?.trim().toLowerCase() === HIKARI_ADMIN_EMAIL;
}
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
var getProfile = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("9df9652da79c7ccc337ce62c64dcd11f1800a8eb6e0bd13747650358f67fe4e8"));
var getPublicProfile = createServerFn({ method: "GET" }).handler(createSsrRpc("4bf0d871c1b1448bf83ecae994053dfefc9592abecd0f940b98c0f46242944f0"));
var getProfileFollowers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("d31ac4ed180510097a068f8bdad6828f14dd43907f9ab8529afdd6f26398fcb2"));
var getProfileFollowing = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("1838c85b00341136a400e035ef711c06064be946f9f419844d4f17d663d9eba1"));
var getMyComments = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("25a8912d9088beaa474d5eaf8c6f3a83922dbac5c467671790718d707cde70cf"));
var getPublicComments = createServerFn({ method: "GET" }).handler(createSsrRpc("1d2e2b7f1167bca92ce8181084df23c866939c314c5d94e0cf2d16d3e467fed0"));
var updateProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("d94d0b5402d88327ffc5615e3b5d2a6f5e7a519b2121a922cbe6da824cc59c6d"));
function overlayList(remote, locals) {
	return overlaySlim(remote, locals, (l) => localToAnime(l));
}
function mergeDetail(remote, id, locals) {
	const byId = locals.find((a) => a.id === id);
	if (byId) {
		const local = localToAnime(byId);
		if (!remote) return local;
		return {
			...remote,
			...local,
			titles: local.titles,
			cover: local.cover || remote.cover,
			banner: local.banner || remote.banner,
			synopsis: local.synopsis || remote.synopsis,
			seasons: local.seasons.length ? local.seasons : remote.seasons,
			trailerId: local.trailerId || remote.trailerId,
			genres: local.genres.length ? local.genres : remote.genres,
			recommendations: remote.recommendations,
			streamingEpisodes: remote.streamingEpisodes,
			studios: remote.studios,
			source: "local"
		};
	}
	if (!remote) return null;
	const byAni = remote.anilistId ? locals.find((a) => a.anilistId === remote.anilistId) : void 0;
	if (byAni) {
		const local = localToAnime(byAni);
		return {
			...remote,
			...local,
			id: remote.id,
			seasons: local.seasons.length ? local.seasons : remote.seasons,
			trailerId: local.trailerId || remote.trailerId,
			recommendations: remote.recommendations,
			streamingEpisodes: remote.streamingEpisodes,
			studios: remote.studios
		};
	}
	return remote;
}
var _jsxFileName$10 = "/app/applet/src/components/shell.tsx";
var BASE_NAV = [
	{
		to: "/",
		label: "Início",
		icon: House,
		match: (p) => p === "/"
	},
	{
		to: "/my-list",
		label: "Minha Lista",
		icon: Bookmark,
		match: (p) => p.startsWith("/my-list")
	},
	{
		to: "/browse/season",
		label: "Temporadas",
		icon: CalendarDays,
		match: (p) => p.startsWith("/browse/season")
	},
	{
		to: "/browse/genres",
		label: "Gêneros",
		icon: Tags,
		match: (p) => p.startsWith("/browse/genres")
	},
	{
		to: "/news",
		label: "Notícias",
		icon: Newspaper,
		match: (p) => p.startsWith("/news")
	},
	{
		to: "/account",
		label: "Conta",
		icon: CircleUser,
		match: (p) => p.startsWith("/account") || p.startsWith("/login")
	}
];
var ADULT_NAV = {
	to: "/adult",
	label: "🔞 +18",
	match: (p) => p.startsWith("/adult")
};
function Shell() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { user } = useCurrentUserState();
	const getProfileFn = useServerFn(getProfile);
	const [profileNick, setProfileNick] = (0, import_react.useState)("");
	const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
	const [adultMenuOpen, setAdultMenuOpen] = (0, import_react.useState)(false);
	const [notificationsOpen, setNotificationsOpen] = (0, import_react.useState)(false);
	const [notifications, setNotifications] = (0, import_react.useState)([]);
	const [unreadCount, setUnreadCount] = (0, import_react.useState)(0);
	const [notificationsLoading, setNotificationsLoading] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!notificationsOpen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [notificationsOpen]);
	(0, import_react.useEffect)(() => {
		if (!menuOpen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [menuOpen]);
	(0, import_react.useEffect)(() => {
		if (!user?.id) {
			setProfileNick("");
			return;
		}
		let active = true;
		getProfileFn().then((profile) => {
			if (!active) return;
			setProfileNick(profile.nick);
		}).catch(() => {
			if (!active) return;
			setProfileNick("");
		});
		return () => {
			active = false;
		};
	}, [user?.id]);
	const [searchOpen, setSearchOpen] = (0, import_react.useState)(false);
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [searchResults, setSearchResults] = (0, import_react.useState)([]);
	const [searchLoading, setSearchLoading] = (0, import_react.useState)(false);
	const localAnimes = useHikariStore((s) => s.animes);
	const cinema = pathname.startsWith("/watch");
	const nav = user && isHikariAdmin(user.primaryEmail) ? [...BASE_NAV, {
		to: "/admin",
		label: "Admin",
		icon: Settings2,
		match: (p) => p.startsWith("/admin")
	}] : BASE_NAV;
	(0, import_react.useEffect)(() => {
		const q = searchQuery.trim();
		if (!searchOpen || !q) {
			setSearchResults([]);
			setSearchLoading(false);
			return;
		}
		let cancelled = false;
		const timer = window.setTimeout(async () => {
			setSearchLoading(true);
			try {
				const isAdultArea = window.location.pathname.startsWith("/adult");
				const result = await searchCatalog({ data: {
					q,
					page: 1,
					adult: isAdultArea
				} });
				if (cancelled) return;
				const normalized = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
				const localHits = overlayList([], localAnimes).filter((anime) => {
					const isHentai = anime.genres?.some((genre) => genre.trim().toLowerCase() === "hentai") ?? false;
					if (isAdultArea ? !isHentai : isHentai) return false;
					return `${anime.titles.romaji} ${anime.titles.english} ${anime.titles.native}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalized);
				});
				const remote = overlayList(result.items ?? [], localAnimes);
				const seen = /* @__PURE__ */ new Set();
				const merged = [];
				for (const anime of [...localHits, ...remote]) {
					if (seen.has(anime.id)) continue;
					seen.add(anime.id);
					merged.push(anime);
				}
				const ranked = merged.sort((a, b) => {
					const aTitle = `${a.titles.romaji} ${a.titles.english} ${a.titles.native}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
					const bTitle = `${b.titles.romaji} ${b.titles.english} ${b.titles.native}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
					const aStarts = aTitle.startsWith(normalized);
					const bStarts = bTitle.startsWith(normalized);
					if (aStarts && !bStarts) return -1;
					if (!aStarts && bStarts) return 1;
					const aContains = aTitle.includes(normalized);
					const bContains = bTitle.includes(normalized);
					if (aContains && !bContains) return -1;
					if (!aContains && bContains) return 1;
					return 0;
				});
				setSearchResults(ranked);
			} catch {
				if (!cancelled) setSearchResults([]);
			} finally {
				if (!cancelled) setSearchLoading(false);
			}
		}, 300);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [
		searchOpen,
		searchQuery,
		localAnimes
	]);
	(0, import_react.useEffect)(() => {
		if (!user) {
			setNotifications([]);
			setUnreadCount(0);
			return;
		}
		let cancelled = false;
		const loadNotifications = async () => {
			try {
				const response = await fetch("/api/notifications");
				if (!response.ok) return;
				const data = await response.json();
				if (cancelled) return;
				setNotifications(data.notifications ?? []);
				setUnreadCount(Number(data.unreadCount ?? 0));
			} catch {}
		};
		loadNotifications();
		const interval = window.setInterval(loadNotifications, 3e4);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [user?.id]);
	const markNotificationAsRead = async (id) => {
		const target = notifications.find((notification) => notification.id === id);
		if (!target || target.read) return;
		setNotifications((current) => current.map((notification) => notification.id === id ? {
			...notification,
			read: true
		} : notification));
		setUnreadCount((current) => Math.max(0, current - 1));
		try {
			const response = await fetch("/api/notifications", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id })
			});
			if (!response.ok) return;
			const data = await response.json();
			setUnreadCount(Number(data.unreadCount ?? 0));
		} catch {}
	};
	const openNotifications = async () => {
		setNotificationsOpen(true);
		if (!user) return;
		setNotificationsLoading(true);
		try {
			const response = await fetch("/api/notifications");
			if (!response.ok) return;
			const data = await response.json();
			setNotifications(data.notifications ?? []);
			setUnreadCount(Number(data.unreadCount ?? 0));
		} catch {} finally {
			setNotificationsLoading(false);
		}
	};
	if (cinema) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Outlet, {}, void 0, false, {
		fileName: _jsxFileName$10,
		lineNumber: 616,
		columnNumber: 12
	}, this);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("header", {
				className: "sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							type: "button",
							onClick: () => setMenuOpen(true),
							className: "flex size-11 items-center justify-center rounded-md text-fg hover:bg-elevated",
							"aria-label": "Abrir menu",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Menu, { className: "size-6" }, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 637,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 629,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex flex-1 items-center justify-center md:justify-start",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "origin-left scale-110 sm:scale-125",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Logo, {}, void 0, false, {
									fileName: _jsxFileName$10,
									lineNumber: 643,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 642,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 641,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
									type: "button",
									onClick: () => {
										if (notificationsOpen) setNotificationsOpen(false);
										else openNotifications();
									},
									className: "relative hidden size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg md:flex",
									"aria-label": "Notificações",
									"aria-expanded": notificationsOpen,
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bell, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 670,
										columnNumber: 15
									}, this), unreadCount > 0 && /* @__PURE__ */ (void 0)("span", {
										className: "absolute right-0.5 top-0.5 flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-bg",
										children: unreadCount > 99 ? "99+" : unreadCount
									}, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 673,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$10,
									lineNumber: 651,
									columnNumber: 13
								}, this),
								!pathname.startsWith("/news") && /* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => {
										setSearchOpen((value) => !value);
									},
									className: "flex size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg",
									"aria-label": "Buscar",
									"aria-expanded": searchOpen,
									children: /* @__PURE__ */ (void 0)(Search, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 696,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName$10,
									lineNumber: 683,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
									type: "button",
									onClick: () => {
										if (notificationsOpen) setNotificationsOpen(false);
										else openNotifications();
									},
									className: "relative flex size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg md:hidden",
									"aria-label": "Notificações",
									"aria-expanded": notificationsOpen,
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bell, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 720,
										columnNumber: 15
									}, this), unreadCount > 0 && /* @__PURE__ */ (void 0)("span", {
										className: "absolute right-0.5 top-0.5 flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-bg",
										children: unreadCount > 99 ? "99+" : unreadCount
									}, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 723,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$10,
									lineNumber: 701,
									columnNumber: 13
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName$10,
							lineNumber: 648,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName$10,
					lineNumber: 626,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName$10,
				lineNumber: 625,
				columnNumber: 7
			}, this),
			searchOpen && /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (void 0)("button", {
				type: "button",
				onClick: () => setSearchOpen(false),
				className: "fixed inset-0 z-40",
				"aria-label": "Fechar busca"
			}, void 0, false, {
				fileName: _jsxFileName$10,
				lineNumber: 739,
				columnNumber: 11
			}, this), /* @__PURE__ */ (void 0)("div", {
				className: "fixed left-4 right-4 top-16 z-50 mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-bg shadow-2xl",
				children: [/* @__PURE__ */ (void 0)("div", {
					className: "border-b border-border p-3",
					children: /* @__PURE__ */ (void 0)("div", {
						className: "relative",
						children: [/* @__PURE__ */ (void 0)(Search, { className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" }, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 753,
							columnNumber: 17
						}, this), /* @__PURE__ */ (void 0)("input", {
							autoFocus: true,
							value: searchQuery,
							onChange: (e) => setSearchQuery(e.target.value),
							placeholder: "Buscar animes…",
							className: "h-11 w-full rounded-lg border border-border bg-elevated pl-10 pr-3 text-sm text-fg outline-none placeholder:text-muted focus:border-fg/30"
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 755,
							columnNumber: 17
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName$10,
						lineNumber: 751,
						columnNumber: 15
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName$10,
					lineNumber: 750,
					columnNumber: 13
				}, this), searchQuery.trim() && /* @__PURE__ */ (void 0)("div", {
					className: "max-h-[70vh] overflow-y-auto",
					children: searchLoading ? /* @__PURE__ */ (void 0)("div", {
						className: "px-4 py-8 text-center text-sm text-muted",
						children: "Buscando..."
					}, void 0, false, {
						fileName: _jsxFileName$10,
						lineNumber: 774,
						columnNumber: 19
					}, this) : searchResults.length === 0 ? /* @__PURE__ */ (void 0)("div", {
						className: "px-4 py-8 text-center text-sm text-muted",
						children: "Nenhum anime encontrado."
					}, void 0, false, {
						fileName: _jsxFileName$10,
						lineNumber: 780,
						columnNumber: 19
					}, this) : /* @__PURE__ */ (void 0)("div", { children: [searchResults.slice(0, 6).map((anime) => /* @__PURE__ */ (void 0)(Link, {
						to: "/anime/$id",
						params: { id: anime.id },
						onClick: () => setSearchOpen(false),
						className: "flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-elevated",
						children: [anime.cover ? /* @__PURE__ */ (void 0)("img", {
							src: anime.cover,
							alt: "",
							className: "size-12 shrink-0 rounded-md object-cover"
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 809,
							columnNumber: 31
						}, this) : /* @__PURE__ */ (void 0)("div", {
							className: "flex size-12 shrink-0 items-center justify-center rounded-md bg-elevated text-muted",
							children: /* @__PURE__ */ (void 0)(Clapperboard, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 818,
								columnNumber: 33
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 817,
							columnNumber: 31
						}, this), /* @__PURE__ */ (void 0)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "truncate text-sm font-medium text-fg",
								children: displayTitle(anime)
							}, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 824,
								columnNumber: 31
							}, this), /* @__PURE__ */ (void 0)("p", {
								className: "mt-0.5 text-xs text-muted",
								children: [
									anime.year ?? "",
									anime.year && anime.format ? " · " : "",
									anime.format === "TV" ? "Série" : anime.format === "MOVIE" ? "Filme" : ""
								]
							}, void 0, true, {
								fileName: _jsxFileName$10,
								lineNumber: 830,
								columnNumber: 31
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$10,
							lineNumber: 822,
							columnNumber: 29
						}, this)]
					}, anime.id, true, {
						fileName: _jsxFileName$10,
						lineNumber: 791,
						columnNumber: 27
					}, this)), /* @__PURE__ */ (void 0)(Link, {
						to: "/search",
						search: {
							q: searchQuery.trim(),
							adult: window.location.pathname.startsWith("/adult") ? true : void 0
						},
						onClick: () => setSearchOpen(false),
						className: "block border-t border-border px-4 py-4 text-center text-sm font-medium text-fg hover:bg-elevated",
						children: "Ver todos os resultados"
					}, void 0, false, {
						fileName: _jsxFileName$10,
						lineNumber: 852,
						columnNumber: 21
					}, this)] }, void 0, true, {
						fileName: _jsxFileName$10,
						lineNumber: 785,
						columnNumber: 19
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName$10,
					lineNumber: 771,
					columnNumber: 15
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$10,
				lineNumber: 748,
				columnNumber: 11
			}, this)] }, void 0, true, {
				fileName: _jsxFileName$10,
				lineNumber: 738,
				columnNumber: 9
			}, this),
			notificationsOpen && /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (void 0)("button", {
				type: "button",
				onClick: () => setNotificationsOpen(false),
				className: "fixed inset-0 z-40",
				"aria-label": "Fechar notificações"
			}, void 0, false, {
				fileName: _jsxFileName$10,
				lineNumber: 889,
				columnNumber: 11
			}, this), /* @__PURE__ */ (void 0)("div", {
				className: "fixed right-4 top-16 z-50 flex max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-2xl md:right-6 md:top-20",
				children: [
					/* @__PURE__ */ (void 0)("div", {
						className: "flex shrink-0 items-center justify-between border-b border-border px-4 py-4",
						children: [/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("h2", {
							className: "font-semibold",
							children: "Notificações"
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 904,
							columnNumber: 17
						}, this), /* @__PURE__ */ (void 0)("p", {
							className: "mt-0.5 text-xs text-muted",
							children: "Suas atividades recentes"
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 908,
							columnNumber: 17
						}, this)] }, void 0, true, {
							fileName: _jsxFileName$10,
							lineNumber: 903,
							columnNumber: 15
						}, this), /* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => setNotificationsOpen(false),
							className: "flex size-9 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg",
							"aria-label": "Fechar notificações",
							children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 923,
								columnNumber: 17
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 913,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName$10,
						lineNumber: 902,
						columnNumber: 13
					}, this),
					notificationsLoading ? /* @__PURE__ */ (void 0)("div", {
						className: "flex min-h-32 flex-1 items-center justify-center px-5 py-8 text-center",
						children: /* @__PURE__ */ (void 0)("p", {
							className: "text-sm text-muted",
							children: "Carregando..."
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 929,
							columnNumber: 17
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName$10,
						lineNumber: 928,
						columnNumber: 15
					}, this) : notifications.length === 0 ? /* @__PURE__ */ (void 0)("div", {
						className: "flex min-h-32 flex-1 items-center justify-center px-5 py-8 text-center",
						children: /* @__PURE__ */ (void 0)("div", { children: [
							/* @__PURE__ */ (void 0)(Bell, { className: "mx-auto mb-3 size-7 text-muted" }, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 938,
								columnNumber: 19
							}, this),
							/* @__PURE__ */ (void 0)("p", {
								className: "text-sm font-medium",
								children: "Nenhuma notificação"
							}, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 940,
								columnNumber: 19
							}, this),
							/* @__PURE__ */ (void 0)("p", {
								className: "mt-1 text-xs text-muted",
								children: "Quando alguém interagir com seu perfil, aparecerá aqui."
							}, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 944,
								columnNumber: 19
							}, this)
						] }, void 0, true, {
							fileName: _jsxFileName$10,
							lineNumber: 937,
							columnNumber: 17
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName$10,
						lineNumber: 936,
						columnNumber: 15
					}, this) : /* @__PURE__ */ (void 0)("div", {
						className: "min-h-0 flex-1 overflow-y-auto",
						children: notifications.slice(0, 7).map((notification) => {
							const hasEpisodeTarget = Boolean(notification.animeId && notification.episodeId);
							const isLikeNotification = notification.type === "comment_like";
							const isReplyNotification = notification.type === "comment_reply";
							const likeCount = Number(notification.commentLikes ?? 0);
							const likeAvatars = Array.isArray(notification.likeAvatars) ? notification.likeAvatars : [];
							const notificationMessage = isLikeNotification && likeCount > 1 && notification.actorName ? `${notification.actorName} e mais ${likeCount - 1} ${likeCount - 1 === 1 ? "pessoa" : "pessoas"} curtiram seu comentário.` : notification.message;
							const notificationContent = /* @__PURE__ */ (void 0)("div", {
								className: cn("border-b border-border px-4 py-4 last:border-b-0 transition-colors", !notification.read && "border-l-4 border-l-blue-500 bg-blue-500/10"),
								children: /* @__PURE__ */ (void 0)("div", {
									className: "flex gap-3",
									children: [
										notification.actorImage ? /* @__PURE__ */ (void 0)("img", {
											src: notification.actorImage,
											alt: "",
											className: "size-10 shrink-0 rounded-full object-cover"
										}, void 0, false, {
											fileName: _jsxFileName$10,
											lineNumber: 1013,
											columnNumber: 31
										}, this) : /* @__PURE__ */ (void 0)("div", {
											className: "flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated text-muted",
											children: /* @__PURE__ */ (void 0)(CircleUser, { className: "size-6" }, void 0, false, {
												fileName: _jsxFileName$10,
												lineNumber: 1022,
												columnNumber: 33
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName$10,
											lineNumber: 1021,
											columnNumber: 31
										}, this),
										/* @__PURE__ */ (void 0)("div", {
											className: "min-w-0 flex-1",
											children: [
												/* @__PURE__ */ (void 0)("p", {
													className: "text-sm leading-5",
													children: notificationMessage
												}, void 0, false, {
													fileName: _jsxFileName$10,
													lineNumber: 1028,
													columnNumber: 31
												}, this),
												isLikeNotification && /* @__PURE__ */ (void 0)("div", {
													className: "mt-2 flex items-center gap-2",
													children: [likeAvatars.length > 0 && /* @__PURE__ */ (void 0)("div", {
														className: "flex items-center pl-1",
														children: likeAvatars.slice(0, 2).map((avatar, index) => /* @__PURE__ */ (void 0)("div", {
															className: cn("relative size-7 overflow-hidden rounded-full border-2 border-bg bg-elevated", index > 0 && "-ml-2"),
															style: { zIndex: 10 - index },
															children: avatar.image ? /* @__PURE__ */ (void 0)("img", {
																src: avatar.image,
																alt: "",
																className: "size-full object-cover"
															}, void 0, false, {
																fileName: _jsxFileName$10,
																lineNumber: 1068,
																columnNumber: 49
															}, this) : /* @__PURE__ */ (void 0)("div", {
																className: "flex size-full items-center justify-center text-[10px] font-semibold text-muted",
																children: (avatar.name ?? "U").charAt(0).toUpperCase()
															}, void 0, false, {
																fileName: _jsxFileName$10,
																lineNumber: 1076,
																columnNumber: 49
															}, this)
														}, avatar.id, false, {
															fileName: _jsxFileName$10,
															lineNumber: 1051,
															columnNumber: 45
														}, this))
													}, void 0, false, {
														fileName: _jsxFileName$10,
														lineNumber: 1039,
														columnNumber: 37
													}, this), /* @__PURE__ */ (void 0)("span", {
														className: "text-xs font-medium text-muted",
														children: [
															likeCount,
															" ",
															likeCount === 1 ? "curtida" : "curtidas"
														]
													}, void 0, true, {
														fileName: _jsxFileName$10,
														lineNumber: 1094,
														columnNumber: 35
													}, this)]
												}, void 0, true, {
													fileName: _jsxFileName$10,
													lineNumber: 1035,
													columnNumber: 33
												}, this),
												(notification.animeCover || notification.animeTitle) && /* @__PURE__ */ (void 0)("div", {
													className: "mt-3 flex items-center gap-3",
													children: [notification.animeCover ? /* @__PURE__ */ (void 0)("img", {
														src: notification.animeCover,
														alt: "",
														className: "h-16 w-11 shrink-0 rounded-md object-cover"
													}, void 0, false, {
														fileName: _jsxFileName$10,
														lineNumber: 1111,
														columnNumber: 37
													}, this) : null, /* @__PURE__ */ (void 0)("div", {
														className: "min-w-0 flex-1",
														children: [notification.animeTitle && /* @__PURE__ */ (void 0)("p", {
															className: "truncate text-sm font-medium text-fg",
															children: notification.animeTitle
														}, void 0, false, {
															fileName: _jsxFileName$10,
															lineNumber: 1123,
															columnNumber: 39
														}, this), hasEpisodeTarget && (isLikeNotification || isReplyNotification) && /* @__PURE__ */ (void 0)("p", {
															className: "mt-1 text-xs font-medium text-muted",
															children: notification.commentId ? "Ver comentário" : "Ver episódio"
														}, void 0, false, {
															fileName: _jsxFileName$10,
															lineNumber: 1133,
															columnNumber: 41
														}, this)]
													}, void 0, true, {
														fileName: _jsxFileName$10,
														lineNumber: 1120,
														columnNumber: 35
													}, this)]
												}, void 0, true, {
													fileName: _jsxFileName$10,
													lineNumber: 1108,
													columnNumber: 33
												}, this),
												hasEpisodeTarget && (isLikeNotification || isReplyNotification) && !notification.animeCover && !notification.animeTitle && /* @__PURE__ */ (void 0)("div", {
													className: "mt-2",
													children: /* @__PURE__ */ (void 0)("span", {
														className: "inline-flex items-center rounded-md bg-elevated px-2.5 py-1 text-xs font-medium text-fg",
														children: notification.commentId ? "Ver comentário" : "Ver episódio"
													}, void 0, false, {
														fileName: _jsxFileName$10,
														lineNumber: 1150,
														columnNumber: 37
													}, this)
												}, void 0, false, {
													fileName: _jsxFileName$10,
													lineNumber: 1149,
													columnNumber: 35
												}, this),
												/* @__PURE__ */ (void 0)("p", {
													className: "mt-1.5 text-[11px] text-muted",
													children: new Date(notification.createdAt).toLocaleString("pt-BR", {
														dateStyle: "short",
														timeStyle: "short"
													})
												}, void 0, false, {
													fileName: _jsxFileName$10,
													lineNumber: 1158,
													columnNumber: 31
												}, this)
											]
										}, void 0, true, {
											fileName: _jsxFileName$10,
											lineNumber: 1026,
											columnNumber: 29
										}, this),
										!notification.read && /* @__PURE__ */ (void 0)("span", { className: "mt-1 size-2 shrink-0 rounded-full bg-blue-500" }, void 0, false, {
											fileName: _jsxFileName$10,
											lineNumber: 1174,
											columnNumber: 31
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName$10,
									lineNumber: 1010,
									columnNumber: 27
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 1003,
								columnNumber: 25
							}, this);
							if (hasEpisodeTarget) return /* @__PURE__ */ (void 0)(Link, {
								to: "/watch/$id",
								params: { id: notification.animeId },
								search: {
									ep: notification.episodeId,
									comment: notification.commentId ?? void 0
								},
								onClick: () => {
									markNotificationAsRead(notification.id);
									setNotificationsOpen(false);
								},
								className: "block transition-colors hover:bg-elevated/70",
								children: notificationContent
							}, notification.id, false, {
								fileName: _jsxFileName$10,
								lineNumber: 1185,
								columnNumber: 25
							}, this);
							return /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => {
									markNotificationAsRead(notification.id);
								},
								className: "block w-full text-left transition-colors hover:bg-elevated/70",
								children: notificationContent
							}, notification.id, false, {
								fileName: _jsxFileName$10,
								lineNumber: 1220,
								columnNumber: 23
							}, this);
						})
					}, void 0, false, {
						fileName: _jsxFileName$10,
						lineNumber: 951,
						columnNumber: 15
					}, this),
					!notificationsLoading && notifications.length > 0 && /* @__PURE__ */ (void 0)(Link, {
						to: "/notifications",
						onClick: () => setNotificationsOpen(false),
						className: "block shrink-0 border-t border-border px-4 py-4 text-center text-sm font-medium text-fg transition-colors hover:bg-elevated",
						children: "Ver todas as notificações"
					}, void 0, false, {
						fileName: _jsxFileName$10,
						lineNumber: 1246,
						columnNumber: 17
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName$10,
				lineNumber: 900,
				columnNumber: 11
			}, this)] }, void 0, true, {
				fileName: _jsxFileName$10,
				lineNumber: 888,
				columnNumber: 9
			}, this),
			menuOpen && /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (void 0)("button", {
				type: "button",
				onClick: () => setMenuOpen(false),
				className: "fixed inset-0 z-50 bg-black/60",
				"aria-label": "Fechar menu"
			}, void 0, false, {
				fileName: _jsxFileName$10,
				lineNumber: 1268,
				columnNumber: 11
			}, this), /* @__PURE__ */ (void 0)("aside", {
				className: "fixed inset-y-0 left-0 z-[60] w-[82%] max-w-sm overflow-y-auto bg-bg shadow-2xl",
				children: [/* @__PURE__ */ (void 0)("div", {
					className: "flex h-20 items-center justify-between border-b border-border px-5",
					children: [/* @__PURE__ */ (void 0)(Logo, {}, void 0, false, {
						fileName: _jsxFileName$10,
						lineNumber: 1281,
						columnNumber: 15
					}, this), /* @__PURE__ */ (void 0)("button", {
						type: "button",
						onClick: () => setMenuOpen(false),
						className: "flex size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg",
						"aria-label": "Fechar menu",
						children: /* @__PURE__ */ (void 0)(X, { className: "size-6" }, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 1291,
							columnNumber: 17
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName$10,
						lineNumber: 1283,
						columnNumber: 15
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName$10,
					lineNumber: 1280,
					columnNumber: 13
				}, this), /* @__PURE__ */ (void 0)("nav", {
					className: "p-4",
					children: [
						/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("p", {
							className: "mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase",
							children: "Navegação"
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 1301,
							columnNumber: 17
						}, this), /* @__PURE__ */ (void 0)("div", {
							className: "space-y-1",
							children: nav.filter((item) => item.to === "/" || item.to === "/my-list" || item.to === "/account" || item.to === "/admin").map((item) => {
								const active = item.match(pathname);
								const Icon = item.icon;
								return /* @__PURE__ */ (void 0)(Link, {
									to: item.to,
									onClick: () => setMenuOpen(false),
									className: cn("flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors", active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
									children: [/* @__PURE__ */ (void 0)(Icon, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1341,
										columnNumber: 29
									}, this), item.label]
								}, item.to, true, {
									fileName: _jsxFileName$10,
									lineNumber: 1326,
									columnNumber: 27
								}, this);
							})
						}, void 0, false, {
							fileName: _jsxFileName$10,
							lineNumber: 1305,
							columnNumber: 17
						}, this)] }, void 0, true, {
							fileName: _jsxFileName$10,
							lineNumber: 1300,
							columnNumber: 15
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-6",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase",
								children: "Animes"
							}, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 1356,
								columnNumber: 17
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "space-y-1",
								children: [/* @__PURE__ */ (void 0)(Link, {
									to: "/browse/season",
									onClick: () => setMenuOpen(false),
									className: cn("flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors", pathname.startsWith("/browse/season") ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
									children: [/* @__PURE__ */ (void 0)(CalendarDays, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1376,
										columnNumber: 21
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Temporadas" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1378,
										columnNumber: 21
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$10,
									lineNumber: 1362,
									columnNumber: 19
								}, this), /* @__PURE__ */ (void 0)(Link, {
									to: "/browse/genres",
									onClick: () => setMenuOpen(false),
									className: cn("flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors", pathname.startsWith("/browse/genres") ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
									children: [/* @__PURE__ */ (void 0)(Tags, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1397,
										columnNumber: 21
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Gêneros" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1399,
										columnNumber: 21
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$10,
									lineNumber: 1383,
									columnNumber: 19
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$10,
								lineNumber: 1360,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$10,
							lineNumber: 1355,
							columnNumber: 15
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-6",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase",
								children: "Notícias"
							}, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 1411,
								columnNumber: 17
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "space-y-1",
								children: /* @__PURE__ */ (void 0)(Link, {
									to: "/news",
									onClick: () => setMenuOpen(false),
									className: cn("flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors", pathname.startsWith("/news") ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
									children: [/* @__PURE__ */ (void 0)(Newspaper, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1431,
										columnNumber: 21
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Notícias" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1433,
										columnNumber: 21
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$10,
									lineNumber: 1417,
									columnNumber: 19
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 1415,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$10,
							lineNumber: 1410,
							columnNumber: 15
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-6",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase",
								children: "Perfil"
							}, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 1445,
								columnNumber: 17
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "space-y-1",
								children: [user && profileNick && /* @__PURE__ */ (void 0)(Link, {
									to: "/profile/$nick",
									params: { nick: profileNick },
									onClick: () => setMenuOpen(false),
									className: cn("flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors", pathname === `/profile/${profileNick}` ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
									children: [/* @__PURE__ */ (void 0)(CircleUser, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1471,
										columnNumber: 25
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Meu perfil público" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1473,
										columnNumber: 25
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$10,
									lineNumber: 1453,
									columnNumber: 23
								}, this), /* @__PURE__ */ (void 0)(Link, {
									to: "/settings",
									onClick: () => setMenuOpen(false),
									className: cn("flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors", pathname.startsWith("/settings") ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
									children: [/* @__PURE__ */ (void 0)(Settings2, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1495,
										columnNumber: 21
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Configurações" }, void 0, false, {
										fileName: _jsxFileName$10,
										lineNumber: 1497,
										columnNumber: 21
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$10,
									lineNumber: 1479,
									columnNumber: 19
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$10,
								lineNumber: 1449,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$10,
							lineNumber: 1444,
							columnNumber: 15
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-6",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase",
								children: "Outros"
							}, void 0, false, {
								fileName: _jsxFileName$10,
								lineNumber: 1509,
								columnNumber: 17
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "space-y-1",
								children: [/* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => setAdultMenuOpen((value) => !value),
									className: cn("flex w-full items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors", ADULT_NAV.match(pathname) ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
									"aria-expanded": adultMenuOpen,
									children: [
										/* @__PURE__ */ (void 0)("span", {
											className: "flex size-5 items-center justify-center text-base",
											children: "🔞"
										}, void 0, false, {
											fileName: _jsxFileName$10,
											lineNumber: 1534,
											columnNumber: 21
										}, this),
										/* @__PURE__ */ (void 0)("span", {
											className: "flex-1 text-left",
											children: "+18"
										}, void 0, false, {
											fileName: _jsxFileName$10,
											lineNumber: 1538,
											columnNumber: 21
										}, this),
										/* @__PURE__ */ (void 0)(ChevronDown, { className: cn("size-5 transition-transform", adultMenuOpen && "rotate-180") }, void 0, false, {
											fileName: _jsxFileName$10,
											lineNumber: 1542,
											columnNumber: 21
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName$10,
									lineNumber: 1515,
									columnNumber: 19
								}, this), adultMenuOpen && /* @__PURE__ */ (void 0)("div", {
									className: "ml-9 space-y-1 border-l border-border pl-3",
									children: [
										/* @__PURE__ */ (void 0)(Link, {
											to: ADULT_NAV.to,
											onClick: () => setMenuOpen(false),
											className: cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors", pathname === "/adult" ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
											children: /* @__PURE__ */ (void 0)("span", { children: "Início" }, void 0, false, {
												fileName: _jsxFileName$10,
												lineNumber: 1567,
												columnNumber: 25
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName$10,
											lineNumber: 1553,
											columnNumber: 23
										}, this),
										/* @__PURE__ */ (void 0)(Link, {
											to: "/adult/news",
											onClick: () => setMenuOpen(false),
											className: "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted transition hover:bg-elevated hover:text-fg",
											children: /* @__PURE__ */ (void 0)("span", { children: "Notícias +18" }, void 0, false, {
												fileName: _jsxFileName$10,
												lineNumber: 1577,
												columnNumber: 25
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName$10,
											lineNumber: 1570,
											columnNumber: 23
										}, this),
										/* @__PURE__ */ (void 0)(Link, {
											to: "/adult/tags",
											onClick: () => setMenuOpen(false),
											className: "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted transition hover:bg-elevated hover:text-fg",
											children: [/* @__PURE__ */ (void 0)(Tags, { className: "size-5" }, void 0, false, {
												fileName: _jsxFileName$10,
												lineNumber: 1587,
												columnNumber: 25
											}, this), /* @__PURE__ */ (void 0)("span", { children: "Tags" }, void 0, false, {
												fileName: _jsxFileName$10,
												lineNumber: 1588,
												columnNumber: 25
											}, this)]
										}, void 0, true, {
											fileName: _jsxFileName$10,
											lineNumber: 1580,
											columnNumber: 23
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName$10,
									lineNumber: 1552,
									columnNumber: 21
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$10,
								lineNumber: 1513,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$10,
							lineNumber: 1508,
							columnNumber: 15
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName$10,
					lineNumber: 1295,
					columnNumber: 13
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$10,
				lineNumber: 1277,
				columnNumber: 11
			}, this)] }, void 0, true, {
				fileName: _jsxFileName$10,
				lineNumber: 1267,
				columnNumber: 9
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("main", {
				className: "mx-auto w-full max-w-6xl px-4 pb-5 sm:px-6 sm:pb-8",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Outlet, {}, void 0, false, {
					fileName: _jsxFileName$10,
					lineNumber: 1606,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName$10,
				lineNumber: 1605,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("footer", {
				className: "mx-auto hidden max-w-6xl items-center justify-between px-6 py-8 text-xs text-subtle md:flex",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", { children: "Hikari 光 — catálogo via AniList, com MyAnimeList como reserva." }, void 0, false, {
					fileName: _jsxFileName$10,
					lineNumber: 1613,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "inline-flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Clapperboard, { className: "size-3.5" }, void 0, false, {
						fileName: _jsxFileName$10,
						lineNumber: 1618,
						columnNumber: 11
					}, this), "Trailers e episódios com URL própria"]
				}, void 0, true, {
					fileName: _jsxFileName$10,
					lineNumber: 1617,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$10,
				lineNumber: 1612,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName$10,
		lineNumber: 620,
		columnNumber: 5
	}, this);
}
var styles_default = "/assets/styles-Cyn5o5Gx.css";
var _jsxFileName$9 = "/app/applet/src/routes/__root.tsx";
var APP_NAME = "HIKARI";
var Route$54 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Hikari 光 — catálogo e streaming de animes. Temporada, populares, trailers e Minha Lista."
			},
			{
				name: "theme-color",
				content: "#09090b"
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
				href: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600&family=Noto+Serif+JP:wght@500;600&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("html", {
		lang: "pt-BR",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("head", { children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("script", {
				async: true,
				src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4294366271727594",
				crossorigin: "anonymous"
			}, void 0, false, {
				fileName: _jsxFileName$9,
				lineNumber: 80,
				columnNumber: 10
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("script", {
				async: true,
				src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-SEU_ID_AQUI",
				crossOrigin: "anonymous"
			}, void 0, false, {
				fileName: _jsxFileName$9,
				lineNumber: 82,
				columnNumber: 9
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("script", { dangerouslySetInnerHTML: { __html: `
              (function () {
                function applyTheme() {
                  try {
                    var theme =
                      localStorage.getItem("hikari-theme");

                    if (theme === "Claro") {
                      document.documentElement.setAttribute(
                        "data-theme",
                        "light"
                      );
                    } else {
                      document.documentElement.removeAttribute(
                        "data-theme"
                      );
                    }
                  } catch (e) {}
                }

                applyTheme();

                window.addEventListener(
                  "pageshow",
                  function () {
                    applyTheme();
                  }
                );
              })();
            ` } }, void 0, false, {
				fileName: _jsxFileName$9,
				lineNumber: 88,
				columnNumber: 9
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(HeadContent, {}, void 0, false, {
				fileName: _jsxFileName$9,
				lineNumber: 123,
				columnNumber: 9
			}, void 0)
		] }, void 0, true, {
			fileName: _jsxFileName$9,
			lineNumber: 78,
			columnNumber: 7
		}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(PreviewHostBridge, {}, void 0, false, {
				fileName: _jsxFileName$9,
				lineNumber: 127,
				columnNumber: 9
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Shell, {}, void 0, false, {
				fileName: _jsxFileName$9,
				lineNumber: 130,
				columnNumber: 11
			}, void 0) }, void 0, false, {
				fileName: _jsxFileName$9,
				lineNumber: 129,
				columnNumber: 9
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Scripts, {}, void 0, false, {
				fileName: _jsxFileName$9,
				lineNumber: 133,
				columnNumber: 9
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Analytics, {}, void 0, false, {
				fileName: _jsxFileName$9,
				lineNumber: 135,
				columnNumber: 9
			}, void 0)
		] }, void 0, true, {
			fileName: _jsxFileName$9,
			lineNumber: 126,
			columnNumber: 7
		}, void 0)]
	}, void 0, true, {
		fileName: _jsxFileName$9,
		lineNumber: 73,
		columnNumber: 5
	}, void 0)
});
var _jsxFileName$8 = "/app/applet/src/routes/index.tsx?tsr-shared=1";
function HomePending() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 pt-3",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "-mx-4 h-[20rem] animate-pulse bg-elevated sm:-mx-6 sm:h-[27rem]" }, void 0, false, {
			fileName: _jsxFileName$8,
			lineNumber: 4,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "rail",
			children: Array.from({ length: 8 }, (_, i) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCardSkeleton, {}, i, false, {
				fileName: _jsxFileName$8,
				lineNumber: 9,
				columnNumber: 20
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName$8,
			lineNumber: 6,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName$8,
		lineNumber: 3,
		columnNumber: 10
	}, this);
}
var $$splitComponentImporter$38 = () => import("./routes-Dyxqheps.mjs");
var $$splitErrorComponentImporter$4 = () => import("./routes-DpRLJpAn.mjs");
var Route$53 = createFileRoute("/")({
	loader: () => fetchHomeCatalog(),
	pendingComponent: HomePending,
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$4, "errorComponent"),
	component: lazyRouteComponent($$splitComponentImporter$38, "component")
});
var $$splitComponentImporter$37 = () => import("./account-Bd_C8LF5.mjs");
var Route$52 = createFileRoute("/account")({ component: lazyRouteComponent($$splitComponentImporter$37, "component") });
var $$splitComponentImporter$36 = () => import("./admin-DWxyq2vd.mjs");
var Route$51 = createFileRoute("/admin")({ component: lazyRouteComponent($$splitComponentImporter$36, "component") });
var $$splitComponentImporter$35 = () => import("./adult-lw-DyLhu.mjs");
var Route$50 = createFileRoute("/adult")({ component: lazyRouteComponent($$splitComponentImporter$35, "component") });
var Route$49 = createFileRoute("/api-anilist")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const body = await request.json();
		const response = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify(body)
		});
		const text = await response.text();
		return new Response(text, {
			status: response.status,
			headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" }
		});
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "Erro ao acessar AniList" }, { status: 500 });
	}
} } } });
var _jsxFileName$7 = "/app/applet/src/routes/calendar.tsx";
var $$splitComponentImporter$34 = () => import("./calendar-DRz1risW.mjs");
var $$splitErrorComponentImporter$3 = () => import("./calendar-COdIieG7.mjs");
function getCurrentSeason$1() {
	const now = /* @__PURE__ */ new Date();
	const month = now.getMonth();
	const year = now.getFullYear();
	if (month <= 2) return {
		season: "WINTER",
		year
	};
	if (month <= 5) return {
		season: "SPRING",
		year
	};
	if (month <= 8) return {
		season: "SUMMER",
		year
	};
	return {
		season: "FALL",
		year
	};
}
function isAnimeSeason$1(value) {
	return value === "WINTER" || value === "SPRING" || value === "SUMMER" || value === "FALL";
}
function normalizeYear$1(value, fallback) {
	const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	if (Number.isInteger(parsed) && parsed >= 2e3 && parsed <= 2028) return parsed;
	return fallback;
}
function normalizePage$1(value) {
	const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	if (Number.isInteger(parsed) && parsed >= 1) return parsed;
	return 1;
}
function mapAnime(anime) {
	return {
		id: String(anime.id),
		anilistId: anime.id,
		malId: anime.idMal ?? void 0,
		titles: {
			romaji: anime.title?.romaji ?? "",
			english: anime.title?.english ?? "",
			native: anime.title?.native ?? ""
		},
		cover: anime.coverImage?.extraLarge ?? anime.coverImage?.large ?? "",
		banner: anime.bannerImage ?? "",
		synopsis: anime.description ?? "",
		score: anime.averageScore != null ? anime.averageScore / 10 : null,
		genres: (anime.genres ?? []).filter((genre) => genre !== "Hentai"),
		format: anime.format ?? "",
		status: anime.status ?? "",
		episodesCount: anime.episodes ?? null,
		season: anime.season ?? null,
		year: anime.seasonYear ?? null,
		trailerId: null,
		source: "anilist"
	};
}
async function fetchSeason(season, year, page) {
	const response = await fetch("https://graphql.anilist.co", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			query: `
            query CalendarSeason(
              $season: MediaSeason,
              $year: Int,
              $page: Int
            ) {
              Page(
                page: $page,
                perPage: 24
              ) {
                pageInfo {
                  currentPage
                  hasNextPage
                }

                media(
                  type: ANIME,
                  season: $season,
                  seasonYear: $year,
                  isAdult: false,
                  sort: POPULARITY_DESC
                ) {
                  id
                  idMal
                  isAdult

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                    color
                  }

                  bannerImage

                  averageScore

                  genres

                  format

                  status

                  episodes

                  season

                  seasonYear

                  description(asHtml: false)
                }
              }
            }
          `,
			variables: {
				season,
				year,
				page
			}
		})
	});
	if (!response.ok) throw new Error("Não foi possível carregar a temporada.");
	const pageData = (await response.json()).data?.Page;
	const pageInfo = pageData?.pageInfo;
	const items = (pageData?.media ?? []).filter((anime) => !anime.isAdult).map(mapAnime);
	const hasNext = pageInfo?.hasNextPage ?? false;
	return {
		items,
		currentPage: pageInfo?.currentPage ?? page,
		lastPage: hasNext ? page + 1 : page,
		hasNext,
		total: (page - 1) * 24 + items.length
	};
}
var Route$48 = createFileRoute("/calendar")({
	validateSearch: (raw) => {
		const current = getCurrentSeason$1();
		return {
			season: isAnimeSeason$1(raw.season) ? raw.season : current.season,
			year: normalizeYear$1(raw.year, current.year),
			page: normalizePage$1(raw.page)
		};
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => {
		const current = getCurrentSeason$1();
		const season = isAnimeSeason$1(deps.season) ? deps.season : current.season;
		const year = normalizeYear$1(deps.year, current.year);
		const page = normalizePage$1(deps.page);
		return {
			...await fetchSeason(season, year, page),
			season,
			year,
			page
		};
	},
	pendingComponent: CalendarPending,
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$3, "errorComponent"),
	component: lazyRouteComponent($$splitComponentImporter$34, "component")
});
function CalendarPending() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 py-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-8 w-64 animate-pulse rounded bg-elevated" }, void 0, false, {
					fileName: _jsxFileName$7,
					lineNumber: 246,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-4 w-80 animate-pulse rounded bg-elevated" }, void 0, false, {
					fileName: _jsxFileName$7,
					lineNumber: 248,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$7,
				lineNumber: 245,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
				children: Array.from({ length: 4 }, (_, index) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-12 animate-pulse rounded-lg bg-elevated" }, index, false, {
					fileName: _jsxFileName$7,
					lineNumber: 254,
					columnNumber: 24
				}, this))
			}, void 0, false, {
				fileName: _jsxFileName$7,
				lineNumber: 251,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-6",
				children: Array.from({ length: 12 }, (_, index) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "aspect-2/3 w-full animate-pulse rounded-xl bg-elevated" }, void 0, false, {
							fileName: _jsxFileName$7,
							lineNumber: 261,
							columnNumber: 15
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-3 w-4/5 animate-pulse rounded bg-elevated" }, void 0, false, {
							fileName: _jsxFileName$7,
							lineNumber: 263,
							columnNumber: 15
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-1 h-2.5 w-1/2 animate-pulse rounded bg-elevated" }, void 0, false, {
							fileName: _jsxFileName$7,
							lineNumber: 265,
							columnNumber: 15
						}, this)
					]
				}, index, true, {
					fileName: _jsxFileName$7,
					lineNumber: 260,
					columnNumber: 24
				}, this))
			}, void 0, false, {
				fileName: _jsxFileName$7,
				lineNumber: 257,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName$7,
		lineNumber: 244,
		columnNumber: 10
	}, this);
}
var $$splitComponentImporter$33 = () => import("./login-Ri2wCLXO.mjs");
var Route$47 = createFileRoute("/login")({ component: lazyRouteComponent($$splitComponentImporter$33, "component") });
var $$splitComponentImporter$32 = () => import("./my-list-B-cYeoOC.mjs");
var Route$46 = createFileRoute("/my-list")({ component: lazyRouteComponent($$splitComponentImporter$32, "component") });
var $$splitComponentImporter$31 = () => import("./news-DZ0fi6ey.mjs");
var Route$45 = createFileRoute("/news")({
	validateSearch: (search) => ({
		q: typeof search.q === "string" ? search.q : "",
		page: Math.max(1, Number(search.page) || 1)
	}),
	search: { middlewares: [stripSearchParams({
		q: "",
		page: 1
	})] },
	loader: async () => {
		return await fetchAutomaticNews();
	},
	component: lazyRouteComponent($$splitComponentImporter$31, "component")
});
var $$splitComponentImporter$30 = () => import("./notifications-DES6S4DY.mjs");
var Route$44 = createFileRoute("/notifications")({ component: lazyRouteComponent($$splitComponentImporter$30, "component") });
var _jsxFileName$6 = "/app/applet/src/routes/search.tsx?tsr-shared=1";
function SearchPending() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "grid grid-cols-2 gap-3 pt-6 sm:grid-cols-4 lg:grid-cols-6",
		children: Array.from({ length: 12 }, (_, i) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "[&>div]:w-full",
			children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCardSkeleton, {}, void 0, false, {
				fileName: _jsxFileName$6,
				lineNumber: 7,
				columnNumber: 13
			}, this)
		}, i, false, {
			fileName: _jsxFileName$6,
			lineNumber: 6,
			columnNumber: 18
		}, this))
	}, void 0, false, {
		fileName: _jsxFileName$6,
		lineNumber: 3,
		columnNumber: 10
	}, this);
}
var $$splitComponentImporter$29 = () => import("./search-eNXpHz1u.mjs");
var Route$43 = createFileRoute("/search")({
	validateSearch: (raw) => ({
		q: typeof raw.q === "string" && raw.q ? raw.q : void 0,
		genre: typeof raw.genre === "string" && raw.genre ? raw.genre : void 0,
		year: typeof raw.year === "string" && raw.year ? raw.year : void 0,
		format: typeof raw.format === "string" && raw.format ? raw.format : void 0,
		status: typeof raw.status === "string" && raw.status ? raw.status : void 0,
		sort: typeof raw.sort === "string" && raw.sort ? raw.sort : void 0,
		page: typeof raw.page === "string" && /^\d+$/.test(raw.page) ? Math.max(1, Number(raw.page)) : void 0,
		adult: raw.adult === true || raw.adult === "true" ? true : void 0
	}),
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => {
		const [result, home] = await Promise.all([searchCatalog({ data: {
			...deps,
			page: deps.page ?? 1
		} }), fetchHomeCatalog()]);
		return {
			result,
			genres: home.genres
		};
	},
	pendingComponent: SearchPending,
	component: lazyRouteComponent($$splitComponentImporter$29, "component")
});
var $$splitComponentImporter$28 = () => import("./settings-U11ziNXQ.mjs");
var Route$42 = createFileRoute("/settings")({ component: lazyRouteComponent($$splitComponentImporter$28, "component") });
var $$splitComponentImporter$27 = () => import("./settings-about-DmnGgvyw.mjs");
var Route$41 = createFileRoute("/settings-about")({ component: lazyRouteComponent($$splitComponentImporter$27, "component") });
var $$splitComponentImporter$26 = () => import("./settings-account-Z-hyxK63.mjs");
var getAccountSession = createServerFn({ method: "GET" }).handler(createSsrRpc("dc0a2f2c9be36a20adcfcabecdb4dfda242ab43dfd30504731175343705c23b2"));
var Route$40 = createFileRoute("/settings-account")({
	loader: async () => {
		return getAccountSession();
	},
	component: lazyRouteComponent($$splitComponentImporter$26, "component")
});
var $$splitComponentImporter$25 = () => import("./settings-appearance-CbpXzoa7.mjs");
var getAppearanceTheme = createServerFn({ method: "GET" }).handler(createSsrRpc("a34ee8c6e41db677545f029e07cff17073360e9b45653837653382f09beefbcb"));
var Route$39 = createFileRoute("/settings-appearance")({
	loader: async () => {
		return getAppearanceTheme();
	},
	component: lazyRouteComponent($$splitComponentImporter$25, "component")
});
var $$splitComponentImporter$24 = () => import("./settings-notifications-l745yU9H.mjs");
var Route$38 = createFileRoute("/settings-notifications")({ component: lazyRouteComponent($$splitComponentImporter$24, "component") });
var $$splitComponentImporter$23 = () => import("./settings-player-NrZUQKt1.mjs");
var Route$37 = createFileRoute("/settings-player")({ component: lazyRouteComponent($$splitComponentImporter$23, "component") });
var $$splitComponentImporter$22 = () => import("./settings-privacy-BSmsOoFj.mjs");
var Route$36 = createFileRoute("/settings-privacy")({ component: lazyRouteComponent($$splitComponentImporter$22, "component") });
var $$splitComponentImporter$21 = () => import("./settings-profile-CeXY0khW.mjs");
var Route$35 = createFileRoute("/settings-profile")({ component: lazyRouteComponent($$splitComponentImporter$21, "component") });
var $$splitComponentImporter$20 = () => import("./settings-security-CBlit_Yx.mjs");
var Route$34 = createFileRoute("/settings-security")({ component: lazyRouteComponent($$splitComponentImporter$20, "component") });
var $$splitComponentImporter$19 = () => import("./test-anilist-vercel-bHnp-Ix-.mjs");
var Route$33 = createFileRoute("/test-anilist-vercel")({
	loader: async () => {
		const response = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify({ query: `
            query {
              Media(id: 1, type: ANIME) {
                id
                title {
                  romaji
                }
              }
            }
          ` })
		});
		const text = await response.text();
		return {
			status: response.status,
			response: text
		};
	},
	component: lazyRouteComponent($$splitComponentImporter$19, "component")
});
var $$splitComponentImporter$18 = () => import("./test-api-anilist-D2ChE7DT.mjs");
var Route$32 = createFileRoute("/test-api-anilist")({
	loader: async () => {
		const response = await fetch("https://grokhikari.vercel.app/api-anilist", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query: `
            query {
              Media(id: 1, type: ANIME) {
                id
                title {
                  romaji
                }
              }
            }
          ` })
		});
		const text = await response.text();
		return {
			status: response.status,
			response: text
		};
	},
	component: lazyRouteComponent($$splitComponentImporter$18, "component")
});
var $$splitComponentImporter$17 = () => import("./admin.index-BR3NQXwa.mjs");
var Route$31 = createFileRoute("/admin/")({ component: lazyRouteComponent($$splitComponentImporter$17, "component") });
var $$splitComponentImporter$16 = () => import("./admin._id-CyvqEaV1.mjs");
var Route$30 = createFileRoute("/admin/$id")({
	validateSearch: (raw) => ({ importId: typeof raw.importId === "string" && raw.importId ? raw.importId : void 0 }),
	loaderDeps: ({ search }) => ({ importId: search.importId }),
	loader: async ({ params, deps }) => {
		const fetchId = params.id === "new" ? deps.importId : params.id;
		if (!fetchId || fetchId.startsWith("local-")) return { remote: null };
		try {
			return { remote: await fetchAnimeDetail({ data: { id: fetchId } }) };
		} catch {
			return { remote: null };
		}
	},
	component: lazyRouteComponent($$splitComponentImporter$16, "component")
});
var $$splitComponentImporter$15 = () => import("./admin.hikari-ai-BoqgXK-5.mjs");
var Route$29 = createFileRoute("/admin/hikari-ai")({ component: lazyRouteComponent($$splitComponentImporter$15, "component") });
var $$splitComponentImporter$14 = () => import("./admin.moderation-D9DNjKff.mjs");
var Route$28 = createFileRoute("/admin/moderation")({ component: lazyRouteComponent($$splitComponentImporter$14, "component") });
var _jsxFileName$5 = "/app/applet/src/routes/adult.index.tsx?tsr-shared=1";
function AdultPending() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 pt-3",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "-mx-4 h-[20rem] animate-pulse bg-elevated sm:-mx-6 sm:h-[27rem]" }, void 0, false, {
			fileName: _jsxFileName$5,
			lineNumber: 4,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "rail",
			children: Array.from({ length: 8 }, (_, i) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCardSkeleton, {}, i, false, {
				fileName: _jsxFileName$5,
				lineNumber: 9,
				columnNumber: 20
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName$5,
			lineNumber: 6,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName$5,
		lineNumber: 3,
		columnNumber: 10
	}, this);
}
var $$splitComponentImporter$13 = () => import("./adult.index-BLUfJGN9.mjs");
var $$splitErrorComponentImporter$2 = () => import("./adult.index-dPMg26xR.mjs");
var Route$27 = createFileRoute("/adult/")({
	loader: () => fetchAdultCatalog(),
	pendingComponent: AdultPending,
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$2, "errorComponent"),
	component: lazyRouteComponent($$splitComponentImporter$13, "component")
});
var _jsxFileName$4 = "/app/applet/src/routes/adult.hentai.tsx";
var $$splitComponentImporter$12 = () => import("./adult.hentai-BcMWsFVL.mjs");
var $$splitErrorComponentImporter$1 = () => import("./adult.hentai-Cy4jHuwf.mjs");
var Route$26 = createFileRoute("/adult/hentai")({
	validateSearch: (search) => {
		const page = Number(search.page);
		return { page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1 };
	},
	loader: () => fetchAdultCatalog(),
	pendingComponent: HentaiPending,
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$1, "errorComponent"),
	component: lazyRouteComponent($$splitComponentImporter$12, "component")
});
function HentaiPending() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-5 pb-5 sm:space-y-8",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-8 w-52 animate-pulse rounded bg-elevated" }, void 0, false, {
			fileName: _jsxFileName$4,
			lineNumber: 22,
			columnNumber: 9
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-4 w-72 animate-pulse rounded bg-elevated" }, void 0, false, {
			fileName: _jsxFileName$4,
			lineNumber: 24,
			columnNumber: 9
		}, this)] }, void 0, true, {
			fileName: _jsxFileName$4,
			lineNumber: 21,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6",
			children: Array.from({ length: 8 }, (_, i) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCardSkeleton, {}, i, false, {
				fileName: _jsxFileName$4,
				lineNumber: 30,
				columnNumber: 20
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName$4,
			lineNumber: 27,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName$4,
		lineNumber: 20,
		columnNumber: 10
	}, this);
}
var _jsxFileName$3 = "/app/applet/src/routes/adult.recent.tsx";
var $$splitComponentImporter$11 = () => import("./adult.recent-DVW8CuUp.mjs");
var $$splitErrorComponentImporter = () => import("./adult.recent-C_fdowgx.mjs");
var Route$25 = createFileRoute("/adult/recent")({
	validateSearch: (search) => {
		const page = Number(search.page);
		return { page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1 };
	},
	loader: () => fetchAdultCatalog(),
	pendingComponent: AdultRecentPending,
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter, "errorComponent"),
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
function AdultRecentPending() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-5 pb-5 sm:space-y-8",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-8 w-52 animate-pulse rounded bg-elevated" }, void 0, false, {
			fileName: _jsxFileName$3,
			lineNumber: 22,
			columnNumber: 9
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-4 w-72 animate-pulse rounded bg-elevated" }, void 0, false, {
			fileName: _jsxFileName$3,
			lineNumber: 24,
			columnNumber: 9
		}, this)] }, void 0, true, {
			fileName: _jsxFileName$3,
			lineNumber: 21,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6",
			children: Array.from({ length: 8 }, (_, i) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCardSkeleton, {}, i, false, {
				fileName: _jsxFileName$3,
				lineNumber: 30,
				columnNumber: 20
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName$3,
			lineNumber: 27,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName$3,
		lineNumber: 20,
		columnNumber: 10
	}, this);
}
var _jsxFileName$2 = "/app/applet/src/routes/adult.tags.tsx";
var $$splitComponentImporter$10 = () => import("./adult.tags-RQlOqZ4k.mjs");
var Route$24 = createFileRoute("/adult/tags")({
	validateSearch: (search) => {
		const page = Number(search.page);
		return {
			tag: typeof search.tag === "string" && search.tag.trim() ? search.tag.trim() : void 0,
			page: Number.isInteger(page) && page >= 1 ? page : 1
		};
	},
	loader: () => fetchAdultTags(),
	staleTime: 18e5,
	preloadStaleTime: 3e5,
	gcTime: 36e5,
	pendingComponent: AdultTagsPending,
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
function AdultTagsPending() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 py-5 sm:space-y-8 sm:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "flex size-10 shrink-0 animate-pulse items-center justify-center rounded-xl bg-elevated" }, void 0, false, {
					fileName: _jsxFileName$2,
					lineNumber: 25,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-7 w-32 animate-pulse rounded bg-elevated" }, void 0, false, {
					fileName: _jsxFileName$2,
					lineNumber: 28,
					columnNumber: 13
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-4 w-56 animate-pulse rounded bg-elevated" }, void 0, false, {
					fileName: _jsxFileName$2,
					lineNumber: 30,
					columnNumber: 13
				}, this)] }, void 0, true, {
					fileName: _jsxFileName$2,
					lineNumber: 27,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$2,
				lineNumber: 24,
				columnNumber: 9
			}, this) }, void 0, false, {
				fileName: _jsxFileName$2,
				lineNumber: 23,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
				children: Array.from({ length: 12 }, (_, index) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-12 animate-pulse rounded-xl bg-elevated" }, index, false, {
					fileName: _jsxFileName$2,
					lineNumber: 39,
					columnNumber: 26
				}, this))
			}, void 0, false, {
				fileName: _jsxFileName$2,
				lineNumber: 36,
				columnNumber: 9
			}, this) }, void 0, false, {
				fileName: _jsxFileName$2,
				lineNumber: 35,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6",
				children: Array.from({ length: 8 }, (_, index) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCardSkeleton, {}, index, false, {
					fileName: _jsxFileName$2,
					lineNumber: 46,
					columnNumber: 24
				}, this))
			}, void 0, false, {
				fileName: _jsxFileName$2,
				lineNumber: 43,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName$2,
		lineNumber: 22,
		columnNumber: 10
	}, this);
}
var $$splitComponentImporter$9 = () => import("./adult_.news-CzOePE6D.mjs");
var Route$23 = createFileRoute("/adult_/news")({
	validateSearch: (search) => ({
		q: typeof search.q === "string" ? search.q : "",
		page: Math.max(1, Number(search.page) || 1)
	}),
	search: { middlewares: [stripSearchParams({
		q: "",
		page: 1
	})] },
	loader: async () => {
		return await fetchAdultNews();
	},
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var _jsxFileName$1 = "/app/applet/src/routes/anime.$id.tsx";
var $$splitComponentImporter$8 = () => import("./anime._id-C2UzF3Dh.mjs");
var Route$22 = createFileRoute("/anime/$id")({
	loader: async ({ params }) => {
		if (params.id.startsWith("local-")) return { remote: null };
		return { remote: await fetchAnimeDetail({ data: { id: params.id } }) };
	},
	pendingComponent: () => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-4 pt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "-mx-4 h-56 animate-pulse bg-elevated sm:-mx-6 sm:h-72" }, void 0, false, {
				fileName: _jsxFileName$1,
				lineNumber: 24,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-8 w-2/3 animate-pulse rounded bg-elevated" }, void 0, false, {
				fileName: _jsxFileName$1,
				lineNumber: 26,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-24 rounded bg-elevated" }, void 0, false, {
				fileName: _jsxFileName$1,
				lineNumber: 28,
				columnNumber: 7
			}, void 0)
		]
	}, void 0, true, {
		fileName: _jsxFileName$1,
		lineNumber: 23,
		columnNumber: 27
	}, void 0),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : void 0;
function getDatabaseHash(value) {
	if (!value || !value.trim()) return "DATABASE_URL_NOT_SET";
	return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
var runtimeDatabaseHash = getDatabaseHash(rawDatabaseUrl);
var Route$21 = createFileRoute("/api/notifications")({ server: { handlers: {
	GET: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return Response.json({
			notifications: [],
			unreadCount: 0
		}, { status: 401 });
		const sql = await getSql();
		let notificationTableExists = false;
		try {
			const tableRows = await sql`
              select exists (
                select 1
                from information_schema.tables
                where
                  table_schema = 'public'
                  and table_name = 'notification'
              ) as exists
            `;
			notificationTableExists = Boolean(tableRows[0]?.exists);
		} catch {
			notificationTableExists = false;
		}
		if (!notificationTableExists) return Response.json({
			notifications: [],
			unreadCount: 0,
			debug: {
				dbSource,
				databaseUrlConfigured: dbSource === "neon",
				runtimeDatabaseHash,
				notificationTableExists
			}
		});
		const notifications = await sql`
            select
              n."id",
              n."type",
              n."message",
              n."read",
              n."createdAt",

              n."actorId",

              u."name" as "actorName",
              u."image" as "actorImage",

              n."commentId",
              n."animeId",
              n."episodeId",

              coalesce(
                (
                  select
                    count(*)::int
                  from "comment_like" cl
                  where
                    cl."commentId" =
                      n."commentId"
                ),
                0
              ) as "commentLikes",

              coalesce(
                (
                  select
                    json_agg(
                      json_build_object(
                        'id',
                        liker."id",
                        'name',
                        liker."name",
                        'image',
                        liker."image"
                      )
                    )
                  from (
                    select
                      cl2."userId",
                      cl2."id"
                    from "comment_like" cl2
                    where
                      cl2."commentId" =
                        n."commentId"
                    order by
                      cl2."id" desc
                    limit 2
                  ) recent_likes

                  left join "user" liker
                    on liker."id" =
                      recent_likes."userId"
                ),
                '[]'::json
              ) as "likeAvatars"

            from "notification" n

            left join "user" u
              on u."id" =
                n."actorId"

            where
              n."userId" =
                ${session.user.id}

            order by
              n."createdAt" desc

            limit 50
          `;
		const enrichedNotifications = await Promise.all(notifications.map(async (notification) => {
			let animeTitle = null;
			let animeCover = null;
			const animeId = notification.animeId;
			if (animeId) try {
				if (animeId.startsWith("mal-")) {
					const malId = animeId.replace("mal-", "");
					const response = await fetch(`https://api.jikan.moe/v4/anime/${encodeURIComponent(malId)}`, { headers: { Accept: "application/json" } });
					if (response.ok) {
						const anime = (await response.json()).data;
						animeTitle = anime?.title_english || anime?.title || anime?.title_japanese || null;
						animeCover = anime?.images?.jpg?.large_image_url || anime?.images?.jpg?.image_url || null;
					}
				} else {
					const numericId = Number(animeId);
					if (Number.isFinite(numericId)) {
						const response = await fetch("https://graphql.anilist.co", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Accept: "application/json"
							},
							body: JSON.stringify({
								query: `
                                    query (
                                      $id: Int
                                    ) {
                                      Media(
                                        id: $id
                                        type: ANIME
                                      ) {
                                        id

                                        title {
                                          romaji
                                          english
                                          native
                                        }

                                        coverImage {
                                          extraLarge
                                          large
                                        }
                                      }
                                    }
                                  `,
								variables: { id: numericId }
							})
						});
						if (response.ok) {
							const anime = (await response.json()).data?.Media;
							animeTitle = anime?.title?.english || anime?.title?.romaji || anime?.title?.native || null;
							animeCover = anime?.coverImage?.extraLarge || anime?.coverImage?.large || null;
						}
					}
				}
			} catch {}
			return {
				...notification,
				animeTitle,
				animeCover,
				likeAvatars: Array.isArray(notification.likeAvatars) ? notification.likeAvatars : []
			};
		}));
		const unreadRows = await sql`
            select
              count(*)::text as count

            from "notification"

            where
              "userId" =
                ${session.user.id}

              and
              "read" = false
          `;
		return Response.json({
			notifications: enrichedNotifications,
			unreadCount: Number(unreadRows[0]?.count ?? "0"),
			debug: {
				dbSource,
				databaseUrlConfigured: dbSource === "neon",
				runtimeDatabaseHash,
				notificationTableExists
			}
		});
	},
	PATCH: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return Response.json({
			success: false,
			unreadCount: 0
		}, { status: 401 });
		const sql = await getSql();
		let notificationTableExists = false;
		try {
			const tableRows = await sql`
              select exists (
                select 1
                from information_schema.tables
                where
                  table_schema = 'public'
                  and table_name = 'notification'
              ) as exists
            `;
			notificationTableExists = Boolean(tableRows[0]?.exists);
		} catch {
			notificationTableExists = false;
		}
		if (!notificationTableExists) return Response.json({
			success: true,
			unreadCount: 0
		});
		let body = {};
		try {
			body = await request.json();
		} catch {
			body = {};
		}
		if (body.id) await sql`
            update "notification"
            set
              "read" = true
            where
              "id" =
                ${body.id}
              and
              "userId" =
                ${session.user.id}
          `;
		else await sql`
            update "notification"
            set
              "read" = true
            where
              "userId" =
                ${session.user.id}
              and
              "read" = false
          `;
		const unreadRows = await sql`
            select
              count(*)::text as count

            from "notification"

            where
              "userId" =
                ${session.user.id}

              and
              "read" = false
          `;
		return Response.json({
			success: true,
			unreadCount: Number(unreadRows[0]?.count ?? "0")
		});
	}
} } });
var Route$20 = createFileRoute("/api/upload-comment-image")({ server: { handlers: { POST: async ({ request }) => {
	const body = await request.json();
	const token = process.env.BLOB_READ_WRITE_TOKEN;
	if (!token) return Response.json({ error: "BLOB_READ_WRITE_TOKEN não está disponível." }, { status: 500 });
	try {
		const jsonResponse = await handleUpload({
			token,
			body,
			request,
			onBeforeGenerateToken: async () => ({
				allowedContentTypes: [
					"image/jpeg",
					"image/png",
					"image/webp",
					"image/gif"
				],
				maximumSizeInBytes: 10485760,
				addRandomSuffix: true
			}),
			onUploadCompleted: async ({ blob }) => {
				console.log("Imagem de comentário enviada:", blob.url);
			}
		});
		return Response.json(jsonResponse);
	} catch (error) {
		console.error("Erro no upload da imagem do comentário:", error);
		return Response.json({ error: error instanceof Error ? error.message : "Falha no upload da imagem." }, { status: 400 });
	}
} } } });
var ALLOWED_TYPES = [
	"video/mp4",
	"video/webm",
	"video/quicktime"
];
var MAX_SIZE = 943718400;
async function handlePost({ request }) {
	try {
		const body = await request.json();
		const jsonResponse = await handleUpload({
			body,
			request,
			onBeforeGenerateToken: async () => ({
				allowedContentTypes: ALLOWED_TYPES,
				maximumSizeInBytes: MAX_SIZE,
				addRandomSuffix: true
			}),
			onUploadCompleted: async ({ blob }) => {
				console.log("Upload concluído:", blob.url);
			}
		});
		return Response.json(jsonResponse);
	} catch (error) {
		console.error("Erro no upload do Vercel Blob:", error);
		return Response.json({ error: error instanceof Error ? `Falha no upload: ${error.message}` : "Falha no upload." }, { status: 500 });
	}
}
var Route$19 = createFileRoute("/api/upload-video")({ server: { handlers: { POST: handlePost } } });
var _jsxFileName = "/app/applet/src/routes/browse.$section.tsx";
var $$splitComponentImporter$7 = () => import("./browse._section-8HrIX6x1.mjs");
function getCurrentSeason() {
	const now = /* @__PURE__ */ new Date();
	const month = now.getMonth();
	const year = now.getFullYear();
	if (month <= 2) return {
		season: "WINTER",
		year
	};
	if (month <= 5) return {
		season: "SPRING",
		year
	};
	if (month <= 8) return {
		season: "SUMMER",
		year
	};
	return {
		season: "FALL",
		year
	};
}
function isAnimeSeason(value) {
	return value === "WINTER" || value === "SPRING" || value === "SUMMER" || value === "FALL";
}
function normalizeYear(value, fallback) {
	const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	if (Number.isInteger(parsed) && parsed >= 2e3 && parsed <= 2028) return parsed;
	return fallback;
}
function normalizePage(value) {
	const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	if (Number.isInteger(parsed) && parsed >= 1) return parsed;
	return 1;
}
function normalizeGenre(value) {
	if (typeof value !== "string") return;
	const genre = value.trim();
	return genre ? genre : void 0;
}
var Route$18 = createFileRoute("/browse/$section")({
	validateSearch: (raw) => {
		const current = getCurrentSeason();
		return {
			season: isAnimeSeason(raw.season) ? raw.season : current.season,
			year: normalizeYear(raw.year, current.year),
			page: normalizePage(raw.page),
			genre: normalizeGenre(raw.genre)
		};
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ params, deps }) => {
		if (params.section === "genres") {
			const genre = normalizeGenre(deps.genre);
			if (!genre) return {
				section: "genres",
				genres: await fetchGenres(),
				result: null,
				season: void 0,
				year: void 0,
				page: 1,
				genre: void 0
			};
			return {
				section: "genres",
				genres: [],
				result: await fetchBrowse({ data: {
					section: "popular",
					page: normalizePage(deps.page),
					genre
				} }),
				season: void 0,
				year: void 0,
				page: normalizePage(deps.page),
				genre
			};
		}
		const section = [
			"popular",
			"season",
			"top",
			"trending"
		].includes(params.section) ? params.section : "popular";
		const current = getCurrentSeason();
		const season = isAnimeSeason(deps.season) ? deps.season : current.season;
		const year = normalizeYear(deps.year, current.year);
		const page = normalizePage(deps.page);
		return {
			result: await fetchBrowse({ data: {
				section,
				page,
				season,
				year
			} }),
			section,
			season,
			year,
			page,
			genres: [],
			genre: void 0
		};
	},
	pendingComponent: () => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "grid grid-cols-2 gap-3 pt-20 sm:grid-cols-4 lg:grid-cols-6",
		children: Array.from({ length: 12 }, (_, i) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCardSkeleton, {}, i, false, {
			fileName: _jsxFileName,
			lineNumber: 150,
			columnNumber: 18
		}, void 0))
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 147,
		columnNumber: 27
	}, void 0),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var NEWS = [
	{
		id: "frieren-trailer",
		type: "TRAILER",
		title: "Novo trailer de \"Sousou no Frieren\" é divulgado",
		description: "Um novo trailer foi divulgado, trazendo novas cenas e detalhes da próxima temporada.",
		content: "Um novo trailer de \"Sousou no Frieren\" foi divulgado, apresentando novas cenas e momentos inéditos da próxima temporada. O material mostra parte da jornada dos personagens e destaca diferentes situações que deverão aparecer nos próximos episódios.\n\nO novo vídeo também apresenta cenas de personagens conhecidos e alguns momentos que chamaram a atenção dos fãs. Mais detalhes sobre a história e a produção poderão ser divulgados posteriormente.",
		date: "22 de setembro de 2026",
		image: "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg",
		trailerUrl: "https://www.youtube.com/embed/Fgj15FVP6IU",
		anime: {
			id: "52991",
			name: "Sousou no Frieren",
			image: "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg",
			synopsis: "Durante sua jornada de dez anos para derrotar o Rei Demônio, Frieren e os membros do grupo de heróis criaram laços e memórias importantes. Após a aventura terminar, Frieren começa a perceber o verdadeiro significado daqueles momentos e decide compreender melhor os humanos e criar novas conexões.",
			season: "Outono de 2023",
			releaseDate: "29 de setembro de 2023",
			episodes: 28
		}
	},
	{
		id: "one-piece-nova-temporada",
		type: "NOVA TEMPORADA",
		title: "One Piece ganha novidades sobre seu próximo arco",
		description: "Novas informações sobre a continuação da história foram divulgadas.",
		content: "Novas informações sobre o próximo arco de One Piece foram divulgadas. A atualização apresenta detalhes sobre a continuação da história e aumenta a expectativa para os próximos acontecimentos.\n\nA produção deve continuar revelando novas informações ao longo das próximas atualizações. Os fãs poderão acompanhar as novidades conforme novos materiais forem publicados.",
		date: "21 de setembro de 2026",
		image: "https://cdn.myanimelist.net/images/anime/1244/138851l.jpg"
	},
	{
		id: "anime-filme",
		type: "FILME",
		title: "Novo filme de anime recebe data de estreia",
		description: "A produção ganhou uma nova atualização e teve sua data de estreia anunciada.",
		content: "Um novo filme de anime recebeu uma atualização importante com a divulgação de sua data de estreia. A produção vinha sendo aguardada pelos fãs e agora possui uma nova previsão para chegar ao público.\n\nNovas informações sobre a equipe, personagens e materiais promocionais poderão ser divulgadas antes da estreia. O filme também deverá receber novos trailers e imagens promocionais.",
		date: "20 de setembro de 2026",
		image: "https://cdn.myanimelist.net/images/anime/1765/135099l.jpg"
	},
	{
		id: "novo-episodio",
		type: "NOVO EPISÓDIO",
		title: "Novo episódio de uma das séries mais populares chega esta semana",
		description: "O próximo episódio já tem data prevista e novas informações foram divulgadas.",
		content: "O próximo episódio da série já possui uma data prevista para lançamento. A atualização também trouxe novas informações sobre o que os espectadores poderão encontrar no próximo capítulo.\n\nA expectativa aumenta com a chegada do novo episódio, que deverá continuar os acontecimentos apresentados anteriormente. Novas informações podem ser divulgadas antes da publicação.",
		date: "19 de setembro de 2026",
		image: "https://cdn.myanimelist.net/images/anime/1801/142390l.jpg"
	},
	{
		id: "jujutsu-novidades",
		type: "NOVIDADES",
		title: "Jujutsu Kaisen recebe novas informações sobre a produção",
		description: "A produção divulgou novas informações para os fãs da série.",
		content: "A produção de Jujutsu Kaisen recebeu uma nova atualização. As informações divulgadas apresentam novidades relacionadas ao futuro da série e aos próximos materiais que deverão ser publicados.\n\nOs fãs poderão acompanhar novas imagens, vídeos e outros anúncios conforme a produção avançar. Mais detalhes serão adicionados quando novas informações oficiais forem disponibilizadas.",
		date: "18 de setembro de 2026",
		image: "https://jujutsukaisen.jp/news/images/20250728_01_01.jpg"
	},
	{
		id: "demon-slayer-filme",
		type: "FILME",
		title: "Novo projeto de Demon Slayer ganha novidades",
		description: "Novos detalhes do próximo projeto foram revelados.",
		content: "O próximo projeto relacionado a Demon Slayer recebeu novas informações. A atualização apresenta detalhes adicionais sobre a produção e aumenta a expectativa para os próximos materiais promocionais.\n\nNovas imagens, vídeos e informações sobre o projeto poderão ser divulgados posteriormente. O público poderá acompanhar as novidades conforme o lançamento se aproxima.",
		date: "17 de setembro de 2026",
		image: "https://cdn.myanimelist.net/images/anime/1765/135099l.jpg"
	},
	{
		id: "solo-leveling",
		type: "NOVA TEMPORADA",
		title: "Solo Leveling recebe atualização sobre sua próxima temporada",
		description: "A equipe de produção divulgou novas informações sobre a continuação.",
		content: "A próxima temporada de Solo Leveling recebeu uma nova atualização. As informações divulgadas trazem novidades sobre a continuação da produção e sobre os próximos materiais que serão apresentados aos fãs.\n\nA expectativa para a nova temporada continua crescendo, enquanto novas imagens e informações podem ser divulgadas durante os próximos anúncios.",
		date: "16 de setembro de 2026",
		image: "https://cdn.myanimelist.net/images/anime/1801/142390l.jpg"
	},
	{
		id: "bleach-news",
		type: "NOVIDADES",
		title: "Bleach ganha novas informações sobre seus próximos episódios",
		description: "Novos detalhes foram divulgados sobre a continuação da série.",
		content: "Novas informações sobre os próximos episódios de Bleach foram divulgadas. A atualização apresenta detalhes sobre a continuação da história e sobre os próximos acontecimentos da série.\n\nMais materiais promocionais poderão ser publicados durante as próximas atualizações. Os fãs poderão acompanhar as novidades conforme novos anúncios forem realizados.",
		date: "15 de setembro de 2026",
		image: "https://cdn.myanimelist.net/images/anime/3/40451.jpg"
	},
	{
		id: "chainsaw-man-filme",
		type: "FILME",
		title: "Chainsaw Man recebe novidades sobre seu filme",
		description: "O projeto ganhou novas informações e detalhes de produção.",
		content: "O filme de Chainsaw Man recebeu novas informações relacionadas ao seu desenvolvimento. A atualização apresenta detalhes adicionais sobre o projeto e seus próximos materiais promocionais.\n\nNovas imagens, vídeos e anúncios poderão ser divulgados antes do lançamento. O público poderá acompanhar as próximas atualizações conforme a produção avançar.",
		date: "14 de setembro de 2026",
		image: "https://api-cdn.myanimelist.net/images/anime/1632/110707.jpg"
	},
	{
		id: "my-hero-academia",
		type: "NOVA TEMPORADA",
		title: "My Hero Academia recebe novidades da próxima fase",
		description: "Novas informações sobre a produção foram divulgadas.",
		content: "My Hero Academia recebeu novas informações relacionadas à sua próxima fase. A atualização apresenta novidades sobre a produção e sobre os próximos conteúdos que deverão ser disponibilizados.\n\nNovos materiais promocionais poderão trazer mais detalhes sobre os personagens e acontecimentos da continuação. Outras informações serão divulgadas conforme novos anúncios forem realizados.",
		date: "13 de setembro de 2026",
		image: "https://cdn.myanimelist.net/images/anime/10/78745l.jpg"
	},
	{
		id: "dragon-ball",
		type: "NOVIDADES",
		title: "Dragon Ball ganha novas informações para os fãs",
		description: "A franquia recebeu uma nova atualização nesta semana.",
		content: "Dragon Ball recebeu uma nova atualização com informações para os fãs da franquia. O anúncio apresenta novidades sobre os próximos conteúdos e mantém a comunidade acompanhando os futuros projetos.\n\nNovas informações poderão surgir nas próximas atualizações, incluindo materiais promocionais, imagens e outros anúncios relacionados à franquia.",
		date: "12 de setembro de 2026",
		image: "https://cdn.myanimelist.net/images/anime/7/74606.jpg"
	},
	{
		id: "one-punch-man",
		type: "TRAILER",
		title: "Novo trailer de One Punch Man é divulgado",
		description: "O novo vídeo apresenta cenas inéditas e detalhes da produção.",
		content: "Um novo trailer de One Punch Man foi divulgado, apresentando cenas inéditas e novos detalhes da produção. O vídeo reúne diferentes momentos da série e mostra parte do conteúdo que deverá aparecer nos próximos episódios.\n\nO material promocional também aumenta a expectativa para a continuação. Novas informações poderão ser divulgadas durante os próximos anúncios da produção.",
		date: "11 de setembro de 2026",
		image: "https://cdn.myanimelist.net/images/anime/12/76049l.jpg"
	}
];
var $$splitComponentImporter$6 = () => import("./news_._id-oDhse4E8.mjs");
var ANILIST = "https://graphql.anilist.co";
function titleOf(media) {
	return media.title?.english || media.title?.romaji || media.title?.native || "Anime";
}
function formatAnimeSeason(season, year) {
	const translated = season ? {
		WINTER: "Inverno",
		SPRING: "Primavera",
		SUMMER: "Verão",
		FALL: "Outono"
	}[season.toUpperCase()] ?? season : "Não informado";
	return year ? `${translated} de ${year}` : translated;
}
function formatAnimeDate(date) {
	if (!date?.year || !date.month || !date.day) return "Não informado";
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(new Date(date.year, date.month - 1, date.day));
}
async function translateSynopsis(text) {
	const cleaned = stripHtml(text).trim();
	if (!cleaned) return "Sinopse não disponível.";
	try {
		const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(cleaned.slice(0, 5e3))}`;
		const response = await fetch(url, { signal: AbortSignal.timeout(8e3) });
		if (!response.ok) return cleaned;
		const json = await response.json();
		if (!Array.isArray(json) || !Array.isArray(json[0])) return cleaned;
		return json[0].filter((part) => Array.isArray(part) && typeof part[0] === "string").map((part) => part[0]).join("").trim() || cleaned;
	} catch {
		return cleaned;
	}
}
async function fetchAnimeInfo(animeId) {
	try {
		const response = await fetch(ANILIST, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify({
				query: `
              query AnimeDetails(
                $id: Int
              ) {
                Media(
                  id: $id
                  type: ANIME
                ) {
                  id

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }

                  description(
                    asHtml: false
                  )

                  episodes

                  season

                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }
                }
              }
            `,
				variables: { id: animeId }
			}),
			signal: AbortSignal.timeout(1e4)
		});
		if (!response.ok) return null;
		const media = (await response.json()).data?.Media;
		if (!media) return null;
		const synopsis = await translateSynopsis(media.description ?? "");
		return {
			id: String(media.id),
			name: titleOf(media),
			image: media.coverImage?.extraLarge || media.coverImage?.large || "",
			synopsis,
			season: formatAnimeSeason(media.season, media.seasonYear),
			releaseDate: formatAnimeDate(media.startDate),
			episodes: media.episodes ?? null
		};
	} catch {
		return null;
	}
}
var Route$17 = createFileRoute("/news_/$id")({
	validateSearch: (search) => ({ page: Math.max(1, Number(search.page) || 1) }),
	loader: async ({ params }) => {
		if (NEWS.find((item) => item.id === params.id)) return {
			automaticNews: [],
			automaticAnime: null,
			isAdultNews: false
		};
		const [adultNews, normalNews] = await Promise.all([fetchAdultNews(), fetchAutomaticNews()]);
		const adultItem = adultNews.find((item) => item.id === params.id);
		const normalItem = normalNews.find((item) => item.id === params.id);
		const isAdultNews = Boolean(adultItem);
		const automaticNews = isAdultNews ? adultNews : normalNews;
		const automaticItem = isAdultNews ? adultItem : normalItem;
		let automaticAnime = null;
		if (automaticItem?.animeId) {
			const animeId = Number(automaticItem.animeId);
			if (Number.isInteger(animeId) && animeId > 0) automaticAnime = await fetchAnimeInfo(animeId);
		}
		return {
			automaticNews,
			automaticAnime,
			isAdultNews
		};
	},
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./news_.search-DsILXKiV.mjs");
var Route$16 = createFileRoute("/news_/search")({
	validateSearch: (search) => ({
		q: typeof search.q === "string" ? search.q : "",
		page: Math.max(1, Number(search.page) || 1)
	}),
	loader: async () => {
		return await fetchAutomaticNews();
	},
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./profile._nick-Btr5FtVl.mjs");
var Route$15 = createFileRoute("/profile/$nick")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./watch._id-_CGbP5_Q.mjs");
var Route$14 = createFileRoute("/watch/$id")({
	validateSearch: (raw) => ({
		ep: typeof raw.ep === "string" && raw.ep ? raw.ep : void 0,
		comment: typeof raw.comment === "string" && raw.comment ? raw.comment : void 0
	}),
	loader: async ({ params }) => {
		if (params.id.startsWith("local-")) return { remote: null };
		return { remote: await fetchAnimeDetail({ data: { id: params.id } }) };
	},
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./watch._id-gif-Dy6faRqU.mjs");
var Route$13 = createFileRoute("/watch/$id-gif")({
	validateSearch: (raw) => ({
		ep: typeof raw.ep === "string" && raw.ep ? raw.ep : void 0,
		comment: typeof raw.comment === "string" && raw.comment ? raw.comment : void 0
	}),
	loader: async ({ params }) => {
		if (params.id.startsWith("local-")) return { remote: null };
		return { remote: await fetchAnimeDetail({ data: { id: params.id } }) };
	},
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./watch._id-imagem-corrigida-CIoRkyNG.mjs");
var Route$12 = createFileRoute("/watch/$id-imagem-corrigida")({
	validateSearch: (raw) => ({
		ep: typeof raw.ep === "string" && raw.ep ? raw.ep : void 0,
		comment: typeof raw.comment === "string" && raw.comment ? raw.comment : void 0
	}),
	loader: async ({ params }) => {
		if (params.id.startsWith("local-")) return { remote: null };
		return { remote: await fetchAnimeDetail({ data: { id: params.id } }) };
	},
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var REPORT_REASON_LABELS$1 = {
	spam: "Spam",
	hate: "Ódio ou discurso de ódio",
	spoiler: "Spoiler não marcado",
	sexual: "Conteúdo sexual",
	harassment: "Assédio",
	other: "Outro"
};
var Route$11 = createFileRoute("/api/admin/comment-reports")({ server: { handlers: {
	GET: async ({ request }) => {
		try {
			const session = await auth.api.getSession({ headers: request.headers });
			const email = session?.user?.email ?? null;
			if (!session?.user?.id || !isHikariAdmin(email)) return Response.json({ error: "Acesso permitido somente ao administrador." }, { status: 403 });
			const result = await (await getSql()).query(`
              select
                c."id" as "commentId",
                c."animeId",
                c."episodeId",
                c."content",
                c."parentId",
                c."isSpoiler",
                c."createdAt",
                c."updatedAt",

                u."id" as "userId",
                coalesce(
                  u."name",
                  'Usuário'
                ) as "userName",
                u."email" as "userEmail",
                u."image" as "userImage",

                count(cr."id")::int as "reportCount",

                min(cr."createdAt") as "firstReportedAt",

                array_agg(
                  distinct cr."reason"
                ) as "reasons"

              from "comment_report" cr

              inner join "comment" c
                on c."id" = cr."commentId"

              left join "user" u
                on u."id" = c."userId"

              where cr."status" = 'pending'

              group by
                c."id",
                c."animeId",
                c."episodeId",
                c."content",
                c."parentId",
                c."isSpoiler",
                c."createdAt",
                c."updatedAt",
                u."id",
                u."name",
                u."email",
                u."image"

              order by
                min(cr."createdAt") desc
            `);
			const reports = (Array.isArray(result) ? result : result?.rows ?? []).map((row) => ({
				commentId: row.commentId,
				animeId: row.animeId,
				episodeId: row.episodeId,
				content: row.content,
				parentId: row.parentId,
				isSpoiler: Boolean(row.isSpoiler),
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				userId: row.userId,
				userName: row.userName || "Usuário",
				userEmail: row.userEmail ?? null,
				userImage: row.userImage ?? null,
				reportCount: Number(row.reportCount ?? 0) || 0,
				firstReportedAt: row.firstReportedAt,
				reasons: Array.isArray(row.reasons) ? row.reasons.map((reason) => ({
					value: String(reason),
					label: REPORT_REASON_LABELS$1[String(reason)] ?? String(reason)
				})) : []
			}));
			return Response.json({ reports });
		} catch (error) {
			console.error("ERRO REAL AO LISTAR DENÚNCIAS:", error);
			return Response.json({ error: "Não foi possível carregar as denúncias." }, { status: 500 });
		}
	},
	POST: async ({ request }) => {
		try {
			const session = await auth.api.getSession({ headers: request.headers });
			const email = session?.user?.email ?? null;
			if (!session?.user?.id || !isHikariAdmin(email)) return Response.json({ error: "Acesso permitido somente ao administrador." }, { status: 403 });
			let body;
			try {
				body = await request.json();
			} catch {
				return Response.json({ error: "JSON inválido." }, { status: 400 });
			}
			const commentId = typeof body.commentId === "string" ? body.commentId.trim() : "";
			const action = typeof body.action === "string" ? body.action.trim() : "";
			if (!commentId) return Response.json({ error: "commentId é obrigatório." }, { status: 400 });
			if (action !== "resolve" && action !== "delete") return Response.json({ error: "Ação inválida." }, { status: 400 });
			const sql = await getSql();
			const commentResult = await sql.query(`
                select
                  "id"
                from "comment"
                where "id" = $1
                limit 1
              `, [commentId]);
			if ((Array.isArray(commentResult) ? commentResult : commentResult?.rows ?? []).length === 0) return Response.json({ error: "Comentário não encontrado." }, { status: 404 });
			if (action === "resolve") {
				await sql.query(`
                update "comment_report"
                set
                  "status" = 'resolved',
                  "resolvedAt" = CURRENT_TIMESTAMP,
                  "resolvedBy" = $2
                where "commentId" = $1
                  and "status" = 'pending'
              `, [commentId, session.user.id]);
				return Response.json({
					success: true,
					action: "resolve"
				});
			}
			if (action === "delete") {
				await sql.query(`
                delete from "comment"
                where "id" = $1
              `, [commentId]);
				return Response.json({
					success: true,
					action: "delete"
				});
			}
			return Response.json({ error: "Ação não processada." }, { status: 400 });
		} catch (error) {
			console.error("ERRO REAL NA MODERAÇÃO ADMINISTRATIVA:", error);
			const message = error instanceof Error ? error.message : String(error);
			return Response.json({
				error: "Não foi possível realizar a ação.",
				details: message
			}, { status: 500 });
		}
	}
} } });
var Route$10 = createFileRoute("/api/auth/$")({ server: { handlers: {
	GET: ({ request }) => auth.handler(request),
	POST: ({ request }) => auth.handler(request)
} } });
var Route$9 = createFileRoute("/api/comments/")({ server: { handlers: {
	GET: async ({ request }) => {
		try {
			const url = new URL(request.url);
			const animeId = url.searchParams.get("animeId");
			const episodeId = url.searchParams.get("episodeId");
			if (!animeId || !episodeId) return Response.json({ error: "animeId e episodeId são obrigatórios." }, { status: 400 });
			const sql = await getSql();
			const session = await auth.api.getSession({ headers: request.headers });
			const currentUserId = session?.user?.id ?? null;
			const isAdmin = isHikariAdmin(session?.user?.email);
			const result = await sql.query(`
              select
                c."id",
                c."animeId",
                c."episodeId",
                c."content",
                c."imageUrl",
                c."parentId",
                c."isSpoiler",
                c."createdAt",
                c."updatedAt",
                c."userId",

                coalesce(
                  u."name",
                  'Usuário'
                ) as "userName",

                u."image" as "userImage",

                (
                  select count(*)::int
                  from "comment_like" cl
                  where cl."commentId" = c."id"
                ) as "likes",

                ${currentUserId ? `
                      exists (
                        select 1
                        from "comment_like" cl2
                        where cl2."commentId" = c."id"
                          and cl2."userId" = $3
                      ) as "liked"
                    ` : `
                      false as "liked"
                    `}

              from "comment" c

              left join "user" u
                on u."id" = c."userId"

              where c."animeId" = $1
                and c."episodeId" = $2

              order by c."createdAt" desc
            `, currentUserId ? [
				animeId,
				episodeId,
				currentUserId
			] : [animeId, episodeId]);
			const normalizedComments = (Array.isArray(result) ? result : result?.rows ?? []).map((comment) => ({
				...comment,
				likes: Number(comment.likes ?? 0) || 0,
				liked: Boolean(comment.liked),
				imageUrl: typeof comment.imageUrl === "string" ? comment.imageUrl : null
			}));
			console.log("COMENTÁRIOS ENCONTRADOS:", normalizedComments.length);
			return Response.json({
				comments: normalizedComments,
				currentUserId,
				isAdmin
			});
		} catch (error) {
			console.error("ERRO REAL AO BUSCAR COMENTÁRIOS:", error);
			return Response.json({ error: "Não foi possível carregar os comentários." }, { status: 500 });
		}
	},
	POST: async ({ request }) => {
		try {
			const session = await auth.api.getSession({ headers: request.headers });
			if (!session?.user?.id) return Response.json({ error: "Você precisa estar logado para comentar." }, { status: 401 });
			console.log("SESSÃO DO COMENTÁRIO:", {
				userId: session.user.id,
				userName: session.user.name
			});
			const body = await request.json();
			const animeId = typeof body.animeId === "string" ? body.animeId.trim() : "";
			const episodeId = typeof body.episodeId === "string" ? body.episodeId.trim() : "";
			const content = typeof body.content === "string" ? body.content.trim() : "";
			const parentId = typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;
			const isSpoiler = typeof body.isSpoiler === "boolean" ? body.isSpoiler : false;
			const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
			if (!animeId || !episodeId || !content && !imageUrl) return Response.json({ error: "É necessário escrever um comentário ou enviar uma imagem." }, { status: 400 });
			if (content.length > 2e3) return Response.json({ error: "O comentário pode ter no máximo 2000 caracteres." }, { status: 400 });
			const sql = await getSql();
			let parentCommentOwnerId = null;
			if (parentId) {
				const parentResult = await sql.query(`
                  select
                    "id",
                    "userId"

                  from "comment"

                  where "id" = $1
                    and "animeId" = $2
                    and "episodeId" = $3

                  limit 1
                `, [
					parentId,
					animeId,
					episodeId
				]);
				const parentRows = Array.isArray(parentResult) ? parentResult : parentResult?.rows ?? [];
				if (parentRows.length === 0) return Response.json({ error: "Comentário original não encontrado." }, { status: 400 });
				parentCommentOwnerId = parentRows[0]?.userId ?? null;
			}
			const id = crypto.randomUUID();
			await sql.query(`
              insert into "comment" (
                "id",
                "userId",
                "animeId",
                "episodeId",
                "content",
                "imageUrl",
                "parentId",
                "isSpoiler"
              )

              values (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8
              )
            `, [
				id,
				session.user.id,
				animeId,
				episodeId,
				content,
				imageUrl,
				parentId,
				isSpoiler
			]);
			if (parentId && parentCommentOwnerId && parentCommentOwnerId !== session.user.id) try {
				const notificationId = crypto.randomUUID();
				const actorName = session.user.name ?? "Alguém";
				await sql.query(`
                  insert into "notification" (
                    "id",
                    "userId",
                    "actorId",
                    "type",
                    "message",
                    "commentId",
                    "animeId",
                    "episodeId"
                  )

                  values (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                  )
                `, [
					notificationId,
					parentCommentOwnerId,
					session.user.id,
					"comment_reply",
					`${actorName} respondeu seu comentário.`,
					parentId,
					animeId,
					episodeId
				]);
				console.log("NOTIFICAÇÃO DE RESPOSTA CRIADA:", {
					notificationId,
					commentId: parentId,
					animeId,
					episodeId
				});
			} catch (notificationError) {
				console.error("ERRO AO CRIAR NOTIFICAÇÃO DE RESPOSTA:", notificationError);
			}
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const comment = {
				id,
				animeId,
				episodeId,
				content,
				imageUrl,
				parentId,
				isSpoiler,
				createdAt: now,
				updatedAt: now,
				userId: session.user.id,
				userName: session.user.name || "Usuário",
				userImage: session.user.image || null,
				likes: 0,
				liked: false
			};
			console.log("COMENTÁRIO CRIADO COM SUCESSO:", comment.id);
			return Response.json({ comment }, { status: 201 });
		} catch (error) {
			console.error("ERRO REAL AO CRIAR COMENTÁRIO:", error);
			return Response.json({ error: "Não foi possível criar o comentário." }, { status: 500 });
		}
	}
} } });
var Route$8 = createFileRoute("/api/comments/edit")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user?.id) return Response.json({ error: "Você precisa estar logado." }, { status: 401 });
		let body;
		try {
			body = await request.json();
		} catch {
			return Response.json({ error: "JSON inválido." }, { status: 400 });
		}
		const commentId = typeof body.commentId === "string" ? body.commentId.trim() : "";
		const action = typeof body.action === "string" ? body.action.trim() : "";
		const content = typeof body.content === "string" ? body.content.trim() : "";
		const isSpoiler = typeof body.isSpoiler === "boolean" ? body.isSpoiler : false;
		if (!commentId) return Response.json({ error: "commentId é obrigatório." }, { status: 400 });
		if (action !== "edit" && action !== "delete") return Response.json({ error: "Ação inválida." }, { status: 400 });
		if (action === "edit" && !content) return Response.json({ error: "O comentário não pode ficar vazio." }, { status: 400 });
		if (action === "edit" && content.length > 2e3) return Response.json({ error: "O comentário pode ter no máximo 2000 caracteres." }, { status: 400 });
		const sql = await getSql();
		const commentResult = await sql.query(`
                select
                  "id",
                  "userId"
                from "comment"
                where "id" = $1
                limit 1
              `, [commentId]);
		const commentRows = Array.isArray(commentResult) ? commentResult : commentResult?.rows ?? [];
		if (commentRows.length === 0) return Response.json({ error: "Comentário não encontrado." }, { status: 404 });
		const isOwner = commentRows[0].userId === session.user.id;
		const isAdmin = isHikariAdmin(session.user.email);
		if (!isOwner && !isAdmin) return Response.json({ error: "Você não tem permissão para alterar este comentário." }, { status: 403 });
		if (action === "edit") {
			await sql.query(`
                update "comment"
                set
                  "content" = $1,
                  "isSpoiler" = $2,
                  "updatedAt" = CURRENT_TIMESTAMP
                where "id" = $3
              `, [
				content,
				isSpoiler,
				commentId
			]);
			const updatedResult = await sql.query(`
                  select
                    c."id",
                    c."animeId",
                    c."episodeId",
                    c."content",
                    c."parentId",
                    c."isSpoiler",
                    c."createdAt",
                    c."updatedAt",
                    c."userId",
                    coalesce(
                      u."name",
                      'Usuário'
                    ) as "userName",
                    u."image" as "userImage",
                    (
                      select count(*)::int
                      from "comment_like" cl
                      where cl."commentId" = c."id"
                    ) as "likes"
                  from "comment" c
                  left join "user" u
                    on u."id" = c."userId"
                  where c."id" = $1
                  limit 1
                `, [commentId]);
			const updatedRows = Array.isArray(updatedResult) ? updatedResult : updatedResult?.rows ?? [];
			return Response.json({
				success: true,
				action: "edit",
				comment: updatedRows[0] ?? null
			});
		}
		await sql.query(`
              delete from "comment"
              where "id" = $1
            `, [commentId]);
		return Response.json({
			success: true,
			action: "delete",
			commentId
		});
	} catch (error) {
		console.error("ERRO AO EDITAR/EXCLUIR COMENTÁRIO:", error);
		const message = error instanceof Error ? error.message : String(error);
		return Response.json({
			error: "Não foi possível alterar o comentário.",
			details: message
		}, { status: 500 });
	}
} } } });
var Route$7 = createFileRoute("/api/comments/like")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user?.id) return Response.json({ error: "Você precisa estar logado para curtir." }, { status: 401 });
		const userId = session.user.id;
		let body;
		try {
			body = await request.json();
		} catch {
			return Response.json({ error: "JSON inválido." }, { status: 400 });
		}
		const commentId = typeof body.commentId === "string" ? body.commentId.trim() : "";
		if (!commentId) return Response.json({ error: "commentId é obrigatório." }, { status: 400 });
		const sql = await getSql();
		const commentResult = await sql.query(`
                select
                  "id",
                  "userId",
                  "animeId",
                  "episodeId"
                from "comment"
                where "id" = $1
                limit 1
              `, [commentId]);
		const commentRows = Array.isArray(commentResult) ? commentResult : commentResult?.rows ?? [];
		if (commentRows.length === 0) return Response.json({ error: "Comentário não encontrado." }, { status: 404 });
		const comment = commentRows[0];
		const commentOwnerId = comment?.userId ?? null;
		const animeId = comment?.animeId ?? null;
		const episodeId = comment?.episodeId ?? null;
		const existingLikeResult = await sql.query(`
                select
                  "id"
                from "comment_like"
                where
                  "commentId" = $1
                  and
                  "userId" = $2
                limit 1
              `, [commentId, userId]);
		if ((Array.isArray(existingLikeResult) ? existingLikeResult : existingLikeResult?.rows ?? []).length > 0) {
			await sql.query(`
                delete from "comment_like"
                where
                  "commentId" = $1
                  and
                  "userId" = $2
              `, [commentId, userId]);
			const countResult = await sql.query(`
                  select
                    count(*)::int as "count"
                  from "comment_like"
                  where
                    "commentId" = $1
                `, [commentId]);
			const countRows = Array.isArray(countResult) ? countResult : countResult?.rows ?? [];
			const likes = Number(countRows[0]?.count ?? 0);
			return Response.json({
				liked: false,
				likes
			});
		}
		const likeId = crypto.randomUUID();
		await sql.query(`
              insert into "comment_like" (
                "id",
                "commentId",
                "userId"
              )
              values (
                $1,
                $2,
                $3
              )
            `, [
			likeId,
			commentId,
			userId
		]);
		if (commentOwnerId && commentOwnerId !== userId) try {
			const notificationId = crypto.randomUUID();
			const actorName = session.user.name ?? "Alguém";
			await sql.query(`
                  insert into "notification" (
                    "id",
                    "userId",
                    "actorId",
                    "type",
                    "message",
                    "commentId",
                    "animeId",
                    "episodeId"
                  )
                  values (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                  )
                `, [
				notificationId,
				commentOwnerId,
				userId,
				"comment_like",
				`${actorName} curtiu seu comentário.`,
				commentId,
				animeId,
				episodeId
			]);
			console.log("NOTIFICAÇÃO DE CURTIDA CRIADA:", {
				notificationId,
				commentId,
				animeId,
				episodeId
			});
		} catch (notificationError) {
			console.error("ERRO AO CRIAR NOTIFICAÇÃO DE CURTIDA:", notificationError);
		}
		const countResult = await sql.query(`
                select
                  count(*)::int as "count"
                from "comment_like"
                where
                  "commentId" = $1
              `, [commentId]);
		const countRows = Array.isArray(countResult) ? countResult : countResult?.rows ?? [];
		const likes = Number(countRows[0]?.count ?? 0);
		return Response.json({
			liked: true,
			likes
		});
	} catch (error) {
		console.error("ERRO REAL AO CURTIR COMENTÁRIO:", error);
		const message = error instanceof Error ? error.message : String(error);
		return Response.json({
			error: "Não foi possível alterar a curtida.",
			details: message
		}, { status: 500 });
	}
} } } });
var REPORT_REASONS = [
	"spam",
	"hate",
	"spoiler",
	"sexual",
	"harassment",
	"other"
];
var Route$6 = createFileRoute("/api/comments/moderation")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user?.id) return Response.json({ error: "Você precisa estar logado para realizar esta ação." }, { status: 401 });
		let body;
		try {
			body = await request.json();
		} catch {
			return Response.json({ error: "JSON inválido." }, { status: 400 });
		}
		const commentId = typeof body.commentId === "string" ? body.commentId.trim() : "";
		const action = typeof body.action === "string" ? body.action.trim() : "";
		const reason = typeof body.reason === "string" ? body.reason.trim() : "";
		if (!commentId) return Response.json({ error: "commentId é obrigatório." }, { status: 400 });
		if (action !== "spoiler" && action !== "report" && action !== "spam") return Response.json({ error: "Ação de moderação inválida." }, { status: 400 });
		const sql = await getSql();
		const commentResult = await sql.query(`
                select
                  "id"
                from "comment"
                where "id" = $1
                limit 1
              `, [commentId]);
		if ((Array.isArray(commentResult) ? commentResult : commentResult?.rows ?? []).length === 0) return Response.json({ error: "Comentário não encontrado." }, { status: 404 });
		if (action === "spoiler") {
			await sql.query(`
                update "comment"
                set
                  "isSpoiler" = true,
                  "updatedAt" = CURRENT_TIMESTAMP
                where "id" = $1
              `, [commentId]);
			return Response.json({
				success: true,
				action: "spoiler"
			});
		}
		if (action === "spam") {
			const existingResult = await sql.query(`
                  select
                    "id"
                  from "comment_report"
                  where "commentId" = $1
                    and "userId" = $2
                  limit 1
                `, [commentId, session.user.id]);
			if ((Array.isArray(existingResult) ? existingResult : existingResult?.rows ?? []).length === 0) await sql.query(`
                  insert into "comment_report" (
                    "id",
                    "commentId",
                    "userId",
                    "reason"
                  )
                  values (
                    $1,
                    $2,
                    $3,
                    $4
                  )
                `, [
				crypto.randomUUID(),
				commentId,
				session.user.id,
				"spam"
			]);
			return Response.json({
				success: true,
				action: "spam"
			});
		}
		if (action === "report") {
			if (!REPORT_REASONS.includes(reason)) return Response.json({ error: "Motivo da denúncia inválido." }, { status: 400 });
			const existingResult = await sql.query(`
                  select
                    "id"
                  from "comment_report"
                  where "commentId" = $1
                    and "userId" = $2
                  limit 1
                `, [commentId, session.user.id]);
			if ((Array.isArray(existingResult) ? existingResult : existingResult?.rows ?? []).length > 0) return Response.json({
				success: true,
				action: "report",
				alreadyReported: true
			});
			await sql.query(`
                insert into "comment_report" (
                  "id",
                  "commentId",
                  "userId",
                  "reason"
                )
                values (
                  $1,
                  $2,
                  $3,
                  $4
                )
              `, [
				crypto.randomUUID(),
				commentId,
				session.user.id,
				reason
			]);
			return Response.json({
				success: true,
				action: "report"
			});
		}
		return Response.json({ error: "Ação não processada." }, { status: 400 });
	} catch (error) {
		console.error("ERRO REAL NA MODERAÇÃO DO COMENTÁRIO:", error);
		const message = error instanceof Error ? error.message : String(error);
		return Response.json({
			error: "Não foi possível realizar esta ação.",
			details: message
		}, { status: 500 });
	}
} } } });
var Route$5 = createFileRoute("/api/comments/upload-image")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const sessionResponse = await fetch(new URL("/api/auth/get-session", request.url), {
			method: "GET",
			headers: { cookie: request.headers.get("cookie") ?? "" }
		});
		if (!sessionResponse.ok) return Response.json({ error: "Você precisa estar logado para enviar uma imagem." }, { status: 401 });
		const userId = (await sessionResponse.json())?.user?.id;
		if (!userId) return Response.json({ error: "Você precisa estar logado para enviar uma imagem." }, { status: 401 });
		const file = (await request.formData()).get("file");
		if (!(file instanceof File)) return Response.json({ error: "Nenhuma imagem foi enviada." }, { status: 400 });
		if (![
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/gif"
		].includes(file.type)) return Response.json({ error: "Formato de imagem não permitido. Use JPG, PNG, WEBP ou GIF." }, { status: 400 });
		if (file.size > 5242880) return Response.json({ error: "A imagem pode ter no máximo 5 MB." }, { status: 400 });
		const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
		const safeExtension = [
			"jpg",
			"jpeg",
			"png",
			"webp",
			"gif"
		].includes(extension) ? extension : "jpg";
		const filename = `hikari/comments/${userId}/${crypto.randomUUID()}.${safeExtension}`;
		const blob = await put(filename, file, {
			access: "public",
			addRandomSuffix: false,
			contentType: file.type
		});
		return Response.json({
			success: true,
			url: blob.url
		}, { status: 200 });
	} catch (error) {
		console.error("ERRO AO ENVIAR IMAGEM DO COMENTÁRIO:", error);
		return Response.json({ error: "Não foi possível enviar a imagem." }, { status: 500 });
	}
} } } });
var Route$4 = createFileRoute("/api/profile/follow")({ server: { handlers: { POST: async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return json({ error: "Você precisa estar conectado." }, { status: 401 });
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: "Dados inválidos." }, { status: 400 });
	}
	const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
	if (!targetUserId) return json({ error: "Usuário alvo não informado." }, { status: 400 });
	const currentUserId = session.user.id;
	if (targetUserId === currentUserId) return json({ error: "Você não pode seguir a si mesmo." }, { status: 400 });
	const sql = await getSql();
	if ((await sql`
            select "id"
            from "user"
            where "id" =
              ${targetUserId}
            limit 1
          `).length === 0) return json({ error: "Usuário não encontrado." }, { status: 404 });
	const existing = await sql`
            select
              "followerId",
              "followingId"
            from "user_follow"
            where
              "followerId" =
                ${currentUserId}
              and
              "followingId" =
                ${targetUserId}
            limit 1
          `;
	let following = false;
	let notificationCreated = false;
	let notificationError = null;
	if (existing.length > 0) {
		await sql`
            delete from "user_follow"
            where
              "followerId" =
                ${currentUserId}
              and
              "followingId" =
                ${targetUserId}
          `;
		following = false;
	} else {
		await sql`
            insert into "user_follow" (
              "followerId",
              "followingId"
            )
            values (
              ${currentUserId},
              ${targetUserId}
            )
            on conflict (
              "followerId",
              "followingId"
            )
            do nothing
          `;
		following = true;
		try {
			await sql`
              insert into "notification" (
                "id",
                "userId",
                "actorId",
                "type",
                "message"
              )
              values (
                ${crypto.randomUUID()},
                ${targetUserId},
                ${currentUserId},
                'follow',
                ${session.user.name ?? "Alguém"} || ' começou a seguir você.'
              )
            `;
			notificationCreated = true;
		} catch (error) {
			notificationCreated = false;
			notificationError = error instanceof Error ? error.message : String(error);
		}
	}
	const followerRows = await sql`
            select count(*)::text as count
            from "user_follow"
            where
              "followingId" =
                ${targetUserId}
          `;
	const followingRows = await sql`
            select count(*)::text as count
            from "user_follow"
            where
              "followerId" =
                ${targetUserId}
          `;
	return json({
		following,
		followersCount: Number(followerRows[0]?.count ?? "0"),
		followingCount: Number(followingRows[0]?.count ?? "0"),
		notificationCreated,
		notificationError
	});
} } } });
var Route$3 = createFileRoute("/api/users/search")({ server: { handlers: { GET: async ({ request }) => {
	try {
		const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
		if (!q) return Response.json({ users: [] });
		if (q.length > 100) return Response.json({ error: "A busca é muito longa." }, { status: 400 });
		const result = await (await getSql()).query(`
                select
                  "id",
                  "name",
                  "image"
                from "user"
                where
                  "name" ilike $1
                order by
                  "name" asc
                limit 20
              `, [`%${q}%`]);
		const users = (Array.isArray(result) ? result : result?.rows ?? []).map((user) => ({
			id: user.id,
			name: user.name || "Usuário",
			image: user.image ?? null
		}));
		return Response.json({ users });
	} catch (error) {
		console.error("ERRO AO BUSCAR USUÁRIOS:", error);
		return Response.json({ error: "Não foi possível buscar usuários." }, { status: 500 });
	}
} } } });
var $$splitComponentImporter = () => import("./settings-player-C2oPvypG.mjs");
var Route$2 = createFileRoute("/src/routes/settings-player")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var Route$1 = createFileRoute("/api/src/routes/api/gifs")({ server: { handlers: { GET: async ({ request }) => {
	try {
		const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
		if (!query) return Response.json({ gifs: [] }, { status: 200 });
		if (query.length > 100) return Response.json({ error: "A busca pode ter no máximo 100 caracteres." }, { status: 400 });
		const apiKey = process.env.GIPHY_API_KEY;
		if (!apiKey) {
			console.error("GIPHY_API_KEY não está configurada.");
			return Response.json({ error: "A busca de GIFs ainda não está configurada." }, { status: 500 });
		}
		const giphyUrl = new URL("https://api.giphy.com/v1/gifs/search");
		giphyUrl.searchParams.set("api_key", apiKey);
		giphyUrl.searchParams.set("q", query);
		giphyUrl.searchParams.set("limit", "24");
		giphyUrl.searchParams.set("offset", "0");
		giphyUrl.searchParams.set("rating", "pg-13");
		giphyUrl.searchParams.set("lang", "pt");
		const response = await fetch(giphyUrl.toString(), { headers: { Accept: "application/json" } });
		if (!response.ok) {
			console.error("Erro da API do GIPHY:", response.status);
			return Response.json({ error: "Não foi possível buscar GIFs." }, { status: 502 });
		}
		const data = await response.json();
		const gifs = Array.isArray(data?.data) ? data.data.map((gif) => {
			const images = gif?.images;
			const preview = images?.fixed_width_small?.url ?? images?.preview_gif?.url ?? null;
			const original = images?.original?.url ?? images?.downsized?.url ?? null;
			if (!preview || !original) return null;
			return {
				id: String(gif.id),
				title: typeof gif.title === "string" ? gif.title : "",
				preview,
				url: original
			};
		}).filter(Boolean) : [];
		return Response.json({ gifs });
	} catch (error) {
		console.error("ERRO REAL AO BUSCAR GIFS:", error);
		return Response.json({ error: "Não foi possível buscar GIFs." }, { status: 500 });
	}
} } } });
var REPORT_REASON_LABELS = {
	spam: "Spam",
	hate: "Ódio ou discurso de ódio",
	spoiler: "Spoiler não marcado",
	sexual: "Conteúdo sexual",
	harassment: "Assédio",
	other: "Outro"
};
var Route = createFileRoute("/api/src/routes/api/admin/comment-reports")({ server: { handlers: {
	GET: async ({ request }) => {
		try {
			const session = await auth.api.getSession({ headers: request.headers });
			const email = session?.user?.email ?? null;
			if (!session?.user?.id || !isHikariAdmin(email)) return Response.json({ error: "Acesso permitido somente ao administrador." }, { status: 403 });
			const result = await (await getSql()).query(`
              select
                c."id" as "commentId",
                c."animeId",
                c."episodeId",
                c."content",
                c."parentId",
                c."isSpoiler",
                c."createdAt",
                c."updatedAt",

                u."id" as "userId",
                coalesce(
                  u."name",
                  'Usuário'
                ) as "userName",
                u."email" as "userEmail",
                u."image" as "userImage",

                count(cr."id")::int as "reportCount",

                min(cr."createdAt") as "firstReportedAt",

                array_agg(
                  distinct cr."reason"
                ) as "reasons"

              from "comment_report" cr

              inner join "comment" c
                on c."id" = cr."commentId"

              left join "user" u
                on u."id" = c."userId"

              where cr."status" = 'pending'

              group by
                c."id",
                c."animeId",
                c."episodeId",
                c."content",
                c."parentId",
                c."isSpoiler",
                c."createdAt",
                c."updatedAt",
                u."id",
                u."name",
                u."email",
                u."image"

              order by
                min(cr."createdAt") desc
            `);
			const reports = (Array.isArray(result) ? result : result?.rows ?? []).map((row) => ({
				commentId: row.commentId,
				animeId: row.animeId,
				episodeId: row.episodeId,
				content: row.content,
				parentId: row.parentId,
				isSpoiler: Boolean(row.isSpoiler),
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				userId: row.userId,
				userName: row.userName || "Usuário",
				userEmail: row.userEmail ?? null,
				userImage: row.userImage ?? null,
				reportCount: Number(row.reportCount ?? 0) || 0,
				firstReportedAt: row.firstReportedAt,
				reasons: Array.isArray(row.reasons) ? row.reasons.map((reason) => ({
					value: String(reason),
					label: REPORT_REASON_LABELS[String(reason)] ?? String(reason)
				})) : []
			}));
			return Response.json({ reports });
		} catch (error) {
			console.error("ERRO REAL AO LISTAR DENÚNCIAS:", error);
			return Response.json({ error: "Não foi possível carregar as denúncias." }, { status: 500 });
		}
	},
	POST: async ({ request }) => {
		try {
			const session = await auth.api.getSession({ headers: request.headers });
			const email = session?.user?.email ?? null;
			if (!session?.user?.id || !isHikariAdmin(email)) return Response.json({ error: "Acesso permitido somente ao administrador." }, { status: 403 });
			let body;
			try {
				body = await request.json();
			} catch {
				return Response.json({ error: "JSON inválido." }, { status: 400 });
			}
			const commentId = typeof body.commentId === "string" ? body.commentId.trim() : "";
			const action = typeof body.action === "string" ? body.action.trim() : "";
			if (!commentId) return Response.json({ error: "commentId é obrigatório." }, { status: 400 });
			if (action !== "resolve" && action !== "delete") return Response.json({ error: "Ação inválida." }, { status: 400 });
			const sql = await getSql();
			const commentResult = await sql.query(`
                select
                  "id"
                from "comment"
                where "id" = $1
                limit 1
              `, [commentId]);
			if ((Array.isArray(commentResult) ? commentResult : commentResult?.rows ?? []).length === 0) return Response.json({ error: "Comentário não encontrado." }, { status: 404 });
			if (action === "resolve") {
				await sql.query(`
                update "comment_report"
                set
                  "status" = 'resolved',
                  "resolvedAt" = CURRENT_TIMESTAMP,
                  "resolvedBy" = $2
                where "commentId" = $1
                  and "status" = 'pending'
              `, [commentId, session.user.id]);
				return Response.json({
					success: true,
					action: "resolve"
				});
			}
			if (action === "delete") {
				await sql.query(`
                delete from "comment"
                where "id" = $1
              `, [commentId]);
				return Response.json({
					success: true,
					action: "delete"
				});
			}
			return Response.json({ error: "Ação não processada." }, { status: 400 });
		} catch (error) {
			console.error("ERRO REAL NA MODERAÇÃO ADMINISTRATIVA:", error);
			const message = error instanceof Error ? error.message : String(error);
			return Response.json({
				error: "Não foi possível realizar a ação.",
				details: message
			}, { status: 500 });
		}
	}
} } });
var IndexRoute = Route$53.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$54
});
var AccountRoute = Route$52.update({
	id: "/account",
	path: "/account",
	getParentRoute: () => Route$54
});
var AdminRoute = Route$51.update({
	id: "/admin",
	path: "/admin",
	getParentRoute: () => Route$54
});
var AdultRoute = Route$50.update({
	id: "/adult",
	path: "/adult",
	getParentRoute: () => Route$54
});
var ApiAnilistRoute = Route$49.update({
	id: "/api-anilist",
	path: "/api-anilist",
	getParentRoute: () => Route$54
});
var CalendarRoute = Route$48.update({
	id: "/calendar",
	path: "/calendar",
	getParentRoute: () => Route$54
});
var LoginRoute = Route$47.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$54
});
var MyListRoute = Route$46.update({
	id: "/my-list",
	path: "/my-list",
	getParentRoute: () => Route$54
});
var NewsRoute = Route$45.update({
	id: "/news",
	path: "/news",
	getParentRoute: () => Route$54
});
var NotificationsRoute = Route$44.update({
	id: "/notifications",
	path: "/notifications",
	getParentRoute: () => Route$54
});
var SearchRoute = Route$43.update({
	id: "/search",
	path: "/search",
	getParentRoute: () => Route$54
});
var SettingsRoute = Route$42.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => Route$54
});
var SettingsAboutRoute = Route$41.update({
	id: "/settings-about",
	path: "/settings-about",
	getParentRoute: () => Route$54
});
var SettingsAccountRoute = Route$40.update({
	id: "/settings-account",
	path: "/settings-account",
	getParentRoute: () => Route$54
});
var SettingsAppearanceRoute = Route$39.update({
	id: "/settings-appearance",
	path: "/settings-appearance",
	getParentRoute: () => Route$54
});
var SettingsNotificationsRoute = Route$38.update({
	id: "/settings-notifications",
	path: "/settings-notifications",
	getParentRoute: () => Route$54
});
var SettingsPlayerRoute = Route$37.update({
	id: "/settings-player",
	path: "/settings-player",
	getParentRoute: () => Route$54
});
var SettingsPrivacyRoute = Route$36.update({
	id: "/settings-privacy",
	path: "/settings-privacy",
	getParentRoute: () => Route$54
});
var SettingsProfileRoute = Route$35.update({
	id: "/settings-profile",
	path: "/settings-profile",
	getParentRoute: () => Route$54
});
var SettingsSecurityRoute = Route$34.update({
	id: "/settings-security",
	path: "/settings-security",
	getParentRoute: () => Route$54
});
var TestAnilistVercelRoute = Route$33.update({
	id: "/test-anilist-vercel",
	path: "/test-anilist-vercel",
	getParentRoute: () => Route$54
});
var TestApiAnilistRoute = Route$32.update({
	id: "/test-api-anilist",
	path: "/test-api-anilist",
	getParentRoute: () => Route$54
});
var AdminIndexRoute = Route$31.update({
	id: "/",
	path: "/",
	getParentRoute: () => AdminRoute
});
var AdminIdRoute = Route$30.update({
	id: "/$id",
	path: "/$id",
	getParentRoute: () => AdminRoute
});
var AdminHikariAiRoute = Route$29.update({
	id: "/hikari-ai",
	path: "/hikari-ai",
	getParentRoute: () => AdminRoute
});
var AdminModerationRoute = Route$28.update({
	id: "/moderation",
	path: "/moderation",
	getParentRoute: () => AdminRoute
});
var AdultIndexRoute = Route$27.update({
	id: "/",
	path: "/",
	getParentRoute: () => AdultRoute
});
var AdultHentaiRoute = Route$26.update({
	id: "/hentai",
	path: "/hentai",
	getParentRoute: () => AdultRoute
});
var AdultRecentRoute = Route$25.update({
	id: "/recent",
	path: "/recent",
	getParentRoute: () => AdultRoute
});
var AdultTagsRoute = Route$24.update({
	id: "/tags",
	path: "/tags",
	getParentRoute: () => AdultRoute
});
var AdultNewsRoute = Route$23.update({
	id: "/adult_/news",
	path: "/adult/news",
	getParentRoute: () => Route$54
});
var AnimeIdRoute = Route$22.update({
	id: "/anime/$id",
	path: "/anime/$id",
	getParentRoute: () => Route$54
});
var ApiNotificationsRoute = Route$21.update({
	id: "/api/notifications",
	path: "/api/notifications",
	getParentRoute: () => Route$54
});
var ApiUploadCommentImageRoute = Route$20.update({
	id: "/api/upload-comment-image",
	path: "/api/upload-comment-image",
	getParentRoute: () => Route$54
});
var ApiUploadVideoRoute = Route$19.update({
	id: "/api/upload-video",
	path: "/api/upload-video",
	getParentRoute: () => Route$54
});
var BrowseSectionRoute = Route$18.update({
	id: "/browse/$section",
	path: "/browse/$section",
	getParentRoute: () => Route$54
});
var NewsIdRoute = Route$17.update({
	id: "/news_/$id",
	path: "/news/$id",
	getParentRoute: () => Route$54
});
var NewsSearchRoute = Route$16.update({
	id: "/news_/search",
	path: "/news/search",
	getParentRoute: () => Route$54
});
var ProfileNickRoute = Route$15.update({
	id: "/profile/$nick",
	path: "/profile/$nick",
	getParentRoute: () => Route$54
});
var WatchIdRoute = Route$14.update({
	id: "/watch/$id",
	path: "/watch/$id",
	getParentRoute: () => Route$54
});
var WatchIdGifRoute = Route$13.update({
	id: "/watch/$id-gif",
	path: "/watch/$id-gif",
	getParentRoute: () => Route$54
});
var WatchIdImagemCorrigidaRoute = Route$12.update({
	id: "/watch/$id-imagem-corrigida",
	path: "/watch/$id-imagem-corrigida",
	getParentRoute: () => Route$54
});
var ApiAdminCommentReportsRoute = Route$11.update({
	id: "/api/admin/comment-reports",
	path: "/api/admin/comment-reports",
	getParentRoute: () => Route$54
});
var ApiAuthSplatRoute = Route$10.update({
	id: "/api/auth/$",
	path: "/api/auth/$",
	getParentRoute: () => Route$54
});
var ApiCommentsIndexRoute = Route$9.update({
	id: "/api/comments/",
	path: "/api/comments/",
	getParentRoute: () => Route$54
});
var ApiCommentsEditRoute = Route$8.update({
	id: "/api/comments/edit",
	path: "/api/comments/edit",
	getParentRoute: () => Route$54
});
var ApiCommentsLikeRoute = Route$7.update({
	id: "/api/comments/like",
	path: "/api/comments/like",
	getParentRoute: () => Route$54
});
var ApiCommentsModerationRoute = Route$6.update({
	id: "/api/comments/moderation",
	path: "/api/comments/moderation",
	getParentRoute: () => Route$54
});
var ApiCommentsUploadImageRoute = Route$5.update({
	id: "/api/comments/upload-image",
	path: "/api/comments/upload-image",
	getParentRoute: () => Route$54
});
var ApiProfileFollowRoute = Route$4.update({
	id: "/api/profile/follow",
	path: "/api/profile/follow",
	getParentRoute: () => Route$54
});
var ApiUsersSearchRoute = Route$3.update({
	id: "/api/users/search",
	path: "/api/users/search",
	getParentRoute: () => Route$54
});
var SrcRoutesSettingsPlayerRoute = Route$2.update({
	id: "/src/routes/settings-player",
	path: "/src/routes/settings-player",
	getParentRoute: () => Route$54
});
var ApiSrcRoutesApiGifsRoute = Route$1.update({
	id: "/api/src/routes/api/gifs",
	path: "/api/src/routes/api/gifs",
	getParentRoute: () => Route$54
});
var ApiSrcRoutesApiAdminCommentReportsRoute = Route.update({
	id: "/api/src/routes/api/admin/comment-reports",
	path: "/api/src/routes/api/admin/comment-reports",
	getParentRoute: () => Route$54
});
var AdminRouteChildren = {
	AdminIdRoute,
	AdminHikariAiRoute,
	AdminModerationRoute,
	AdminIndexRoute
};
var AdminRouteWithChildren = AdminRoute._addFileChildren(AdminRouteChildren);
var AdultRouteChildren = {
	AdultHentaiRoute,
	AdultRecentRoute,
	AdultTagsRoute,
	AdultIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	AccountRoute,
	AdminRoute: AdminRouteWithChildren,
	AdultRoute: AdultRoute._addFileChildren(AdultRouteChildren),
	ApiAnilistRoute,
	CalendarRoute,
	LoginRoute,
	MyListRoute,
	NewsRoute,
	NotificationsRoute,
	SearchRoute,
	SettingsRoute,
	SettingsAboutRoute,
	SettingsAccountRoute,
	SettingsAppearanceRoute,
	SettingsNotificationsRoute,
	SettingsPlayerRoute,
	SettingsPrivacyRoute,
	SettingsProfileRoute,
	SettingsSecurityRoute,
	TestAnilistVercelRoute,
	TestApiAnilistRoute,
	AdultNewsRoute,
	AnimeIdRoute,
	ApiNotificationsRoute,
	ApiUploadCommentImageRoute,
	ApiUploadVideoRoute,
	BrowseSectionRoute,
	NewsIdRoute,
	NewsSearchRoute,
	ProfileNickRoute,
	WatchIdRoute,
	WatchIdGifRoute,
	WatchIdImagemCorrigidaRoute,
	ApiAdminCommentReportsRoute,
	ApiAuthSplatRoute,
	ApiCommentsEditRoute,
	ApiCommentsLikeRoute,
	ApiCommentsModerationRoute,
	ApiCommentsUploadImageRoute,
	ApiProfileFollowRoute,
	ApiUsersSearchRoute,
	SrcRoutesSettingsPlayerRoute,
	ApiCommentsIndexRoute,
	ApiSrcRoutesApiGifsRoute,
	ApiSrcRoutesApiAdminCommentReportsRoute
};
var routeTree = Route$54._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { getMyComments as A, useServerFn as B, SearchPending as C, HomePending as D, Route$53 as E, getPublicProfile as F, AnimeCard as H, updateProfile as I, useCurrentUserState as L, getProfileFollowers as M, getProfileFollowing as N, mergeDetail as O, getPublicComments as P, isHikariAdmin as R, Route$43 as S, Route$48 as T, AnimeCardSkeleton as U, fetchAutomaticNews as V, searchCatalog as W, Route$30 as _, Route$15 as a, Route$39 as b, NEWS as c, Route$23 as d, Route$24 as f, AdultPending as g, Route$27 as h, Route$14 as i, getProfile as j, overlayList as k, Route$18 as l, Route$26 as m, Route$12 as n, Route$16 as o, Route$25 as p, Route$13 as r, Route$17 as s, router_exports as t, Route$22 as u, Route$32 as v, Route$45 as w, Route$40 as x, Route$33 as y, Logo as z };
