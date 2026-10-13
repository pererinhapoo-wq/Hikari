import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { I as Moon, P as Palette, _ as Sparkles, h as Sun, l as Type, pt as Check } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { b as Route$39 } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-appearance-CbpXzoa7.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/settings-appearance.tsx?tsr-split=component";
function getSavedTheme() {
	if (typeof window === "undefined") return "Escuro";
	const savedTheme = window.localStorage.getItem("hikari-theme");
	if (savedTheme === "Claro" || savedTheme === "Escuro") return savedTheme;
	return "Escuro";
}
function saveThemeCookie(theme) {
	document.cookie = `hikari-theme=${theme}; path=/; max-age=31536000; samesite=lax`;
}
function SettingsAppearance() {
	const initialTheme = Route$39.useLoaderData() || getSavedTheme();
	const [theme, setTheme] = (0, import_react.useState)(initialTheme);
	const [fontSize, setFontSize] = (0, import_react.useState)("Médio");
	const [animations, setAnimations] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		if (theme === "Claro") {
			document.documentElement.setAttribute("data-theme", "light");
			window.localStorage.setItem("hikari-theme", "Claro");
			saveThemeCookie("Claro");
		} else {
			document.documentElement.removeAttribute("data-theme");
			window.localStorage.setItem("hikari-theme", "Escuro");
			saveThemeCookie("Escuro");
		}
	}, [theme]);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "min-h-screen pb-20 pt-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "mb-6",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/settings",
					className: "mb-4 inline-flex items-center text-sm text-muted hover:text-fg",
					children: "← Voltar"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 38,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-11 items-center justify-center rounded-xl bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Palette, { className: "size-5 text-fg" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 44,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 43,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
						className: "text-2xl font-bold text-fg",
						children: "Aparência"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 48,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Personalize a aparência do Hikari."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 52,
						columnNumber: 13
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 47,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 42,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 37,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "Tema"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 60,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "overflow-hidden rounded-xl border border-border bg-bg",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: () => setTheme("Escuro"),
						className: "flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-elevated",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Moon, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 68,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 67,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Escuro"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 72,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: "Usar o tema escuro no Hikari."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 76,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 71,
								columnNumber: 13
							}, this),
							theme === "Escuro" && /* @__PURE__ */ (void 0)(Check, { className: "size-5 shrink-0 text-fg" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 81,
								columnNumber: 36
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 66,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: () => setTheme("Claro"),
						className: "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sun, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 86,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 85,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Claro"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 90,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: "Usar o tema claro no Hikari."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 94,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 89,
								columnNumber: 13
							}, this),
							theme === "Claro" && /* @__PURE__ */ (void 0)(Check, { className: "size-5 shrink-0 text-fg" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 99,
								columnNumber: 35
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 84,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 64,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 59,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "Texto"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 106,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "overflow-hidden rounded-xl border border-border bg-bg",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: () => {
							const sizes = [
								"Pequeno",
								"Médio",
								"Grande"
							];
							const current = sizes.indexOf(fontSize);
							setFontSize(sizes[(current + 1) % sizes.length]);
						},
						className: "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Type, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 118,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 117,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-medium text-fg",
								children: "Tamanho da fonte"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 122,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-xs leading-5 text-muted",
								children: ["Tamanho atual: ", fontSize]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 126,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 121,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 112,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 110,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 105,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
				className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
				children: "Efeitos"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 136,
				columnNumber: 9
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "overflow-hidden rounded-xl border border-border bg-bg",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center gap-4 px-4 py-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 145,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 144,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-medium text-fg",
								children: "Animações"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 149,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-xs leading-5 text-muted",
								children: "Ativar ou desativar animações da interface."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 153,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 148,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							type: "button",
							role: "switch",
							"aria-checked": animations,
							onClick: () => setAnimations(!animations),
							className: `relative h-6 w-11 shrink-0 rounded-full transition-colors ${animations ? "bg-green-500" : "bg-elevated"}`,
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { className: `absolute top-1 size-4 rounded-full bg-white transition-all ${animations ? "left-6" : "left-1"}` }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 159,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 158,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 142,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 140,
				columnNumber: 9
			}, this)] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 135,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 35,
		columnNumber: 10
	}, this);
}
//#endregion
export { SettingsAppearance as component };
