import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { AdminGuardError } from "./auth/admin-guard";
import { CrossSiteRequestError } from "./auth/isolation.server";
import { getSql } from "./db";
import {
  DEFAULT_HIKARI_PLAYER_API_TIMEOUT_MS,
  fetchHikariPlayerEpisodePoster,
  getHikariPlayerApiConfig,
} from "./hikari-player-api.server";
import {
  canAutoApplyHikariPlayerThumbnail,
  createHikariPlayerThumbnailManager,
  HIKARI_PLAYER_CLIENT_TIMEOUT_MS,
  HIKARI_PLAYER_THUMB_MESSAGES,
  resolveInitialThumbnailOrigin,
  type EpisodeThumbnailOrigin,
  type HikariPlayerThumbStatusEntry,
} from "./hikari-player-thumbnail";
import { handleGetHikariPlayerEpisode } from "@/routes/api/admin/hikari-player-episode.$id";
import { handlePostCatalogEpisode } from "@/routes/api/admin/catalog-episode";
import { invalidateCatalogEpisodesCacheAsync } from "./catalog-episodes";

const TEST_BASE_URL = "https://hikari-player-2.vercel.app";
const TEST_SECRET_TOKEN = "super-secret-player-token-do-not-leak-12345";

describe("hikari-player-api.server — consulta privada servidor-servidor", () => {
  it("1. Retorna poster_url quando o ID existe e envia Authorization Bearer apenas no servidor", async () => {
    let capturedUrl = "";
    let capturedAuth = "";

    const result = await fetchHikariPlayerEpisodePoster("  ep_valid_01  ", {
      baseUrl: `${TEST_BASE_URL}/`,
      apiToken: TEST_SECRET_TOKEN,
      fetchImpl: async (input, init) => {
        capturedUrl = String(input);
        const headers = new Headers(init?.headers);
        capturedAuth = headers.get("authorization") ?? "";
        return new Response(
          JSON.stringify({
            id: "ep_valid_01",
            poster_url: "https://cdn.example.com/posters/ep1.jpg",
            extra_ignored_field: "should-not-matter",
            video_url: "https://cdn.example.com/secret.m3u8",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    assert.equal(
      capturedUrl,
      "https://hikari-player-2.vercel.app/api/internal/episodes/ep_valid_01",
    );
    assert.equal(capturedAuth, `Bearer ${TEST_SECRET_TOKEN}`);
    assert.deepEqual(result, {
      ok: true,
      id: "ep_valid_01",
      posterUrl: "https://cdn.example.com/posters/ep1.jpg",
    });
    assert.equal(JSON.stringify(result).includes(TEST_SECRET_TOKEN), false);
  });

  it("2. Retorna posterUrl: null quando o Player responde com poster_url null ou vazio", async () => {
    const result = await fetchHikariPlayerEpisodePoster("ep_no_poster", {
      baseUrl: TEST_BASE_URL,
      apiToken: TEST_SECRET_TOKEN,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            id: "ep_no_poster",
            poster_url: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    assert.deepEqual(result, {
      ok: true,
      id: "ep_no_poster",
      posterUrl: null,
    });
  });

  it("3. Trata 404 do Player como not_found", async () => {
    const result = await fetchHikariPlayerEpisodePoster("ep_missing", {
      baseUrl: TEST_BASE_URL,
      apiToken: TEST_SECRET_TOKEN,
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "not_found");
      assert.equal(result.status, 404);
    }
  });

  it("4. Trata ausência de HIKARI_PLAYER_API_TOKEN ou HIKARI_PLAYER_BASE_URL como unavailable sem quebrar", async () => {
    const missingTokenConfig = getHikariPlayerApiConfig({
      baseUrl: TEST_BASE_URL,
      apiToken: "",
    });
    assert.deepEqual(missingTokenConfig, {
      configured: false,
      reason: "missing_env",
    });

    const missingBaseConfig = getHikariPlayerApiConfig({
      baseUrl: "",
      apiToken: TEST_SECRET_TOKEN,
    });
    assert.deepEqual(missingBaseConfig, {
      configured: false,
      reason: "missing_env",
    });

    let fetchCalled = false;
    const resNoToken = await fetchHikariPlayerEpisodePoster("ep_123", {
      baseUrl: TEST_BASE_URL,
      apiToken: "",
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response("{}");
      },
    });
    assert.equal(fetchCalled, false);
    assert.equal(resNoToken.ok, false);
    if (!resNoToken.ok) {
      assert.equal(resNoToken.kind, "unavailable");
    }
  });

  it("5. Trata 401, 403, 500 e erro de rede sem expor segredos", async () => {
    for (const status of [401, 403, 500, 503]) {
      const res = await fetchHikariPlayerEpisodePoster("ep_err", {
        baseUrl: TEST_BASE_URL,
        apiToken: TEST_SECRET_TOKEN,
        fetchImpl: async () =>
          new Response(`upstream fail ${TEST_SECRET_TOKEN}`, { status }),
      });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(
          res.kind,
          status === 401 || status === 403
            ? "upstream_auth_error"
            : "upstream_error",
        );
        assert.equal(res.error.includes(TEST_SECRET_TOKEN), false);
      }
    }

    const netRes = await fetchHikariPlayerEpisodePoster("ep_net", {
      baseUrl: TEST_BASE_URL,
      apiToken: TEST_SECRET_TOKEN,
      fetchImpl: async () => {
        throw new Error(`ECONNREFUSED ${TEST_SECRET_TOKEN}`);
      },
    });
    assert.equal(netRes.ok, false);
    if (!netRes.ok) {
      assert.equal(netRes.kind, "network_error");
      assert.equal(netRes.error.includes(TEST_SECRET_TOKEN), false);
    }
  });

  it("6. Aplica timeout (~5s padrão) quando o Player demora além do limite", async () => {
    assert.equal(DEFAULT_HIKARI_PLAYER_API_TIMEOUT_MS, 5000);

    const res = await fetchHikariPlayerEpisodePoster("ep_slow", {
      baseUrl: TEST_BASE_URL,
      apiToken: TEST_SECRET_TOKEN,
      timeoutMs: 40,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    });

    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.kind, "timeout");
    }
  });
});

describe("API Route GET /api/admin/hikari-player-episode/$id — proteção e respostas", () => {
  it("7. Protege rota contra usuário não autenticado (401) e não administrador (403)", async () => {
    const req = new Request(
      "https://hikaritv.cc.cd/api/admin/hikari-player-episode/ep_abc123",
    );

    const unauthRes = await handleGetHikariPlayerEpisode(
      { request: req, params: { id: "ep_abc123" } },
      {
        assertSameSite: () => {},
        requireAdmin: async () => {
          throw new AdminGuardError("Não autenticado.", 401);
        },
      },
    );
    assert.equal(unauthRes.status, 401);

    const nonAdminRes = await handleGetHikariPlayerEpisode(
      { request: req, params: { id: "ep_abc123" } },
      {
        assertSameSite: () => {},
        requireAdmin: async () => {
          throw new AdminGuardError("Acesso proibido.", 403);
        },
      },
    );
    assert.equal(nonAdminRes.status, 403);

    const crossSiteRes = await handleGetHikariPlayerEpisode(
      { request: req, params: { id: "ep_abc123" } },
      {
        assertSameSite: () => {
          throw new CrossSiteRequestError();
        },
      },
    );
    assert.equal(crossSiteRes.status, 403);
  });

  it("8. Retorna exatamente { id, poster_url } e nunca expõe token nas respostas HTTP", async () => {
    const req = new Request(
      "https://hikaritv.cc.cd/api/admin/hikari-player-episode/ep_abc123",
    );

    const okRes = await handleGetHikariPlayerEpisode(
      { request: req, params: { id: "ep_abc123" } },
      {
        assertSameSite: () => {},
        requireAdmin: async () => "admin-1",
        fetchPoster: async (id) => ({
          ok: true,
          id,
          posterUrl: "https://cdn.example.com/poster-ok.jpg",
        }),
      },
    );
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.deepEqual(okBody, {
      id: "ep_abc123",
      poster_url: "https://cdn.example.com/poster-ok.jpg",
    });

    const invalidRes = await handleGetHikariPlayerEpisode(
      { request: req, params: { id: "https://hikari-player-2.vercel.app/e/abc" } },
      {
        assertSameSite: () => {},
        requireAdmin: async () => "admin-1",
      },
    );
    assert.equal(invalidRes.status, 400);

    const unavailableRes = await handleGetHikariPlayerEpisode(
      { request: req, params: { id: "ep_abc123" } },
      {
        assertSameSite: () => {},
        requireAdmin: async () => "admin-1",
        fetchPoster: async () => ({
          ok: false,
          kind: "unavailable",
          id: "ep_abc123",
          error: "Indisponível",
        }),
      },
    );
    assert.equal(unavailableRes.status, 503);
    const unavailableText = await unavailableRes.text();
    assert.equal(unavailableText.includes(TEST_SECRET_TOKEN), false);

    const notFoundRes = await handleGetHikariPlayerEpisode(
      { request: req, params: { id: "ep_missing" } },
      {
        assertSameSite: () => {},
        requireAdmin: async () => "admin-1",
        fetchPoster: async () => ({
          ok: false,
          kind: "not_found",
          id: "ep_missing",
          status: 404,
          error: "Not found",
        }),
      },
    );
    assert.equal(notFoundRes.status, 404);

    const upstreamAuthRes = await handleGetHikariPlayerEpisode(
      { request: req, params: { id: "ep_abc123" } },
      {
        assertSameSite: () => {},
        requireAdmin: async () => "admin-1",
        fetchPoster: async () => ({
          ok: false,
          kind: "upstream_auth_error",
          id: "ep_abc123",
          status: 401,
          error: "Auth fail",
        }),
      },
    );
    assert.equal(upstreamAuthRes.status, 502);
  });
});

describe("hikari-player-thumbnail — proteção contra sobrescrita, corrida e deduplicação no editor", () => {
  it("9. Protege thumbnail manual contra sobrescrita (antes e depois da importação) e permite preencher vazia", async () => {
    assert.equal(resolveInitialThumbnailOrigin(""), "empty");
    assert.equal(
      resolveInitialThumbnailOrigin("https://manual.test/thumb.jpg"),
      "manual",
    );
    assert.equal(canAutoApplyHikariPlayerThumbnail("", "empty"), true);
    assert.equal(canAutoApplyHikariPlayerThumbnail(null, "manual"), true);
    assert.equal(
      canAutoApplyHikariPlayerThumbnail("https://a.test/1.jpg", "hikari-player"),
      true,
    );
    assert.equal(
      canAutoApplyHikariPlayerThumbnail("https://manual.test/1.jpg", "manual"),
      false,
    );

    const state = {
      epId: "ep_1",
      hikariId: "id_manual",
      thumbnail: "https://manual.test/existing.jpg",
      origin: "manual" as EpisodeThumbnailOrigin,
      status: undefined as HikariPlayerThumbStatusEntry | undefined,
    };

    const manager = createHikariPlayerThumbnailManager({
      getCurrentEpisodeId: () => state.hikariId,
      getCurrentThumbnailState: () => ({
        thumbnail: state.thumbnail,
        origin: state.origin,
      }),
      onStatusChange: (_k, s) => {
        state.status = s;
      },
      onApplyPoster: (_k, url) => {
        state.thumbnail = url;
        state.origin = "hikari-player";
      },
      fetchImpl: async (input) => {
        const id = decodeURIComponent(String(input).split("/").pop() || "");
        return new Response(
          JSON.stringify({
            id,
            poster_url: `https://player.cdn/${id}.jpg`,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    // Com thumbnail manual existente -> NÃO substitui
    await manager.lookup(state.epId, "id_manual");
    assert.equal(state.thumbnail, "https://manual.test/existing.jpg");
    assert.equal(state.origin, "manual");
    assert.equal(state.status?.preservedManual, true);

    // Trocar o ID do Hikari Player com thumbnail manual -> ainda busca, mas continua preservando manual
    state.hikariId = "id_other";
    await manager.lookup(state.epId, "id_other");
    assert.equal(state.thumbnail, "https://manual.test/existing.jpg");
    assert.equal(state.origin, "manual");

    // Limpar thumbnail -> permite preenchimento automático ao buscar novo ID
    state.thumbnail = "";
    state.origin = "empty";
    state.hikariId = "id_auto_1";
    await manager.lookup(state.epId, "id_auto_1");
    assert.equal(state.thumbnail, "https://player.cdn/id_auto_1.jpg");
    assert.equal(state.origin, "hikari-player");
    assert.equal(state.status?.message, HIKARI_PLAYER_THUMB_MESSAGES.imported);

    // Trocar ID quando a origem é hikari-player -> atualiza com novo poster
    state.hikariId = "id_auto_2";
    await manager.lookup(state.epId, "id_auto_2");
    assert.equal(state.thumbnail, "https://player.cdn/id_auto_2.jpg");
    assert.equal(state.origin, "hikari-player");

    // Se retorno for poster_url: null -> NÃO apaga imagem existente
    state.hikariId = "id_null_poster";
    await (async () => {
      const managerNull = createHikariPlayerThumbnailManager({
        getCurrentEpisodeId: () => state.hikariId,
        getCurrentThumbnailState: () => ({
          thumbnail: state.thumbnail,
          origin: state.origin,
        }),
        onStatusChange: (_k, s) => {
          state.status = s;
        },
        onApplyPoster: (_k, url) => {
          state.thumbnail = url;
          state.origin = "hikari-player";
        },
        fetchImpl: async () =>
          new Response(
            JSON.stringify({ id: "id_null_poster", poster_url: null }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      });
      await managerNull.lookup(state.epId, "id_null_poster");
      managerNull.dispose();
    })();
    assert.equal(state.thumbnail, "https://player.cdn/id_auto_2.jpg");
    assert.equal(state.status?.status, "no_image");
    assert.equal(state.status?.message, HIKARI_PLAYER_THUMB_MESSAGES.no_image);

    // Se o admin editar manualmente depois da importação -> nova troca de ID não sobrescreve
    state.thumbnail = "https://manual.test/after-import.jpg";
    state.origin = "manual";
    state.hikariId = "id_auto_3";
    await manager.lookup(state.epId, "id_auto_3");
    assert.equal(state.thumbnail, "https://manual.test/after-import.jpg");
    assert.equal(state.origin, "manual");

    manager.dispose();
  });

  it("10. Evita consultas duplicadas para o mesmo ID e descarta respostas antigas em troca rápida", async () => {
    assert.equal(HIKARI_PLAYER_CLIENT_TIMEOUT_MS, 5000);

    let currentId = "ep_fast_dup";
    let thumbnail = "";
    let origin: EpisodeThumbnailOrigin = "empty";
    let lastStatus: HikariPlayerThumbStatusEntry | undefined;

    let fetchCount = 0;
    const resolvers = new Map<string, (res: Response) => void>();

    const manager = createHikariPlayerThumbnailManager({
      getCurrentEpisodeId: () => currentId,
      getCurrentThumbnailState: () => ({ thumbnail, origin }),
      onStatusChange: (_k, s) => {
        lastStatus = s;
      },
      onApplyPoster: (_k, url) => {
        thumbnail = url;
        origin = "hikari-player";
      },
      fetchImpl: (input, init) => {
        fetchCount += 1;
        const id = decodeURIComponent(String(input).split("/").pop() || "");
        return new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
          resolvers.set(id, resolve);
        });
      },
    });

    // Duas chamadas concorrentes para o mesmo ID -> apenas 1 request
    const p1 = manager.lookup("ep1", "ep_fast_dup");
    const p2 = manager.lookup("ep1", "ep_fast_dup");
    assert.equal(fetchCount, 1);

    resolvers.get("ep_fast_dup")?.(
      new Response(
        JSON.stringify({
          id: "ep_fast_dup",
          poster_url: "https://cdn.test/dup.jpg",
        }),
        { status: 200 },
      ),
    );
    await Promise.all([p1, p2]);
    assert.equal(thumbnail, "https://cdn.test/dup.jpg");

    // Troca rápida: id_old (lento) -> id_new (rápido). Mesmo se id_old responder depois, é descartado!
    thumbnail = "";
    origin = "empty";
    currentId = "id_old";
    const slowOld = manager.lookup("ep1", "id_old");

    currentId = "id_new";
    const fastNew = manager.lookup("ep1", "id_new");

    resolvers.get("id_new")?.(
      new Response(
        JSON.stringify({
          id: "id_new",
          poster_url: "https://cdn.test/new.jpg",
        }),
        { status: 200 },
      ),
    );
    await fastNew;
    assert.equal(thumbnail, "https://cdn.test/new.jpg");
    assert.equal(lastStatus?.episodeIdRequested, "id_new");

    // Mesmo se a promessa antiga tentasse resolver tarde, não substitui id_new
    resolvers.get("id_old")?.(
      new Response(
        JSON.stringify({
          id: "id_old",
          poster_url: "https://cdn.test/old-stale.jpg",
        }),
        { status: 200 },
      ),
    );
    await slowOld;
    assert.equal(thumbnail, "https://cdn.test/new.jpg");
    assert.equal(lastStatus?.episodeIdRequested, "id_new");

    manager.dispose();
  });

  it("11. Trata 404, erros HTTP, timeout no cliente sem apagar thumbnail existente", async () => {
    let thumbnail = "https://cdn.test/keep-me.jpg";
    const origin: EpisodeThumbnailOrigin = "hikari-player";
    let statusEntry: HikariPlayerThumbStatusEntry | undefined;

    const manager404 = createHikariPlayerThumbnailManager({
      getCurrentEpisodeId: () => "ep_404",
      getCurrentThumbnailState: () => ({ thumbnail, origin }),
      onStatusChange: (_k, s) => {
        statusEntry = s;
      },
      onApplyPoster: (_k, url) => {
        thumbnail = url;
      },
      fetchImpl: async () => new Response("{}", { status: 404 }),
    });
    await manager404.lookup("ep1", "ep_404");
    assert.equal(thumbnail, "https://cdn.test/keep-me.jpg");
    assert.equal(statusEntry?.status, "not_found");
    assert.equal(statusEntry?.message, HIKARI_PLAYER_THUMB_MESSAGES.not_found);
    manager404.dispose();

    const managerTimeout = createHikariPlayerThumbnailManager({
      getCurrentEpisodeId: () => "ep_timeout",
      getCurrentThumbnailState: () => ({ thumbnail, origin }),
      onStatusChange: (_k, s) => {
        statusEntry = s;
      },
      onApplyPoster: (_k, url) => {
        thumbnail = url;
      },
      timeoutMs: 30,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    });
    await managerTimeout.lookup("ep1", "ep_timeout");
    assert.equal(thumbnail, "https://cdn.test/keep-me.jpg");
    assert.equal(statusEntry?.status, "error");
    assert.equal(statusEntry?.message, HIKARI_PLAYER_THUMB_MESSAGES.error);
    managerTimeout.dispose();
  });
});

describe("catalog-episode — integração com salvamento e fail-open no PostgreSQL (PGLite)", () => {
  const animeId = "local-hikari-player-thumb-save-test";
  const createdEpIds: string[] = [];

  before(async () => {
    const sql = await getSql();
    await sql.query(`DELETE FROM "catalog_episode" WHERE "animeId" = $1;`, [
      animeId,
    ]);
    await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = $1;`, [
      animeId,
    ]);
    await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [animeId]);
    await sql.query(
      `INSERT INTO "catalog_anime" ("id", "title", "createdAt", "updatedAt")
       VALUES ($1, 'Anime Thumb Integration Test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [animeId],
    );
    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
       VALUES ($1, 1, 'Temporada 1', 0, CURRENT_TIMESTAMP);`,
      [animeId],
    );
  });

  after(async () => {
    const sql = await getSql();
    if (createdEpIds.length > 0) {
      await sql.query(
        `DELETE FROM "catalog_episode" WHERE "id" = ANY($1::text[]);`,
        [createdEpIds],
      );
    }
    await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = $1;`, [
      animeId,
    ]);
    await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [animeId]);
    await invalidateCatalogEpisodesCacheAsync(animeId);
  });

  it("12. Persiste thumbnail vinda do formulário, faz fallback fail-open no servidor quando vazia e preserva thumbnail manual", async () => {
    const postHandler = ({ request }: { request: Request }) =>
      handlePostCatalogEpisode({ request }, { assertSameSite: () => {} });

    const prevBase = process.env.HIKARI_PLAYER_BASE_URL;
    const prevToken = process.env.HIKARI_PLAYER_API_TOKEN;
    const prevAdminIds = process.env.ADMIN_USER_IDS;
    const prevFetch = globalThis.fetch;

    // Cria usuário admin temporário ou injeta via ADMIN_USER_IDS/sessão mockada se necessário?
    // Nota: requireAdminUser consulta Better Auth via headers/cookie.
    // Vamos verificar se o ambiente possui tabela session/user no PGLite para criar uma sessão real de teste.
    const sql = await getSql();
    const testUserId = `test-admin-thumb-${Date.now()}`;
    const testSessionToken = `test-sess-thumb-${Date.now()}`;
    const testSessionId = `sess-${Date.now()}`;
    process.env.ADMIN_USER_IDS = prevAdminIds
      ? `${prevAdminIds},${testUserId}`
      : testUserId;

    await sql.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, 'Admin Test', $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
      [testUserId, `${testUserId}@hikaritv.test`],
    );
    await sql.query(
      `INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
       VALUES ($1, CURRENT_TIMESTAMP + INTERVAL '1 day', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3);`,
      [testSessionId, testSessionToken, testUserId],
    );

    try {
      const makePostRequest = (body: Record<string, unknown>) =>
        new Request("https://hikaritv.cc.cd/api/admin/catalog-episode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${testSessionToken}`,
          },
          body: JSON.stringify(body),
        });

      // A) Salva episódio já com thumbnail preenchida (importada pelo formulário)
      const epFormId = `ep-form-${Date.now()}`;
      createdEpIds.push(epFormId);
      const resA = await postHandler({
        request: makePostRequest({
          id: epFormId,
          animeId,
          seasonNumber: 1,
          number: 1,
          title: "Episódio 1",
          hikariPlayerEpisodeId: "hp_form_1",
          thumbnail: "https://cdn.example.com/imported-by-form.jpg",
          replaceThumbnail: true,
          published: true,
        }),
      });
      assert.equal(resA.status, 200);
      const jsonA = await resA.json();
      assert.equal(
        jsonA.thumbnail,
        "https://cdn.example.com/imported-by-form.jpg",
      );

      // B) Salva episódio sem thumbnail com Player indisponível (sem env vars) -> fail-open (salva normalmente com thumbnail null)
      delete process.env.HIKARI_PLAYER_BASE_URL;
      delete process.env.HIKARI_PLAYER_API_TOKEN;
      const epFailOpenId = `ep-failopen-${Date.now()}`;
      createdEpIds.push(epFailOpenId);
      const resB = await postHandler({
        request: makePostRequest({
          id: epFailOpenId,
          animeId,
          seasonNumber: 1,
          number: 2,
          title: "Episódio 2",
          hikariPlayerEpisodeId: "hp_failopen_2",
          thumbnail: null,
          replaceThumbnail: false,
          published: true,
        }),
      });
      assert.equal(resB.status, 200);
      const jsonB = await resB.json();
      assert.equal(jsonB.ok, true);
      assert.equal(jsonB.thumbnail, null);

      // C) Salva episódio sem thumbnail com Player configurado -> fallback no servidor busca poster_url e grava no banco
      process.env.HIKARI_PLAYER_BASE_URL = TEST_BASE_URL;
      process.env.HIKARI_PLAYER_API_TOKEN = TEST_SECRET_TOKEN;
      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/internal/episodes/hp_fallback_3")) {
          const authHeader = new Headers(init?.headers).get("authorization");
          assert.equal(authHeader, `Bearer ${TEST_SECRET_TOKEN}`);
          return new Response(
            JSON.stringify({
              id: "hp_fallback_3",
              poster_url: "https://cdn.example.com/server-fallback-3.jpg",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      }) as typeof fetch;

      const epFallbackId = `ep-fallback-${Date.now()}`;
      createdEpIds.push(epFallbackId);
      const resC = await postHandler({
        request: makePostRequest({
          id: epFallbackId,
          animeId,
          seasonNumber: 1,
          number: 3,
          title: "Episódio 3",
          hikariPlayerEpisodeId: "hp_fallback_3",
          thumbnail: null,
          replaceThumbnail: false,
          published: true,
        }),
      });
      assert.equal(resC.status, 200);
      const jsonC = await resC.json();
      assert.equal(
        jsonC.thumbnail,
        "https://cdn.example.com/server-fallback-3.jpg",
      );

      // Confirma no PostgreSQL que a thumbnail foi persistida
      const dbRowC = await sql.query<{ thumbnail: string | null }>(
        `SELECT "thumbnail" FROM "catalog_episode" WHERE "id" = $1;`,
        [epFallbackId],
      );
      assert.equal(
        dbRowC[0]?.thumbnail,
        "https://cdn.example.com/server-fallback-3.jpg",
      );

      // D) Salva episódio com thumbnail manual -> nunca consulta Player e mantém manual
      let unexpectedFallbackFetch = false;
      globalThis.fetch = (async () => {
        unexpectedFallbackFetch = true;
        return new Response(
          JSON.stringify({
            id: "hp_manual_4",
            poster_url: "https://cdn.example.com/should-not-overwrite.jpg",
          }),
          { status: 200 },
        );
      }) as typeof fetch;

      const epManualId = `ep-manual-${Date.now()}`;
      createdEpIds.push(epManualId);
      const resD = await postHandler({
        request: makePostRequest({
          id: epManualId,
          animeId,
          seasonNumber: 1,
          number: 4,
          title: "Episódio 4",
          hikariPlayerEpisodeId: "hp_manual_4",
          thumbnail: "https://manual.example.com/custom-4.jpg",
          replaceThumbnail: true,
          published: true,
        }),
      });
      assert.equal(resD.status, 200);
      assert.equal(unexpectedFallbackFetch, false);
      const jsonD = await resD.json();
      assert.equal(
        jsonD.thumbnail,
        "https://manual.example.com/custom-4.jpg",
      );
    } finally {
      globalThis.fetch = prevFetch;
      if (prevBase === undefined) delete process.env.HIKARI_PLAYER_BASE_URL;
      else process.env.HIKARI_PLAYER_BASE_URL = prevBase;
      if (prevToken === undefined) delete process.env.HIKARI_PLAYER_API_TOKEN;
      else process.env.HIKARI_PLAYER_API_TOKEN = prevToken;
      if (prevAdminIds === undefined) delete process.env.ADMIN_USER_IDS;
      else process.env.ADMIN_USER_IDS = prevAdminIds;

      await sql.query(`DELETE FROM "session" WHERE "id" = $1;`, [
        testSessionId,
      ]);
      await sql.query(`DELETE FROM "user" WHERE "id" = $1;`, [testUserId]);
    }
  });

  it("13. Garante que HIKARI_PLAYER_API_TOKEN nunca aparece em arquivos de frontend ou variáveis públicas", () => {
    const clientFiles = [
      "src/lib/hikari-player-thumbnail.ts",
      "src/components/admin/anime-editor/editor-seasons.tsx",
      "src/routes/admin.$id.tsx",
      ".env.example",
    ];

    for (const rel of clientFiles) {
      const content = fs.readFileSync(path.resolve(rel), "utf8");
      assert.equal(
        content.includes("VITE_HIKARI_PLAYER"),
        false,
        `${rel} não pode conter prefixo VITE_ para credenciais do Hikari Player`,
      );
      assert.equal(
        content.includes("NEXT_PUBLIC_HIKARI_PLAYER"),
        false,
        `${rel} não pode conter prefixo NEXT_PUBLIC_ para credenciais do Hikari Player`,
      );
      if (rel !== ".env.example") {
        assert.equal(
          content.includes("HIKARI_PLAYER_API_TOKEN"),
          false,
          `${rel} (frontend) não pode referenciar HIKARI_PLAYER_API_TOKEN`,
        );
        assert.equal(
          content.includes("hikari-player-api.server"),
          false,
          `${rel} (frontend) não pode importar módulo server-only`,
        );
      }
    }
  });
});
