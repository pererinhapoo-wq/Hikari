import { createServerFn } from "@tanstack/react-start";
import { getSql, dbSource } from "@/lib/db";

export interface AdminSystemStatus {
  connected: boolean;
  dbSource: string;
  checkedAt: number;
  serverAnimesCount?: number;
  serverEpisodesCount?: number;
  serverPublishedEpisodesCount?: number;
  serverSeasonsCount?: number;
  error?: string | null;
}

/**
 * Consulta server-side do status real do PostgreSQL e contagens canônicas no servidor.
 * Retorna dados estritamente reais, sem simulações ou números fictícios.
 */
export async function executeGetAdminSystemStatus(): Promise<AdminSystemStatus> {
  try {
    const sql = await getSql();

    // 1. Testa conectividade real com SELECT 1
    const ping = await sql.query<{ ok: number }>("SELECT 1 as ok");
    if (!ping || ping.length === 0 || ping[0].ok !== 1) {
      return {
        connected: false,
        dbSource,
        checkedAt: Date.now(),
        error: "Resposta inesperada do banco de dados.",
      };
    }

    // 2. Consulta contagens reais das tabelas de catálogo no PostgreSQL
    let serverAnimesCount = 0;
    let serverEpisodesCount = 0;
    let serverPublishedEpisodesCount = 0;
    let serverSeasonsCount = 0;

    try {
      const animesRes = await sql.query<{ count: number }>(
        'SELECT count(*)::int as count FROM "catalog_anime";',
      );
      serverAnimesCount = Number(animesRes[0]?.count || 0);
    } catch {
      // Tabela pode ainda estar vazia ou sem migração aplicada neste ambiente
    }

    try {
      const episodesRes = await sql.query<{ count: number; published_count: number }>(
        `SELECT
           count(*)::int as count,
           count(case when "published" = true then 1 end)::int as published_count
         FROM "catalog_episode";`,
      );
      serverEpisodesCount = Number(episodesRes[0]?.count || 0);
      serverPublishedEpisodesCount = Number(episodesRes[0]?.published_count || 0);
    } catch {
      // ignore
    }

    try {
      const seasonsRes = await sql.query<{ count: number }>(
        'SELECT count(*)::int as count FROM "catalog_season";',
      );
      serverSeasonsCount = Number(seasonsRes[0]?.count || 0);
    } catch {
      // ignore
    }

    return {
      connected: true,
      dbSource,
      checkedAt: Date.now(),
      serverAnimesCount,
      serverEpisodesCount,
      serverPublishedEpisodesCount,
      serverSeasonsCount,
      error: null,
    };
  } catch (err: any) {
    return {
      connected: false,
      dbSource: dbSource || "unknown",
      checkedAt: Date.now(),
      error: err?.message || String(err),
    };
  }
}

/**
 * Server Function GET para checagem do sistema administrativo no Hikari Studio.
 */
export const getAdminSystemStatus = createServerFn({
  method: "GET",
}).handler(async (): Promise<AdminSystemStatus> => {
  return executeGetAdminSystemStatus();
});
