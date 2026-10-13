import { r as signIn } from "./client-cOaGlUWb.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { z as Logo } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-Ri2wCLXO.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/login.tsx?tsr-split=component";
function Login() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("main", {
		className: "grid min-h-[70vh] place-items-center py-12",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "w-full max-w-sm rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mb-6 flex justify-center",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Logo, {}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 7,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 6,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
					className: "font-display text-2xl tracking-tight",
					children: "Entrar na Conta"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 10,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Entre para usar sua conta no HIKARI."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 14,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mt-6 flex flex-col gap-2",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						type: "button",
						onClick: () => void signIn("google", { callbackURL: "/account" }),
						className: "w-full cursor-pointer rounded-md border px-4 py-3 text-sm font-medium",
						children: "Continuar com Google"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 19,
						columnNumber: 26
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 18,
					columnNumber: 9
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 5,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 4,
		columnNumber: 10
	}, this);
}
//#endregion
export { Login as component };
