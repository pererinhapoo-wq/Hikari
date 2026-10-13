import { i as createServerFn, l as getRequestHeaders } from "./ssr.mjs";
import { t as auth } from "./server-B8XoIhuu.mjs";
import { t as createServerRpc } from "./createServerRpc--phiu8Av.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-account-DWhbv6TY.js
var getAccountSession_createServerFn_handler = createServerRpc({
	id: "dc0a2f2c9be36a20adcfcabecdb4dfda242ab43dfd30504731175343705c23b2",
	name: "getAccountSession",
	filename: "src/routes/settings-account.tsx"
}, (opts) => getAccountSession.__executeServer(opts));
var getAccountSession = createServerFn({ method: "GET" }).handler(getAccountSession_createServerFn_handler, async () => {
	try {
		return { email: (await auth.api.getSession({ headers: getRequestHeaders() }))?.user?.email ?? null };
	} catch {
		return { email: null };
	}
});
//#endregion
export { getAccountSession_createServerFn_handler };
