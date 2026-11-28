import { createServerFn } from "@tanstack/react-start";
import type { HomeRecentlyAddedResult } from "@/lib/home-recently-added.server";

/**
 * Server Function GET pública para "Animes Recém-Adicionados" da Home.
 * Executa `executeGetHomeRecentlyAdded()` exclusivamente no servidor (com cache
 * de 180s, singleflight e invalidação administrativa) sem expor módulos
 * server-only ao bundle do cliente.
 */
export const getHomeRecentlyAdded = createServerFn({
  method: "GET",
}).handler(async (): Promise<HomeRecentlyAddedResult> => {
  const { executeGetHomeRecentlyAdded } = await import(
    "@/lib/home-recently-added.server"
  );
  return executeGetHomeRecentlyAdded();
});
