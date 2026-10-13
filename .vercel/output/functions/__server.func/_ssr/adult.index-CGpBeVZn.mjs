import { a as useHikariStore } from "./types-CX6YV1cu.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { g as AdultPending, h as Route$27, k as overlayList } from "./router-BPjBsLK8.mjs";
import { n as Hero, t as AnimeRow } from "./anime-row-BZo2B4Vc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/adult.index-CGpBeVZn.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/adult.index.tsx?tsr-split=component";
function AdultPage() {
	const data = Route$27.useLoaderData();
	const locals = useHikariStore((s) => s.animes);
	const items = overlayList(data.items, locals);
	const recentItems = overlayList(data.recentItems ?? [], locals);
	const featured = items[0];
	const featuredItems = items.slice(0, 6);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-5 pb-5 sm:space-y-8",
		children: [featured ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Hero, {
			anime: featured,
			animes: featuredItems
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 15,
			columnNumber: 19
		}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AdultPending, {}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 15,
			columnNumber: 70
		}, this), items.length > 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "[&_.rail>*]:min-w-[135px]",
			children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeRow, {
				title: "Novos episódios",
				href: "/adult/recent",
				items: recentItems
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 19,
				columnNumber: 13
			}, this)
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 18,
			columnNumber: 11
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeRow, {
			title: "Hentai",
			href: "/adult/hentai",
			items
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 22,
			columnNumber: 11
		}, this)] }, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 17,
			columnNumber: 27
		}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "rounded-xl bg-surface p-8 text-center shadow-[var(--shadow-border)]",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "font-display text-xl",
				children: "Nenhum anime encontrado"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 24,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-2 text-sm text-muted",
				children: "A lista de conteúdo +18 está vazia."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 28,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 23,
			columnNumber: 15
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 14,
		columnNumber: 10
	}, this);
}
//#endregion
export { AdultPage as component };
