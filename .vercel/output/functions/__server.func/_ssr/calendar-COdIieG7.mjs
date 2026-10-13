import { gt as CalendarDays } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar-COdIieG7.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/calendar.tsx?tsr-split=errorComponent";
function CalendarError({ error }) {
	const message = error instanceof Error ? error.message : "Tente novamente.";
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "mx-auto max-w-md py-24 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CalendarDays, { className: "mx-auto size-10 text-muted" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 50,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
				className: "mt-4 font-display text-2xl",
				children: "Calendário indisponível"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 52,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-2 text-sm text-muted",
				children: message
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 56,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 49,
		columnNumber: 10
	}, this);
}
//#endregion
export { CalendarError as errorComponent };
