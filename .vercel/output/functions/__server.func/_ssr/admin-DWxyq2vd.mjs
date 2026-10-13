import { b as Navigate, h as Outlet } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { L as useCurrentUserState, R as isHikariAdmin } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-DWxyq2vd.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/admin.tsx?tsr-split=component";
function AdminGuard() {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return null;
	if (!user) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Navigate, { to: "/login" }, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 10,
		columnNumber: 21
	}, this);
	if (!isHikariAdmin(user.primaryEmail)) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Navigate, { to: "/account" }, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 11,
		columnNumber: 49
	}, this);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Outlet, {}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 12,
		columnNumber: 10
	}, this);
}
//#endregion
export { AdminGuard as component };
