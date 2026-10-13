import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { dt as ChevronLeft, gt as CalendarDays, ut as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { H as AnimeCard, T as Route$48 } from "./router-Dx2-dd95.mjs";
import { t as NativeSelect } from "./native-select-DtoSTrFt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar-DRz1risW.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/calendar.tsx?tsr-split=component";
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
function CalendarPage() {
	const navigate = useNavigate();
	const { items, season, year, page, lastPage, hasNext, total } = Route$48.useLoaderData();
	const currentSeason = SEASONS.find((item) => item.value === season);
	function handleYearChange(nextYear) {
		navigate({
			to: "/calendar",
			search: {
				season,
				year: nextYear,
				page: 1
			}
		});
	}
	function handleSeasonChange(nextSeason) {
		navigate({
			to: "/calendar",
			search: {
				season: nextSeason,
				year,
				page: 1
			}
		});
	}
	function goToPage(nextPage) {
		if (nextPage < 1 || nextPage === page || nextPage > lastPage) return;
		navigate({
			to: "/calendar",
			search: {
				season,
				year,
				page: nextPage
			}
		});
	}
	const pageNumbers = (() => {
		if (lastPage <= 1) return [1];
		const pages = /* @__PURE__ */ new Set();
		pages.add(1);
		if (page <= 3) for (let value = 2; value <= Math.min(5, lastPage); value += 1) pages.add(value);
		else {
			pages.add(Math.max(2, page - 2));
			pages.add(Math.max(2, page - 1));
			pages.add(page);
			pages.add(Math.min(lastPage, page + 1));
			pages.add(Math.min(lastPage, page + 2));
		}
		pages.add(lastPage);
		return Array.from(pages).filter((value) => value >= 1 && value <= lastPage).sort((a, b) => a - b);
	})();
	const showPagination = lastPage > 1;
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 py-5 sm:space-y-8 sm:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CalendarDays, { className: "size-5 text-fg" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 142,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 141,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
					className: "font-display text-2xl tracking-tight sm:text-3xl",
					children: "Calendário de animes"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 146,
					columnNumber: 13
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Confira os animes de cada temporada."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 150,
					columnNumber: 13
				}, this)] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 145,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 140,
				columnNumber: 9
			}, this) }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 139,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-xs font-semibold tracking-[0.16em] text-subtle uppercase",
					children: "Ano"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 159,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(NativeSelect, {
					value: String(year),
					onChange: (event) => {
						handleYearChange(Number(event.target.value));
					},
					"aria-label": "Selecionar ano",
					children: YEARS.map((yearOption) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
						value: yearOption,
						children: yearOption
					}, yearOption, false, {
						fileName: _jsxFileName,
						lineNumber: 166,
						columnNumber: 36
					}, this))
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 163,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 158,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-xs font-semibold tracking-[0.16em] text-subtle uppercase",
					children: "Temporada"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 174,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
					children: SEASONS.map((item) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/calendar",
						search: {
							season: item.value,
							year,
							page: 1
						},
						onClick: () => handleSeasonChange(item.value),
						className: cnCalendarSeason(item.value === season),
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "text-lg",
							children: item.icon
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 184,
							columnNumber: 17
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: item.label }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 188,
							columnNumber: 17
						}, this)]
					}, item.value, true, {
						fileName: _jsxFileName,
						lineNumber: 179,
						columnNumber: 32
					}, this))
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 178,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 173,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "border-b border-border pb-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "font-display text-xl tracking-tight sm:text-2xl",
					children: [
						"Animes da temporada de",
						" ",
						currentSeason?.label ?? "anime",
						" ",
						year
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 197,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Confira a lista dos animes programados para esta temporada."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 203,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 196,
				columnNumber: 7
			}, this),
			items.length > 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "grid grid-cols-2 items-stretch gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6 lg:grid-cols-6",
				children: items.map((anime) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "\n                  flex\n                  min-w-0\n                  h-full\n                  [&>article]:flex\n                  [&>article]:h-full\n                  [&>article]:w-full\n                  [&>article>a]:flex\n                  [&>article>a]:h-full\n                  [&>article>a]:w-full\n                  [&>article>a]:flex-col\n                ",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCard, {
						anime,
						size: "lg"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 223,
						columnNumber: 17
					}, this)
				}, anime.id, false, {
					fileName: _jsxFileName,
					lineNumber: 211,
					columnNumber: 31
				}, this))
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 210,
				columnNumber: 27
			}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "rounded-xl border border-border bg-elevated/40 px-5 py-14 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CalendarDays, { className: "mx-auto size-8 text-muted" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 226,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
						className: "mt-3 font-medium",
						children: "Nenhum anime encontrado"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 228,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Não encontramos animes para esta temporada."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 232,
						columnNumber: 11
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 225,
				columnNumber: 22
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
							lineNumber: 241,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 240,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (void 0)("div", {
						className: "flex items-center gap-1",
						children: pageNumbers.map((pageNumber, index) => {
							const previous = pageNumbers[index - 1];
							return /* @__PURE__ */ (void 0)("div", {
								className: "flex items-center gap-1",
								children: [previous != null && pageNumber - previous > 1 && /* @__PURE__ */ (void 0)("span", {
									className: "flex size-10 items-center justify-center text-sm text-muted",
									children: "…"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 249,
									columnNumber: 38
								}, this), /* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => goToPage(pageNumber),
									"aria-current": pageNumber === page ? "page" : void 0,
									className: pageNumber === page ? "flex size-10 items-center justify-center rounded-lg bg-elevated text-sm font-semibold text-fg" : "flex size-10 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-elevated hover:text-fg",
									children: pageNumber
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 253,
									columnNumber: 21
								}, this)]
							}, pageNumber, true, {
								fileName: _jsxFileName,
								lineNumber: 248,
								columnNumber: 18
							}, this);
						})
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 244,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (void 0)("button", {
						type: "button",
						onClick: () => goToPage(page + 1),
						disabled: !hasNext,
						"aria-label": "Próxima página",
						className: "flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
						children: /* @__PURE__ */ (void 0)(ChevronRight, { className: "size-5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 261,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 260,
						columnNumber: 11
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 239,
				columnNumber: 26
			}, this),
			total > 0 && /* @__PURE__ */ (void 0)("p", {
				className: "text-center text-xs text-subtle",
				children: [
					"Página ",
					page,
					" de",
					" ",
					lastPage,
					" · ",
					total,
					" ",
					"animes"
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 265,
				columnNumber: 21
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 137,
		columnNumber: 10
	}, this);
}
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
//#endregion
export { CalendarPage as component };
