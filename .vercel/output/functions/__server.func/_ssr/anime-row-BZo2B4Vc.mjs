import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore, n as displayTitle } from "./types-CX6YV1cu.mjs";
import { c as scoreLabel, s as genreLabel } from "./labels-BsexCKFj.mjs";
import { A as Play, ut as ChevronRight, vt as Bookmark, yt as BookmarkCheck } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { H as AnimeCard, U as AnimeCardSkeleton } from "./router-BPjBsLK8.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
import { t as Badge } from "./badge-Dg3McsuO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/anime-row-BZo2B4Vc.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName$1 = "/app/applet/src/components/hero.tsx";
function Hero({ anime, animes = [anime] }) {
	const [index, setIndex] = (0, import_react.useState)(0);
	const [visibleBackdrop, setVisibleBackdrop] = (0, import_react.useState)(anime.cover || anime.banner || "");
	const [isLandscape, setIsLandscape] = (0, import_react.useState)(false);
	const [imageRatio, setImageRatio] = (0, import_react.useState)(null);
	const current = animes[index] ?? anime;
	const title = displayTitle(current);
	const inList = useHikariStore((s) => s.myList.includes(current.id));
	const toggleList = useHikariStore((s) => s.toggleList);
	const mobileBackdrop = current.cover || current.banner || "";
	const desktopBackdrop = current.banner || current.cover || "";
	function loadBackdrop(url, onLoaded) {
		if (!url) {
			setImageRatio(null);
			setIsLandscape(false);
			onLoaded?.();
			return;
		}
		const image = new Image();
		image.onload = () => {
			const width = image.naturalWidth;
			const height = image.naturalHeight;
			if (width > 0 && height > 0) {
				setIsLandscape(width > height);
				setImageRatio(width / height);
			}
			onLoaded?.();
		};
		image.src = url;
	}
	(0, import_react.useEffect)(() => {
		loadBackdrop(visibleBackdrop);
	}, [visibleBackdrop]);
	(0, import_react.useEffect)(() => {
		if (animes.length < 2) return;
		const timer = window.setInterval(() => {
			const nextIndex = (index + 1) % animes.length;
			const nextAnime = animes[nextIndex];
			const nextBackdrop = nextAnime?.cover || nextAnime?.banner || "";
			if (!nextBackdrop) {
				setIndex(nextIndex);
				return;
			}
			const image = new Image();
			image.onload = () => {
				const width = image.naturalWidth;
				const height = image.naturalHeight;
				if (width > 0 && height > 0) {
					setIsLandscape(width > height);
					setImageRatio(width / height);
				}
				setVisibleBackdrop(nextBackdrop);
				setIndex(nextIndex);
			};
			image.src = nextBackdrop;
		}, 8e3);
		return () => window.clearInterval(timer);
	}, [animes, index]);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
		className: "\n        relative\n        -mx-4\n        overflow-hidden\n        bg-bg\n        sm:-mx-6\n      ",
		children: [visibleBackdrop ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "\n            relative\n            w-full\n            overflow-hidden\n            bg-bg\n            h-[14rem]\n            sm:h-[21rem]\n            md:h-[21rem]\n          ",
			style: !isLandscape && imageRatio ? void 0 : void 0,
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
					src: mobileBackdrop,
					alt: "",
					"aria-hidden": "true",
					className: "\n              absolute\n              inset-0\n              size-full\n              object-contain\n              object-center\n              md:hidden\n            "
				}, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 154,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
					src: desktopBackdrop,
					alt: "",
					"aria-hidden": "true",
					className: "\n              absolute\n              inset-0\n              hidden\n              size-full\n              object-cover\n              object-center\n              md:block\n            "
				}, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 172,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "\n              pointer-events-none\n              absolute\n              inset-x-0\n              bottom-0\n              h-1/2\n              bg-linear-to-t\n              from-bg\n              via-bg/40\n              to-transparent\n            " }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 188,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "\n              pointer-events-none\n              absolute\n              inset-0\n              hidden\n              md:block\n              bg-linear-to-r\n              from-bg/80\n              via-bg/20\n              to-transparent\n            " }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 203,
					columnNumber: 11
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName$1,
			lineNumber: 134,
			columnNumber: 9
		}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "\n            h-[14rem]\n            bg-bg\n            sm:h-[21rem]\n            md:h-[21rem]\n          " }, void 0, false, {
			fileName: _jsxFileName$1,
			lineNumber: 218,
			columnNumber: 9
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "\n          relative\n          z-10\n          px-4\n          pb-3\n          pt-1\n          sm:px-6\n          sm:pb-7\n          sm:pt-2\n          md:-mt-32\n          md:px-10\n          md:pb-10\n        ",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "\n            text-[8px]\n            font-medium\n            tracking-[0.2em]\n            text-muted\n            uppercase\n            sm:text-[9px]\n            md:text-xs\n          ",
					children: "Em destaque"
				}, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 244,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
					className: "\n            mt-0.5\n            max-w-2xl\n            line-clamp-2\n            font-display\n            text-[1.65rem]\n            leading-tight\n            tracking-tight\n            text-fg\n            sm:text-4xl\n            md:text-5xl\n          ",
					children: title
				}, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 258,
					columnNumber: 9
				}, this),
				current.titles.native && current.titles.native !== title && /* @__PURE__ */ (void 0)("p", {
					className: "mt-0.5 hidden font-display text-sm text-muted sm:block",
					children: current.titles.native
				}, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 277,
					columnNumber: 13
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mt-1.5 flex flex-wrap items-center gap-1.5",
					children: [
						current.score != null && /* @__PURE__ */ (void 0)("span", {
							className: "text-xs font-medium tabular-nums text-score sm:text-sm",
							children: scoreLabel(current.score)
						}, void 0, false, {
							fileName: _jsxFileName$1,
							lineNumber: 284,
							columnNumber: 13
						}, this),
						current.year && /* @__PURE__ */ (void 0)("span", {
							className: "text-xs text-muted sm:text-sm",
							children: current.year
						}, void 0, false, {
							fileName: _jsxFileName$1,
							lineNumber: 290,
							columnNumber: 13
						}, this),
						current.genres.slice(0, 2).map((genre) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Badge, {
							className: "text-[9px] sm:text-xs",
							children: genreLabel(genre)
						}, genre, false, {
							fileName: _jsxFileName$1,
							lineNumber: 296,
							columnNumber: 13
						}, this))
					]
				}, void 0, true, {
					fileName: _jsxFileName$1,
					lineNumber: 282,
					columnNumber: 9
				}, this),
				current.synopsis && /* @__PURE__ */ (void 0)("p", {
					className: "\n              mt-1.5\n              max-w-xl\n              line-clamp-2\n              text-[10px]\n              leading-snug\n              text-muted\n              sm:mt-4\n              sm:line-clamp-3\n              sm:text-sm\n              md:max-w-2xl\n              md:text-base\n            ",
					children: current.synopsis
				}, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 306,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mt-2.5 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							asChild: true,
							size: "sm",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
								to: "/watch/$id",
								params: { id: current.id },
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Play, { className: "size-3.5 sm:size-4" }, void 0, false, {
									fileName: _jsxFileName$1,
									lineNumber: 331,
									columnNumber: 15
								}, this), "Assistir"]
							}, void 0, true, {
								fileName: _jsxFileName$1,
								lineNumber: 327,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName$1,
							lineNumber: 326,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => toggleList(current),
							children: [inList ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(BookmarkCheck, { className: "size-3.5 sm:size-4" }, void 0, false, {
								fileName: _jsxFileName$1,
								lineNumber: 343,
								columnNumber: 15
							}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bookmark, { className: "size-3.5 sm:size-4" }, void 0, false, {
								fileName: _jsxFileName$1,
								lineNumber: 345,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "hidden sm:inline",
								children: inList ? "Na lista" : "Minha Lista"
							}, void 0, false, {
								fileName: _jsxFileName$1,
								lineNumber: 348,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$1,
							lineNumber: 336,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							asChild: true,
							variant: "ghost",
							size: "sm",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
								to: "/anime/$id",
								params: { id: current.id },
								children: "Detalhes"
							}, void 0, false, {
								fileName: _jsxFileName$1,
								lineNumber: 358,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName$1,
							lineNumber: 353,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName$1,
					lineNumber: 325,
					columnNumber: 9
				}, this),
				animes.length > 1 && /* @__PURE__ */ (void 0)("div", {
					className: "\n              mt-2.5\n              flex\n              items-center\n              gap-1.5\n              sm:mt-3\n            ",
					"aria-label": "Destaques",
					children: animes.map((item, i) => /* @__PURE__ */ (void 0)("button", {
						type: "button",
						"aria-label": `Mostrar destaque ${i + 1}`,
						onClick: () => {
							if (i === index) return;
							const nextBackdrop = item.cover || item.banner || "";
							if (!nextBackdrop) {
								setIndex(i);
								return;
							}
							const image = new Image();
							image.onload = () => {
								const width = image.naturalWidth;
								const height = image.naturalHeight;
								if (width > 0 && height > 0) {
									setIsLandscape(width > height);
									setImageRatio(width / height);
								}
								setVisibleBackdrop(nextBackdrop);
								setIndex(i);
							};
							image.src = nextBackdrop;
						},
						className: `
                  h-1.5
                  rounded-full
                  transition-all
                  ${i === index ? "w-5 bg-fg" : "w-1.5 bg-fg/40"}
                `
					}, item.id, false, {
						fileName: _jsxFileName$1,
						lineNumber: 379,
						columnNumber: 15
					}, this))
				}, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 368,
					columnNumber: 11
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName$1,
			lineNumber: 229,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName$1,
		lineNumber: 123,
		columnNumber: 5
	}, this);
}
var _jsxFileName = "/app/applet/src/components/anime-row.tsx";
function AnimeRow({ title, href, items, loading }) {
	if (!loading && items.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex items-center justify-between gap-3 px-1",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
				className: "font-display text-lg tracking-tight text-fg sm:text-2xl",
				children: title
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 26,
				columnNumber: 9
			}, this), href && /* @__PURE__ */ (void 0)(Link, {
				to: href,
				className: "\n              inline-flex\n              min-h-9\n              shrink-0\n              items-center\n              gap-0.5\n              rounded-md\n              px-1\n              text-[10px]\n              font-medium\n              tracking-wide\n              text-muted\n              uppercase\n              transition-colors\n              hover:text-fg\n              sm:text-xs\n            ",
				children: ["Ver tudo", /* @__PURE__ */ (void 0)(ChevronRight, { className: "size-3.5" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 52,
					columnNumber: 13
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 31,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 25,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "rail -mx-4 px-4 sm:-mx-6 sm:px-6",
			children: loading ? Array.from({ length: 8 }, (_, i) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCardSkeleton, {}, i, false, {
				fileName: _jsxFileName,
				lineNumber: 60,
				columnNumber: 15
			}, this)) : items.map((anime) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCard, { anime }, anime.id, false, {
				fileName: _jsxFileName,
				lineNumber: 63,
				columnNumber: 15
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 57,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 24,
		columnNumber: 5
	}, this);
}
//#endregion
export { Hero as n, AnimeRow as t };
