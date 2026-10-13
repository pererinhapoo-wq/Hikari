import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Ct as ArrowLeft, D as Search, F as Newspaper, dt as ChevronLeft, gt as CalendarDays, ut as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { o as Route$16 } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news_.search-DsILXKiV.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/news_.search.tsx?tsr-split=component";
var NEWS_PER_PAGE = 4;
function parseNewsDate(date) {
	if (!date) return 0;
	const normalized = date.trim().toLowerCase();
	const numericMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (numericMatch) {
		const [, day, month, year] = numericMatch;
		return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
	}
	const monthNames = {
		janeiro: 0,
		fevereiro: 1,
		março: 2,
		abril: 3,
		maio: 4,
		junho: 5,
		julho: 6,
		agosto: 7,
		setembro: 8,
		outubro: 9,
		novembro: 10,
		dezembro: 11
	};
	const textMatch = normalized.match(/^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})$/);
	if (textMatch) {
		const [, day, monthName, year] = textMatch;
		const month = monthNames[monthName];
		if (month !== void 0) return new Date(Number(year), month, Number(day)).getTime();
	}
	const parsed = Date.parse(date);
	if (!Number.isNaN(parsed)) return parsed;
	return 0;
}
function normalizeSearchText(value) {
	return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function NewsSearchPage() {
	const navigate = useNavigate({ from: "/news/search" });
	const loaderNews = Route$16.useLoaderData();
	const search = Route$16.useSearch();
	const query = typeof search.q === "string" ? search.q : "";
	const urlPage = Math.max(1, Number(search.page) || 1);
	const [currentPage, setCurrentPage] = (0, import_react.useState)(urlPage);
	const news = (0, import_react.useMemo)(() => {
		return [...loaderNews ?? []].sort((a, b) => parseNewsDate(b.date) - parseNewsDate(a.date));
	}, [loaderNews]);
	const results = (0, import_react.useMemo)(() => {
		const normalizedQuery = normalizeSearchText(query);
		if (!normalizedQuery) return [];
		return news.filter((item) => {
			return normalizeSearchText([
				item.title,
				item.description,
				item.type,
				item.date
			].filter(Boolean).join(" ")).includes(normalizedQuery);
		});
	}, [news, query]);
	const totalPages = Math.max(1, Math.ceil(results.length / NEWS_PER_PAGE));
	(0, import_react.useEffect)(() => {
		if (currentPage !== urlPage) setCurrentPage(urlPage);
	}, [currentPage, urlPage]);
	(0, import_react.useEffect)(() => {
		if (urlPage > totalPages) {
			setCurrentPage(totalPages);
			navigate({
				search: {
					q: query,
					page: totalPages
				},
				resetScroll: false
			});
		}
	}, [
		urlPage,
		totalPages,
		query,
		navigate
	]);
	const visibleResults = (0, import_react.useMemo)(() => {
		const start = (currentPage - 1) * NEWS_PER_PAGE;
		return results.slice(start, start + NEWS_PER_PAGE);
	}, [results, currentPage]);
	const goToPage = (page) => {
		const nextPage = Math.min(Math.max(page, 1), totalPages);
		setCurrentPage(nextPage);
		navigate({
			search: {
				q: query,
				page: nextPage
			},
			resetScroll: false
		});
		window.scrollTo({
			top: 0,
			behavior: "smooth"
		});
	};
	const displayedQuery = query.trim();
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("main", {
		className: "min-h-screen bg-background text-fg",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "\n          mx-auto\n          w-full\n          max-w-7xl\n          px-4\n          pb-16\n          pt-4\n          sm:px-6\n          lg:px-8\n        ",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "\n            mb-8\n            flex\n            items-center\n            justify-between\n            gap-3\n          ",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/news",
						className: "\n              inline-flex\n              items-center\n              gap-2\n              rounded-lg\n              px-2\n              py-2\n              text-sm\n              font-medium\n              text-muted\n              transition\n              hover:bg-elevated\n              hover:text-fg\n              active:scale-[0.97]\n            ",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ArrowLeft, { className: "size-4 shrink-0" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 186,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Voltar" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 188,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 171,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/news",
						className: "\n              inline-flex\n              items-center\n              gap-2\n              rounded-lg\n              px-2\n              py-2\n              text-sm\n              font-medium\n              text-muted\n              transition\n              hover:bg-elevated\n              hover:text-fg\n              active:scale-[0.97]\n            ",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Search, { className: "size-4 shrink-0" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 208,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Buscar" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 210,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 193,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 164,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
					className: "\n            mb-8\n            rounded-3xl\n            border\n            border-border\n            bg-card\n            p-5\n            sm:p-6\n          ",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "\n              flex\n              items-center\n              gap-3\n            ",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "\n                flex\n                size-11\n                shrink-0\n                items-center\n                justify-center\n                rounded-full\n                bg-elevated\n                text-fg\n              ",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Search, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 244,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 234,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
								className: "\n                  text-xl\n                  font-semibold\n                  tracking-tight\n                ",
								children: "Resultados da busca"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 248,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "\n                  mt-1\n                  break-words\n                  text-sm\n                  text-muted\n                ",
								children: [
									"Resultados para:",
									" ",
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "font-medium text-fg",
										children: displayedQuery || "nenhuma busca"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 263,
										columnNumber: 17
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 256,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 247,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 229,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 220,
					columnNumber: 9
				}, this),
				displayedQuery && results.length > 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "\n                mb-5\n                flex\n                items-center\n                gap-2\n                text-sm\n                text-muted\n              ",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Newspaper, { className: "size-4 shrink-0" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 284,
							columnNumber: 15
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [
							results.length,
							" ",
							results.length === 1 ? "resultado encontrado" : "resultados encontrados"
						] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 286,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 276,
						columnNumber: 13
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
						className: "\n                grid\n                grid-cols-1\n                gap-4\n                sm:grid-cols-2\n              ",
						children: visibleResults.map((item) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
							to: "/news/$id",
							params: { id: item.id },
							search: { page: currentPage },
							className: "\n                      group\n                      overflow-hidden\n                      rounded-3xl\n                      border\n                      border-border\n                      bg-card\n                      transition-all\n                      duration-200\n                      hover:-translate-y-0.5\n                      hover:border-border/80\n                      hover:bg-elevated\n                      active:scale-[0.99]\n                    ",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "\n                        relative\n                        aspect-[16/9]\n                        w-full\n                        overflow-hidden\n                        bg-black\n                      ",
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
										src: item.image,
										alt: item.title,
										className: "\n                          absolute\n                          inset-0\n                          h-full\n                          w-full\n                          object-contain\n                          object-center\n                          transition-transform\n                          duration-300\n                          group-hover:scale-[1.01]\n                        ",
										loading: "lazy"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 326,
										columnNumber: 23
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "\n                          absolute\n                          inset-x-0\n                          bottom-0\n                          h-1/2\n                          bg-gradient-to-t\n                          from-black/80\n                          via-black/20\n                          to-transparent\n                        " }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 338,
										columnNumber: 23
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "\n                          absolute\n                          bottom-3\n                          left-3\n                          rounded-md\n                          bg-black/70\n                          px-2\n                          py-1\n                          text-[10px]\n                          font-semibold\n                          uppercase\n                          tracking-wide\n                          text-white\n                        ",
										children: item.type
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 349,
										columnNumber: 23
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 319,
								columnNumber: 21
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "p-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
										className: "\n                          line-clamp-2\n                          text-base\n                          font-semibold\n                          leading-snug\n                          text-fg\n                        ",
										children: item.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 370,
										columnNumber: 23
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "\n                          mt-2\n                          line-clamp-3\n                          text-sm\n                          leading-relaxed\n                          text-muted\n                        ",
										children: item.description
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 380,
										columnNumber: 23
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "\n                          mt-4\n                          flex\n                          items-center\n                          gap-2\n                          text-xs\n                          text-muted\n                        ",
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CalendarDays, { className: "size-3.5 shrink-0" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 398,
											columnNumber: 25
										}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: item.date }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 400,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 390,
										columnNumber: 23
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 369,
								columnNumber: 21
							}, this)]
						}, item.id, true, {
							fileName: _jsxFileName,
							lineNumber: 298,
							columnNumber: 43
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 292,
						columnNumber: 13
					}, this),
					totalPages > 1 && /* @__PURE__ */ (void 0)("nav", {
						className: "\n                  mt-8\n                  flex\n                  flex-col\n                  items-center\n                  gap-3\n                ",
						"aria-label": "Paginação dos resultados da busca",
						children: [/* @__PURE__ */ (void 0)("div", {
							className: "\n                    flex\n                    max-w-full\n                    items-center\n                    gap-1.5\n                    overflow-x-auto\n                    px-1\n                    pb-1\n                  ",
							children: [
								/* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => goToPage(currentPage - 1),
									disabled: currentPage === 1,
									"aria-label": "Página anterior",
									className: "\n                      flex\n                      size-9\n                      shrink-0\n                      items-center\n                      justify-center\n                      rounded-full\n                      border\n                      border-border\n                      bg-card\n                      text-muted\n                      transition\n                      hover:bg-elevated\n                      hover:text-fg\n                      disabled:cursor-not-allowed\n                      disabled:opacity-30\n                    ",
									children: /* @__PURE__ */ (void 0)(ChevronLeft, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 448,
										columnNumber: 21
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 431,
									columnNumber: 19
								}, this),
								Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => /* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => goToPage(page),
									"aria-label": `Ir para a página ${page}`,
									"aria-current": currentPage === page ? "page" : void 0,
									className: `
                          flex
                          size-9
                          shrink-0
                          items-center
                          justify-center
                          rounded-full
                          border
                          text-xs
                          font-medium
                          transition
                          ${currentPage === page ? "border-fg bg-fg text-background" : "border-border bg-card text-muted hover:bg-elevated hover:text-fg"}
                        `,
									children: page
								}, page, false, {
									fileName: _jsxFileName,
									lineNumber: 455,
									columnNumber: 53
								}, this)),
								/* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => goToPage(currentPage + 1),
									disabled: currentPage === totalPages,
									"aria-label": "Próxima página",
									className: "\n                      flex\n                      size-9\n                      shrink-0\n                      items-center\n                      justify-center\n                      rounded-full\n                      border\n                      border-border\n                      bg-card\n                      text-muted\n                      transition\n                      hover:bg-elevated\n                      hover:text-fg\n                      disabled:cursor-not-allowed\n                      disabled:opacity-30\n                    ",
									children: /* @__PURE__ */ (void 0)(ChevronRight, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 490,
										columnNumber: 21
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 473,
									columnNumber: 19
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 419,
							columnNumber: 17
						}, this), /* @__PURE__ */ (void 0)("p", {
							className: "text-xs text-muted",
							children: [
								"Página",
								" ",
								currentPage,
								" ",
								"de",
								" ",
								totalPages
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 494,
							columnNumber: 17
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 412,
						columnNumber: 32
					}, this)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 275,
					columnNumber: 49
				}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
					className: "\n              flex\n              min-h-[220px]\n              flex-col\n              items-center\n              justify-center\n              rounded-3xl\n              border\n              border-border\n              bg-card\n              px-6\n              text-center\n            ",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Newspaper, { className: "mb-3 size-8 text-muted" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 514,
						columnNumber: 13
					}, this), displayedQuery ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "\n                    text-base\n                    font-medium\n                    text-fg\n                  ",
						children: "Nenhuma notícia encontrada."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 517,
						columnNumber: 17
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "\n                    mt-2\n                    text-sm\n                    text-muted\n                  ",
						children: [
							"Não encontramos notícias para",
							" ",
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "font-medium text-fg",
								children: [
									"\"",
									displayedQuery,
									"\""
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 531,
								columnNumber: 19
							}, this),
							"."
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 525,
						columnNumber: 17
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 516,
						columnNumber: 31
					}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-sm text-muted",
						children: "Digite algo para pesquisar notícias."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 536,
						columnNumber: 21
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 501,
					columnNumber: 17
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 149,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 148,
		columnNumber: 10
	}, this);
}
//#endregion
export { NewsSearchPage as component };
