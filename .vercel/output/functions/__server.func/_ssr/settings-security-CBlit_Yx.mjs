import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { L as Monitor, W as LogOut, b as Shield, ut as ChevronRight, v as Smartphone } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-security-CBlit_Yx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/settings-security.tsx?tsr-split=component";
function SettingsSecurity() {
	const [sessionsOpen, setSessionsOpen] = (0, import_react.useState)(false);
	const [logoutOpen, setLogoutOpen] = (0, import_react.useState)(false);
	const [message, setMessage] = (0, import_react.useState)("");
	function handleLogoutOtherSessions() {
		setLogoutOpen(false);
		setMessage("As outras sessões foram encerradas.");
	}
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
					lineNumber: 16,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-11 items-center justify-center rounded-xl bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Shield, { className: "size-5 text-fg" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 22,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 21,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
						className: "text-2xl font-bold text-fg",
						children: "Segurança"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 26,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Gerencie os dispositivos e sessões da sua conta."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 30,
						columnNumber: 13
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 25,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 20,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 15,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "Dispositivos conectados"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 39,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "overflow-hidden rounded-xl border border-border bg-bg",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center gap-4 border-b border-border px-4 py-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Smartphone, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 48,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 47,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Este dispositivo"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 52,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: "Sessão atual do Hikari."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 56,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 51,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-xs font-medium text-muted",
								children: "Atual"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 61,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 46,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: () => setSessionsOpen(true),
						className: "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Monitor, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 69,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 68,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Sessões ativas"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 73,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: "Veja onde sua conta está conectada."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 77,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 72,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-5 shrink-0 text-muted" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 82,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 67,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 43,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 38,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "Sessão"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 90,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "overflow-hidden rounded-xl border border-border bg-bg",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: () => setLogoutOpen(true),
						className: "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(LogOut, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 98,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 97,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Encerrar outras sessões"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 102,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: "Desconecte sua conta de outros dispositivos."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 106,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 101,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-5 shrink-0 text-muted" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 111,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 96,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 94,
					columnNumber: 9
				}, this),
				message && /* @__PURE__ */ (void 0)("p", {
					className: "mt-3 px-1 text-sm text-muted",
					children: message
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 116,
					columnNumber: 21
				}, this)
			] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 89,
				columnNumber: 7
			}, this),
			sessionsOpen && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4",
				children: /* @__PURE__ */ (void 0)("div", {
					className: "w-full max-w-sm rounded-2xl border border-border bg-bg p-5",
					children: [
						/* @__PURE__ */ (void 0)("h2", {
							className: "text-lg font-semibold text-fg",
							children: "Sessões ativas"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 125,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-xl bg-elevated p-4",
							children: /* @__PURE__ */ (void 0)("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ (void 0)(Smartphone, { className: "size-5 text-muted" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 131,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("p", {
									className: "text-sm font-medium text-fg",
									children: "Este dispositivo"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 134,
									columnNumber: 19
								}, this), /* @__PURE__ */ (void 0)("p", {
									className: "mt-1 text-xs text-muted",
									children: "Sessão atual"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 138,
									columnNumber: 19
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 133,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 130,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 129,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("p", {
							className: "mt-4 text-xs leading-5 text-muted",
							children: "Nenhuma outra sessão foi identificada nesta tela."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 145,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => setSessionsOpen(false),
							className: "mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm text-muted",
							children: "Fechar"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 149,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 123,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 122,
				columnNumber: 24
			}, this),
			logoutOpen && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4",
				children: /* @__PURE__ */ (void 0)("div", {
					className: "w-full max-w-sm rounded-2xl border border-border bg-bg p-5",
					children: [
						/* @__PURE__ */ (void 0)("h2", {
							className: "text-lg font-semibold text-fg",
							children: "Encerrar outras sessões?"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 160,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("p", {
							className: "mt-2 text-sm leading-5 text-muted",
							children: "Isso desconectará sua conta de outros dispositivos. O dispositivo atual continuará conectado."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 164,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 flex gap-3",
							children: [/* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => setLogoutOpen(false),
								className: "flex-1 rounded-xl border border-border px-4 py-3 text-sm text-muted",
								children: "Cancelar"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 170,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: handleLogoutOtherSessions,
								className: "flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-medium text-white",
								children: "Encerrar"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 174,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 169,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 158,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 157,
				columnNumber: 22
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 12,
		columnNumber: 10
	}, this);
}
//#endregion
export { SettingsSecurity as component };
