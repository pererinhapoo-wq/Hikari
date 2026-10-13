import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { v as Route$32 } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/test-api-anilist-D2ChE7DT.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/test-api-anilist.tsx?tsr-split=component";
function TestApiAniListPage() {
	const data = Route$32.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("pre", {
		style: {
			padding: "20px",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word"
		},
		children: [
			"HTTP ",
			data.status,
			"\n\n",
			data.response
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 4,
		columnNumber: 10
	}, this);
}
//#endregion
export { TestApiAniListPage as component };
