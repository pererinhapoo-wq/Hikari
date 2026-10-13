import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore, r as localToAnime } from "./types-CX6YV1cu.mjs";
import { vt as Bookmark } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { H as AnimeCard } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/my-list-B-cYeoOC.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/my-list.tsx?tsr-split=component";
function MyListPage() {
	const myList = useHikariStore((s) => s.myList);
	const snapshots = useHikariStore((s) => s.snapshots);
	const animes = useHikariStore((s) => s.animes);
	const hydrated = useHikariStore((s) => s.hydrated);
	const items = myList.map((id) => {
		if (snapshots[id]) return snapshots[id];
		const local = animes.find((a) => a.id === id);
		return local ? localToAnime(local) : null;
	}).filter((a) => Boolean(a));
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 pt-6",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("header", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
			className: "text-[11px] tracking-[0.28em] text-muted uppercase",
			children: "Salvos neste dispositivo"
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 18,
			columnNumber: 9
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
			className: "font-display text-3xl tracking-tight",
			children: "Minha Lista"
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 22,
			columnNumber: 9
		}, this)] }, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 17,
			columnNumber: 7
		}, this), !hydrated ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6",
			children: Array.from({ length: 6 }, (_, i) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "aspect-2/3 animate-pulse rounded-xl bg-elevated" }, i, false, {
				fileName: _jsxFileName,
				lineNumber: 30,
				columnNumber: 20
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 27,
			columnNumber: 20
		}, this) : items.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex flex-col items-center py-20 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bookmark, { className: "size-8 text-subtle" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 32,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-4 font-display text-2xl",
					children: "Sua lista está vazia"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 34,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-2 max-w-sm text-sm text-muted",
					children: "Toque no marcador de qualquer capa para guardar títulos e continuar depois."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 38,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/search",
					className: "mt-6 text-sm text-fg underline",
					children: "Explorar o catálogo"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 43,
					columnNumber: 11
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 31,
			columnNumber: 39
		}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "\n            grid\n            grid-cols-2\n            gap-4\n            sm:grid-cols-4\n            lg:grid-cols-6\n            [&>article]:w-full\n          ",
			children: items.map((anime) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCard, { anime }, anime.id, false, {
				fileName: _jsxFileName,
				lineNumber: 54,
				columnNumber: 31
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 46,
			columnNumber: 18
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 16,
		columnNumber: 10
	}, this);
}
//#endregion
export { MyListPage as component };
