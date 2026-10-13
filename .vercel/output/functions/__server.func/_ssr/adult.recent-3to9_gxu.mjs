import { x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore } from "./types-CX6YV1cu.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { H as AnimeCard, k as overlayList, p as Route$25 } from "./router-BPjBsLK8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/adult.recent-3to9_gxu.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/adult.recent.tsx?tsr-split=component";
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
function AdultRecentPage() {
	const data = Route$25.useLoaderData();
	const navigate = useNavigate({ from: "/adult/recent" });
	const { page: requestedPage } = Route$25.useSearch();
	const locals = useHikariStore((s) => s.animes);
	const items = overlayList(data.recentItems ?? [], locals);
	const itemsPerPage = 8;
	const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
	const currentPage = Math.min(requestedPage, totalPages);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const paginatedItems = items.slice(startIndex, startIndex + itemsPerPage);
	const paginationPages = getPaginationPages(currentPage, totalPages);
	const changePage = (page) => {
		if (page < 1 || page > totalPages || page === currentPage) return;
		navigate({ search: { page } }).then(() => {
			window.scrollTo({
				top: 0,
				behavior: "smooth"
			});
		});
	};
	function goBack() {
		if (currentPage > 1) {
			navigate({
				search: { page: currentPage - 1 },
				replace: true
			}).then(() => {
				window.scrollTo({
					top: 0,
					behavior: "smooth"
				});
			});
			return;
		}
		navigate({ to: "/adult" }).then(() => {
			window.scrollTo({
				top: 0,
				behavior: "smooth"
			});
		});
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-5 pb-5 sm:space-y-8",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
			type: "button",
			onClick: goBack,
			className: "mt-2 inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition hover:bg-elevated hover:text-fg",
			children: "‹ Voltar"
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 95,
			columnNumber: 9
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mt-12",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
				className: "font-display text-2xl tracking-tight sm:text-3xl",
				children: "Novos episódios"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 100,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Confira os episódios mais recentes."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 104,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 99,
			columnNumber: 9
		}, this)] }, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 94,
			columnNumber: 7
		}, this), items.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "rounded-xl bg-surface p-8 text-center shadow-[var(--shadow-border)]",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "font-display text-xl",
				children: "Nenhum episódio encontrado"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 111,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-2 text-sm text-muted",
				children: "Não há novos episódios disponíveis no momento."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 115,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 110,
			columnNumber: 29
		}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6",
			children: paginatedItems.map((anime) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(AnimeCard, {
				anime,
				size: "lg"
			}, anime.id, false, {
				fileName: _jsxFileName,
				lineNumber: 120,
				columnNumber: 42
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 119,
			columnNumber: 11
		}, this), totalPages > 1 && /* @__PURE__ */ (void 0)("div", {
			className: "flex flex-wrap items-center justify-center gap-1.5 pt-2",
			children: paginationPages.map((page, index) => {
				if (page === "...") return /* @__PURE__ */ (void 0)("span", {
					className: "inline-flex size-9 items-center justify-center text-sm text-muted",
					children: "…"
				}, `dots-${index}`, false, {
					fileName: _jsxFileName,
					lineNumber: 126,
					columnNumber: 20
				}, this);
				const isActive = currentPage === page;
				return /* @__PURE__ */ (void 0)("button", {
					type: "button",
					onClick: () => changePage(page),
					"aria-current": isActive ? "page" : void 0,
					className: `inline-flex size-9 items-center justify-center rounded-lg text-sm font-medium transition ${isActive ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"}`,
					children: page
				}, page, false, {
					fileName: _jsxFileName,
					lineNumber: 131,
					columnNumber: 18
				}, this);
			})
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 123,
			columnNumber: 30
		}, this)] }, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 118,
			columnNumber: 18
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 93,
		columnNumber: 10
	}, this);
}
//#endregion
export { AdultRecentPage as component };
