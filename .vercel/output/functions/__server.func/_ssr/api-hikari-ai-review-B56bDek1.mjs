import { i as createServerFn } from "./ssr.mjs";
import { Ft as string, Mt as object, wt as _enum } from "../_libs/@better-auth/core+[...].mjs";
import { t as createSsrRpc } from "./createSsrRpc-Cbx5Q3_U.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-hikari-ai-review-B56bDek1.js
var reviewSchema = object({
	title: string().trim().min(1).max(1e3),
	description: string().trim().max(1e4).default(""),
	source: string().trim().max(500).default(""),
	sourceUrl: string().trim().max(2e3).default(""),
	animeName: string().trim().max(500).default(""),
	provider: _enum(["gemini", "groq"]).optional()
});
var reviewHikariAINews = createServerFn({ method: "POST" }).inputValidator(reviewSchema).handler(createSsrRpc("28120bd7f92385b37288069e3333647052b92abeaf32b458973e6fe4ac2d4356"));
//#endregion
export { reviewHikariAINews as t };
