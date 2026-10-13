import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as MessageCircle, a as User, dt as ChevronLeft, p as Trash2, pt as Check } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
import { i as DialogTitle, n as DialogContent, r as DialogDescription, t as Dialog } from "./dialog-Dcc8DMVp.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.moderation-D9DNjKff.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/admin.moderation.tsx?tsr-split=component";
function AdminModeration() {
	const [reports, setReports] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [pendingAction, setPendingAction] = (0, import_react.useState)(null);
	const [processing, setProcessing] = (0, import_react.useState)(false);
	const loadReports = (0, import_react.useCallback)(async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/admin/comment-reports", {
				method: "GET",
				credentials: "include"
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar as denúncias.");
			setReports(Array.isArray(data.reports) ? data.reports : []);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Não foi possível carregar as denúncias.");
		} finally {
			setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		loadReports();
	}, [loadReports]);
	async function executeAction() {
		if (!pendingAction) return;
		setProcessing(true);
		try {
			const response = await fetch("/api/admin/comment-reports", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					commentId: pendingAction.commentId,
					action: pendingAction.type
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? "Não foi possível realizar a ação.");
			if (pendingAction.type === "delete") toast.success("Comentário removido.");
			else toast.success("Denúncia resolvida.");
			setPendingAction(null);
			await loadReports();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Não foi possível realizar a ação.");
		} finally {
			setProcessing(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-8 pt-6 pb-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("header", {
				className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/admin/",
						className: "inline-flex items-center gap-1 text-xs text-muted hover:text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronLeft, { className: "size-3.5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 99,
							columnNumber: 13
						}, this), "Painel"]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 98,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-4 text-[11px] tracking-[0.28em] text-muted uppercase",
						children: "Administração"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 103,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
						className: "mt-1 font-display text-3xl tracking-tight",
						children: "Moderação"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 107,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 max-w-xl text-sm text-muted",
						children: "Analise os comentários denunciados e decida se a denúncia deve ser resolvida ou se o comentário deve ser removido."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 111,
						columnNumber: 11
					}, this)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 97,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
					type: "button",
					variant: "outline",
					onClick: () => void loadReports(),
					disabled: loading,
					children: loading ? "Atualizando…" : "Atualizar"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 120,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 96,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "grid size-10 shrink-0 place-items-center rounded-lg bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, { className: "size-5 text-muted" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 128,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 127,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-sm font-medium",
						children: "Denúncias pendentes"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 132,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-xs text-muted",
						children: reports.length === 0 ? "Nenhuma denúncia pendente." : reports.length === 1 ? "1 comentário aguardando análise." : `${reports.length} comentários aguardando análise.`
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 136,
						columnNumber: 13
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 131,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 126,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 125,
				columnNumber: 7
			}, this),
			loading ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "space-y-4",
				children: Array.from({ length: 3 }, (_, index) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-52 animate-pulse rounded-xl bg-surface shadow-[var(--shadow-border)]" }, index, false, {
					fileName: _jsxFileName,
					lineNumber: 146,
					columnNumber: 24
				}, this))
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 143,
				columnNumber: 18
			}, this) : reports.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "rounded-xl bg-surface px-5 py-14 text-center shadow-[var(--shadow-border)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "mx-auto grid size-12 place-items-center rounded-full bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Check, { className: "size-6 text-muted" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 149,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 148,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
						className: "mt-4 font-display text-xl",
						children: "Tudo limpo"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 152,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Não há comentários denunciados aguardando análise."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 156,
						columnNumber: 11
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 147,
				columnNumber: 41
			}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "space-y-4",
				children: reports.map((report) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ReportCard, {
					report,
					onResolve: () => setPendingAction({
						type: "resolve",
						commentId: report.commentId
					}),
					onDelete: () => setPendingAction({
						type: "delete",
						commentId: report.commentId
					})
				}, report.commentId, false, {
					fileName: _jsxFileName,
					lineNumber: 162,
					columnNumber: 34
				}, this))
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 161,
				columnNumber: 18
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Dialog, {
				open: pendingAction !== null,
				onOpenChange: (open) => {
					if (!open && !processing) setPendingAction(null);
				},
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(DialogContent, { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(DialogTitle, { children: pendingAction?.type === "delete" ? "Remover comentário?" : "Resolver denúncia?" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 177,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(DialogDescription, { children: pendingAction?.type === "delete" ? "O comentário será removido permanentemente. As respostas, curtidas e denúncias relacionadas também serão removidas." : "A denúncia será marcada como resolvida e deixará de aparecer nesta lista." }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 181,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "mt-5 flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: "ghost",
							disabled: processing,
							onClick: () => setPendingAction(null),
							children: "Cancelar"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 186,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: pendingAction?.type === "delete" ? "danger" : "default",
							disabled: processing,
							onClick: () => void executeAction(),
							children: processing ? "Processando…" : pendingAction?.type === "delete" ? "Remover" : "Resolver"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 190,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 185,
						columnNumber: 11
					}, this)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 176,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 171,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 95,
		columnNumber: 10
	}, this);
}
function ReportCard({ report, onResolve, onDelete }) {
	const formattedCommentDate = formatDate(report.createdAt);
	const formattedReportDate = formatDate(report.firstReportedAt);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("article", {
		className: "overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "border-b border-border px-4 py-4 sm:px-5",
			children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-start gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Avatar, {
						image: report.userImage,
						name: report.userName
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 212,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex flex-wrap items-center gap-x-2 gap-y-1",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-medium",
								children: report.userName
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 216,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-xs text-muted",
								children: [
									"comentou em",
									" ",
									report.episodeId
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 220,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 215,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-0.5 text-xs text-subtle",
							children: [
								"Comentário criado em",
								" ",
								formattedCommentDate
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 226,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 214,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "shrink-0 rounded-full bg-elevated px-2.5 py-1 text-xs text-muted",
						children: [
							report.reportCount,
							" ",
							report.reportCount === 1 ? "denúncia" : "denúncias"
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 232,
						columnNumber: 11
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 211,
				columnNumber: 9
			}, this)
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 210,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "space-y-4 p-4 sm:p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "rounded-lg bg-elevated p-4",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "whitespace-pre-wrap break-words text-sm leading-6",
						children: report.content
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 241,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 240,
					columnNumber: 9
				}, this),
				report.isSpoiler && /* @__PURE__ */ (void 0)("div", {
					className: "rounded-lg border border-border px-3 py-2 text-xs text-muted",
					children: "⚠️ Este comentário está marcado como spoiler."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 246,
					columnNumber: 30
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mb-2 text-[11px] font-medium tracking-wider text-muted uppercase",
					children: "Motivos"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 253,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex flex-wrap gap-2",
					children: report.reasons.length > 0 ? report.reasons.map((reason) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "rounded-full bg-elevated px-3 py-1.5 text-xs text-muted",
						children: [reason.value === "spoiler" ? "⚠️ " : "", reason.label]
					}, reason.value, true, {
						fileName: _jsxFileName,
						lineNumber: 258,
						columnNumber: 71
					}, this)) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "text-xs text-subtle",
						children: "Motivo não informado"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 261,
						columnNumber: 30
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 257,
					columnNumber: 11
				}, this)] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 252,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "grid gap-2 text-xs text-subtle sm:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-muted",
								children: "Anime:"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 270,
								columnNumber: 13
							}, this),
							" ",
							report.animeId
						] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 269,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-muted",
								children: "Episódio:"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 277,
								columnNumber: 13
							}, this),
							" ",
							report.episodeId
						] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 276,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-muted",
								children: "Primeira denúncia:"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 284,
								columnNumber: 13
							}, this),
							" ",
							formattedReportDate
						] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 283,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 268,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
						type: "button",
						variant: "outline",
						onClick: onResolve,
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Check, { className: "size-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 293,
							columnNumber: 13
						}, this), "Resolver"]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 292,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
						type: "button",
						variant: "danger",
						onClick: onDelete,
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Trash2, { className: "size-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 298,
							columnNumber: 13
						}, this), "Remover comentário"]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 297,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 291,
					columnNumber: 9
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 239,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 209,
		columnNumber: 10
	}, this);
}
function Avatar({ image, name }) {
	if (image) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
		src: image,
		alt: "",
		className: "size-10 shrink-0 rounded-full object-cover"
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 313,
		columnNumber: 12
	}, this);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "grid size-10 shrink-0 place-items-center rounded-full bg-elevated text-muted",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(User, { className: "size-5" }, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 316,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 315,
		columnNumber: 10
	}, this);
}
function formatDate(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("pt-BR", {
		dateStyle: "short",
		timeStyle: "short"
	}).format(date);
}
//#endregion
export { AdminModeration as component };
