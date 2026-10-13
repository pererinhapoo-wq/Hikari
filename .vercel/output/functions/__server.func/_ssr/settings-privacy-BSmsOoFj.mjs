import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { G as Lock, i as Users, t as X, tt as Eye, ut as ChevronRight, xt as Ban } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-privacy-BSmsOoFj.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/settings-privacy.tsx?tsr-split=component";
function getSavedPublicProfile() {
	if (typeof window === "undefined") return true;
	const savedPublicProfile = window.localStorage.getItem("hikari-public-profile");
	if (savedPublicProfile === null) return true;
	return savedPublicProfile !== "false";
}
function getSavedFollowers() {
	if (typeof window === "undefined") return "Todos";
	return window.localStorage.getItem("hikari-followers") ?? "Todos";
}
function SettingsPrivacy() {
	const [publicProfile, setPublicProfile] = (0, import_react.useState)(getSavedPublicProfile);
	const [followersOpen, setFollowersOpen] = (0, import_react.useState)(false);
	const [blockedOpen, setBlockedOpen] = (0, import_react.useState)(false);
	const [followers, setFollowers] = (0, import_react.useState)(getSavedFollowers);
	(0, import_react.useEffect)(() => {
		const savedFollowers = localStorage.getItem("hikari-followers");
		if (savedFollowers) setFollowers(savedFollowers);
	}, []);
	function handlePublicProfileToggle() {
		const next = !publicProfile;
		setPublicProfile(next);
		localStorage.setItem("hikari-public-profile", String(next));
	}
	function handleFollowersChange(option) {
		setFollowers(option);
		localStorage.setItem("hikari-followers", option);
		setFollowersOpen(false);
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
					lineNumber: 43,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-11 items-center justify-center rounded-xl bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Lock, { className: "size-5 text-fg" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 49,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 48,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
						className: "text-2xl font-bold text-fg",
						children: "Privacidade"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 53,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Controle quem pode acessar e interagir com seu perfil."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 57,
						columnNumber: 13
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 52,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 47,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 42,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "Visibilidade"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 65,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "overflow-hidden rounded-xl border border-border bg-bg",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: handlePublicProfileToggle,
						className: "flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-elevated",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Eye, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 72,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 71,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Perfil público"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 76,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: "Permitir que outras pessoas encontrem e vejam seu perfil."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 80,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 75,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: `relative h-6 w-11 shrink-0 rounded-full transition-colors ${publicProfile ? "bg-green-500" : "bg-elevated"}`,
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { className: `absolute top-1 size-4 rounded-full transition-transform ${publicProfile ? "translate-x-6 bg-white" : "translate-x-1 bg-muted"}` }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 86,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 85,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 70,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 69,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 64,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "Seguidores"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 93,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "overflow-hidden rounded-xl border border-border bg-bg",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: () => setFollowersOpen(true),
						className: "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Users, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 100,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 99,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Quem pode me seguir"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 104,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: followers
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 108,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 103,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-5 shrink-0 text-muted" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 113,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 98,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 97,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 92,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
				className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
				children: "Usuários bloqueados"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 119,
				columnNumber: 9
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "overflow-hidden rounded-xl border border-border bg-bg",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					type: "button",
					onClick: () => setBlockedOpen(true),
					className: "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Ban, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 126,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 125,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-medium text-fg",
								children: "Usuários bloqueados"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 130,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-xs leading-5 text-muted",
								children: "Gerencie as pessoas que você bloqueou."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 134,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 129,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-5 shrink-0 text-muted" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 139,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 124,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 123,
				columnNumber: 9
			}, this)] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 118,
				columnNumber: 7
			}, this),
			followersOpen && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5",
				children: /* @__PURE__ */ (void 0)("div", {
					className: "w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl",
					children: [/* @__PURE__ */ (void 0)("div", {
						className: "flex items-center gap-3",
						children: [
							/* @__PURE__ */ (void 0)("div", {
								className: "flex size-10 items-center justify-center rounded-full bg-elevated",
								children: /* @__PURE__ */ (void 0)(Users, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 148,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 147,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (void 0)("div", {
								className: "min-w-0 flex-1",
								children: /* @__PURE__ */ (void 0)("h3", {
									className: "text-xl font-semibold text-fg",
									children: "Quem pode me seguir"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 152,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 151,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => setFollowersOpen(false),
								className: "flex size-9 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg",
								children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 158,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 157,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 146,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)("div", {
						className: "mt-5 space-y-2",
						children: [
							"Todos",
							"Somente pessoas que você aprovar",
							"Ninguém"
						].map((option) => /* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: () => handleFollowersChange(option),
							className: "flex w-full items-center justify-between rounded-xl border border-border bg-bg px-4 py-4 text-left hover:bg-elevated",
							children: [/* @__PURE__ */ (void 0)("span", {
								className: "text-sm text-fg",
								children: option
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 164,
								columnNumber: 19
							}, this), followers === option && /* @__PURE__ */ (void 0)("span", {
								className: "text-sm font-semibold text-green-500",
								children: "✓"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 168,
								columnNumber: 44
							}, this)]
						}, option, true, {
							fileName: _jsxFileName,
							lineNumber: 163,
							columnNumber: 87
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 162,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 145,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 144,
				columnNumber: 25
			}, this),
			blockedOpen && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5",
				children: /* @__PURE__ */ (void 0)("div", {
					className: "w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl",
					children: [/* @__PURE__ */ (void 0)("div", {
						className: "flex items-center gap-3",
						children: [
							/* @__PURE__ */ (void 0)("div", {
								className: "flex size-10 items-center justify-center rounded-full bg-elevated",
								children: /* @__PURE__ */ (void 0)(Ban, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 180,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 179,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (void 0)("div", {
								className: "min-w-0 flex-1",
								children: /* @__PURE__ */ (void 0)("h3", {
									className: "text-xl font-semibold text-fg",
									children: "Usuários bloqueados"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 184,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 183,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => setBlockedOpen(false),
								className: "flex size-9 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg",
								children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 190,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 189,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 178,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)("div", {
						className: "mt-5 rounded-xl border border-border bg-bg p-5 text-center",
						children: [
							/* @__PURE__ */ (void 0)(Ban, { className: "mx-auto size-8 text-muted" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 195,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (void 0)("p", {
								className: "mt-3 text-sm font-medium text-fg",
								children: "Nenhum usuário bloqueado"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 197,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (void 0)("p", {
								className: "mt-1 text-xs leading-5 text-muted",
								children: "Os usuários que você bloquear aparecerão aqui."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 201,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 194,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 177,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 176,
				columnNumber: 23
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 41,
		columnNumber: 10
	}, this);
}
//#endregion
export { SettingsPrivacy as component };
