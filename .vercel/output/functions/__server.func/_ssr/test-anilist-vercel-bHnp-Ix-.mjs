import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { y as Route$33 } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/test-anilist-vercel-bHnp-Ix-.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/test-anilist-vercel.tsx?tsr-split=component";
function TestAniListVercelPage() {
	const data = Route$33.useLoaderData();
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
export { TestAniListVercelPage as component };
