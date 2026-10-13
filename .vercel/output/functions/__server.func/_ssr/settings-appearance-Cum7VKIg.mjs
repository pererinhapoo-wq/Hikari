import { i as createServerFn, s as getCookie } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc--phiu8Av.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-appearance-Cum7VKIg.js
var getAppearanceTheme_createServerFn_handler = createServerRpc({
	id: "a34ee8c6e41db677545f029e07cff17073360e9b45653837653382f09beefbcb",
	name: "getAppearanceTheme",
	filename: "src/routes/settings-appearance.tsx"
}, (opts) => getAppearanceTheme.__executeServer(opts));
var getAppearanceTheme = createServerFn({ method: "GET" }).handler(getAppearanceTheme_createServerFn_handler, () => {
	const savedTheme = getCookie("hikari-theme");
	if (savedTheme === "Claro" || savedTheme === "Escuro") return savedTheme;
	return "Escuro";
});
//#endregion
export { getAppearanceTheme_createServerFn_handler };
