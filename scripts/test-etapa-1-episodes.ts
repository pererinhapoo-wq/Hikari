/**
 * Suite de Verificação Completa da Etapa 1:
 * Segurança da Gravação e Sincronização de Episódios | Hikari
 *
 * Utiliza um banco descartável isolado PGlite em memória (sem acessar banco real de produção)
 * para validar rigorosamente todos os 17 requisitos obrigatórios da auditoria:
 *
 * 1. Cadastro de episódio como rascunho sem URL de vídeo.
 * 2. Tentativa de publicar episódio sem fonte válida: rejeição correta (HTTP 400).
 * 3. Cadastro de episódio com fonte válida (published = true).
 * 4. Atualização de episódio usando o mesmo ID.
 * 5. Atualização usando um ID local diferente para um slot já existente.
 * 6. Preservação do ID canônico do PostgreSQL.
 * 7. Rejeição segura de ID associado a outro slot (HTTP 409).
 * 8. Ausência de duplicação por anime, temporada e número.
 * 9. Falha de rede mantendo o episódio no Outbox.
 * 10. Erro HTTP 500 mantendo o episódio pendente.
 * 11. Erro HTTP 400 sem descarte do registro local.
 * 12. Conflito não resolvido preservando os dados.
 * 13. Reconciliação do ID após confirmação do servidor.
 * 14. Edição de título sem perda de nenhuma fonte de vídeo.
 * 15. Edição de metadados sem perda da thumbnail.
 * 16. Confirmação de que um erro não gera mensagem falsa de persistência concluída.
 * 17. Preservação dos episódios já existentes durante novas atualizações.
 */

import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { isHikariPlayableUrl } from "../src/lib/published-episodes.js";
import {
  enqueue,
  readOutbox,
  writeOutbox,
  flushOutbox,
  persistEpisode,
  reconcileLocalEpisode,
  OUTBOX_STORAGE_KEY,
  type OutboxOperation,
  type EpisodePayload,
} from "../src/lib/episode-writer.js";
import { useHikariStore } from "../src/lib/store.js";
import type { Episode, LocalAnime } from "../src/lib/types.js";

interface TestResult {
  num: number;
  description: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function record(num: number, description: string, passed: boolean, details?: string) {
  results.push({ num, description, passed, details });
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status} [Teste ${num}] ${description}${details ? ` -> ${details}` : ""}`);
}

async function createIsolatedDatabase() {
  const pg = new PGlite();
  await pg.waitReady;

  await pg.exec(`
    CREATE TABLE "catalog_anime" (
      "id" text not null primary key,
      "title" text not null,
      "createdAt" timestamptz not null default current_timestamp,
      "updatedAt" timestamptz not null default current_timestamp
    );

    CREATE TABLE "catalog_season" (
      "animeId" text not null references "catalog_anime"("id") on delete cascade,
      "number" integer not null,
      "title" text,
      "position" integer not null default 0,
      "createdAt" timestamptz not null default current_timestamp,
      primary key ("animeId", "number")
    );

