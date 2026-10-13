import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Ct as ArrowLeft, K as LoaderCircle, Z as History, _ as Sparkles, _t as Bot, et as FileText, lt as CircleCheck, w as Settings, x as ShieldCheck, z as MessageSquareWarning } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { V as fetchAutomaticNews } from "./router-BPjBsLK8.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
import { t as reviewHikariAINews } from "./api-hikari-ai-review-B56bDek1.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.hikari-ai-BoqgXK-5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/admin.hikari-ai.tsx?tsr-split=component";
function HikariAIPage() {
	const [testing, setTesting] = (0, import_react.useState)(false);
	const [testResult, setTestResult] = (0, import_react.useState)(null);
	async function handleTestAI(provider) {
		setTesting(true);
		setTestResult(null);
		try {
			const realNews = (await fetchAutomaticNews()).find((item) => typeof item.sourceUrl === "string" && item.sourceUrl.trim().length > 0);
			if (!realNews) {
				setTestResult({
					approved: false,
					isAnime: false,
					isGameNews: false,
					isDuplicate: false,
					label: "Erro",
					animeName: "",
					title: "",
					description: "",
					reason: "Nenhuma notícia externa disponível no momento para testar a Hikari AI.",
					provider: "Fallback"
				});
				return;
			}
			const result = await reviewHikariAINews({ data: {
				title: realNews.title,
				description: realNews.description,
				source: realNews.source ?? "",
				sourceUrl: realNews.sourceUrl ?? "",
				animeName: "",
				provider
			} });
			setTestResult(result);
		} catch (error) {
			setTestResult({
				approved: false,
				isAnime: false,
				isGameNews: false,
				isDuplicate: false,
				label: "Erro",
				animeName: "",
				title: "",
				description: "",
				reason: error instanceof Error ? error.message : "Não foi possível executar o teste.",
				provider: "Fallback"
			});
		} finally {
			setTesting(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 pt-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("header", {
				className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/admin",
						className: "mb-2 inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ArrowLeft, { className: "size-3.5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 75,
							columnNumber: 13
						}, this), "Voltar ao painel"]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 74,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "grid size-11 shrink-0 place-items-center rounded-xl bg-elevated shadow-[var(--shadow-border)]",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bot, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 81,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 80,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-[11px] tracking-[0.28em] text-muted uppercase",
							children: "Inteligência artificial"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 85,
							columnNumber: 15
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
							className: "font-display text-3xl tracking-tight",
							children: "Hikari AI"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 89,
							columnNumber: 15
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 84,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 79,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-2 max-w-2xl text-sm text-muted",
						children: "Central de inteligência artificial para revisão de notícias, moderação e tarefas administrativas do Hikari."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 95,
						columnNumber: 11
					}, this)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 73,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 72,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-start gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-elevated",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 107,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 106,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
							className: "font-display text-lg",
							children: "Status da Hikari AI"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 111,
							columnNumber: 15
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-1 text-sm text-muted",
							children: "A estrutura do sistema está pronta e a conexão com o provedor pode ser testada abaixo."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 115,
							columnNumber: 15
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 110,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 105,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "inline-flex w-fit items-center gap-2 rounded-full bg-elevated px-3 py-1.5 text-xs text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "size-3.5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 123,
							columnNumber: 13
						}, this), "Configurada"]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 122,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 104,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 103,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "font-display text-xl",
					children: "Provedores da Hikari AI"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 132,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-1 text-sm leading-6 text-muted",
					children: "O Hikari usa estes provedores na análise automática das notícias."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 136,
					columnNumber: 11
				}, this)] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 131,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mt-4 grid gap-3 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "rounded-lg bg-elevated p-4",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-xs text-muted",
								children: "Provedor principal"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 145,
								columnNumber: 17
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 font-display text-lg",
								children: "Gemini"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 146,
								columnNumber: 17
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 144,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "rounded-full bg-surface px-2.5 py-1 text-[10px] text-muted",
								children: "Principal"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 148,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 143,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-2 text-xs text-muted",
							children: "Gemini 3.5 Flash Lite"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 152,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 142,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "rounded-lg bg-elevated p-4",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-xs text-muted",
								children: "Provedor de reserva"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 160,
								columnNumber: 17
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 font-display text-lg",
								children: "Groq"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 161,
								columnNumber: 17
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 159,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "rounded-full bg-surface px-2.5 py-1 text-[10px] text-muted",
								children: "Fallback"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 163,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 158,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-2 text-xs text-muted",
							children: "GPT-OSS 120B"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 167,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 157,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 141,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 130,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
						className: "font-display text-xl",
						children: "Testar Hikari AI"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 178,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 max-w-2xl text-sm leading-6 text-muted",
						children: "Pega uma notícia externa real do Hikari e envia para a Hikari AI analisar. Nenhuma notícia será publicada ou alterada."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 182,
						columnNumber: 13
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 177,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							onClick: () => handleTestAI("gemini"),
							disabled: testing,
							children: [testing ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(LoaderCircle, { className: "size-4 animate-spin" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 190,
								columnNumber: 26
							}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bot, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 190,
								columnNumber: 72
							}, this), "Testar Gemini"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 189,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: "outline",
							onClick: () => handleTestAI("groq"),
							disabled: testing,
							children: [testing ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(LoaderCircle, { className: "size-4 animate-spin" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 194,
								columnNumber: 26
							}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bot, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 194,
								columnNumber: 72
							}, this), "Testar Groq"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 193,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 188,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 176,
					columnNumber: 9
				}, this), testResult && /* @__PURE__ */ (void 0)("div", {
					className: "mt-5 rounded-lg bg-elevated p-4",
					children: [
						/* @__PURE__ */ (void 0)("div", {
							className: "flex items-center gap-2 text-sm",
							children: [testResult.approved ? /* @__PURE__ */ (void 0)("span", {
								className: testResult.approved ? "font-bold text-green-500" : "font-bold text-red-500",
								"aria-hidden": "true",
								children: testResult.approved ? "✓" : "✕"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 202,
								columnNumber: 38
							}, this) : null, /* @__PURE__ */ (void 0)("span", { children: testResult.approved ? "Hikari AI aprovou a notícia" : "Hikari AI não aprovou a notícia" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 206,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 201,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mb-4 flex items-center gap-2 text-sm",
							children: [/* @__PURE__ */ (void 0)("span", {
								className: testResult.provider === "Fallback" ? "font-bold text-red-500" : "font-bold text-green-500",
								children: testResult.provider === "Fallback" ? "✕" : "✓"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 212,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("span", { children: ["IA utilizada: ", testResult.provider === "Fallback" ? "Nenhuma (falha)" : testResult.provider] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 215,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 211,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-4 grid gap-3 text-sm sm:grid-cols-2",
							children: [
								/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("span", {
									className: "text-xs text-muted",
									children: "Anime identificado"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 220,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("p", {
									className: "mt-1",
									children: testResult.animeName || "Nenhum"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 223,
									columnNumber: 17
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 219,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("span", {
									className: "text-xs text-muted",
									children: "Classificação"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 229,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("p", {
									className: "mt-1",
									children: testResult.label
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 232,
									columnNumber: 17
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 228,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("span", {
									className: "text-xs text-muted",
									children: "É notícia de anime?"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 236,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("p", {
									className: "mt-1",
									children: testResult.isAnime ? "Sim" : "Não"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 239,
									columnNumber: 17
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 235,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("span", {
									className: "text-xs text-muted",
									children: "É notícia de jogo?"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 245,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("p", {
									className: "mt-1",
									children: testResult.isGameNews ? "Sim" : "Não"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 248,
									columnNumber: 17
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 244,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 218,
							columnNumber: 13
						}, this),
						testResult.title && /* @__PURE__ */ (void 0)("div", {
							className: "mt-4",
							children: [/* @__PURE__ */ (void 0)("span", {
								className: "text-xs text-muted",
								children: "Título revisado"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 255,
								columnNumber: 17
							}, this), /* @__PURE__ */ (void 0)("p", {
								className: "mt-1 text-sm leading-6",
								children: testResult.title
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 259,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 254,
							columnNumber: 34
						}, this),
						testResult.description && /* @__PURE__ */ (void 0)("div", {
							className: "mt-4",
							children: [/* @__PURE__ */ (void 0)("span", {
								className: "text-xs text-muted",
								children: "Descrição revisada"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 265,
								columnNumber: 17
							}, this), /* @__PURE__ */ (void 0)("p", {
								className: "mt-1 text-sm leading-6 text-muted",
								children: testResult.description
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 269,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 264,
							columnNumber: 40
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-lg bg-surface p-3",
							children: [/* @__PURE__ */ (void 0)("span", {
								className: "text-xs text-muted",
								children: "Motivo"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 275,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("p", {
								className: "mt-1 text-sm leading-6",
								children: testResult.reason
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 279,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 274,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 200,
					columnNumber: 24
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 175,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "font-display text-xl",
					children: "Recursos da Hikari AI"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 289,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Estrutura preparada para os recursos de inteligência artificial do painel administrativo."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 293,
					columnNumber: 11
				}, this)] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 288,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-start justify-between gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "grid size-10 shrink-0 place-items-center rounded-lg bg-elevated",
										children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(FileText, { className: "size-5" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 304,
											columnNumber: 17
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 303,
										columnNumber: 15
									}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "rounded-full bg-elevated px-2.5 py-1 text-[10px] text-muted",
										children: "Em breve"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 307,
										columnNumber: 15
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 302,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
									className: "mt-4 font-display text-lg",
									children: "Revisão de notícias"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 312,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-sm leading-6 text-muted",
									children: "A IA poderá analisar automaticamente as notícias antes da publicação, verificar o conteúdo e identificar informações relacionadas a animes."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 316,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("ul", {
									className: "mt-4 space-y-2 text-xs text-muted",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "size-3.5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 324,
												columnNumber: 17
											}, this), "Identificação do anime"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 323,
											columnNumber: 15
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "size-3.5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 329,
												columnNumber: 17
											}, this), "Revisão do título"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 328,
											columnNumber: 15
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "size-3.5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 334,
												columnNumber: 17
											}, this), "Revisão da descrição"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 333,
											columnNumber: 15
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "size-3.5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 339,
												columnNumber: 17
											}, this), "Detecção de conteúdo de jogos"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 338,
											columnNumber: 15
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 322,
									columnNumber: 13
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 301,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-start justify-between gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "grid size-10 shrink-0 place-items-center rounded-lg bg-elevated",
										children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ShieldCheck, { className: "size-5" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 349,
											columnNumber: 17
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 348,
										columnNumber: 15
									}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "rounded-full bg-elevated px-2.5 py-1 text-[10px] text-muted",
										children: "Em breve"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 352,
										columnNumber: 15
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 347,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
									className: "mt-4 font-display text-lg",
									children: "Moderação inteligente"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 357,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-sm leading-6 text-muted",
									children: "A IA poderá auxiliar na análise de comentários, denúncias e conteúdos enviados pelos usuários."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 361,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("ul", {
									className: "mt-4 space-y-2 text-xs text-muted",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "size-3.5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 368,
												columnNumber: 17
											}, this), "Análise de denúncias"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 367,
											columnNumber: 15
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "size-3.5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 373,
												columnNumber: 17
											}, this), "Detecção de conteúdo inadequado"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 372,
											columnNumber: 15
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "size-3.5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 378,
												columnNumber: 17
											}, this), "Auxílio aos moderadores"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 377,
											columnNumber: 15
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 366,
									columnNumber: 13
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 346,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-start justify-between gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "grid size-10 shrink-0 place-items-center rounded-lg bg-elevated",
										children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageSquareWarning, { className: "size-5" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 388,
											columnNumber: 17
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 387,
										columnNumber: 15
									}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "rounded-full bg-elevated px-2.5 py-1 text-[10px] text-muted",
										children: "Em breve"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 391,
										columnNumber: 15
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 386,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
									className: "mt-4 font-display text-lg",
									children: "Detecção de duplicatas"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 396,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-sm leading-6 text-muted",
									children: "A IA poderá comparar novas notícias com conteúdos existentes para evitar publicações repetidas."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 400,
									columnNumber: 13
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 385,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-start justify-between gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "grid size-10 shrink-0 place-items-center rounded-lg bg-elevated",
										children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(History, { className: "size-5" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 410,
											columnNumber: 17
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 409,
										columnNumber: 15
									}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "rounded-full bg-elevated px-2.5 py-1 text-[10px] text-muted",
										children: "Em breve"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 413,
										columnNumber: 15
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 408,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
									className: "mt-4 font-display text-lg",
									children: "Histórico da IA"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 418,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-sm leading-6 text-muted",
									children: "Registro das análises realizadas pela Hikari AI e das decisões tomadas pelo administrador."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 422,
									columnNumber: 13
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 407,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 299,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 287,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-start gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "grid size-10 shrink-0 place-items-center rounded-lg bg-elevated",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Settings, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 435,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 434,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
							className: "font-display text-lg",
							children: "Configuração da IA"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 439,
							columnNumber: 15
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-1 text-sm text-muted",
							children: "O provedor de inteligência artificial é configurado através das variáveis de ambiente do servidor."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 443,
							columnNumber: 15
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 438,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 433,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
						type: "button",
						variant: "outline",
						disabled: true,
						children: "Configurar"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 450,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 432,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mt-5 rounded-lg bg-elevated p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center gap-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 457,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Provedor de IA configurado no servidor" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 458,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 456,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-1 text-xs leading-5 text-muted",
							children: "As chaves do Gemini e do Groq permanecem protegidas nas variáveis de ambiente e não são enviadas para o navegador."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 461,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mt-3 flex flex-wrap gap-4 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "inline-flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "font-bold text-green-500",
									"aria-hidden": "true",
									children: "✓"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 468,
									columnNumber: 15
								}, this), "Funcionando / aprovado"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 467,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "inline-flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "font-bold text-red-500",
									"aria-hidden": "true",
									children: "✕"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 472,
									columnNumber: 15
								}, this), "Falha / não aprovado"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 471,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 466,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 455,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 431,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex justify-start pb-4",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
					asChild: true,
					variant: "outline",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/admin",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ArrowLeft, { className: "size-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 483,
							columnNumber: 13
						}, this), "Voltar ao Admin"]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 482,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 481,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 480,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 70,
		columnNumber: 10
	}, this);
}
//#endregion
export { HikariAIPage as component };
