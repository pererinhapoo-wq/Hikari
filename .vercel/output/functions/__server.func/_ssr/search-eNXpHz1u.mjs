import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore } from "./types-CX6YV1cu.mjs";
import { a as STATUS_PT, i as SORT_OPTIONS, n as GENRE_PT, t as FORMAT_PT } from "./labels-BsexCKFj.mjs";
import { D as Search, dt as ChevronLeft, ut as ChevronRight, y as SlidersHorizontal } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { C as SearchPending, H as AnimeCard, S as Route$43, k as overlayList } from "./router-Dx2-dd95.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
import { t as Input } from "./input-DWrO9Aym.mjs";
import { t as Label } from "./label-BgLaS0nV.mjs";
import { t as NativeSelect } from "./native-select-DtoSTrFt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/search-eNXpHz1u.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/search.tsx?tsr-split=component";
var YEARS = Array.from({ length: 37 }, (_, i) => String(2026 - i));
function SearchPage() {
	const search = Route$43.useSearch();
	const navigate = Route$43.useNavigate();
	const { result, genres } = Route$43.useLoaderData();
	const locals = useHikariStore((s) => s.animes);
	const [clearingOnReload, setClearingOnReload] = (0, import_react.useState)(() => {
		if (typeof window === "undefined") return false;
		const navigation = window.performance.getEntriesByType("navigation")[0];
		const alreadyHandled = Boolean(window.__hikariSearchReloadHandled);
		if (navigation?.type === "reload" && !alreadyHandled) {
			window.__hikariSearchReloadHandled = true;
			return true;
		}
		return false;
	});
	const [draft, setDraft] = (0, import_react.useState)(() => search.q ?? "");
	const firstSearchSync = (0, import_react.useRef)(true);
	const [filtersOpen, setFiltersOpen] = (0, import_react.useState)(false);
	const currentPage = search.page ?? 1;
	(0, import_react.useEffect)(() => {
		if (!clearingOnReload) return;
		setDraft("");
		navigate({
			search: {
				genre: search.genre,
				adult: search.adult
			},
			replace: true
		}).finally(() => {
			setClearingOnReload(false);
		});
	}, [
		clearingOnReload,
		navigate,
		search.genre,
		search.adult
	]);
	(0, import_react.useEffect)(() => {
		if (firstSearchSync.current) {
			firstSearchSync.current = false;
			return;
		}
		if (clearingOnReload) return;
		setDraft(search.q ?? "");
	}, [search.q, clearingOnReload]);
	(0, import_react.useEffect)(() => {
		if (clearingOnReload) return;
		const q = draft.trim();
		if (q.length > 0 && q.length < 2) return;
		if (q === (search.q ?? "").trim()) return;
		const timer = window.setTimeout(() => {
			navigate({
				search: {
					...search,
					q: q || void 0,
					page: 1
				},
				replace: true
			});
		}, 700);
		return () => window.clearTimeout(timer);
	}, [
		draft,
		navigate,
		search,
		clearingOnReload
	]);
	const items = (0, import_react.useMemo)(() => {
		if (clearingOnReload) return [];
		const q = (search.q ?? "").trim().toLowerCase();
		const localHits = currentPage === 1 ? overlayList([], locals).filter((anime) => {
			const isHentai = anime.genres?.some((genre) => genre.trim().toLowerCase() === "hentai") ?? false;
			if (search.adult) {
				if (!isHentai) return false;
			} else if (isHentai) return false;
			if (q && !`${anime.titles.romaji} ${anime.titles.english} ${anime.titles.native}`.toLowerCase().includes(q)) return false;
			if (search.genre && !anime.genres.includes(search.genre)) return false;
			return true;
		}) : [];
		const remote = overlayList(result.items, locals).filter((anime) => {
			const isHentai = anime.genres?.some((genre) => genre.trim().toLowerCase() === "hentai") ?? false;
			return search.adult ? isHentai : !isHentai;
		});
		const seen = new Set(localHits.map((anime) => anime.id));
		return [...localHits, ...remote.filter((anime) => !seen.has(anime.id))];
	}, [
		currentPage,
		locals,
		result.items,
		search.q,
		search.genre,
		search.adult,
		clearingOnReload
	]);
	function apply(next) {
		navigate({ search: {
			...search,
			...next,
			page: 1
		} });
	}
	const genreOptions = genres.length ? genres : Object.keys(GENRE_PT);
	const hasAnimes = items.length > 0;
	const hasQuery = Boolean(search.q?.trim() || search.genre);
	const pageNumbers = (0, import_react.useMemo)(() => {
		const pages = /* @__PURE__ */ new Set();
		pages.add(1);
		if (currentPage <= 3) {
			pages.add(2);
			pages.add(3);
			pages.add(4);
			pages.add(5);
		} else {
			pages.add(currentPage - 2);
			pages.add(currentPage - 1);
			pages.add(currentPage);
			if (result.hasNext) pages.add(currentPage + 1);
		}
		return Array.from(pages).filter((page) => page >= 1).sort((a, b) => a - b);
	}, [currentPage, result.hasNext]);
	function goToPage(page) {
		if (page < 1 || page === currentPage) return;
		navigate({ search: {
			...search,
			page
		} });
	}
	if (clearingOnReload) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 pt-6",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex items-center gap-2",
			children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
				type: "button",
				variant: "ghost",
				size: "sm",
				onClick: () => window.history.back(),
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronLeft, { className: "size-4" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 292,
					columnNumber: 13
				}, this), "Voltar"]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 291,
				columnNumber: 11
			}, this)
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 290,
			columnNumber: 9
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(SearchPending, {}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 297,
			columnNumber: 9
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 288,
		columnNumber: 12
	}, this);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 pt-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
				type: "button",
				variant: "ghost",
				size: "sm",
				onClick: () => window.history.back(),
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronLeft, { className: "size-4" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 316,
					columnNumber: 11
				}, this), "Voltar"]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 315,
				columnNumber: 9
			}, this) }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 314,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "relative flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "relative flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 328,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
						value: draft,
						onChange: (e) => {
							setDraft(e.target.value);
						},
						placeholder: "Buscar animes…",
						className: "pl-10",
						"aria-label": "Buscar animes"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 330,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 326,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
					type: "button",
					variant: "outline",
					size: "icon",
					"aria-label": "Filtros",
					onClick: () => setFiltersOpen((value) => !value),
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(SlidersHorizontal, { className: "size-4" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 337,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 336,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 325,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: filtersOpen ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "hidden lg:grid lg:grid-cols-4 lg:gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
						label: "Gênero",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(NativeSelect, {
							value: search.genre ?? "",
							onChange: (e) => apply({ genre: e.target.value || void 0 }),
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
								value: "",
								children: "Todos"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 352,
								columnNumber: 13
							}, this), genreOptions.map((genre) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
								value: genre,
								children: GENRE_PT[genre] ?? genre
							}, genre, false, {
								fileName: _jsxFileName,
								lineNumber: 356,
								columnNumber: 40
							}, this))]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 349,
							columnNumber: 11
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 348,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
						label: "Ano",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(NativeSelect, {
							value: search.year ?? "",
							onChange: (e) => apply({ year: e.target.value || void 0 }),
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
								value: "",
								children: "Qualquer"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 367,
								columnNumber: 13
							}, this), YEARS.map((year) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
								value: year,
								children: year
							}, year, false, {
								fileName: _jsxFileName,
								lineNumber: 371,
								columnNumber: 32
							}, this))]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 364,
							columnNumber: 11
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 363,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
						label: "Formato",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(NativeSelect, {
							value: search.format ?? "",
							onChange: (e) => apply({ format: e.target.value || void 0 }),
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
								value: "",
								children: "Todos"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 382,
								columnNumber: 13
							}, this), Object.entries(FORMAT_PT).filter(([key]) => [
								"TV",
								"MOVIE",
								"OVA",
								"ONA",
								"SPECIAL",
								"TV_SHORT"
							].includes(key)).map(([key, value]) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
								value: key,
								children: value
							}, key, false, {
								fileName: _jsxFileName,
								lineNumber: 386,
								columnNumber: 148
							}, this))]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 379,
							columnNumber: 11
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 378,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
						label: "Status",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(NativeSelect, {
							value: search.status ?? "",
							onChange: (e) => apply({ status: e.target.value || void 0 }),
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
								value: "",
								children: "Todos"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 397,
								columnNumber: 13
							}, this), Object.entries(STATUS_PT).map(([key, value]) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
								value: key,
								children: value
							}, key, false, {
								fileName: _jsxFileName,
								lineNumber: 401,
								columnNumber: 62
							}, this))]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 394,
							columnNumber: 11
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 393,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
						label: "Ordenar",
						className: "lg:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(NativeSelect, {
							value: search.sort ?? "TRENDING_DESC",
							onChange: (e) => apply({ sort: e.target.value || void 0 }),
							children: SORT_OPTIONS.map((option) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
								value: option.value,
								children: option.label
							}, option.value, false, {
								fileName: _jsxFileName,
								lineNumber: 412,
								columnNumber: 41
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 409,
							columnNumber: 11
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 408,
						columnNumber: 9
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 345,
				columnNumber: 7
			}, this),
			hasQuery && hasAnimes && /* @__PURE__ */ (void 0)("section", {
				className: "space-y-5",
				children: [
					/* @__PURE__ */ (void 0)("div", {
						className: "flex items-end justify-between gap-3",
						children: /* @__PURE__ */ (void 0)("div", {
							className: "flex flex-wrap items-baseline gap-x-4 gap-y-1",
							children: [/* @__PURE__ */ (void 0)("h1", {
								className: "font-display text-2xl tracking-tight sm:text-3xl",
								children: "Resultados da busca"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 430,
								columnNumber: 17
							}, this), /* @__PURE__ */ (void 0)("span", {
								className: "text-sm text-muted",
								children: [
									items.length,
									" ",
									items.length === 1 ? "anime encontrado" : "animes encontrados"
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 434,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 428,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 426,
						columnNumber: 13
					}, this),
					/* @__PURE__ */ (void 0)("div", {
						className: "grid grid-cols-2 items-stretch gap-3 sm:grid-cols-4 lg:grid-cols-6",
						children: items.map((anime) => /* @__PURE__ */ (void 0)("div", {
							className: "min-w-0 [&>article]:w-full",
							children: /* @__PURE__ */ (void 0)(AnimeCard, { anime }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 446,
								columnNumber: 21
							}, this)
						}, anime.id, false, {
							fileName: _jsxFileName,
							lineNumber: 445,
							columnNumber: 35
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 443,
						columnNumber: 13
					}, this),
					(currentPage > 1 || result.hasNext) && /* @__PURE__ */ (void 0)("div", {
						className: "flex items-center justify-center gap-1 pt-4",
						children: [
							/* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => goToPage(currentPage - 1),
								disabled: currentPage === 1,
								"aria-label": "Página anterior",
								className: "flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
								children: /* @__PURE__ */ (void 0)(ChevronLeft, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 454,
									columnNumber: 19
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 453,
								columnNumber: 17
							}, this),
							/* @__PURE__ */ (void 0)("div", {
								className: "flex items-center gap-1",
								children: [pageNumbers.map((page) => /* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => goToPage(page),
									"aria-current": page === currentPage ? "page" : void 0,
									className: page === currentPage ? "flex size-10 items-center justify-center rounded-lg bg-elevated text-sm font-semibold text-fg" : "flex size-10 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-elevated hover:text-fg",
									children: page
								}, page, false, {
									fileName: _jsxFileName,
									lineNumber: 459,
									columnNumber: 44
								}, this)), result.hasNext && currentPage <= 3 && /* @__PURE__ */ (void 0)("span", {
									className: "flex size-10 items-center justify-center text-sm text-muted",
									children: "…"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 463,
									columnNumber: 58
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 457,
								columnNumber: 17
							}, this),
							/* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => goToPage(currentPage + 1),
								disabled: !result.hasNext,
								"aria-label": "Próxima página",
								className: "flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
								children: /* @__PURE__ */ (void 0)(ChevronRight, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 470,
									columnNumber: 19
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 469,
								columnNumber: 17
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 451,
						columnNumber: 53
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 424,
				columnNumber: 33
			}, this),
			!hasQuery && /* @__PURE__ */ (void 0)("div", {
				className: "py-20 text-center",
				children: [
					/* @__PURE__ */ (void 0)(Search, { className: "mx-auto size-8 text-subtle" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 483,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (void 0)("p", {
						className: "mt-4 font-display text-2xl",
						children: "Pesquise um anime"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 485,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (void 0)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Digite o nome do anime para ver os resultados."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 489,
						columnNumber: 11
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 481,
				columnNumber: 21
			}, this),
			hasQuery && !hasAnimes && /* @__PURE__ */ (void 0)("div", {
				className: "py-20 text-center",
				children: [
					/* @__PURE__ */ (void 0)("p", {
						className: "font-display text-2xl",
						children: "Nada encontrado"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 501,
						columnNumber: 13
					}, this),
					/* @__PURE__ */ (void 0)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Tente outro título ou limpe os filtros."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 505,
						columnNumber: 13
					}, this),
					/* @__PURE__ */ (void 0)(Link, {
						to: "/search",
						className: "mt-4 inline-block text-sm text-fg underline",
						children: "Limpar busca"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 511,
						columnNumber: 13
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 499,
				columnNumber: 34
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 308,
		columnNumber: 10
	}, this);
}
function Field({ label, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("label", {
		className,
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Label, {
			className: "mb-1.5 block",
			children: label
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 529,
			columnNumber: 7
		}, this), children]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 528,
		columnNumber: 10
	}, this);
}
//#endregion
export { SearchPage as component };
