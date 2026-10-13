import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { A as Play, H as Maximize, R as MonitorPlay, T as Settings2, mt as Captions, ut as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-player-NrZUQKt1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/settings-player.tsx?tsr-split=component";
function getSavedAutoplay() {
	if (typeof window === "undefined") return true;
	const savedAutoplay = window.localStorage.getItem("hikari-player-autoplay");
	if (savedAutoplay === null) return true;
	return savedAutoplay !== "false";
}
function SettingsPlayer() {
	const [autoplay, setAutoplay] = (0, import_react.useState)(getSavedAutoplay);
	const [qualityOpen, setQualityOpen] = (0, import_react.useState)(false);
	const [quality, setQuality] = (0, import_react.useState)("Automática");
	const [captionsOpen, setCaptionsOpen] = (0, import_react.useState)(false);
	const [captions, setCaptions] = (0, import_react.useState)("Ativadas");
	const [fullscreenOpen, setFullscreenOpen] = (0, import_react.useState)(false);
	const [fullscreen, setFullscreen] = (0, import_react.useState)("Perguntar");
	function handleAutoplayToggle() {
		setAutoplay((current) => {
			const next = !current;
			localStorage.setItem("hikari-player-autoplay", String(next));
			return next;
		});
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
					lineNumber: 33,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-11 items-center justify-center rounded-xl bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MonitorPlay, { className: "size-5 text-fg" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 39,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 38,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
						className: "text-2xl font-bold text-fg",
						children: "Player"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 43,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Personalize o comportamento do player de vídeo."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 47,
						columnNumber: 13
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 42,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 37,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 32,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "Reprodução"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 56,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "overflow-hidden rounded-xl border border-border bg-bg",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center gap-4 border-b border-border px-4 py-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Play, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 65,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 64,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Reprodução automática"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 69,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: "Iniciar o episódio automaticamente ao abrir o player."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 73,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 68,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								type: "button",
								role: "switch",
								"aria-checked": autoplay,
								onClick: handleAutoplayToggle,
								className: `relative h-6 w-11 shrink-0 rounded-full transition-colors ${autoplay ? "bg-green-500" : "bg-elevated"}`,
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { className: `absolute top-1 size-4 rounded-full bg-white transition-all ${autoplay ? "left-6" : "left-1"}` }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 79,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 78,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 63,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: () => setQualityOpen(true),
						className: "flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-elevated",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Settings2, { className: "size-5" }, void 0, false, {
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
									children: "Qualidade do vídeo"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 90,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: quality
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
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-5 shrink-0 text-muted" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 99,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 84,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 60,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 55,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "Legendas"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 107,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "overflow-hidden rounded-xl border border-border bg-bg",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: () => setCaptionsOpen(true),
						className: "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Captions, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 115,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 114,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Legendas"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 119,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: captions
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 123,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 118,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-5 shrink-0 text-muted" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 128,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 113,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 111,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 106,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
				className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
				children: "Tela"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 136,
				columnNumber: 9
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "overflow-hidden rounded-xl border border-border bg-bg",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					type: "button",
					onClick: () => setFullscreenOpen(true),
					className: "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Maximize, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 144,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 143,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-medium text-fg",
								children: "Tela cheia"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 148,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-xs leading-5 text-muted",
								children: fullscreen
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 152,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 147,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-5 shrink-0 text-muted" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 157,
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
			}, this),
			qualityOpen && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4",
				children: /* @__PURE__ */ (void 0)("div", {
					className: "w-full max-w-sm rounded-2xl border border-border bg-bg p-5",
					children: [
						/* @__PURE__ */ (void 0)("h2", {
							className: "text-lg font-semibold text-fg",
							children: "Qualidade do vídeo"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 166,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-4 space-y-2",
							children: [
								"Automática",
								"1080p",
								"720p",
								"480p"
							].map((option) => /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => {
									setQuality(option);
									setQualityOpen(false);
								},
								className: "flex w-full items-center justify-between rounded-xl bg-elevated px-4 py-3 text-left text-sm text-fg",
								children: [option, quality === option && /* @__PURE__ */ (void 0)("span", {
									className: "text-green-500",
									children: "✓"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 177,
									columnNumber: 42
								}, this)]
							}, option, true, {
								fileName: _jsxFileName,
								lineNumber: 171,
								columnNumber: 70
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 170,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => setQualityOpen(false),
							className: "mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm text-muted",
							children: "Cancelar"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 183,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 165,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 164,
				columnNumber: 23
			}, this),
			captionsOpen && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4",
				children: /* @__PURE__ */ (void 0)("div", {
					className: "w-full max-w-sm rounded-2xl border border-border bg-bg p-5",
					children: [
						/* @__PURE__ */ (void 0)("h2", {
							className: "text-lg font-semibold text-fg",
							children: "Legendas"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 192,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-4 space-y-2",
							children: ["Ativadas", "Desativadas"].map((option) => /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => {
									setCaptions(option);
									setCaptionsOpen(false);
								},
								className: "flex w-full items-center justify-between rounded-xl bg-elevated px-4 py-3 text-left text-sm text-fg",
								children: [option, captions === option && /* @__PURE__ */ (void 0)("span", {
									className: "text-green-500",
									children: "✓"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 203,
									columnNumber: 43
								}, this)]
							}, option, true, {
								fileName: _jsxFileName,
								lineNumber: 197,
								columnNumber: 58
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 196,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => setCaptionsOpen(false),
							className: "mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm text-muted",
							children: "Cancelar"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 209,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 191,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 190,
				columnNumber: 24
			}, this),
			fullscreenOpen && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4",
				children: /* @__PURE__ */ (void 0)("div", {
					className: "w-full max-w-sm rounded-2xl border border-border bg-bg p-5",
					children: [
						/* @__PURE__ */ (void 0)("h2", {
							className: "text-lg font-semibold text-fg",
							children: "Tela cheia"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 218,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-4 space-y-2",
							children: ["Perguntar", "Entrar automaticamente"].map((option) => /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => {
									setFullscreen(option);
									setFullscreenOpen(false);
								},
								className: "flex w-full items-center justify-between rounded-xl bg-elevated px-4 py-3 text-left text-sm text-fg",
								children: [option, fullscreen === option && /* @__PURE__ */ (void 0)("span", {
									className: "text-green-500",
									children: "✓"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 229,
									columnNumber: 45
								}, this)]
							}, option, true, {
								fileName: _jsxFileName,
								lineNumber: 223,
								columnNumber: 70
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 222,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => setFullscreenOpen(false),
							className: "mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm text-muted",
							children: "Cancelar"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 235,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 217,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 216,
				columnNumber: 26
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 29,
		columnNumber: 10
	}, this);
}
//#endregion
export { SettingsPlayer as component };
