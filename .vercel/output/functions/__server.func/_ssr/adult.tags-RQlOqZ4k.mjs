import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore } from "./types-CX6YV1cu.mjs";
import { dt as ChevronLeft, m as Tags, ut as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { H as AnimeCard, f as Route$24, k as overlayList } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/adult.tags-RQlOqZ4k.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/adult.tags.tsx?tsr-split=component";
var MAIN_ADULT_TAGS = [
	{
		name: "Anal",
		aliases: ["Anal"]
	},
	{
		name: "Boquete",
		aliases: [
			"Blow Job",
			"Blowjob",
			"Boquete"
		]
	},
	{
		name: "Harém",
		aliases: ["Harem", "Harém"]
	},
	{
		name: "Incesto",
		aliases: ["Incest", "Incesto"]
	},
	{
		name: "Lactante",
		aliases: [
			"Breast Feeding",
			"Lactation",
			"Lactante"
		]
	},
	{
		name: "Milf",
		aliases: ["MILF", "Milf"]
	},
	{
		name: "Futanari",
		aliases: ["Futanari"]
	},
	{
		name: "Ecchi",
		aliases: ["Ecchi"]
	},
	{
		name: "Yuri",
		aliases: ["Yuri"]
	},
	{
		name: "Yaoi",
		aliases: ["Yaoi"]
	},
	{
		name: "Romance",
		aliases: ["Romance"]
	},
	{
		name: "Masturbação",
		aliases: ["Masturbation", "Masturbação"]
	},
	{
		name: "Orgia",
		aliases: ["Orgy", "Orgia"]
	},
	{
		name: "Peitões",
		aliases: [
			"Large Breasts",
			"Big Breasts",
			"Peitões"
		]
	},
	{
		name: "Brinquedos",
		aliases: [
			"Toys",
			"Sex Toys",
			"Brinquedos"
		]
	},
	{
		name: "BDSM",
		aliases: ["BDSM"]
	},
	{
		name: "Tentáculos",
		aliases: ["Tentacles", "Tentáculos"]
	},
	{
		name: "NTR",
		aliases: ["NTR"]
	},
	{
		name: "Netorare",
		aliases: ["Netorare"]
	},
	{
		name: "Cosplay",
		aliases: ["Cosplay"]
	},
	{
		name: "Voyeur",
		aliases: ["Voyeur"]
	},
	{
		name: "Exibicionismo",
		aliases: ["Exhibitionism", "Exibicionismo"]
	},
	{
		name: "Vida Escolar",
		aliases: [
			"School Life",
			"School",
			"Vida Escolar"
		]
	},
	{
		name: "Professora",
		aliases: ["Teacher", "Professora"]
	},
	{
		name: "Empregada",
		aliases: [
			"Maid",
			"Maids",
			"Empregada"
		]
	},
	{
		name: "Office / Escritório",
		aliases: [
			"Office Lady",
			"Office",
			"Office / Escritório"
		]
	},
	{
		name: "Comédia",
		aliases: ["Comedy", "Comédia"]
	},
	{
		name: "Magia",
		aliases: ["Magic", "Magia"]
	},
	{
		name: "Elfos",
		aliases: [
			"Elf",
			"Elves",
			"Elfos"
		]
	},
	{
		name: "Demônios",
		aliases: [
			"Demon",
			"Demons",
			"Demônios"
		]
	},
	{
		name: "Vampiros",
		aliases: [
			"Vampire",
			"Vampires",
			"Vampiros"
		]
	},
	{
		name: "Terror",
		aliases: ["Horror", "Terror"]
	},
	{
		name: "Virgem",
		aliases: [
			"Virgin",
			"Virginity",
			"Virgem"
		]
	},
	{
		name: "Esporte",
		aliases: [
			"Sports",
			"Sport",
			"Esporte"
		]
	}
];
function normalizeAdultTag(value) {
	return value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function AdultTagsPage() {
	const data = Route$24.useLoaderData();
	const navigate = useNavigate({ from: "/adult/tags" });
	const { tag, page } = Route$24.useSearch();
	const locals = useHikariStore((state) => state.animes);
	const items = overlayList(data.items ?? [], locals);
	const displayedTags = MAIN_ADULT_TAGS.map((mainTag) => {
		return data.tags.find((item) => mainTag.aliases.some((alias) => normalizeAdultTag(alias) === normalizeAdultTag(item.name))) ?? {
			name: mainTag.name,
			count: 0,
			animeIds: []
		};
	});
	const selectedMainTag = tag ? MAIN_ADULT_TAGS.find((mainTag) => normalizeAdultTag(mainTag.name) === normalizeAdultTag(tag) || mainTag.aliases.some((alias) => normalizeAdultTag(alias) === normalizeAdultTag(tag))) : void 0;
	const selectedTag = selectedMainTag ? data.tags.find((item) => selectedMainTag.aliases.some((alias) => normalizeAdultTag(alias) === normalizeAdultTag(item.name))) : void 0;
	const itemsPerPage = 8;
	const filteredItems = selectedTag ? items.filter((anime) => selectedTag.animeIds.includes(anime.id)) : [];
	const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
	const currentPage = Math.min(page, totalPages);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);
	const pageNumbers = (() => {
		const start = Math.min(Math.max(currentPage - 2, 1), Math.max(totalPages - 4, 1));
		return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
	})();
	function openTag(nextTag) {
		navigate({
			to: "/adult/tags",
			search: {
				tag: nextTag,
				page: 1
			}
		}).then(() => {
			window.scrollTo({
				top: 0,
				behavior: "auto"
			});
		});
	}
	function goToPage(nextPage) {
		if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
		navigate({
			to: "/adult/tags",
			search: {
				tag: selectedTag?.name ?? tag,
				page: nextPage
			}
		}).then(() => {
			window.scrollTo({
				top: 0,
				behavior: "auto"
			});
		});
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 py-5 sm:space-y-8 sm:py-8",
		children: !tag ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex items-center gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Tags, { className: "size-5 text-fg" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 183,
					columnNumber: 17
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 182,
				columnNumber: 15
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
				className: "font-display text-2xl tracking-tight sm:text-3xl",
				children: "Tags"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 187,
				columnNumber: 17
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Explore o conteúdo +18 por tag."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 191,
				columnNumber: 17
			}, this)] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 186,
				columnNumber: 15
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 181,
			columnNumber: 13
		}, this) }, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 180,
			columnNumber: 11
		}, this), displayedTags.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
			className: "py-16 text-center text-muted",
			children: "Nenhuma tag disponível no momento."
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 198,
			columnNumber: 41
		}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
			children: displayedTags.map((item) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
				type: "button",
				onClick: () => openTag(item.name),
				className: "flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm font-medium text-fg transition-colors hover:bg-elevated",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Tags, { className: "size-4 shrink-0 text-muted" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 203,
						columnNumber: 21
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "min-w-0 flex-1 truncate",
						children: item.name
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 205,
						columnNumber: 21
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "shrink-0 text-xs text-muted",
						children: item.count
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 209,
						columnNumber: 21
					}, this)
				]
			}, item.name, true, {
				fileName: _jsxFileName,
				lineNumber: 202,
				columnNumber: 44
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 201,
			columnNumber: 15
		}, this) }, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 200,
			columnNumber: 20
		}, this)] }, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 179,
			columnNumber: 15
		}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex min-w-0 items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Tags, { className: "size-5 text-fg" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 222,
							columnNumber: 19
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 221,
						columnNumber: 17
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
							className: "font-display text-2xl tracking-tight sm:text-3xl",
							children: selectedMainTag?.name ?? tag
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 226,
							columnNumber: 19
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-1 text-sm text-muted",
							children: selectedTag ? `${selectedTag.count} anime(s) com esta tag.` : `${selectedMainTag?.name ?? tag} — 0 anime(s) com esta tag.`
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 230,
							columnNumber: 19
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 225,
						columnNumber: 17
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 220,
					columnNumber: 15
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/adult/tags",
					"aria-label": "Voltar para tags",
					title: "Voltar para tags",
					className: "flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-elevated hover:text-fg",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "text-2xl leading-none",
						"aria-hidden": "true",
						children: "×"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 237,
						columnNumber: 17
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 236,
					columnNumber: 15
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 219,
				columnNumber: 13
			}, this) }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 218,
				columnNumber: 11
			}, this),
			!selectedTag ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "py-16 text-center text-muted",
				children: "Essa tag não está disponível no catálogo +18."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 244,
				columnNumber: 27
			}, this) : paginatedItems.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "py-16 text-center text-muted",
				children: "Nenhum anime encontrado para esta tag."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 246,
				columnNumber: 50
			}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6",
				children: paginatedItems.map((anime) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCard, {
					anime,
					size: "lg"
				}, anime.id, false, {
					fileName: _jsxFileName,
					lineNumber: 249,
					columnNumber: 44
				}, this))
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 248,
				columnNumber: 20
			}, this),
			selectedTag && totalPages > 1 && /* @__PURE__ */ (void 0)("div", {
				className: "flex flex-wrap items-center justify-center gap-1 pt-2",
				children: [
					/* @__PURE__ */ (void 0)("button", {
						type: "button",
						onClick: () => goToPage(currentPage - 1),
						disabled: currentPage === 1,
						"aria-label": "Página anterior",
						className: "flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
						children: /* @__PURE__ */ (void 0)(ChevronLeft, { className: "size-5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 254,
							columnNumber: 17
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 253,
						columnNumber: 15
					}, this),
					/* @__PURE__ */ (void 0)("div", {
						className: "flex items-center gap-1",
						children: pageNumbers.map((pageNumber) => /* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => goToPage(pageNumber),
							"aria-current": pageNumber === currentPage ? "page" : void 0,
							className: pageNumber === currentPage ? "flex size-10 items-center justify-center rounded-lg bg-elevated text-sm font-semibold text-fg" : "flex size-10 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-elevated hover:text-fg",
							children: pageNumber
						}, pageNumber, false, {
							fileName: _jsxFileName,
							lineNumber: 258,
							columnNumber: 48
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 257,
						columnNumber: 15
					}, this),
					/* @__PURE__ */ (void 0)("button", {
						type: "button",
						onClick: () => goToPage(currentPage + 1),
						disabled: currentPage === totalPages,
						"aria-label": "Próxima página",
						className: "flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35",
						children: /* @__PURE__ */ (void 0)(ChevronRight, { className: "size-5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 264,
							columnNumber: 17
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 263,
						columnNumber: 15
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 252,
				columnNumber: 45
			}, this)
		] }, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 217,
			columnNumber: 15
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 178,
		columnNumber: 10
	}, this);
}
//#endregion
export { AdultTagsPage as component };
