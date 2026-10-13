import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as MessageCircle, Q as Heart, bt as Bell, o as UserPlus } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-notifications-l745yU9H.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/settings-notifications.tsx?tsr-split=component";
function getSavedNotificationSetting(key) {
	if (typeof window === "undefined") return true;
	const saved = window.localStorage.getItem(key);
	if (saved === null) return true;
	return saved !== "false";
}
function SettingsNotifications() {
	const [likes, setLikes] = (0, import_react.useState)(() => getSavedNotificationSetting("hikari-notifications-likes"));
	const [replies, setReplies] = (0, import_react.useState)(() => getSavedNotificationSetting("hikari-notifications-replies"));
	const [followers, setFollowers] = (0, import_react.useState)(() => getSavedNotificationSetting("hikari-notifications-followers"));
	function handleLikesToggle() {
		setLikes((current) => {
			const next = !current;
			localStorage.setItem("hikari-notifications-likes", String(next));
			return next;
		});
	}
	function handleRepliesToggle() {
		setReplies((current) => {
			const next = !current;
			localStorage.setItem("hikari-notifications-replies", String(next));
			return next;
		});
	}
	function handleFollowersToggle() {
		setFollowers((current) => {
			const next = !current;
			localStorage.setItem("hikari-notifications-followers", String(next));
			return next;
		});
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "min-h-screen pb-20 pt-5",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
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
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bell, { className: "size-5 text-fg" }, void 0, false, {
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
					children: "Notificações"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 53,
					columnNumber: 13
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Escolha quais atividades podem gerar notificações."
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
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
			className: "mb-7",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
				className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
				children: "Atividades"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 66,
				columnNumber: 9
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "overflow-hidden rounded-xl border border-border bg-bg",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center gap-4 border-b border-border px-4 py-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Heart, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 76,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 75,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Curtidas"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 80,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: "Receber notificações quando alguém curtir seu conteúdo."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 84,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 79,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								type: "button",
								role: "switch",
								"aria-checked": likes,
								onClick: handleLikesToggle,
								className: `relative h-6 w-11 shrink-0 rounded-full transition-colors ${likes ? "bg-green-500" : "bg-elevated"}`,
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { className: `absolute top-1 size-4 rounded-full bg-white transition-all ${likes ? "left-6" : "left-1"}` }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 90,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 89,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 73,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center gap-4 border-b border-border px-4 py-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 99,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 98,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Respostas"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 103,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: "Receber notificações quando alguém responder aos seus comentários."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 107,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 102,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								type: "button",
								role: "switch",
								"aria-checked": replies,
								onClick: handleRepliesToggle,
								className: `relative h-6 w-11 shrink-0 rounded-full transition-colors ${replies ? "bg-green-500" : "bg-elevated"}`,
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { className: `absolute top-1 size-4 rounded-full bg-white transition-all ${replies ? "left-6" : "left-1"}` }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 113,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 112,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 96,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center gap-4 px-4 py-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(UserPlus, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 122,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 121,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm font-medium text-fg",
									children: "Novos seguidores"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 126,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "mt-1 text-xs leading-5 text-muted",
									children: "Receber notificações quando alguém começar a seguir você."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 130,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 125,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								type: "button",
								role: "switch",
								"aria-checked": followers,
								onClick: handleFollowersToggle,
								className: `relative h-6 w-11 shrink-0 rounded-full transition-colors ${followers ? "bg-green-500" : "bg-elevated"}`,
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { className: `absolute top-1 size-4 rounded-full bg-white transition-all ${followers ? "left-6" : "left-1"}` }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 136,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 135,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 119,
						columnNumber: 11
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 70,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 65,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 39,
		columnNumber: 10
	}, this);
}
//#endregion
export { SettingsNotifications as component };
