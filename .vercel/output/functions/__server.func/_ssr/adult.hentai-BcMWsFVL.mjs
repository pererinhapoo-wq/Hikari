import { x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore } from "./types-CX6YV1cu.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { H as AnimeCard, k as overlayList, m as Route$26 } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/adult.hentai-BcMWsFVL.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/adult.hentai.tsx?tsr-split=component";
function getPaginationPages(currentPage, totalPages) {
	if (totalPages <= 9) return Array.from({ length: totalPages }, (_, index) => index + 1);
	const pages = [];
	pages.push(1);
	if (currentPage <= 5) {
		pages.push(2, 3, 4, 5, 6, 7, "...");
		pages.push(totalPages);
		return pages;
	}
	if (currentPage >= totalPages - 4) {
		pages.push("...");
		for (let page = totalPages - 6; page <= totalPages; page++) pages.push(page);
		return pages;
	}
	pages.push("...");
	pages.push(currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2);
	pages.push("...");
	pages.push(totalPages);
	return pages;
}
function HentaiPage() {
	const data = Route$26.useLoaderData();
	const { page } = Route$26.useSearch();
	const navigate = useNavigate({ from: "/adult/hentai" });
	const locals = useHikariStore((s) => s.animes);
	const items = overlayList(data.items ?? [], locals);
	const itemsPerPage = 8;
	const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
	const currentPage = Math.min(page, totalPages);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const paginatedItems = items.slice(startIndex, startIndex + itemsPerPage);
	const paginationPages = getPaginationPages(currentPage, totalPages);
	function changePage(nextPage) {
		if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
		navigate({ search: { page: nextPage } }).then(() => {
			window.scrollTo({
				top: 0,
				behavior: "smooth"
			});
		});
	}
	function handleBack() {
		if (currentPage > 1) {
			navigate({ search: { page: currentPage - 1 } }).then(() => {
				window.scrollTo({
					top: 0,
					behavior: "auto"
				});
			});
			return;
		}
		navigate({ to: "/adult" }).then(() => {
			window.scrollTo({
				top: 0,
				behavior: "auto"
			});
		});
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-5 pb-5 sm:space-y-8",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
			type: "button",
			onClick: handleBack,
			className: "mt-2 inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition hover:bg-elevated hover:text-fg",
			children: "‹ Voltar"
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 88,
			columnNumber: 9
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mt-12",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
				className: "font-display text-2xl tracking-tight sm:text-3xl",
				children: "Hentai"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 93,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Confira todos os títulos disponíveis."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 97,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 92,
			columnNumber: 9
		}, this)] }, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 87,
			columnNumber: 7
		}, this), items.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "rounded-xl bg-surface p-8 text-center shadow-[var(--shadow-border)]",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "font-display text-xl",
				children: "Nenhum título encontrado"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 104,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-2 text-sm text-muted",
				children: "Não há títulos disponíveis no momento."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 108,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 103,
			columnNumber: 29
		}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6",
			children: paginatedItems.map((anime) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCard, {
				anime,
				size: "lg"
			}, anime.id, false, {
				fileName: _jsxFileName,
				lineNumber: 113,
				columnNumber: 42
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 112,
			columnNumber: 11
		}, this), totalPages > 1 && /* @__PURE__ */ (void 0)("div", {
			className: "flex flex-wrap items-center justify-center gap-2 pt-2",
			children: paginationPages.map((pageNumber, index) => {
				if (pageNumber === "...") return /* @__PURE__ */ (void 0)("span", {
					className: "inline-flex size-9 items-center justify-center text-sm text-muted",
					children: "…"
				}, `dots-${index}`, false, {
					fileName: _jsxFileName,
					lineNumber: 119,
					columnNumber: 20
				}, this);
				const isActive = currentPage === pageNumber;
				return /* @__PURE__ */ (void 0)("button", {
					type: "button",
					onClick: () => changePage(pageNumber),
					"aria-current": isActive ? "page" : void 0,
					className: `inline-flex size-9 items-center justify-center rounded-lg text-sm font-medium transition ${isActive ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"}`,
					children: pageNumber
				}, pageNumber, false, {
					fileName: _jsxFileName,
					lineNumber: 124,
					columnNumber: 18
				}, this);
			})
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 116,
			columnNumber: 30
		}, this)] }, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 111,
			columnNumber: 18
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 86,
		columnNumber: 10
	}, this);
}
//#endregion
export { HentaiPage as component };
