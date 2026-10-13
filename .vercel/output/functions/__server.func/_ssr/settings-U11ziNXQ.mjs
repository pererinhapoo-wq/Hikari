import { A as Play, J as Info, P as Palette, a as User, b as Shield, bt as Bell, tt as Eye, ut as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-U11ziNXQ.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/settings.tsx?tsr-split=component";
var items = [
	{
		title: "Conta",
		description: "Gerencie informações da sua conta.",
		icon: User,
		href: "https://grokhikari.vercel.app/settings-account"
	},
	{
		title: "Privacidade",
		description: "Controle sua privacidade no Hikari.",
		icon: Eye,
		href: "https://grokhikari.vercel.app/settings-privacy"
	},
	{
		title: "Notificações",
		description: "Escolha quais notificações receber.",
		icon: Bell,
		href: "https://grokhikari.vercel.app/settings-notifications"
	},
	{
		title: "Player",
		description: "Configure suas preferências de reprodução.",
		icon: Play,
		href: "https://grokhikari.vercel.app/settings-player"
	},
	{
		title: "Aparência",
		description: "Personalize a aparência do Hikari.",
		icon: Palette,
		href: "https://grokhikari.vercel.app/settings-appearance"
	},
	{
		title: "Segurança",
		description: "Gerencie os dispositivos e sessões da sua conta.",
		icon: Shield,
		href: "https://grokhikari.vercel.app/settings-security"
	},
	{
		title: "Sobre",
		description: "Informações sobre o Hikari.",
		icon: Info,
		href: "https://grokhikari.vercel.app/settings-about"
	}
];
function Settings() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "min-h-screen pb-20 pt-5",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mb-6",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
				className: "text-2xl font-bold text-fg",
				children: "Configurações"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 43,
				columnNumber: 9
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Gerencie sua conta e suas preferências."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 47,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 42,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "overflow-hidden rounded-xl border border-border bg-bg",
			children: items.map((item) => {
				const Icon = item.icon;
				return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("a", {
					href: item.href,
					className: "flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-elevated",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Icon, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 59,
								columnNumber: 17
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 58,
							columnNumber: 15
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-medium text-fg",
								children: item.title
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 63,
								columnNumber: 17
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-xs leading-5 text-muted",
								children: item.description
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 67,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 62,
							columnNumber: 15
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-5 shrink-0 text-muted" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 72,
							columnNumber: 15
						}, this)
					]
				}, item.title, true, {
					fileName: _jsxFileName,
					lineNumber: 57,
					columnNumber: 16
				}, this);
			})
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 53,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 39,
		columnNumber: 10
	}, this);
}
//#endregion
export { Settings as component };
