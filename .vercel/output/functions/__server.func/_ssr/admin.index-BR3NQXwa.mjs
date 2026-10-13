import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore, n as displayTitle, t as animeToLocal } from "./types-CX6YV1cu.mjs";
import { D as Search, S as ShieldAlert, _t as Bot, c as Upload, it as Download, k as Plus, p as Trash2 } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { W as searchCatalog } from "./router-BPjBsLK8.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
import { t as Input } from "./input-DWrO9Aym.mjs";
import { i as DialogTitle, n as DialogContent, r as DialogDescription, t as Dialog } from "./dialog-Dcc8DMVp.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.index-BR3NQXwa.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/admin.index.tsx?tsr-split=component";
function AdminIndex() {
	const animes = useHikariStore((s) => s.animes);
	const removeAnime = useHikariStore((s) => s.removeAnime);
	const upsertAnime = useHikariStore((s) => s.upsertAnime);
	const importAll = useHikariStore((s) => s.importAll);
	const [q, setQ] = (0, import_react.useState)("");
	const [importQ, setImportQ] = (0, import_react.useState)("");
	const [hits, setHits] = (0, import_react.useState)([]);
	const [searching, setSearching] = (0, import_react.useState)(false);
	const [pendingDelete, setPendingDelete] = (0, import_react.useState)(null);
	const filtered = (0, import_react.useMemo)(() => {
		const n = q.trim().toLowerCase();
		if (!n) return animes;
		return animes.filter((a) => `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`.toLowerCase().includes(n));
	}, [animes, q]);
	async function runImportSearch(e) {
		e.preventDefault();
		if (!importQ.trim()) return;
		setSearching(true);
		try {
			const res = await searchCatalog({ data: {
				q: importQ.trim(),
				page: 1
			} });
			setHits(res.items);
		} catch {
			toast.error("Não foi possível buscar no AniList.");
		} finally {
			setSearching(false);
		}
	}
	function importHit(hit) {
		const existing = animes.find((a) => a.anilistId === hit.anilistId);
		const local = animeToLocal(hit, existing);
		upsertAnime(local);
		toast.success(`${displayTitle(hit)} importado. Abra para editar episódios.`);
	}
	function exportJson() {
		const blob = new Blob([JSON.stringify({ animes }, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "hikari-catalogo.json";
		a.click();
		URL.revokeObjectURL(url);
	}
	function onImportFile(file) {
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const parsed = JSON.parse(String(reader.result));
				if (!Array.isArray(parsed.animes)) throw new Error("invalid");
				importAll(parsed.animes);
				toast.success("Catálogo restaurado.");
			} catch {
				toast.error("Arquivo inválido.");
			}
		};
		reader.readAsText(file);
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-8 pt-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("header", {
				className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-[11px] tracking-[0.28em] text-muted uppercase",
						children: "Painel"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 84,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
						className: "font-display text-3xl tracking-tight",
						children: "Admin"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 88,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 max-w-xl text-sm text-muted",
						children: "Adicione, edite e exclua animes, temporadas e episódios. Este painel é exclusivo do administrador."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 92,
						columnNumber: 11
					}, this)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 83,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							asChild: true,
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
								to: "/admin/$id",
								params: { id: "new" },
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Plus, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 103,
									columnNumber: 15
								}, this), "Novo anime"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 100,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 99,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: "outline",
							onClick: exportJson,
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Download, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 109,
								columnNumber: 13
							}, this), "Exportar"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 108,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("label", {
							className: "inline-flex h-11 cursor-pointer items-center gap-2 rounded-md px-4 text-sm font-medium shadow-[var(--shadow-border)] hover:bg-elevated",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Upload, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 114,
									columnNumber: 13
								}, this),
								"Importar JSON",
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("input", {
									type: "file",
									accept: "application/json",
									className: "sr-only",
									onChange: (e) => {
										const f = e.target.files?.[0];
										if (f) onImportFile(f);
										e.target.value = "";
									}
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 117,
									columnNumber: 13
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 113,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 98,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 82,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-start gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "grid size-11 shrink-0 place-items-center rounded-lg bg-elevated",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bot, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 131,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 130,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
								className: "font-display text-lg",
								children: "Hikari AI"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 135,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-sm text-muted",
								children: "Central de inteligência artificial para revisão de notícias e moderação do Hikari."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 139,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-2 text-xs text-subtle",
								children: "Estrutura criada. Provedor de IA ainda não configurado."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 144,
								columnNumber: 15
							}, this)
						] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 134,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 129,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
						asChild: true,
						variant: "outline",
						className: "w-full sm:w-auto",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
							to: "/admin/hikari-ai",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bot, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 153,
								columnNumber: 15
							}, this), "Abrir Hikari AI"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 152,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 151,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 128,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 127,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
						className: "font-display text-lg",
						children: "Importar do AniList"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 161,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Busque um título oficial e traga capa, sinopse e gêneros. Depois acrescente URLs de episódio."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 165,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("form", {
						className: "mt-4 flex gap-2",
						onSubmit: runImportSearch,
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "relative flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 172,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
								value: importQ,
								onChange: (e) => setImportQ(e.target.value),
								placeholder: "Ex.: Frieren, Dandadan, One Piece",
								className: "pl-10"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 174,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 171,
							columnNumber: 11
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "submit",
							disabled: searching,
							children: searching ? "Buscando…" : "Buscar"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 177,
							columnNumber: 11
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 170,
						columnNumber: 9
					}, this),
					hits.length > 0 && /* @__PURE__ */ (void 0)("ul", {
						className: "mt-4 divide-y divide-border",
						children: hits.slice(0, 8).map((hit) => /* @__PURE__ */ (void 0)("li", {
							className: "flex items-center gap-3 py-3",
							children: [
								/* @__PURE__ */ (void 0)("div", {
									className: "h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-elevated",
									children: hit.cover && /* @__PURE__ */ (void 0)("img", {
										src: hit.cover,
										alt: "",
										className: "size-full object-cover"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 185,
										columnNumber: 33
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 184,
									columnNumber: 17
								}, this),
								/* @__PURE__ */ (void 0)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (void 0)("p", {
										className: "truncate text-sm",
										children: displayTitle(hit)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 189,
										columnNumber: 19
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "truncate text-xs text-muted",
										children: [
											hit.year ?? "",
											" ",
											hit.genres.slice(0, 2).join(" · ")
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 193,
										columnNumber: 19
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 188,
									columnNumber: 17
								}, this),
								/* @__PURE__ */ (void 0)(Button, {
									type: "button",
									size: "sm",
									variant: "outline",
									onClick: () => importHit(hit),
									children: "Importar"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 199,
									columnNumber: 17
								}, this)
							]
						}, hit.id, true, {
							fileName: _jsxFileName,
							lineNumber: 183,
							columnNumber: 42
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 182,
						columnNumber: 29
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 160,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
						className: "font-display text-lg",
						children: [
							"Seu catálogo (",
							animes.length,
							")"
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 209,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-0.5 text-xs text-muted",
						children: "Gerencie seus animes e episódios."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 213,
						columnNumber: 13
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 208,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex flex-col gap-2 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							asChild: true,
							variant: "outline",
							className: "w-full sm:w-auto",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
								to: "/admin/moderation",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ShieldAlert, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 221,
									columnNumber: 17
								}, this), "Moderação"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 220,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 219,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
							value: q,
							onChange: (e) => setQ(e.target.value),
							placeholder: "Filtrar catálogo",
							className: "w-full sm:max-w-56"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 226,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 218,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 207,
					columnNumber: 9
				}, this), filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "rounded-xl bg-surface px-4 py-10 text-center shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-sm text-muted",
						children: "Nenhum título local ainda."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 231,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-xs text-subtle",
						children: "Importe do AniList ou crie um do zero."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 235,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 230,
					columnNumber: 34
				}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("ul", {
					className: "space-y-3",
					children: filtered.map((a) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", {
						className: "rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-elevated",
								children: a.cover ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
									src: a.cover,
									alt: "",
									className: "size-full object-cover"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 242,
									columnNumber: 32
								}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "grid size-full place-items-center text-xs text-subtle",
									children: "—"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 242,
									columnNumber: 98
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 241,
								columnNumber: 19
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "line-clamp-2 text-sm font-medium leading-snug",
										children: a.titleEnglish || a.titleRomaji || a.titleNative
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 248,
										columnNumber: 21
									}, this),
									a.hidden && /* @__PURE__ */ (void 0)("span", {
										className: "mt-1 inline-block rounded-full bg-elevated px-2 py-0.5 text-[10px] text-subtle",
										children: "Oculto"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 252,
										columnNumber: 34
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "mt-1 text-xs text-muted",
										children: [
											a.seasons.reduce((n, s) => n + s.episodes.length, 0),
											" ",
											"episódios",
											a.anilistId ? ` · AniList ${a.anilistId}` : " · Original"
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 256,
										columnNumber: 21
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 247,
								columnNumber: 19
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 240,
							columnNumber: 17
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mt-3 grid grid-cols-[1fr_auto] gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
								asChild: true,
								size: "sm",
								variant: "outline",
								className: "w-full",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
									to: "/admin/$id",
									params: { id: a.id },
									children: "Editar"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 266,
									columnNumber: 21
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 265,
								columnNumber: 19
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
								type: "button",
								size: "icon",
								variant: "ghost",
								"aria-label": "Excluir",
								onClick: () => setPendingDelete(a.id),
								className: "size-9",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Trash2, { className: "size-4 text-danger" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 274,
									columnNumber: 21
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 273,
								columnNumber: 19
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 264,
							columnNumber: 17
						}, this)]
					}, a.id, true, {
						fileName: _jsxFileName,
						lineNumber: 239,
						columnNumber: 32
					}, this))
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 238,
					columnNumber: 20
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 206,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Dialog, {
				open: Boolean(pendingDelete),
				onOpenChange: () => setPendingDelete(null),
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(DialogContent, { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(DialogTitle, { children: "Excluir anime?" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 283,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(DialogDescription, { children: "Temporadas e episódios deste título saem do catálogo local. O AniList continua disponível." }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 287,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "mt-5 flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: "ghost",
							onClick: () => setPendingDelete(null),
							children: "Cancelar"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 293,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: "danger",
							onClick: () => {
								if (pendingDelete) removeAnime(pendingDelete);
								setPendingDelete(null);
								toast.success("Removido.");
							},
							children: "Excluir"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 297,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 292,
						columnNumber: 11
					}, this)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 282,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 281,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 81,
		columnNumber: 10
	}, this);
}
//#endregion
export { AdminIndex as component };
