import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore } from "./types-CX6YV1cu.mjs";
import { dt as ChevronLeft, f as TrendingUp, g as Star, gt as CalendarDays, m as Tags, ut as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { H as AnimeCard, k as overlayList, l as Route$18 } from "./router-Dx2-dd95.mjs";
import { t as NativeSelect } from "./native-select-DtoSTrFt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/browse._section-8HrIX6x1.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/browse.$section.tsx?tsr-split=component";
var SEASONS = [
	{
		value: "WINTER",
		label: "Inverno",
		icon: "❄️"
	},
	{
		value: "SPRING",
		label: "Primavera",
		icon: "🌸"
	},
	{
		value: "SUMMER",
		label: "Verão",
		icon: "☀️"
	},
	{
		value: "FALL",
		label: "Outono",
		icon: "🍂"
	}
];
var YEARS = Array.from({ length: 29 }, (_, index) => 2e3 + index);
function cnCalendarSeason(active) {
	return [
		"flex",
		"min-h-12",
		"items-center",
		"justify-center",
		"gap-2",
		"rounded-lg",
		"border",
		"px-4",
		"text-sm",
		"font-medium",
		"transition-colors",
		active ? "border-fg/20 bg-elevated text-fg" : "border-border text-muted hover:bg-elevated hover:text-fg"
	].join(" ");
}
function cnGenre() {
	return [
		"flex",
		"min-h-12",
		"items-center",
		"gap-3",
		"rounded-xl",
		"border",
		"border-border",
		"bg-surface",
		"px-4",
		"text-sm",
		"font-medium",
		"text-fg",
		"transition-colors",
		"hover:bg-elevated"
	].join(" ");
}
function BrowsePage() {
	const navigate = useNavigate();
	const { result, section, season, year, page, genres, genre } = Route$18.useLoaderData();
	const locals = useHikariStore((s) => s.animes);
	if (section === "genres" && !genre) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 py-5 sm:space-y-8 sm:py-8",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex items-center gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Tags, { className: "size-5 text-fg" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 66,
					columnNumber: 15
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 65,
				columnNumber: 13
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
				className: "font-display text-2xl tracking-tight sm:text-3xl",
				children: "Gêneros"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 70,
				columnNumber: 15
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Explore os animes por gênero."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 74,
				columnNumber: 15
			}, this)] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 69,
				columnNumber: 13
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 64,
			columnNumber: 11
		}, this) }, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 63,
			columnNumber: 9
		}, this), genres.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
			className: "py-16 text-center text-muted",
			children: "Nenhum gênero disponível no momento."
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 81,
			columnNumber: 32
		}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
			children: genres.map((item) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
				type: "button",
				onClick: () => {
					navigate({
						to: "/browse/$section",
						params: { section: "genres" },
						search: {
							genre: item,
							page: 1
						}
					});
				},
				className: cnGenre(),
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Tags, { className: "size-4 shrink-0 text-muted" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 97,
					columnNumber: 21
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
					className: "truncate",
					children: item
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 99,
					columnNumber: 21
				}, this)]
			}, item, true, {
				fileName: _jsxFileName,
				lineNumber: 85,
				columnNumber: 35
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 84,
			columnNumber: 13
		}, this) }, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 83,
			columnNumber: 18
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 62,
		columnNumber: 12
	}, this);
	if (section === "genres" && genre) {
		const items = overlayList(result?.items ?? [], locals);
		const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / 24));
		const currentPage = Math.min(page, totalPages);
		const showPagination = totalPages > 1;
		const pageNumbers = (() => {
			const pages = [];
			const start = Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4));
			for (let value = start; value <= Math.min(totalPages, start + 4); value += 1) pages.push(value);
			return pages;
		})();
		function goToGenrePage(nextPage) {
			if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
			navigate({
				to: "/browse/$section",
				params: { section: "genres" },
				search: {
					genre,
					page: nextPage
				}
			});
		}
		return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "space-y-6 py-5 sm:space-y-8 sm:py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex min-w-0 items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Tags, { className: "size-5 text-fg" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 145,
								columnNumber: 17
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 144,
							columnNumber: 15
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
								className: "font-display text-2xl tracking-tight sm:text-3xl",
								children: genre
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 149,
								columnNumber: 17
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-sm text-muted",
								children: [
									"Animes do gênero ",
									genre,
									"."
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 153,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 148,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 143,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/browse/$section",
						params: { section: "genres" },
						"aria-label": "Fechar gênero",
						title: "Voltar para gêneros",
						className: "flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-elevated hover:text-fg",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "text-2xl leading-none",
							"aria-hidden": "true",
							children: "×"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 162,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 159,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 142,
					columnNumber: 11
				}, this) }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 141,
					columnNumber: 9
				}, this),
				items.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "py-16 text-center text-muted",
					children: "Nenhum anime encontrado para este gênero."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 169,
					columnNumber: 31
				}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6",
					children: items.map((anime) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCard, {
						anime,
						size: "lg"
					}, anime.id, false, {
						fileName: _jsxFileName,
						lineNumber: 172,
						columnNumber: 33
					}, this))
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 171,
					columnNumber: 18
				}, this),
				showPagination && /* @__PURE__ */ (void 0)("div", {
					className: "flex flex-wrap items-center justify-center gap-1 pt-2",
					children: [
						/* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => goToGenrePage(Math.max(1, currentPage - 5)),
							disabled: currentPage <= 1,
							"aria-label": "Voltar 5 páginas",
							title: "Voltar 5 páginas",
							className: "flex size-10 items-center justify-center rounded-lg border border-border text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
							children: "«"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 176,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => goToGenrePage(currentPage - 1),
							disabled: currentPage === 1,
							"aria-label": "Página anterior",
							className: "flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
							children: /* @__PURE__ */ (void 0)(ChevronLeft, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 181,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 180,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "flex items-center gap-1",
							children: pageNumbers.map((pageNumber) => /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => goToGenrePage(pageNumber),
								"aria-current": pageNumber === currentPage ? "page" : void 0,
								className: pageNumber === currentPage ? "flex size-10 items-center justify-center rounded-lg bg-elevated text-sm font-semibold text-fg" : "flex size-10 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-elevated hover:text-fg",
								children: pageNumber
							}, pageNumber, false, {
								fileName: _jsxFileName,
								lineNumber: 185,
								columnNumber: 46
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 184,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => goToGenrePage(currentPage + 1),
							disabled: currentPage >= totalPages,
							"aria-label": "Próxima página",
							className: "flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
							children: /* @__PURE__ */ (void 0)(ChevronRight, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 191,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 190,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => goToGenrePage(Math.min(totalPages, currentPage + 5)),
							disabled: currentPage >= totalPages,
							"aria-label": "Avançar 5 páginas",
							title: "Avançar 5 páginas",
							className: "flex size-10 items-center justify-center rounded-lg border border-border text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
							children: "»"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 194,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 175,
					columnNumber: 28
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 140,
			columnNumber: 12
		}, this);
	}
	const items = overlayList(result?.items ?? [], locals);
	const isSeasonPage = section === "season";
	const sectionMeta = {
		popular: {
			title: "Populares",
			description: "Os animes mais populares.",
			Icon: Star
		},
		top: {
			title: "Mais bem avaliados",
			description: "Animes com as melhores avaliações.",
			Icon: Star
		},
		trending: {
			title: "Em alta",
			description: "Animes que estão em alta no momento.",
			Icon: TrendingUp
		},
		season: {
			title: "Calendário de animes",
			description: "Confira os animes de cada temporada.",
			Icon: CalendarDays
		}
	};
	const meta = sectionMeta[section] ?? sectionMeta.popular;
	const SectionIcon = meta.Icon;
	const currentSeason = SEASONS.find((item) => item.value === season);
	function handleYearChange(nextYear) {
		navigate({
			to: "/browse/$section",
			params: { section },
			search: {
				season,
				year: nextYear,
				page: 1
			}
		});
	}
	function handleSeasonChange(nextSeason) {
		navigate({
			to: "/browse/$section",
			params: { section },
			search: {
				season: nextSeason,
				year,
				page: 1
			}
		});
	}
	function goToPage(nextPage) {
		if (nextPage < 1 || nextPage === page) return;
		if (nextPage > page + 1) return;
		navigate({
			to: "/browse/$section",
			params: { section },
			search: {
				season,
				year,
				page: nextPage
			}
		});
	}
	const pageNumbers = (() => {
		const pages = /* @__PURE__ */ new Set();
		for (let value = 1; value <= Math.min(page + 1, 5); value += 1) pages.add(value);
		pages.add(page);
		if (result?.hasNext) pages.add(page + 1);
		return Array.from(pages).sort((a, b) => a - b);
	})();
	const showPagination = page > 1 || Boolean(result?.hasNext);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 py-5 sm:space-y-8 sm:py-8",
		children: [
			!isSeasonPage && /* @__PURE__ */ (void 0)("div", { children: /* @__PURE__ */ (void 0)(Link, {
				to: "/",
				className: "inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg",
				children: [/* @__PURE__ */ (void 0)(ChevronLeft, { className: "size-4" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 288,
					columnNumber: 13
				}, this), "Voltar"]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 287,
				columnNumber: 11
			}, this) }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 286,
				columnNumber: 25
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(SectionIcon, { className: "size-5 text-fg" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 297,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 296,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
					className: "font-display text-2xl tracking-tight sm:text-3xl",
					children: meta.title
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 301,
					columnNumber: 13
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-1 text-sm text-muted",
					children: meta.description
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 305,
					columnNumber: 13
				}, this)] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 300,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 295,
				columnNumber: 9
			}, this) }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 294,
				columnNumber: 7
			}, this),
			isSeasonPage && /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [
				/* @__PURE__ */ (void 0)("section", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (void 0)("p", {
						className: "text-xs font-semibold tracking-[0.16em] text-subtle uppercase",
						children: "Ano"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 315,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)(NativeSelect, {
						value: String(year),
						onChange: (event) => {
							handleYearChange(Number(event.target.value));
						},
						"aria-label": "Selecionar ano",
						children: YEARS.map((yearOption) => /* @__PURE__ */ (void 0)("option", {
							value: yearOption,
							children: yearOption
						}, yearOption, false, {
							fileName: _jsxFileName,
							lineNumber: 322,
							columnNumber: 40
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 319,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 314,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (void 0)("section", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (void 0)("p", {
						className: "text-xs font-semibold tracking-[0.16em] text-subtle uppercase",
						children: "Temporada"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 329,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)("div", {
						className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
						children: SEASONS.map((item) => /* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => handleSeasonChange(item.value),
							className: cnCalendarSeason(item.value === season),
							children: [/* @__PURE__ */ (void 0)("span", {
								className: "text-lg",
								children: item.icon
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 335,
								columnNumber: 21
							}, this), /* @__PURE__ */ (void 0)("span", { children: item.label }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 339,
								columnNumber: 21
							}, this)]
						}, item.value, true, {
							fileName: _jsxFileName,
							lineNumber: 334,
							columnNumber: 36
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 333,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 328,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (void 0)("section", {
					className: "border-b border-border pb-4",
					children: [/* @__PURE__ */ (void 0)("h2", {
						className: "font-display text-xl tracking-tight sm:text-2xl",
						children: [
							"Animes da temporada de",
							" ",
							currentSeason?.label ?? "Temporada",
							" ",
							year
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 347,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Confira a lista dos animes programados para esta temporada."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 353,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 346,
					columnNumber: 11
				}, this)
			] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 313,
				columnNumber: 24
			}, this),
			items.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "py-16 text-center text-muted",
				children: [
					"Nada por aqui.",
					" ",
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/",
						className: "text-fg underline",
						children: "Voltar"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 363,
						columnNumber: 11
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 361,
				columnNumber: 29
			}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6",
				children: items.map((anime) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCard, {
					anime,
					size: "lg"
				}, anime.id, false, {
					fileName: _jsxFileName,
					lineNumber: 367,
					columnNumber: 31
				}, this))
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 366,
				columnNumber: 16
			}, this),
			showPagination && /* @__PURE__ */ (void 0)("div", {
				className: "flex flex-wrap items-center justify-center gap-1 pt-2",
				children: [
					/* @__PURE__ */ (void 0)("button", {
						type: "button",
						onClick: () => goToPage(page - 1),
						disabled: page === 1,
						"aria-label": "Página anterior",
						className: "flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
						children: /* @__PURE__ */ (void 0)(ChevronLeft, { className: "size-5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 373,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 372,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (void 0)("div", {
						className: "flex items-center gap-1",
						children: pageNumbers.map((pageNumber) => /* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => goToPage(pageNumber),
							"aria-current": pageNumber === page ? "page" : void 0,
							className: pageNumber === page ? "flex size-10 items-center justify-center rounded-lg bg-elevated text-sm font-semibold text-fg" : "flex size-10 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-elevated hover:text-fg",
							children: pageNumber
						}, pageNumber, false, {
							fileName: _jsxFileName,
							lineNumber: 377,
							columnNumber: 44
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 376,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (void 0)("button", {
						type: "button",
						onClick: () => goToPage(page + 1),
						disabled: !result?.hasNext,
						"aria-label": "Próxima página",
						className: "flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
						children: /* @__PURE__ */ (void 0)(ChevronRight, { className: "size-5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 383,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 382,
						columnNumber: 11
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 371,
				columnNumber: 26
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 285,
		columnNumber: 10
	}, this);
}
//#endregion
export { BrowsePage as component };
