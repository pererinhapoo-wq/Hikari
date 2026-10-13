import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as createServerFn } from "./ssr.mjs";
import { t as createSsrRpc } from "./createSsrRpc-Cbx5Q3_U.mjs";
import { Ct as ArrowLeft, D as Search, F as Newspaper, dt as ChevronLeft, gt as CalendarDays, t as X, ut as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { w as Route$45 } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news-DZ0fi6ey.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/news.tsx?tsr-split=component";
var NEWS_PER_PAGE = 8;
var fetchCrunchyrollCalendar = createServerFn({ method: "GET" }).handler(createSsrRpc("222b3dfe54295947a131bb0d19c0ff0a9e661db4872cb60be14e310af07374d7"));
function normalizeCalendarTitle(value) {
	return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/season\s*\d+/g, "").replace(/\bpart\s*\d+\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function slugToCalendarTitle(slug) {
	return normalizeCalendarTitle(slug.replace(/-/g, " "));
}
function findCrunchyrollRelease(title, episode, releases) {
	const target = normalizeCalendarTitle(title);
	if (!target) return void 0;
	return releases.filter((release) => {
		if (release.episode && release.episode !== episode) return false;
		const slug = slugToCalendarTitle(release.slug);
		return slug === target || slug.includes(target) || target.includes(slug);
	})[0];
}
async function fetchAnimeCalendar() {
	const now = Math.floor(Date.now() / 1e3);
	const sevenDays = now + 604800;
	const query = `
    query ($airingAtGreater: Int, $airingAtLesser: Int) {
      Page(perPage: 20) {
        airingSchedules(
          airingAt_greater: $airingAtGreater
          airingAt_lesser: $airingAtLesser
          sort: TIME
        ) {
          airingAt
          episode
          media {
            id
            title {
              english
              romaji
            }
            bannerImage
            coverImage {
              extraLarge
              large
            }
          }
        }
      }
    }
  `;
	try {
		const response = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				query,
				variables: {
					airingAtGreater: now,
					airingAtLesser: sevenDays
				}
			})
		});
		if (!response.ok) return [];
		const schedules = (await response.json())?.data?.Page?.airingSchedules;
		if (!Array.isArray(schedules)) return [];
		const crunchyrollReleases = await fetchCrunchyrollCalendar();
		return schedules.filter((item) => item?.media && (item.media.title?.english || item.media.title?.romaji) && item?.airingAt && item?.episode).map((item) => {
			const title = item.media.title?.english?.trim() || item.media.title?.romaji?.trim() || "Anime";
			const episode = Number(item.episode);
			const crunchyrollRelease = findCrunchyrollRelease(title, episode, crunchyrollReleases);
			return {
				id: Number(item.media.id),
				episode,
				airingAt: crunchyrollRelease?.airingAt ?? Number(item.airingAt),
				title: item.media.title?.english?.trim() || item.media.title?.romaji?.trim() || "Anime",
				image: item.media.bannerImage || item.media.coverImage?.extraLarge || item.media.coverImage?.large || "",
				coverImage: item.media.coverImage?.extraLarge || item.media.coverImage?.large || item.media.bannerImage || ""
			};
		}).filter((item) => item.image).slice(0, 12);
	} catch {
		return [];
	}
}
async function fetchAnimeRecommendations(animeIds) {
	const ids = Array.from(new Set(animeIds)).filter((id) => Number.isFinite(id) && id > 0).slice(0, 6);
	if (!ids.length) return [];
	const fields = `
    id
    title {
      english
      romaji
    }
    coverImage {
      extraLarge
      large
    }
    isAdult
  `;
	const query = `
    query {
      ${ids.map((id, index) => `
      media${index}: Media(id: ${id}) {
        recommendations(perPage: 6) {
          nodes {
            rating
            mediaRecommendation {
              ${fields}
            }
          }
        }
      }
    `).join("\n")}
    }
  `;
	try {
		const response = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query })
		});
		if (!response.ok) return [];
		const data = await response.json();
		const result = [];
		const seen = /* @__PURE__ */ new Set();
		for (let index = 0; index < ids.length; index += 1) {
			const nodes = data?.data?.[`media${index}`]?.recommendations?.nodes;
			if (!Array.isArray(nodes)) continue;
			for (const node of nodes) {
				const media = node?.mediaRecommendation;
				const id = Number(media?.id);
				const title = media?.title?.english?.trim() || media?.title?.romaji?.trim() || "Anime";
				const image = media?.coverImage?.extraLarge || media?.coverImage?.large || "";
				if (!id || seen.has(id) || media?.isAdult || !image || !title) continue;
				seen.add(id);
				result.push({
					id,
					title,
					image
				});
				if (result.length >= 8) break;
			}
			if (result.length >= 8) break;
		}
		return result;
	} catch {
		return [];
	}
}
function formatCalendarDate(timestamp) {
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(/* @__PURE__ */ new Date(timestamp * 1e3));
}
function formatCalendarDayName(timestamp) {
	const value = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(/* @__PURE__ */ new Date(timestamp * 1e3));
	return value.charAt(0).toUpperCase() + value.slice(1);
}
function formatCalendarTime(timestamp) {
	return new Intl.DateTimeFormat("pt-BR", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false
	}).format(/* @__PURE__ */ new Date(timestamp * 1e3));
}
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
function formatRelativeNewsTime(dateValue, timeValue) {
	if (!dateValue) return "";
	const normalized = dateValue.trim();
	let date = null;
	const numericMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (numericMatch) {
		const [, day, month, year] = numericMatch;
		date = new Date(Number(year), Number(month) - 1, Number(day));
	} else {
		const parsed = Date.parse(normalized);
		if (!Number.isNaN(parsed)) date = new Date(parsed);
	}
	if (!date) return "";
	if (timeValue) {
		const timeMatch = timeValue.trim().match(/^(\d{1,2}):(\d{2})$/);
		if (timeMatch) date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
	}
	const diffMs = Math.max(0, (/* @__PURE__ */ new Date()).getTime() - date.getTime());
	const minutes = Math.floor(diffMs / 6e4);
	if (minutes < 1) return "Há menos de 1 minuto";
	if (minutes < 60) return `Há ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `Há ${hours} ${hours === 1 ? "hora" : "horas"}`;
	const days = Math.floor(hours / 24);
	return `Há ${days} ${days === 1 ? "dia" : "dias"}`;
}
function normalizeSearchText(value) {
	return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function NewsPage() {
	const navigate = useNavigate({ from: "/news" });
	const loaderNews = Route$45.useLoaderData();
	const search = Route$45.useSearch();
	const currentPage = Math.max(1, Number(search.page) || 1);
	const urlQuery = typeof search.q === "string" ? search.q : "";
	const [searchOpen, setSearchOpen] = (0, import_react.useState)(false);
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [featuredIndex, setFeaturedIndex] = (0, import_react.useState)(0);
	const [calendarEpisodes, setCalendarEpisodes] = (0, import_react.useState)([]);
	const [recommendations, setRecommendations] = (0, import_react.useState)([]);
	const news = (0, import_react.useMemo)(() => {
		return [...loaderNews ?? []].sort((a, b) => parseNewsDate(b.date) - parseNewsDate(a.date));
	}, [loaderNews]);
	const featuredNews = (0, import_react.useMemo)(() => {
		return news.slice(0, 5);
	}, [news]);
	(0, import_react.useEffect)(() => {
		if (featuredNews.length <= 1) {
			setFeaturedIndex(0);
			return;
		}
		if (featuredIndex >= featuredNews.length) {
			setFeaturedIndex(0);
			return;
		}
		const timer = window.setInterval(() => {
			setFeaturedIndex((current) => (current + 1) % featuredNews.length);
		}, 6e3);
		return () => {
			window.clearInterval(timer);
		};
	}, [featuredNews.length, featuredIndex]);
	const featuredItem = featuredNews[featuredIndex] ?? featuredNews[0];
	(0, import_react.useEffect)(() => {
		let active = true;
		fetchAnimeCalendar().then((items) => {
			if (active) setCalendarEpisodes(items);
		});
		return () => {
			active = false;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!calendarEpisodes.length) {
			setRecommendations([]);
			return;
		}
		let active = true;
		fetchAnimeRecommendations(calendarEpisodes.map((item) => item.id)).then((items) => {
			if (active) setRecommendations(items);
		});
		return () => {
			active = false;
		};
	}, [calendarEpisodes]);
	const hotNews = (0, import_react.useMemo)(() => {
		return news.slice(0, 6);
	}, [news]);
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
	const handleSearchSubmit = (event) => {
		event.preventDefault();
		const query = searchQuery.trim();
		if (!query) return;
		setSearchOpen(false);
		navigate({
			to: "/news",
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
			to: "/news/search",
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
				to: "/news",
				search: {},
				resetScroll: false
			});
			setSearchOpen(false);
			setSearchQuery("");
			return;
		}
		navigate({ to: "/" });
	};
	const goToPage = (page) => {
		navigate({
			to: "/news",
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
	const visibleNews = (0, import_react.useMemo)(() => {
		const start = (currentPage - 1) * NEWS_PER_PAGE;
		return displayedNews.slice(start, start + NEWS_PER_PAGE);
	}, [displayedNews, currentPage]);
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
							lineNumber: 583,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Voltar" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 585,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 569,
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
							lineNumber: 617,
							columnNumber: 17
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Fechar" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 619,
							columnNumber: 17
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 616,
							columnNumber: 27
						}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Search, { className: "size-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 623,
							columnNumber: 17
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Buscar" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 625,
							columnNumber: 17
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 622,
							columnNumber: 21
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 590,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 562,
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
									placeholder: "Buscar notícias...",
									enterKeyHint: "search",
									autoComplete: "off",
									className: "\n                    h-14\n                    w-full\n                    rounded-2xl\n                    border\n                    border-border\n                    bg-elevated\n                    pl-4\n                    pr-24\n                    text-base\n                    text-fg\n                    outline-none\n                    placeholder:text-muted\n                    focus:border-fg/30\n                  ",
									"aria-label": "Buscar notícias"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 651,
									columnNumber: 17
								}, this),
								searchQuery.trim() && /* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: clearSearchInput,
									className: "\n                      absolute\n                      right-12\n                      flex\n                      size-10\n                      items-center\n                      justify-center\n                      rounded-xl\n                      text-muted\n                      transition\n                      hover:bg-background\n                      hover:text-fg\n                      active:scale-95\n                    ",
									"aria-label": "Limpar busca",
									children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 681,
										columnNumber: 21
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 667,
									columnNumber: 40
								}, this),
								/* @__PURE__ */ (void 0)("button", {
									type: "submit",
									className: "\n                    absolute\n                    right-2\n                    flex\n                    size-10\n                    items-center\n                    justify-center\n                    rounded-xl\n                    text-muted\n                    transition\n                    hover:bg-background\n                    hover:text-fg\n                    active:scale-95\n                  ",
									"aria-label": "Pesquisar notícias",
									children: /* @__PURE__ */ (void 0)(Search, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 698,
										columnNumber: 19
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 684,
									columnNumber: 17
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 646,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 645,
						columnNumber: 13
					}, this), searchQuery.trim() && /* @__PURE__ */ (void 0)("div", {
						className: "mt-3",
						children: previewSearchResults.length === 0 ? /* @__PURE__ */ (void 0)("div", {
							className: "\n                      rounded-2xl\n                      bg-surface\n                      px-4\n                      py-6\n                      text-center\n                      text-sm\n                      text-muted\n                    ",
							children: "Nenhuma notícia encontrada."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 708,
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
										lineNumber: 750,
										columnNumber: 29
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 743,
									columnNumber: 27
								}, this), /* @__PURE__ */ (void 0)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (void 0)("p", {
										className: "\n                                line-clamp-2\n                                text-sm\n                                font-semibold\n                                text-fg\n                              ",
										children: item.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 758,
										columnNumber: 29
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "\n                                mt-1\n                                text-xs\n                                text-muted\n                              ",
										children: [
											item.type,
											" · ",
											item.date,
											" · ",
											formatRelativeNewsTime(item.publishedAt || item.date, "time" in item && typeof item.time === "string" ? item.time : void 0)
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 767,
										columnNumber: 29
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 757,
									columnNumber: 27
								}, this)]
							}, item.id, true, {
								fileName: _jsxFileName,
								lineNumber: 728,
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
								lineNumber: 785,
								columnNumber: 54
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 718,
							columnNumber: 28
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 707,
						columnNumber: 36
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 636,
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
								lineNumber: 830,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 821,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
							className: "\n                  text-2xl\n                  font-semibold\n                  tracking-tight\n                ",
							children: isSearchMode ? "Resultados da busca" : "Notícias"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 834,
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
									lineNumber: 849,
									columnNumber: 21
								}, this)
							] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 847,
								columnNumber: 33
							}, this) : "Fique por dentro das novidades do mundo dos animes."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 842,
							columnNumber: 15
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 833,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 816,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 815,
					columnNumber: 9
				}, this),
				!isSearchMode && featuredItem && /* @__PURE__ */ (void 0)("section", {
					className: "mb-7",
					children: /* @__PURE__ */ (void 0)(Link, {
						to: "/news/$id",
						params: { id: featuredItem.id },
						search: { page: currentPage },
						className: "\n                group\n                relative\n                block\n                overflow-hidden\n                rounded-3xl\n                border\n                border-border\n                bg-card\n                shadow-sm\n              ",
						children: [/* @__PURE__ */ (void 0)("div", {
							className: "\n                  relative\n                  aspect-[16/8]\n                  min-h-[220px]\n                  w-full\n                  overflow-hidden\n                  bg-black\n                  sm:aspect-[16/7]\n                  lg:aspect-[16/6]\n                ",
							children: [
								/* @__PURE__ */ (void 0)("img", {
									src: featuredItem.bannerImage || featuredItem.image,
									alt: featuredItem.title,
									className: "\n                    absolute\n                    inset-0\n                    h-full\n                    w-full\n                    object-cover\n                    transition-transform\n                    duration-700\n                    group-hover:scale-[1.02]\n                  ",
									loading: "eager"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 888,
									columnNumber: 17
								}, this),
								/* @__PURE__ */ (void 0)("div", { className: "\n                    absolute\n                    inset-0\n                    bg-gradient-to-t\n                    from-black\n                    via-black/55\n                    to-black/5\n                  " }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 899,
									columnNumber: 17
								}, this),
								/* @__PURE__ */ (void 0)("div", {
									className: "\n                    absolute\n                    inset-x-0\n                    bottom-0\n                    p-5\n                    sm:p-7\n                    lg:p-8\n                  ",
									children: [
										/* @__PURE__ */ (void 0)("span", {
											className: "\n                      inline-flex\n                      rounded-md\n                      bg-black/70\n                      px-2\n                      py-1\n                      text-[10px]\n                      font-semibold\n                      uppercase\n                      tracking-wide\n                      text-white\n                    ",
											children: featuredItem.type
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 916,
											columnNumber: 19
										}, this),
										/* @__PURE__ */ (void 0)("h2", {
											className: "\n                      mt-3\n                      max-w-4xl\n                      line-clamp-2\n                      text-xl\n                      font-bold\n                      leading-tight\n                      text-white\n                      sm:text-2xl\n                      lg:text-3xl\n                    ",
											children: featuredItem.title
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 931,
											columnNumber: 19
										}, this),
										/* @__PURE__ */ (void 0)("p", {
											className: "\n                      mt-2\n                      hidden\n                      max-w-3xl\n                      line-clamp-2\n                      text-sm\n                      leading-relaxed\n                      text-white/75\n                      sm:block\n                    ",
											children: featuredItem.description
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 945,
											columnNumber: 19
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 908,
									columnNumber: 17
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 878,
							columnNumber: 15
						}, this), /* @__PURE__ */ (void 0)("div", {
							className: "\n                  flex\n                  items-center\n                  justify-center\n                  gap-1.5\n                  bg-black/35\n                  px-4\n                  py-2.5\n                  backdrop-blur-sm\n                ",
							children: featuredNews.map((item, index) => /* @__PURE__ */ (void 0)("span", { className: `
                      h-1.5
                      rounded-full
                      transition-all
                      ${index === featuredIndex ? "w-6 bg-accent" : "w-1.5 bg-muted/50"}
                    ` }, item.id, false, {
								fileName: _jsxFileName,
								lineNumber: 970,
								columnNumber: 52
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 960,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 863,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 862,
					columnNumber: 43
				}, this),
				isSearchMode && /* @__PURE__ */ (void 0)("div", {
					className: "\n              mb-5\n              flex\n              items-center\n              gap-2\n              text-sm\n              text-muted\n            ",
					children: [/* @__PURE__ */ (void 0)(Search, { className: "size-4" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 992,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)("span", { children: [
						searchResults.length,
						" ",
						searchResults.length === 1 ? "resultado encontrado" : "resultados encontrados"
					] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 994,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 984,
					columnNumber: 26
				}, this),
				visibleNews.length > 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
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
										lineNumber: 1032,
										columnNumber: 23
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "\n                          absolute\n                          inset-x-0\n                          bottom-0\n                          h-1/2\n                          bg-gradient-to-t\n                          from-black/80\n                          via-black/20\n                          to-transparent\n                        " }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1041,
										columnNumber: 23
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "\n                          absolute\n                          bottom-3\n                          left-3\n                          rounded-md\n                          bg-black/70\n                          px-2\n                          py-1\n                          text-[10px]\n                          font-semibold\n                          uppercase\n                          tracking-wide\n                          text-white\n                        ",
										children: item.type
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1052,
										columnNumber: 23
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1025,
								columnNumber: 21
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "p-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
										className: "\n                          line-clamp-2\n                          text-base\n                          font-semibold\n                          leading-snug\n                        ",
										children: item.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1071,
										columnNumber: 23
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "\n                          mt-2\n                          line-clamp-3\n                          text-sm\n                          leading-relaxed\n                          text-muted\n                        ",
										children: item.description
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1080,
										columnNumber: 23
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "\n                          mt-4\n                          flex\n                          items-center\n                          gap-2\n                          text-xs\n                          text-muted\n                        ",
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CalendarDays, { className: "size-3.5" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1098,
											columnNumber: 25
										}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [
											item.date,
											" · ",
											formatRelativeNewsTime(item.publishedAt || item.date, "time" in item && typeof item.time === "string" ? item.time : void 0)
										] }, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 1100,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1090,
										columnNumber: 23
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1070,
								columnNumber: 21
							}, this)]
						}, item.id, true, {
							fileName: _jsxFileName,
							lineNumber: 1011,
							columnNumber: 40
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1005,
						columnNumber: 13
					}, this),
					totalPages > 1 && /* @__PURE__ */ (void 0)("nav", {
						className: "\n                  mt-8\n                  flex\n                  flex-col\n                  items-center\n                  gap-3\n                ",
						children: [/* @__PURE__ */ (void 0)("div", {
							className: "\n                    flex\n                    items-center\n                    gap-1.5\n                    overflow-x-auto\n                    px-1\n                    pb-1\n                  ",
							children: [
								/* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => goToPage(currentPage - 1),
									disabled: currentPage === 1,
									className: "\n                      flex\n                      size-9\n                      shrink-0\n                      items-center\n                      justify-center\n                      rounded-full\n                      border\n                      border-border\n                      bg-card\n                      text-muted\n                      disabled:opacity-30\n                    ",
									children: /* @__PURE__ */ (void 0)(ChevronLeft, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1140,
										columnNumber: 21
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1127,
									columnNumber: 19
								}, this),
								Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => /* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => goToPage(page),
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
                          ${currentPage === page ? "border-accent/50 bg-accent/15 text-accent" : "border-border bg-card text-muted"}
                        `,
									children: page
								}, page, false, {
									fileName: _jsxFileName,
									lineNumber: 1145,
									columnNumber: 53
								}, this)),
								/* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => goToPage(currentPage + 1),
									disabled: currentPage === totalPages,
									className: "\n                      flex\n                      size-9\n                      shrink-0\n                      items-center\n                      justify-center\n                      rounded-full\n                      border\n                      border-border\n                      bg-card\n                      text-muted\n                      disabled:opacity-30\n                    ",
									children: /* @__PURE__ */ (void 0)(ChevronRight, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1173,
										columnNumber: 21
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1160,
									columnNumber: 19
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1119,
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
							lineNumber: 1177,
							columnNumber: 17
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 1112,
						columnNumber: 32
					}, this),
					!isSearchMode && hotNews.length > 0 && /* @__PURE__ */ (void 0)("section", {
						className: "mt-10",
						children: [/* @__PURE__ */ (void 0)("div", {
							className: "mb-4",
							children: /* @__PURE__ */ (void 0)("h2", {
								className: "text-xl font-semibold tracking-tight",
								children: "Em alta"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1191,
								columnNumber: 19
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1190,
							columnNumber: 17
						}, this), /* @__PURE__ */ (void 0)("div", {
							className: "\n                    flex\n                    gap-4\n                    overflow-x-auto\n                    pb-2\n                    snap-x\n                    snap-mandatory\n                    [scrollbar-width:none]\n                    [&::-webkit-scrollbar]:hidden\n                  ",
							children: hotNews.map((item) => /* @__PURE__ */ (void 0)(Link, {
								to: "/news/$id",
								params: { id: item.id },
								search: { page: currentPage },
								className: "\n                        group\n                        w-[78vw]\n                        max-w-[340px]\n                        shrink-0\n                        snap-start\n                        overflow-hidden\n                        rounded-3xl\n                        border\n                        border-border\n                        bg-card\n                        transition\n                        hover:bg-elevated\n                        sm:w-[300px]\n                      ",
								children: [/* @__PURE__ */ (void 0)("div", {
									className: "relative aspect-[16/9] w-full overflow-hidden bg-black",
									children: [
										/* @__PURE__ */ (void 0)("img", {
											src: item.image,
											alt: item.title,
											className: "\n                            h-full\n                            w-full\n                            object-cover\n                            transition-transform\n                            duration-500\n                            group-hover:scale-[1.03]\n                          ",
											loading: "lazy"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1226,
											columnNumber: 25
										}, this),
										/* @__PURE__ */ (void 0)("div", { className: "absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1234,
											columnNumber: 25
										}, this),
										/* @__PURE__ */ (void 0)("span", {
											className: "\n                            absolute\n                            bottom-3\n                            left-3\n                            rounded-md\n                            bg-black/70\n                            px-2\n                            py-1\n                            text-[10px]\n                            font-semibold\n                            uppercase\n                            tracking-wide\n                            text-white\n                          ",
											children: item.type
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1235,
											columnNumber: 25
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1225,
									columnNumber: 23
								}, this), /* @__PURE__ */ (void 0)("div", {
									className: "p-4",
									children: [/* @__PURE__ */ (void 0)("h3", {
										className: "\n                            line-clamp-2\n                            text-sm\n                            font-semibold\n                            leading-snug\n                          ",
										children: item.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1254,
										columnNumber: 25
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-2 text-xs text-muted",
										children: [
											item.date,
											" · ",
											formatRelativeNewsTime(item.publishedAt || item.date, "time" in item && typeof item.time === "string" ? item.time : void 0)
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1262,
										columnNumber: 25
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1253,
									columnNumber: 23
								}, this)]
							}, item.id, true, {
								fileName: _jsxFileName,
								lineNumber: 1206,
								columnNumber: 40
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1196,
							columnNumber: 17
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 1189,
						columnNumber: 53
					}, this)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1004,
					columnNumber: 35
				}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
					className: "\n              flex\n              min-h-[220px]\n              flex-col\n              items-center\n              justify-center\n              rounded-3xl\n              border\n              border-border\n              bg-card\n              px-6\n              text-center\n            ",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Newspaper, { className: "mb-3 size-8 text-muted" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1282,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-base font-medium",
							children: "Nenhuma notícia encontrada."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1284,
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
									lineNumber: 1294,
									columnNumber: 17
								}, this),
								"."
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1288,
							columnNumber: 30
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1269,
					columnNumber: 17
				}, this),
				!isSearchMode && recommendations.length > 0 && /* @__PURE__ */ (void 0)("section", {
					className: "mt-10",
					children: [/* @__PURE__ */ (void 0)("div", {
						className: "mb-4",
						children: /* @__PURE__ */ (void 0)("h2", {
							className: "text-xl font-semibold tracking-tight",
							children: "Recomendações"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1307,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1306,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)("div", {
						className: "\n                grid\n                grid-cols-2\n                gap-3\n                sm:grid-cols-3\n                sm:gap-4\n                lg:grid-cols-4\n              ",
						children: recommendations.map((item) => /* @__PURE__ */ (void 0)(Link, {
							to: "/anime/$id",
							params: { id: String(item.id) },
							className: "block min-w-0",
							children: /* @__PURE__ */ (void 0)("article", {
								className: "\n                      min-w-0\n                      overflow-hidden\n                      rounded-3xl\n                      border\n                      border-border\n                      bg-card\n                    ",
								children: [/* @__PURE__ */ (void 0)("div", {
									className: "relative aspect-[3/4] w-full overflow-hidden bg-black",
									children: /* @__PURE__ */ (void 0)("img", {
										src: item.image,
										alt: item.title,
										className: "h-full w-full object-cover object-center",
										loading: "lazy"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1332,
										columnNumber: 23
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1331,
									columnNumber: 21
								}, this), /* @__PURE__ */ (void 0)("div", {
									className: "p-3 sm:p-4",
									children: /* @__PURE__ */ (void 0)("h3", {
										className: "line-clamp-2 text-sm font-semibold leading-snug sm:text-base",
										children: item.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1336,
										columnNumber: 23
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1335,
									columnNumber: 21
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1323,
								columnNumber: 19
							}, this)
						}, item.id, false, {
							fileName: _jsxFileName,
							lineNumber: 1320,
							columnNumber: 44
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1312,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1305,
					columnNumber: 57
				}, this),
				!isSearchMode && calendarEpisodes.length > 0 && /* @__PURE__ */ (void 0)("section", {
					className: "mt-10",
					children: [/* @__PURE__ */ (void 0)("div", {
						className: "mb-4",
						children: /* @__PURE__ */ (void 0)("h2", {
							className: "text-xl font-semibold tracking-tight",
							children: "Calendário de Anime"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1351,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1350,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)("div", {
						className: "\n                grid\n                grid-cols-2\n                gap-3\n                sm:grid-cols-2\n                sm:gap-4\n                lg:grid-cols-4\n              ",
						children: calendarEpisodes.map((item) => /* @__PURE__ */ (void 0)(Link, {
							to: "/anime/$id",
							params: { id: String(item.id) },
							className: "block min-w-0",
							children: /* @__PURE__ */ (void 0)("article", {
								className: "\n                      min-w-0\n                      overflow-hidden\n                      rounded-3xl\n                      border\n                      border-border\n                      bg-card\n                    ",
								children: [/* @__PURE__ */ (void 0)("div", {
									className: "relative w-full overflow-hidden bg-black",
									children: [/* @__PURE__ */ (void 0)("div", {
										className: "sm:hidden",
										children: /* @__PURE__ */ (void 0)("div", {
											className: "relative aspect-[3/4] w-full overflow-hidden",
											children: /* @__PURE__ */ (void 0)("img", {
												src: item.coverImage,
												alt: item.title,
												className: "h-full w-full object-cover object-center",
												loading: "lazy"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 1378,
												columnNumber: 27
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1377,
											columnNumber: 25
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1376,
										columnNumber: 23
									}, this), /* @__PURE__ */ (void 0)("div", {
										className: "hidden sm:block",
										children: /* @__PURE__ */ (void 0)("div", {
											className: "relative aspect-[16/7] w-full overflow-hidden bg-black",
											children: /* @__PURE__ */ (void 0)("img", {
												src: item.image,
												alt: item.title,
												className: "h-full w-full object-cover object-center",
												loading: "lazy"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 1384,
												columnNumber: 27
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1383,
											columnNumber: 25
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1382,
										columnNumber: 23
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1375,
									columnNumber: 21
								}, this), /* @__PURE__ */ (void 0)("div", {
									className: "p-3 sm:p-4",
									children: [
										/* @__PURE__ */ (void 0)("p", {
											className: "whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-accent sm:text-xs",
											children: [
												formatCalendarDayName(item.airingAt),
												", ",
												formatCalendarDate(item.airingAt),
												" · ",
												formatCalendarTime(item.airingAt)
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 1390,
											columnNumber: 21
										}, this),
										/* @__PURE__ */ (void 0)("h3", {
											className: "mt-2 line-clamp-2 text-sm font-semibold leading-snug sm:text-base",
											children: item.title
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1393,
											columnNumber: 21
										}, this),
										/* @__PURE__ */ (void 0)("p", {
											className: "mt-2 text-xs text-muted",
											children: ["Episódio ", item.episode]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 1396,
											columnNumber: 21
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1389,
									columnNumber: 19
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1367,
								columnNumber: 19
							}, this)
						}, `${item.id}-${item.airingAt}-${item.episode}`, false, {
							fileName: _jsxFileName,
							lineNumber: 1364,
							columnNumber: 45
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1356,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1349,
					columnNumber: 58
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 547,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 546,
		columnNumber: 10
	}, this);
}
//#endregion
export { NewsPage as component };