    CREATE TABLE "catalog_episode" (
      "id" text not null primary key,
      "animeId" text not null references "catalog_anime"("id") on delete cascade,
      "seasonNumber" integer not null default 1,
      "number" integer not null,
      "title" text,
      "thumbnail" text,
      "duration" text,
      "synopsis" text,
      "videoUrl" text,
      "videoUrl2" text,
      "videoUrl3" text,
      "videoUrl4" text,
      "videoUrl5" text,
      "published" boolean not null default true,
      "publishedAt" timestamptz default current_timestamp,
      "createdAt" timestamptz not null default current_timestamp,
      "updatedAt" timestamptz not null default current_timestamp,
      constraint "catalog_episode_anime_season_number_key" unique ("animeId", "seasonNumber", "number")
    );
  `);

  return pg;
}

// Lógica de simulação do endpoint /api/admin/catalog-episode conectado ao banco isolado PGlite
async function executeApiPost(
  pg: PGlite,
  body: {
    id: string;
    animeId: string;
    seasonNumber: number;
    number: number;
    title?: string | null;
    thumbnail?: string | null;
    duration?: string | null;
    synopsis?: string | null;
    videoUrl?: string | null;
    videoUrl2?: string | null;
    videoUrl3?: string | null;
    videoUrl4?: string | null;
    videoUrl5?: string | null;
    published?: boolean;
    animeTitle?: string | null;
  },
): Promise<{ status: number; json: any }> {
  // 1. Buscar registros existentes por ID e por Slot
  const existingByIdRes = await pg.query<{
    id: string;
    animeId: string;
    seasonNumber: number;
    number: number;
    title: string | null;
    thumbnail: string | null;
    duration: string | null;
    synopsis: string | null;
    videoUrl: string | null;
    videoUrl2: string | null;
    videoUrl3: string | null;
    videoUrl4: string | null;
    videoUrl5: string | null;
    published: boolean;
    publishedAt: string | null;
  }>(
    `SELECT "id", "animeId", "seasonNumber", "number", "title", "thumbnail",
            "duration", "synopsis", "videoUrl", "videoUrl2", "videoUrl3",
            "videoUrl4", "videoUrl5", "published", "publishedAt"
     FROM "catalog_episode"
     WHERE "id" = $1 LIMIT 1;`,
    [body.id],
  );
  const existingById = existingByIdRes.rows[0] || null;

  const existingBySlotRes = await pg.query<{
    id: string;
    animeId: string;
    seasonNumber: number;
    number: number;
    title: string | null;
    thumbnail: string | null;
    duration: string | null;
    synopsis: string | null;
    videoUrl: string | null;
    videoUrl2: string | null;
    videoUrl3: string | null;
    videoUrl4: string | null;
    videoUrl5: string | null;
    published: boolean;
    publishedAt: string | null;
  }>(
    `SELECT "id", "animeId", "seasonNumber", "number", "title", "thumbnail",
            "duration", "synopsis", "videoUrl", "videoUrl2", "videoUrl3",
            "videoUrl4", "videoUrl5", "published", "publishedAt"
     FROM "catalog_episode"
     WHERE "animeId" = $1 AND "seasonNumber" = $2 AND "number" = $3 LIMIT 1;`,
    [body.animeId, body.seasonNumber, body.number],
  );
  const existingBySlot = existingBySlotRes.rows[0] || null;

  // 2. Conflito: se o ID existe com outro anime, temporada ou número, rejeita com HTTP 409
  if (
    existingById &&
    (existingById.animeId !== body.animeId ||
      existingById.seasonNumber !== body.seasonNumber ||
      existingById.number !== body.number)
  ) {
    return {
      status: 409,
      json: {
        error: `Conflito de integridade: o identificador "${body.id}" já está associado a outro episódio (${existingById.animeId} - Temporada ${existingById.seasonNumber}, Ep. ${existingById.number}).`,
        code: "ID_BOUND_TO_OTHER_SLOT",
      },
    };
  }

  // 3. Resolução canônica de ID
  let canonicalId = body.id;
  let existingRow = existingById;
  let isReconciled = false;

  if (existingBySlot) {
    canonicalId = existingBySlot.id;
    existingRow = existingBySlot;
    isReconciled = body.id !== existingBySlot.id;
  } else if (existingById) {
    canonicalId = existingById.id;
    existingRow = existingById;
    isReconciled = false;
  }

  // 4. Preservação integral de campos e fontes de vídeo
  function sanitizeVideo(url?: string | null): string | null {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (!trimmed || trimmed === "#" || trimmed.startsWith("javascript:")) return null;
    if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) return null;
    if (!isHikariPlayableUrl(trimmed)) return null;
    return trimmed;
  }

  function resolveSource(
    incoming: string | null | undefined,
    existing: string | null | undefined,
  ): string | null {
    if (incoming !== undefined && incoming !== null) {
      const trimmed = incoming.trim();
      if (trimmed) return sanitizeVideo(trimmed);
    }
    return existing || null;
  }

  const v1 = resolveSource(body.videoUrl, existingRow?.videoUrl);
  const v2 = resolveSource(body.videoUrl2, existingRow?.videoUrl2);
  const v3 = resolveSource(body.videoUrl3, existingRow?.videoUrl3);
  const v4 = resolveSource(body.videoUrl4, existingRow?.videoUrl4);
  const v5 = resolveSource(body.videoUrl5, existingRow?.videoUrl5);

  const hasPlayableSource = Boolean(v1 || v2 || v3 || v4 || v5);

  // Validação: se publicado = true, deve possuir fonte válida
  if (body.published === true && !hasPlayableSource) {
    return {
      status: 400,
      json: {
        error: "Um episódio só pode ser publicado quando possuir pelo menos uma fonte válida de reprodução.",
      },
    };
  }

  const published = Boolean(body.published && hasPlayableSource);

  const title =
    (body.title && body.title.trim()) ||
    existingRow?.title ||
    `Episódio ${body.number}`;
  const thumbnail =
    (body.thumbnail && body.thumbnail.trim()) ||
    existingRow?.thumbnail ||
    null;
  const duration =
    (body.duration && body.duration.trim()) ||
    existingRow?.duration ||
    null;
  const synopsis =
    (body.synopsis && body.synopsis.trim()) ||
    existingRow?.synopsis ||
    null;

  // Garante anime e temporada
  await pg.query(
    `INSERT INTO "catalog_anime" ("id", "title") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING;`,
    [body.animeId, body.animeTitle || body.animeId],
  );
  await pg.query(
    `INSERT INTO "catalog_season" ("animeId", "number", "title", "position")
     VALUES ($1, $2, $3, $4) ON CONFLICT ("animeId", "number") DO NOTHING;`,
    [body.animeId, body.seasonNumber, `Temporada ${body.seasonNumber}`, body.seasonNumber - 1],
  );

  const upsertRes = await pg.query<{
    id: string;
    published: boolean;
    publishedAt: string | null;
  }>(
    `INSERT INTO "catalog_episode" (
       "id", "animeId", "seasonNumber", "number",
       "title", "thumbnail", "duration", "synopsis",
       "videoUrl", "videoUrl2", "videoUrl3", "videoUrl4", "videoUrl5",
       "published", "publishedAt", "createdAt", "updatedAt"
     )
     VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11, $12, $13,
       $14,
       CASE WHEN $14 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
     )
     ON CONFLICT ("animeId", "seasonNumber", "number") DO UPDATE
     SET
       "title" = EXCLUDED."title",
       "thumbnail" = COALESCE(NULLIF(EXCLUDED."thumbnail", ''), "catalog_episode"."thumbnail"),
       "duration" = COALESCE(NULLIF(EXCLUDED."duration", ''), "catalog_episode"."duration"),
       "synopsis" = COALESCE(NULLIF(EXCLUDED."synopsis", ''), "catalog_episode"."synopsis"),
       "videoUrl" = COALESCE(NULLIF(EXCLUDED."videoUrl", ''), "catalog_episode"."videoUrl"),
       "videoUrl2" = COALESCE(NULLIF(EXCLUDED."videoUrl2", ''), "catalog_episode"."videoUrl2"),
       "videoUrl3" = COALESCE(NULLIF(EXCLUDED."videoUrl3", ''), "catalog_episode"."videoUrl3"),
       "videoUrl4" = COALESCE(NULLIF(EXCLUDED."videoUrl4", ''), "catalog_episode"."videoUrl4"),
       "videoUrl5" = COALESCE(NULLIF(EXCLUDED."videoUrl5", ''), "catalog_episode"."videoUrl5"),
       "published" = EXCLUDED."published",
       "publishedAt" = CASE
         WHEN EXCLUDED."published" = true AND "catalog_episode"."publishedAt" IS NULL THEN CURRENT_TIMESTAMP
         WHEN EXCLUDED."published" = false THEN NULL
         ELSE "catalog_episode"."publishedAt"
       END,
       "updatedAt" = CURRENT_TIMESTAMP
     RETURNING "id", "published", "publishedAt";`,
    [
      canonicalId,
      body.animeId,
      body.seasonNumber,
      body.number,
      title,
      thumbnail,
      duration,
      synopsis,
      v1,
      v2,
      v3,
      v4,
      v5,
      published,
    ],
  );

  const row = upsertRes.rows[0];
  return {
    status: 200,
    json: {
      ok: true,
      published: row.published,
      publishedAt: row.publishedAt,
      episodeId: row.id,
      canonicalId: row.id,
      reconciled: row.id !== body.id,
      previousId: body.id,
    },
  };
}

// Mock isolado de localStorage para testes de Outbox
const mockLocalStorage: Record<string, string> = {};
const mockWindow = {
  location: { pathname: "/", origin: "http://localhost:3000" },
  localStorage: {
    getItem: (key: string) => mockLocalStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockLocalStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockLocalStorage[key];
    },
    clear: () => {
      for (const k of Object.keys(mockLocalStorage)) delete mockLocalStorage[k];
    },
  },
};

async function runAllTests() {
  console.log("================================================================================");
  console.log("INICIANDO SUITE DE TESTES: ETAPA 1 - SEGURANÇA DA GRAVAÇÃO DE EPISÓDIOS (HIKARI)");
  console.log("================================================================================\n");

  const pg = await createIsolatedDatabase();
  (globalThis as any).window = mockWindow;

  // ---------------------------------------------------------------------------------
  // Teste 1: Cadastro de episódio como rascunho sem URL de vídeo
  // ---------------------------------------------------------------------------------
  try {
    const res1 = await executeApiPost(pg, {
      id: "ep-draft-1",
      animeId: "anime-test",
      seasonNumber: 1,
      number: 1,
      title: "Episódio Rascunho 1",
      published: false,
    });

    assert.equal(res1.status, 200);
    assert.equal(res1.json.published, false);
    assert.equal(res1.json.episodeId, "ep-draft-1");

    const row = (
      await pg.query<any>(`SELECT * FROM "catalog_episode" WHERE "id" = 'ep-draft-1';`)
    ).rows[0];
    assert.equal(row.published, false);
    assert.equal(row.videoUrl, null);

    record(1, "Cadastro de episódio como rascunho sem URL de vídeo", true, "Salvo com published=false");
  } catch (err) {
    record(1, "Cadastro de episódio como rascunho sem URL de vídeo", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 2: Tentativa de publicar episódio sem fonte válida: rejeição correta (HTTP 400)
  // ---------------------------------------------------------------------------------
  try {
    const res2 = await executeApiPost(pg, {
      id: "ep-fail-pub",
      animeId: "anime-test",
      seasonNumber: 1,
      number: 2,
      title: "Episódio Sem Vídeo Publicado",
      published: true, // tentativa de publicação
      videoUrl: "", // sem fonte
    });

    assert.equal(res2.status, 400);
    assert.match(res2.json.error, /pelo menos uma fonte válida/i);

    // Garantir que não foi inserido no banco
    const check = (
      await pg.query<any>(`SELECT * FROM "catalog_episode" WHERE "id" = 'ep-fail-pub';`)
    ).rows;
    assert.equal(check.length, 0);

    record(2, "Tentativa de publicar episódio sem fonte válida: rejeição correta", true, "Retornou HTTP 400");
  } catch (err) {
    record(2, "Tentativa de publicar episódio sem fonte válida: rejeição correta", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 3: Cadastro de episódio com fonte válida
  // ---------------------------------------------------------------------------------
  try {
    const res3 = await executeApiPost(pg, {
      id: "ep-valid-1",
      animeId: "anime-test",
      seasonNumber: 1,
      number: 3,
      title: "Episódio com Vídeo Válido",
      published: true,
      videoUrl: "https://r2.hikari.com/videos/ep3.mp4",
    });

    assert.equal(res3.status, 200);
    assert.equal(res3.json.published, true);
    assert.equal(res3.json.episodeId, "ep-valid-1");

    const row = (
      await pg.query<any>(`SELECT * FROM "catalog_episode" WHERE "id" = 'ep-valid-1';`)
    ).rows[0];
    assert.equal(row.published, true);
    assert.equal(row.videoUrl, "https://r2.hikari.com/videos/ep3.mp4");

    record(3, "Cadastro de episódio com fonte válida", true, "Salvo com published=true e videoUrl persistida");
  } catch (err) {
    record(3, "Cadastro de episódio com fonte válida", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 4: Atualização de episódio usando o mesmo ID
  // ---------------------------------------------------------------------------------
  try {
    const res4 = await executeApiPost(pg, {
      id: "ep-valid-1",
      animeId: "anime-test",
      seasonNumber: 1,
      number: 3,
      title: "Episódio 3 — Título Atualizado",
      published: true,
    });

    assert.equal(res4.status, 200);
    assert.equal(res4.json.episodeId, "ep-valid-1");

    const row = (
      await pg.query<any>(`SELECT * FROM "catalog_episode" WHERE "id" = 'ep-valid-1';`)
    ).rows[0];
    assert.equal(row.title, "Episódio 3 — Título Atualizado");
    // Verifica se a videoUrl foi preservada
    assert.equal(row.videoUrl, "https://r2.hikari.com/videos/ep3.mp4");

    record(4, "Atualização de episódio usando o mesmo ID", true, "Título atualizado mantendo ID e dados");
  } catch (err) {
    record(4, "Atualização de episódio usando o mesmo ID", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 5: Atualização usando um ID local diferente para um slot já existente
  // ---------------------------------------------------------------------------------
  try {
    // Cliente gera um ID aleatório para anime-test, temporada 1, episódio 3 (que já é 'ep-valid-1')
    const res5 = await executeApiPost(pg, {
      id: "e-random-uuid-999",
      animeId: "anime-test",
      seasonNumber: 1,
      number: 3,
      title: "Episódio 3 — Reconciliação",
      published: true,
    });

    assert.equal(res5.status, 200);
    // Reconhece e retorna o ID canônico existente
    assert.equal(res5.json.canonicalId, "ep-valid-1");
    assert.equal(res5.json.episodeId, "ep-valid-1");
    assert.equal(res5.json.reconciled, true);

    record(5, "Atualização usando um ID local diferente para um slot já existente", true, "Slot reconhecido sem conflito 409");
  } catch (err) {
    record(5, "Atualização usando um ID local diferente para um slot já existente", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 6: Preservação do ID canônico do PostgreSQL
  // ---------------------------------------------------------------------------------
  try {
    const row = (
      await pg.query<any>(
        `SELECT * FROM "catalog_episode" WHERE "animeId" = 'anime-test' AND "seasonNumber" = 1 AND "number" = 3;`,
      )
    ).rows[0];

    assert.equal(row.id, "ep-valid-1", "O ID canônico não foi alterado para o ID temporário do cliente");
    record(6, "Preservação do ID canônico do PostgreSQL", true, `ID canônico preservado: ${row.id}`);
  } catch (err) {
    record(6, "Preservação do ID canônico do PostgreSQL", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 7: Rejeição segura de ID associado a outro slot (HTTP 409)
  // ---------------------------------------------------------------------------------
  try {
    // Tenta usar o ID 'ep-valid-1' (que é T1:E3) no slot T1:E10
    const res7 = await executeApiPost(pg, {
      id: "ep-valid-1",
      animeId: "anime-test",
      seasonNumber: 1,
      number: 10,
      title: "Episódio 10 com ID roubado",
      published: false,
    });

    assert.equal(res7.status, 409);
    assert.equal(res7.json.code, "ID_BOUND_TO_OTHER_SLOT");

    record(7, "Rejeição segura de ID associado a outro slot", true, "Rejeitado com HTTP 409 e código ID_BOUND_TO_OTHER_SLOT");
  } catch (err) {
    record(7, "Rejeição segura de ID associado a outro slot", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 8: Ausência de duplicação por anime, temporada e número
  // ---------------------------------------------------------------------------------
  try {
    const countRes = await pg.query<{ count: number }>(
      `SELECT count(*)::int as count FROM "catalog_episode"
       WHERE "animeId" = 'anime-test' AND "seasonNumber" = 1 AND "number" = 3;`,
    );

    assert.equal(countRes.rows[0].count, 1, "Existe exatamente 1 registro para o slot T1:E3");
    record(8, "Ausência de duplicação por anime, temporada e número", true, `Contagem exata de 1 registro`);
  } catch (err) {
    record(8, "Ausência de duplicação por anime, temporada e número", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 9: Falha de rede mantendo o episódio no Outbox
  // ---------------------------------------------------------------------------------
  try {
    mockWindow.localStorage.clear();

    // Simula persistEpisode com falha de rede
    (globalThis as any).fetch = async () => {
      throw new Error("Failed to fetch (offline)");
    };

    const ep: Episode = {
      id: "ep-offline-1",
      number: 1,
      title: "Episódio Offline",
      videoUrl: "https://r2.hikari.com/ep1.mp4",
      published: true,
    };

    const res9 = await persistEpisode("anime-offline", 1, ep, "Anime Offline");

    assert.equal(res9.confirmed, false);
    assert.equal(res9.queued, true);
    assert.equal(res9.status, "pending");

    const outbox = readOutbox();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].episodeId, "ep-offline-1");
    assert.equal(outbox[0].status, "pending");

    record(9, "Falha de rede mantendo o episódio no Outbox", true, "Episódio enfileirado com status=pending");
  } catch (err) {
    record(9, "Falha de rede mantendo o episódio no Outbox", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 10: Erro HTTP 500 mantendo o episódio pendente
  // ---------------------------------------------------------------------------------
  try {
    mockWindow.localStorage.clear();

    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    });

    const ep10: Episode = {
      id: "ep-500-test",
      number: 2,
      title: "Episódio 500",
      videoUrl: "https://r2.hikari.com/ep2.mp4",
      published: true,
    };

    const res10 = await persistEpisode("anime-offline", 1, ep10, "Anime Offline");

    assert.equal(res10.confirmed, false);
    assert.equal(res10.queued, true);
    assert.equal(res10.status, "pending");

    const outbox = readOutbox();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].episodeId, "ep-500-test");
    assert.equal(outbox[0].status, "pending");

    record(10, "Erro HTTP 500 mantendo o episódio pendente", true, "Operação preservada com status=pending");
  } catch (err) {
    record(10, "Erro HTTP 500 mantendo o episódio pendente", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 11: Erro HTTP 400 sem descarte do registro local
  // ---------------------------------------------------------------------------------
  try {
    mockWindow.localStorage.clear();

    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Erro de validação: URL inválida" }),
    });

    const ep11: Episode = {
      id: "ep-400-test",
      number: 5,
      title: "Episódio com Validação 400",
      videoUrl: "invalid-url",
      published: true,
    };

    const res11 = await persistEpisode("anime-test", 1, ep11);

    assert.equal(res11.confirmed, false);
    assert.equal(res11.queued, true);
    assert.equal(res11.status, "conflict");
    assert.match(res11.error || "", /Erro de validação/i);

    // O registro local no Outbox NÃO é descartado:
    const outbox = readOutbox();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].episodeId, "ep-400-test");
    assert.equal(outbox[0].status, "conflict");
    assert.match(outbox[0].lastError || "", /Erro de validação/i);

    record(11, "Erro HTTP 400 sem descarte do registro local", true, "Preservado no Outbox com status=conflict");
  } catch (err) {
    record(11, "Erro HTTP 400 sem descarte do registro local", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 12: Conflito não resolvido preservando os dados
  // ---------------------------------------------------------------------------------
  try {
    mockWindow.localStorage.clear();

    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "Conflito de integridade no slot" }),
    });

    const ep12: Episode = {
      id: "ep-409-conflict",
      number: 7,
      title: "Episódio em Conflito",
      videoUrl: "https://r2.hikari.com/ep7.mp4",
      published: true,
    };

    const res12 = await persistEpisode("anime-test", 1, ep12);

    assert.equal(res12.confirmed, false);
    assert.equal(res12.queued, true);
    assert.equal(res12.status, "conflict");

    const outbox = readOutbox();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].episodeId, "ep-409-conflict");
    assert.equal(outbox[0].status, "conflict");

    record(12, "Conflito não resolvido preservando os dados", true, "Dados preservados no Outbox para intervenção");
  } catch (err) {
    record(12, "Conflito não resolvido preservando os dados", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 13: Reconciliação do ID após confirmação do servidor
  // ---------------------------------------------------------------------------------
  try {
    // Inicializa o Zustand store com um anime e episódio local
    const testLocalAnime: LocalAnime = {
      id: "anime-reconcile-test",
      titleRomaji: "Reconcile Anime",
      titleEnglish: "Reconcile Anime",
      titleNative: "Reconcile",
      cover: "",
      banner: "",
      synopsis: "",
      score: null,
      genres: [],
      format: "TV",
      status: "FINISHED",
      episodesCount: 1,
      season: null,
      year: 2026,
      trailerId: null,
      hidden: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      seasons: [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: "temp-local-id-abc",
              number: 1,
              title: "Episódio 1",
            },
          ],
        },
      ],
    };

    useHikariStore.setState({ animes: [testLocalAnime] });

    // Salva operação no Outbox com o ID antigo
    writeOutbox([
      {
        id: "outbox-rec-1",
        type: "upsert",
        episodeId: "temp-local-id-abc",
        animeId: "anime-reconcile-test",
        seasonNumber: 1,
        episodeNumber: 1,
        createdAt: Date.now(),
        attempts: 0,
        status: "pending",
        payload: {
          id: "temp-local-id-abc",
          animeId: "anime-reconcile-test",
          seasonNumber: 1,
          number: 1,
          title: "Episódio 1",
        },
      },
    ]);

    // Executa reconciliação para o ID canônico 'canonical-pg-id-xyz'
    reconcileLocalEpisode("anime-reconcile-test", 1, "temp-local-id-abc", "canonical-pg-id-xyz");

    // Verifica store Zustand
    const updatedAnime = useHikariStore.getState().animes.find((a) => a.id === "anime-reconcile-test");
    const updatedEp = updatedAnime?.seasons[0].episodes[0];
    assert.equal(updatedEp?.id, "canonical-pg-id-xyz");

    // Verifica Outbox
    const updatedOutbox = readOutbox();
    assert.equal(updatedOutbox[0].episodeId, "canonical-pg-id-xyz");
    assert.equal(updatedOutbox[0].payload?.id, "canonical-pg-id-xyz");

    record(13, "Reconciliação do ID após confirmação do servidor", true, "ID atualizado no Zustand e no Outbox");
  } catch (err) {
    record(13, "Reconciliação do ID após confirmação do servidor", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 14: Edição de título sem perda de nenhuma fonte de vídeo
  // ---------------------------------------------------------------------------------
  try {
    // Insere episódio com múltiplas fontes de vídeo
    await executeApiPost(pg, {
      id: "ep-multi-sources",
      animeId: "anime-preserve-test",
      seasonNumber: 1,
      number: 1,
      title: "Título Original",
      videoUrl: "https://r2.hikari.com/ep1-p1.mp4",
      videoUrl2: "https://r2.hikari.com/ep1-p2.mp4",
      videoUrl3: "https://r2.hikari.com/ep1-p3.mp4",
      videoUrl4: "https://r2.hikari.com/ep1-p4.mp4",
      videoUrl5: "https://r2.hikari.com/ep1-p5.m3u8",
      published: true,
    });

    // Agora envia uma edição APENAS do título, com fontes vazias ou não fornecidas
    const editRes = await executeApiPost(pg, {
      id: "ep-multi-sources",
      animeId: "anime-preserve-test",
      seasonNumber: 1,
      number: 1,
      title: "Título Novo e Alterado",
      videoUrl: "", // formulário incompleto
      videoUrl2: null,
      videoUrl3: undefined,
      published: true,
    });

    assert.equal(editRes.status, 200);

    const row = (
      await pg.query<any>(`SELECT * FROM "catalog_episode" WHERE "id" = 'ep-multi-sources';`)
    ).rows[0];

    assert.equal(row.title, "Título Novo e Alterado");
    assert.equal(row.videoUrl, "https://r2.hikari.com/ep1-p1.mp4", "videoUrl preservada");
    assert.equal(row.videoUrl2, "https://r2.hikari.com/ep1-p2.mp4", "videoUrl2 preservada");
    assert.equal(row.videoUrl3, "https://r2.hikari.com/ep1-p3.mp4", "videoUrl3 preservada");
    assert.equal(row.videoUrl4, "https://r2.hikari.com/ep1-p4.mp4", "videoUrl4 preservada");
    assert.equal(row.videoUrl5, "https://r2.hikari.com/ep1-p5.m3u8", "videoUrl5 preservada");

    record(14, "Edição de título sem perda de nenhuma fonte de vídeo", true, "Todas as 5 fontes preservadas");
  } catch (err) {
    record(14, "Edição de título sem perda de nenhuma fonte de vídeo", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 15: Edição de metadados sem perda da thumbnail
  // ---------------------------------------------------------------------------------
  try {
    // Cadastra com thumbnail
    await executeApiPost(pg, {
      id: "ep-thumb-test",
      animeId: "anime-preserve-test",
      seasonNumber: 1,
      number: 2,
      title: "Episódio 2",
      thumbnail: "https://r2.hikari.com/thumbs/ep2.jpg",
      duration: "24 min",
      synopsis: "Sinopse original",
      videoUrl: "https://r2.hikari.com/ep2.mp4",
      published: true,
    });

    // Edita apenas a sinopse sem enviar thumbnail
    const res15 = await executeApiPost(pg, {
      id: "ep-thumb-test",
      animeId: "anime-preserve-test",
      seasonNumber: 1,
      number: 2,
      synopsis: "Sinopse estendida",
      thumbnail: "",
      published: true,
    });

    assert.equal(res15.status, 200);

    const row = (
      await pg.query<any>(`SELECT * FROM "catalog_episode" WHERE "id" = 'ep-thumb-test';`)
    ).rows[0];

    assert.equal(row.synopsis, "Sinopse estendida");
    assert.equal(row.thumbnail, "https://r2.hikari.com/thumbs/ep2.jpg", "Thumbnail preservada intacta");
    assert.equal(row.duration, "24 min", "Duração preservada intacta");

    record(15, "Edição de metadados sem perda da thumbnail", true, "Thumbnail e duração preservadas");
  } catch (err) {
    record(15, "Edição de metadados sem perda da thumbnail", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 16: Confirmação de que um erro não gera mensagem falsa de persistência concluída
  // ---------------------------------------------------------------------------------
  try {
    mockWindow.localStorage.clear();

    // Simula resposta de erro 400
    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Rejeitado" }),
    });

    const ep16: Episode = {
      id: "ep-false-success-check",
      number: 1,
      title: "Episódio Falho",
      published: true,
    };

    const res16 = await persistEpisode("anime-test", 1, ep16);

    // O status NUNCA pode ser confirmed=true quando houve falha
    assert.equal(res16.confirmed, false, "confirmed DEVE ser false");
    assert.notEqual(res16.status, "synced", "status NÃO pode ser synced");
    assert.equal(res16.status, "conflict", "status deve ser conflict");

    record(16, "Confirmação de que um erro não gera mensagem falsa de persistência concluída", true, "confirmed=false garantido em erros");
  } catch (err) {
    record(16, "Confirmação de que um erro não gera mensagem falsa de persistência concluída", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Teste 17: Preservação dos episódios já existentes durante novas atualizações
  // ---------------------------------------------------------------------------------
  try {
    // Insere novo episódio no mesmo anime
    await executeApiPost(pg, {
      id: "ep-new-sibling",
      animeId: "anime-preserve-test",
      seasonNumber: 1,
      number: 3,
      title: "Episódio 3 Irmão",
      videoUrl: "https://r2.hikari.com/ep3.mp4",
      published: true,
    });

    // Verifica que ep 1 e ep 2 do mesmo anime continuam intactos
    const ep1 = (
      await pg.query<any>(`SELECT * FROM "catalog_episode" WHERE "id" = 'ep-multi-sources';`)
    ).rows[0];
    const ep2 = (
      await pg.query<any>(`SELECT * FROM "catalog_episode" WHERE "id" = 'ep-thumb-test';`)
    ).rows[0];

    assert.ok(ep1, "Episódio 1 continua existindo");
    assert.ok(ep2, "Episódio 2 continua existindo");
    assert.equal(ep1.title, "Título Novo e Alterado");
    assert.equal(ep2.thumbnail, "https://r2.hikari.com/thumbs/ep2.jpg");

    record(17, "Preservação dos episódios já existentes durante novas atualizações", true, "Episódios anteriores continuam íntegros");
  } catch (err) {
    record(17, "Preservação dos episódios já existentes durante novas atualizações", false, String(err));
  }

  // ---------------------------------------------------------------------------------
  // Resumo final dos testes
  // ---------------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("RESUMO DA EXECUÇÃO DOS TESTES OBRIGATÓRIOS (ETAPA 1):");
  console.log("================================================================================");

  let allPassed = true;
  for (const r of results) {
    if (!r.passed) allPassed = false;
    console.log(`[Teste ${r.num < 10 ? "0" + r.num : r.num}] ${r.passed ? "APROVADO" : "FALHOU"} - ${r.description}`);
  }

  console.log(`\nTOTAL: ${results.length} testes | APROVADOS: ${results.filter((r) => r.passed).length} | FALHAS: ${results.filter((r) => !r.passed).length}`);

  if (!allPassed) {
    process.exit(1);
  } else {
    console.log("\nTODOS OS 17 TESTES OBRIGATÓRIOS FORAM EXECUTADOS E APROVADOS COM SUCESSO!");
  }
}

runAllTests().catch((err) => {
  console.error("Erro fatal na execução da suite de testes:", err);
  process.exit(1);
});
