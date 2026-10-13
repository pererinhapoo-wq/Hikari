import { a as useHikariStore } from "./types-CX6YV1cu.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { D as HomePending, E as Route$53, k as overlayList } from "./router-Dx2-dd95.mjs";
import { n as Hero, t as AnimeRow } from "./anime-row-BZo2B4Vc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Dyxqheps.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/index.tsx?tsr-split=component";
function Home() {
	const data = Route$53.useLoaderData();
	const locals = useHikariStore((s) => s.animes);
	const trending = overlayList(data.trending, locals);
	const popular = overlayList(data.popular, locals);
	const top = overlayList(data.top, locals);
	const season = overlayList(data.season, locals);
	const featured = trending[0] ?? popular[0];
	const featuredItems = [...trending, ...popular.filter((a) => !trending.some((t) => t.id === a.id))].slice(0, 6);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-5 pb-5 sm:space-y-8",
		children: [
			featured ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Hero, {
				anime: featured,
				animes: featuredItems
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 17,
				columnNumber: 19
			}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(HomePending, {}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 17,
				columnNumber: 70
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeRow, {
				title: `Temporada ${data.seasonName} ${data.seasonYear}`,
				href: "/browse/season",
				items: season
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 19,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeRow, {
				title: "Populares",
				href: "/browse/popular",
				items: popular
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 21,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeRow, {
				title: "Mais bem avaliados",
				href: "/browse/top",
				items: top
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 23,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeRow, {
				title: "Em alta",
				href: "/browse/trending",
				items: trending.slice(1)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 25,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "pt-4 text-center text-[11px] text-subtle",
				children: [
					"Fonte:",
					" ",
					data.source === "anilist" ? "AniList" : "MyAnimeList / Jikan"
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 27,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 16,
		columnNumber: 10
	}, this);
}
//#endregion
export { Home as component };
