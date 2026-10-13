import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DpRLJpAn.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/index.tsx?tsr-split=errorComponent";
function HomeError({ error }) {
	const message = error instanceof Error && error.message ? error.message : typeof error === "string" ? error : "Tente recarregar.";
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "mx-auto max-w-md py-24 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
			className: "font-display text-2xl",
			children: "Catálogo indisponível"
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 6,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
			className: "mt-2 text-sm text-muted",
			children: message
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 10,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 5,
		columnNumber: 10
	}, this);
}
//#endregion
export { HomeError as errorComponent };
