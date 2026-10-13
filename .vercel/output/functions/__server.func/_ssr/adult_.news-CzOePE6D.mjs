import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Ct as ArrowLeft, D as Search, F as Newspaper, dt as ChevronLeft, gt as CalendarDays, t as X, ut as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { d as Route$23 } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/adult_.news-CzOePE6D.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/adult_.news.tsx?tsr-split=component";
var NEWS_PER_PAGE = 8;
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
function getPaginationItems(currentPage, totalPages) {
	if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
	if (currentPage <= 4) return [
		1,
		2,
		3,
		4,
		5,
		"ellipsis",
		totalPages
	];
	if (currentPage >= totalPages - 3) return [
		1,
		"ellipsis",
		totalPages - 4,
		totalPages - 3,
		totalPages - 2,
		totalPages - 1,
		totalPages
	];
	return [
		1,
		"ellipsis",
		currentPage - 1,
		currentPage,
		currentPage + 1,
		"ellipsis",
		totalPages
	];
}
function NewsPage() {
	const navigate = useNavigate({ from: "/adult/news" });
	const loaderNews = Route$23.useLoaderData();
	const search = Route$23.useSearch();
	const currentPage = Math.max(1, Number(search.page) || 1);
	const urlQuery = typeof search.q === "string" ? search.q : "";
	const [searchOpen, setSearchOpen] = (0, import_react.useState)(false);
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const news = (0, import_react.useMemo)(() => {
		return [...loaderNews ?? []].sort((a, b) => parseNewsDate(b.date) - parseNewsDate(a.date));
	}, [loaderNews]);
	function getRelativeDateLabel(dateString) {
		const match = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
		if (!match) return "";
		const [, day, month, year] = match;
		const published = new Date(Number(year), Number(month) - 1, Number(day));
		const now = /* @__PURE__ */ new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const difference = Math.round((today.getTime() - published.getTime()) / 864e5);
		if (difference === 0) return "Hoje";
		if (difference === 1) return "Ontem";
		if (difference > 1) return `Há ${difference} dias`;
		if (difference === -1) return "Amanhã";
		return `Em ${Math.abs(difference)} dias`;
	}
	const liveSearchResults = (0, import_react.useMemo)(() => {
		const query = normalizeSearchText(searchQuery);
		if (!query) return [];
		return news.filter((item) => {
			return normalizeSearchText([
				item.title,
				item.description,
				item.type,
				item.date
			].filter(Boolean).join(" ")).includes(query);
		});
	}, [news, searchQuery]);
	const searchResults = (0, import_react.useMemo)(() => {
		const query = normalizeSearchText(urlQuery);
		if (!query) return [];
		return news.filter((item) => {
			return normalizeSearchText([
				item.title,
				item.description,
				item.type,
				item.date
			].filter(Boolean).join(" ")).includes(query);
		});
	}, [news, urlQuery]);
	const previewSearchResults = liveSearchResults.slice(0, 5);
	const isSearchMode = Boolean(urlQuery.trim());
	const displayedNews = isSearchMode ? searchResults : news;
	const totalPages = Math.max(1, Math.ceil(displayedNews.length / NEWS_PER_PAGE));
	const paginationPage = Math.min(currentPage, totalPages);
	const handleSearchSubmit = (event) => {
		event.preventDefault();
		const query = searchQuery.trim();
		if (!query) return;
		setSearchOpen(false);
		navigate({
			to: "/adult/news",
			search: {
				q: query,
				page: 1
			},
			resetScroll: false
		});
	};
	const handleViewAllResults = () => {
		const query = searchQuery.trim();
		if (!query) return;
		setSearchOpen(false);
		navigate({
			to: "/adult/news",
			search: {
				q: query,
				page: 1
			},
			resetScroll: false
		});
	};
	const clearSearchInput = () => {
		setSearchQuery("");
	};
	const closeSearch = () => {
		setSearchOpen(false);
		setSearchQuery("");
	};
	const handleBack = () => {
		if (isSearchMode) {
			navigate({
				to: "/adult/news",
				search: {
					q: "",
					page: 1
				},
				resetScroll: false
			});
			setSearchOpen(false);
			setSearchQuery("");
			return;
		}
		navigate({ to: "/adult" });
	};
	const goToPage = (page) => {
		navigate({
			to: "/adult/news",
			search: {
				q: urlQuery,
				page: Math.min(Math.max(page, 1), totalPages)
			},
			resetScroll: false
		});
		window.scrollTo({
			top: 0,
			behavior: "smooth"
		});
	};
	const paginationItems = getPaginationItems(paginationPage, totalPages);
	const visibleNews = (0, import_react.useMemo)(() => {
		const start = (paginationPage - 1) * NEWS_PER_PAGE;
		return displayedNews.slice(start, start + NEWS_PER_PAGE);
	}, [displayedNews, paginationPage]);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("main", {
		className: "min-h-screen bg-background text-fg",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "\n          mx-auto\n          w-full\n          max-w-7xl\n          px-4\n          pb-16\n          pt-4\n          sm:px-6\n          lg:px-8\n        ",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "\n            mb-7\n            flex\n            items-center\n            justify-between\n            gap-3\n          ",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: handleBack,
						className: "\n              inline-flex\n              items-center\n              gap-2\n              rounded-lg\n              px-2\n              py-2\n              text-sm\n              font-medium\n              text-muted\n              transition\n              hover:bg-elevated\n              hover:text-fg\n            ",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ArrowLeft, { className: "size-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 344,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Voltar" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 346,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 330,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: () => {
							if (searchOpen) closeSearch();
							else {
								setSearchQuery("");
								setSearchOpen(true);
							}
						},
						className: "\n              inline-flex\n              items-center\n              gap-2\n              rounded-lg\n              px-2\n              py-2\n              text-sm\n              font-medium\n              text-muted\n              transition\n              hover:bg-elevated\n              hover:text-fg\n            ",
						children: searchOpen ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(X, { className: "size-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 378,
							columnNumber: 17
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Fechar" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 380,
							columnNumber: 17
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 377,
							columnNumber: 27
						}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Search, { className: "size-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 384,
							columnNumber: 17
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Buscar" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 386,
							columnNumber: 17
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 383,
							columnNumber: 21
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 351,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 323,
					columnNumber: 9
				}, this),
				searchOpen && /* @__PURE__ */ (void 0)("section", {
					className: "\n              mb-7\n              rounded-3xl\n              border\n              border-border\n              bg-background\n              p-3\n              sm:p-4\n            ",
					children: [/* @__PURE__ */ (void 0)("form", {
						onSubmit: handleSearchSubmit,
						children: /* @__PURE__ */ (void 0)("div", {
							className: "\n                  relative\n                  flex\n                  items-center\n                ",
							children: [
								/* @__PURE__ */ (void 0)("input", {
									autoFocus: true,
									type: "text",
									value: searchQuery,
									onChange: (event) => setSearchQuery(event.target.value),
									placeholder: "Buscar notícias +18...",
									enterKeyHint: "search",
									autoComplete: "off",
									className: "\n                    h-14\n                    w-full\n                    rounded-2xl\n                    border\n                    border-border\n                    bg-elevated\n                    pl-4\n                    pr-24\n                    text-base\n                    text-fg\n                    outline-none\n                    placeholder:text-muted\n                    focus:border-fg/30\n                  ",
									"aria-label": "Buscar notícias"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 412,
									columnNumber: 17
								}, this),
								searchQuery.trim() && /* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: clearSearchInput,
									className: "\n                      absolute\n                      right-12\n                      flex\n                      size-10\n                      items-center\n                      justify-center\n                      rounded-xl\n                      text-muted\n                      transition\n                      hover:bg-background\n                      hover:text-fg\n                      active:scale-95\n                    ",
									"aria-label": "Limpar busca",
									children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 442,
										columnNumber: 21
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 428,
									columnNumber: 40
								}, this),
								/* @__PURE__ */ (void 0)("button", {
									type: "submit",
									className: "\n                    absolute\n                    right-2\n                    flex\n                    size-10\n                    items-center\n                    justify-center\n                    rounded-xl\n                    text-muted\n                    transition\n                    hover:bg-background\n                    hover:text-fg\n                    active:scale-95\n                  ",
									"aria-label": "Pesquisar notícias",
									children: /* @__PURE__ */ (void 0)(Search, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 459,
										columnNumber: 19
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 445,
									columnNumber: 17
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 407,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 406,
						columnNumber: 13
					}, this), searchQuery.trim() && /* @__PURE__ */ (void 0)("div", {
						className: "mt-3",
						children: previewSearchResults.length === 0 ? /* @__PURE__ */ (void 0)("div", {
							className: "\n                      rounded-2xl\n                      bg-surface\n                      px-4\n                      py-6\n                      text-center\n                      text-sm\n                      text-muted\n                    ",
							children: "Nenhuma notícia encontrada."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 469,
							columnNumber: 54
						}, this) : /* @__PURE__ */ (void 0)("div", {
							className: "\n                      overflow-hidden\n                      rounded-2xl\n                      border\n                      border-border\n                      bg-surface\n                    ",
							children: [previewSearchResults.map((item) => /* @__PURE__ */ (void 0)(Link, {
								to: "/news/$id",
								params: { id: item.id },
								search: { page: currentPage },
								className: "\n                            flex\n                            items-center\n                            gap-3\n                            border-b\n                            border-border\n                            px-4\n                            py-3\n                            transition\n                            hover:bg-elevated\n                          ",
								children: [/* @__PURE__ */ (void 0)("div", {
									className: "\n                              size-14\n                              shrink-0\n                              overflow-hidden\n                              rounded-lg\n                              bg-black\n                            ",
									children: /* @__PURE__ */ (void 0)("img", {
										src: item.image,
										alt: "",
										className: "\n                                h-full\n                                w-full\n                                object-cover\n                              "
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 511,
										columnNumber: 29
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 504,
									columnNumber: 27
								}, this), /* @__PURE__ */ (void 0)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (void 0)("p", {
										className: "\n                                line-clamp-2\n                                text-sm\n                                font-semibold\n                                text-fg\n                              ",
										children: item.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 519,
										columnNumber: 29
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "\n                                mt-1\n                                text-xs\n                                text-muted\n                              ",
										children: [
											item.type,
											" · ",
											item.date
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 528,
										columnNumber: 29
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 518,
									columnNumber: 27
								}, this)]
							}, item.id, true, {
								fileName: _jsxFileName,
								lineNumber: 489,
								columnNumber: 55
							}, this)), liveSearchResults.length > 5 && /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: handleViewAllResults,
								className: "\n                          flex\n                          w-full\n                          cursor-pointer\n                          items-center\n                          justify-center\n                          border-t\n                          border-border\n                          px-4\n                          py-4\n                          text-sm\n                          font-semibold\n                          text-fg\n                          transition\n                          hover:bg-elevated\n                          active:bg-elevated\n                        ",
								children: [
									"Ver todos os resultados",
									" (",
									liveSearchResults.length,
									")"
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 546,
								columnNumber: 54
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 479,
							columnNumber: 28
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 468,
						columnNumber: 36
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 397,
					columnNumber: 24
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
					className: "mb-7",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "\n              flex\n              items-center\n              gap-3\n            ",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "\n                flex\n                size-10\n                shrink-0\n                items-center\n                justify-center\n                rounded-full\n                bg-elevated\n              ",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Newspaper, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 591,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 582,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
							className: "\n                  text-2xl\n                  font-semibold\n                  tracking-tight\n                ",
							children: isSearchMode ? "Resultados da busca" : "Notícias +18"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 595,
							columnNumber: 15
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "\n                  mt-1\n                  text-sm\n                  text-muted\n                ",
							children: isSearchMode ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
								"Resultados para:",
								" ",
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "font-medium text-fg",
									children: [
										"\"",
										urlQuery,
										"\""
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 610,
									columnNumber: 21
								}, this)
							] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 608,
								columnNumber: 33
							}, this) : "Fique por dentro das novidades de conteúdo +18."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 603,
							columnNumber: 15
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 594,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 577,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 576,
					columnNumber: 9
				}, this),
				isSearchMode && /* @__PURE__ */ (void 0)("div", {
					className: "\n              mb-5\n              flex\n              items-center\n              gap-2\n              text-sm\n              text-muted\n            ",
					children: [/* @__PURE__ */ (void 0)(Search, { className: "size-4" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 631,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)("span", { children: [
						searchResults.length,
						" ",
						searchResults.length === 1 ? "resultado encontrado" : "resultados encontrados"
					] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 633,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 623,
					columnNumber: 26
				}, this),
				visibleNews.length > 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
					className: "\n                grid\n                grid-cols-1\n                gap-4\n                sm:grid-cols-2\n              ",
					children: visibleNews.map((item) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/news/$id",
						params: { id: item.id },
						search: { page: currentPage },
						className: "\n                      group\n                      overflow-hidden\n                      rounded-3xl\n                      border\n                      border-border\n                      bg-card\n                      transition\n                      hover:bg-elevated\n                    ",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "\n                        relative\n                        aspect-[16/9]\n                        w-full\n                        overflow-hidden\n                        bg-black\n                      ",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
									src: item.image,
									alt: item.title,
									className: "\n                          absolute\n                          inset-0\n                          h-full\n                          w-full\n                          object-contain\n                          object-center\n                        ",
									loading: "lazy"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 671,
									columnNumber: 23
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "\n                          absolute\n                          inset-x-0\n                          bottom-0\n                          h-1/2\n                          bg-gradient-to-t\n                          from-black/80\n                          via-black/20\n                          to-transparent\n                        " }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 680,
									columnNumber: 23
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "\n                          absolute\n                          bottom-3\n                          left-3\n                          rounded-md\n                          bg-black/70\n                          px-2\n                          py-1\n                          text-[10px]\n                          font-semibold\n                          uppercase\n                          tracking-wide\n                          text-white\n                        ",
									children: item.type
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 691,
									columnNumber: 23
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 664,
							columnNumber: 21
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
									className: "\n                          line-clamp-2\n                          text-base\n                          font-semibold\n                          leading-snug\n                        ",
									children: item.title
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 710,
									columnNumber: 23
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "\n                          mt-2\n                          line-clamp-3\n                          text-sm\n                          leading-relaxed\n                          text-muted\n                        ",
									children: item.description
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 719,
									columnNumber: 23
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "\n                          mt-4\n                          flex\n                          items-center\n                          gap-2\n                          text-xs\n                          text-muted\n                        ",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CalendarDays, { className: "size-3.5" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 737,
											columnNumber: 25
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: item.date }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 739,
											columnNumber: 25
										}, this),
										getRelativeDateLabel(item.date) && /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (void 0)("span", {
											"aria-hidden": "true",
											children: "•"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 744,
											columnNumber: 29
										}, this), /* @__PURE__ */ (void 0)("span", { children: getRelativeDateLabel(item.date) }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 748,
											columnNumber: 29
										}, this)] }, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 743,
											columnNumber: 61
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 729,
									columnNumber: 23
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 709,
							columnNumber: 21
						}, this)]
					}, item.id, true, {
						fileName: _jsxFileName,
						lineNumber: 650,
						columnNumber: 40
					}, this))
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 644,
					columnNumber: 13
				}, this), totalPages >= 1 && /* @__PURE__ */ (void 0)("nav", {
					className: "\n                  mt-8\n                  flex\n                  flex-col\n                  items-center\n                  gap-3\n                ",
					children: [/* @__PURE__ */ (void 0)("div", {
						className: "\n                    flex\n                    items-center\n                    gap-1.5\n                    overflow-x-auto\n                    px-1\n                    pb-1\n                  ",
						children: [
							totalPages > 1 && /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => goToPage(paginationPage - 1),
								disabled: paginationPage === 1,
								className: "\n                      flex\n                      size-9\n                      shrink-0\n                      items-center\n                      justify-center\n                      rounded-full\n                      border\n                      border-border\n                      bg-card\n                      text-muted\n                      disabled:opacity-30\n                    ",
								children: /* @__PURE__ */ (void 0)(ChevronLeft, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 789,
									columnNumber: 23
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 776,
								columnNumber: 38
							}, this),
							paginationItems.map((item, index) => item === "ellipsis" ? /* @__PURE__ */ (void 0)("span", {
								className: "\n                            flex\n                            size-9\n                            shrink-0\n                            items-center\n                            justify-center\n                            text-xs\n                            text-muted\n                          ",
								children: "…"
							}, `ellipsis-${index}`, false, {
								fileName: _jsxFileName,
								lineNumber: 792,
								columnNumber: 79
							}, this) : /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => goToPage(item),
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
                            ${paginationPage === item ? "border-fg bg-fg text-black" : "border-border bg-card text-muted"}
                          `,
								children: item
							}, item, false, {
								fileName: _jsxFileName,
								lineNumber: 802,
								columnNumber: 35
							}, this)),
							totalPages > 1 && /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => goToPage(paginationPage + 1),
								disabled: paginationPage === totalPages,
								className: "\n                      flex\n                      size-9\n                      shrink-0\n                      items-center\n                      justify-center\n                      rounded-full\n                      border\n                      border-border\n                      bg-card\n                      text-muted\n                      disabled:opacity-30\n                    ",
								children: /* @__PURE__ */ (void 0)(ChevronRight, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 830,
									columnNumber: 23
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 817,
								columnNumber: 38
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 768,
						columnNumber: 17
					}, this), /* @__PURE__ */ (void 0)("p", {
						className: "text-xs text-muted",
						children: [
							"Página",
							" ",
							paginationPage,
							" ",
							"de",
							" ",
							totalPages
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 834,
						columnNumber: 17
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 761,
					columnNumber: 33
				}, this)] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 643,
					columnNumber: 35
				}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
					className: "\n              flex\n              min-h-[220px]\n              flex-col\n              items-center\n              justify-center\n              rounded-3xl\n              border\n              border-border\n              bg-card\n              px-6\n              text-center\n            ",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Newspaper, { className: "mb-3 size-8 text-muted" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 854,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-base font-medium",
							children: "Nenhuma notícia encontrada."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 856,
							columnNumber: 13
						}, this),
						isSearchMode && /* @__PURE__ */ (void 0)("p", {
							className: "\n                  mt-2\n                  text-sm\n                  text-muted\n                ",
							children: [
								"Não encontramos notícias para",
								" ",
								/* @__PURE__ */ (void 0)("span", {
									className: "font-medium text-fg",
									children: [
										"\"",
										urlQuery,
										"\""
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 866,
									columnNumber: 17
								}, this),
								"."
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 860,
							columnNumber: 30
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 841,
					columnNumber: 17
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 308,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 307,
		columnNumber: 10
	}, this);
}
//#endregion
export { NewsPage as component };
