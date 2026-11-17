import { createServerFn } from "@tanstack/react-start";
import type { HomeEpisodesResult } from "@/lib/home-episodes";

/**
 * Server Function GET pública e enxuta para episódios recentes da Home.
 * Executa `executeGetHomePublicEpisodes()` no servidor (com cache de 180s,
 * singleflight e invalidação administrativa) sem expor módulos server-only
 * ao bundle do navegador.
 */
export const getHomePublicEpisodes = createServerFn({
  method: "GET",
}).handler(async (): Promise<HomeEpisodesResult> => {
  const { executeGetHomePublicEpisodes } = await import("@/lib/home-episodes");
  return executeGetHomePublicEpisodes();
});
