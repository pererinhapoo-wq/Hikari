import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ANITUBE22_INCOMPLETE_PLAY_ERROR,
  ANITUBE22_INVALID_URL_ERROR,
  ANITUBE22_NOT_FOUND_ERROR,
  ANITUBE22_PROVIDER,
  ANITUBE22_WRONG_LANG_ERROR,
  buildAnitube22PlayerUrlFromParts,
  extractSignedMediaUrlFromProviderHtml,
  isAnitube22PlayerUrl,
  isLegacyAnitube22Ref,
  parseAnitube22PlayerUrl,
  parseSignedUrlExpiresAtMs,
  partitionEpisodeSourcesByLang,
  sortEpisodeSourcesByPriority,
  stripTimeQueryParam,
  validateAnitube22PlayerUrl,
  type EpisodeSourceItem,
} from "./anitube22";
import {
  cleanEpisodeDisplay,
  hasEpisodePlayableSource,
  isHikariPlayableUrl,
  isPersistablePlayableVideoUrl,
  isWatchPlayableMediaUrl,
  resolveEpisodePlayerSources,
  resolvePlayableStreamUrl,
  sanitizePlayableVideoUrl,
} from "./published-episodes";
import { getSql } from "./db";
import {
  invalidateCachedResolvedSourceUrl,
  SOURCE_RESOLVE_CACHE_TTL_SEC,
} from "./redis";
import {
  checkAndRecordEpisodeSource,
  deleteEpisodeSourcesForEpisode,
  listEpisodeSources,
  recordEpisodeSourceIndexResult,
  resolveAnitube22DirectStream,
  resolveEpisode,
  SourceValidationError,
  syncCatalogEpisodeSlotsToSources,
  upsertEpisodeSource,
} from "./sources";
import { handleSourceResolveRequest } from "../routes/api/source/resolve";

const SUB_URL_583375 =
  "https://www.anitube22.vip/playerricas.php?name=apphd/583375.mp4&img=https://www.hinatasoul.com/media/videos/tmb/583375/default.jpg&pais=pais=BR&time=1770000000&url=https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/zful/583375.mp4";
const DUB_URL_583375 =
  "https://www.anitube22.vip/playerricas.php?name=apphd/583375.mp4&img=https://www.hinatasoul.com/media/videos/tmb/583375/default.jpg&pais=pais=BR&time=1770000100&url=https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/ziphonec/583375.mp4";

describe("anitube22 strict playerricas.php parsing & rejection of legacy formats", () => {
  it("recusa anitube22://, IDs numéricos puros e URLs incompletas com mensagem clara", () => {
    for (const invalid of [
      "anitube22://sub/583375",
      "anitube22://dub/583375",
      "583375",
      "https://www.anitube22.vip/playerricas.php?name=apphd/583375.mp4",
      "https://www.anitube22.vip/playerricas.php?url=https://r2.example.com/zful/583375.mp4",
      "https://www.anitube22.vip/other.php?name=apphd/583375.mp4&url=https://r2.example.com/zful/583375.mp4",
      "https://www.anitube22.vip/playerricas.php?name=apphd/sem-numero.mp4&url=https://r2.example.com/zful/sem-numero.mp4",
    ]) {
      assert.equal(parseAnitube22PlayerUrl(invalid), null, `Devia recusar: ${invalid}`);
      const validation = validateAnitube22PlayerUrl(invalid);
      assert.equal(validation.ok, false);
      if (!validation.ok) {
        assert.equal(validation.error, ANITUBE22_INVALID_URL_ERROR);
      }
    }

    assert.equal(isLegacyAnitube22Ref("anitube22://sub/583375"), true);
    assert.equal(sanitizePlayableVideoUrl("anitube22://sub/583375"), null);
    assert.equal(sanitizePlayableVideoUrl("583375"), null);
    assert.equal(isHikariPlayableUrl("anitube22://sub/583375"), false);
    assert.equal(isWatchPlayableMediaUrl("anitube22://sub/583375"), false);
    assert.equal(isPersistablePlayableVideoUrl("anitube22://sub/583375"), false);
    assert.equal(hasEpisodePlayableSource({ videoUrl: "anitube22://sub/583375" }), false);
    assert.equal(resolvePlayableStreamUrl("anitube22://sub/583375"), null);
    assert.deepEqual(resolveEpisodePlayerSources({ videoUrl: "anitube22://sub/583375" }), []);
  });

  it("faz parse literal de name, img, url e id descartando time= e preservando buckets distintos", () => {
    const subParts = parseAnitube22PlayerUrl(SUB_URL_583375);
    const dubParts = parseAnitube22PlayerUrl(DUB_URL_583375);

    assert.ok(subParts);
    assert.ok(dubParts);
    assert.equal(subParts.externalId, "583375");
    assert.equal(subParts.namePath, "apphd/583375.mp4");
    assert.equal(
      subParts.urlPath,
      "https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/zful/583375.mp4",
    );
    assert.equal(
      subParts.imgUrl,
      "https://www.hinatasoul.com/media/videos/tmb/583375/default.jpg",
    );

    assert.equal(
      dubParts.urlPath,
      "https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/ziphonec/583375.mp4",
    );

    const runtimeSub = buildAnitube22PlayerUrlFromParts(subParts, 1710000500);
    assert.ok(runtimeSub.includes("/zful/583375.mp4"));
    assert.ok(runtimeSub.includes("&pais=pais=BR&time=1710000500&"));
    assert.equal(isAnitube22PlayerUrl(runtimeSub), true);

    const sanitized = sanitizePlayableVideoUrl(SUB_URL_583375);
    assert.ok(sanitized);
    assert.equal(sanitized.includes("time="), false);
    assert.ok(sanitized.includes("/zful/583375.mp4"));

    assert.equal(
      stripTimeQueryParam("https://cdn.example.com/video.mp4?time=12345&hd=1"),
      "https://cdn.example.com/video.mp4?hd=1",
    );
    assert.equal(
      stripTimeQueryParam("https://cdn.example.com/video.mp4?time=12345"),
      "https://cdn.example.com/video.mp4",
    );
  });

  it("ordena por prioridade crescente, mantém sub e dub independentes e ignora fontes incompletas/quebradas", () => {
    const items: EpisodeSourceItem[] = [
      {
        id: "s-incomplete",
        episodeId: "ep-1",
        provider: ANITUBE22_PROVIDER,
        externalId: "583375",
        lang: "sub",
        quality: "1080p",
        priority: 0,
        status: "incomplete",
        failCount: 0,
        lastCheckedAt: null,
        namePath: null,
        urlPath: null,
      },
      {
        id: "s3",
        episodeId: "ep-1",
        provider: ANITUBE22_PROVIDER,
        externalId: "300001",
        lang: "sub",
        quality: "720p",
        priority: 2,
        status: "active",
        failCount: 0,
        lastCheckedAt: null,
        namePath: "apphd/300001.mp4",
        urlPath: "https://r2.example.com/zful/300001.mp4",
      },
      {
        id: "s1-broken",
        episodeId: "ep-1",
        provider: ANITUBE22_PROVIDER,
        externalId: "100000",
        lang: "sub",
        quality: "1080p",
        priority: 0,
        status: "broken",
        failCount: 2,
        lastCheckedAt: null,
        namePath: "apphd/100000.mp4",
        urlPath: "https://r2.example.com/zful/100000.mp4",
      },
      {
        id: "s2",
        episodeId: "ep-1",
        provider: ANITUBE22_PROVIDER,
        externalId: "200001",
        lang: "sub",
        quality: "1080p",
        priority: 1,
        status: "active",
        failCount: 0,
        lastCheckedAt: null,
        namePath: "apphd/200001.mp4",
        urlPath: "https://r2.example.com/zful/200001.mp4",
      },
      {
        id: "d1",
        episodeId: "ep-1",
        provider: ANITUBE22_PROVIDER,
        externalId: "900001",
        lang: "dub",
        quality: "1080p",
        priority: 0,
        status: "active",
        failCount: 0,
        lastCheckedAt: null,
        namePath: "apphd/900001.mp4",
        urlPath: "https://r2.example.com/ziphonec/900001.mp4",
      },
    ];

    const partitioned = partitionEpisodeSourcesByLang(items);
    assert.deepEqual(
      partitioned.sub.map((s) => s.externalId),
      ["200001", "300001"],
    );
    assert.deepEqual(
      partitioned.dub.map((s) => s.externalId),
      ["900001"],
    );
    assert.equal(sortEpisodeSourcesByPriority(items, "sub")[0]?.priority, 1);
  });
});

describe("episode_sources strict validation, bucket isolation, legacy incomplete handling", () => {
  it("grava mesmo ID em sub (zful) e dub (ziphonec) sem colisão, valida 404/idioma, e trata fontes antigas sem name_path/url_path como incompletas", async () => {
    const sql = await getSql();
    const ts = Date.now();
    const animeId = `test-anime-${ts}`;
    const dubAnimeId = `test-anime-dub-${ts}`;
    const episodeId = `test-ep-${ts}`;
    const dubEpisodeId = `test-ep-dub-${ts}`;

    try {
      await sql.query(
        `INSERT INTO "catalog_anime" ("id", "title", "createdAt", "updatedAt")
         VALUES ($1, 'Teste Anime', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ($2, 'Teste Anime Dublado', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [animeId, dubAnimeId],
      );
      await sql.query(
        `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "createdAt", "updatedAt")
         VALUES ($1, $2, 1, 1, 'Episódio 1', $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ($4, $5, 1, 1, 'Episódio 1', $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [
          episodeId,
          animeId,
          sanitizePlayableVideoUrl(SUB_URL_583375),
          dubEpisodeId,
          dubAnimeId,
          sanitizePlayableVideoUrl(DUB_URL_583375),
        ],
      );

      // 1. Recusa anitube22:// no upsert
      await assert.rejects(
        () =>
          upsertEpisodeSource(
            {
              episodeId,
              provider: ANITUBE22_PROVIDER,
              externalId: "anitube22://sub/583375",
              lang: "sub",
            },
            { skipProbe: true },
          ),
        (err: unknown) =>
          err instanceof SourceValidationError &&
          err.message === ANITUBE22_INVALID_URL_ERROR,
      );

      // 2. Recusa idioma diferente do episódio ("esta fonte é de outro idioma")
      await assert.rejects(
        () =>
          upsertEpisodeSource(
            {
              episodeId: dubEpisodeId,
              provider: ANITUBE22_PROVIDER,
              externalId: SUB_URL_583375,
              lang: "sub",
            },
            { skipProbe: true },
          ),
        (err: unknown) =>
          err instanceof SourceValidationError &&
          err.message === ANITUBE22_WRONG_LANG_ERROR,
      );

      // 3. Recusa 404 do provedor no salvamento ("ID não encontrado no provedor")
      await assert.rejects(
        () =>
          upsertEpisodeSource(
            {
              episodeId,
              provider: ANITUBE22_PROVIDER,
              externalId: SUB_URL_583375,
              lang: "sub",
            },
            {
              fetchImpl: async () => new Response("deleted 404 not found", { status: 404 }),
            },
          ),
        (err: unknown) =>
          err instanceof SourceValidationError &&
          err.message === ANITUBE22_NOT_FOUND_ERROR &&
          err.statusCode === 404,
      );

      // Soft-404 com HTTP 200 e corpo "deleted 404 not found" também é recusado
      await assert.rejects(
        () =>
          upsertEpisodeSource(
            {
              episodeId,
              provider: ANITUBE22_PROVIDER,
              externalId: SUB_URL_583375,
              lang: "sub",
            },
            {
              fetchImpl: async () => new Response("deleted 404 not found", { status: 200 }),
            },
          ),
        (err: unknown) =>
          err instanceof SourceValidationError &&
          err.message === ANITUBE22_NOT_FOUND_ERROR,
      );

      // 4. Mesmo ID 583375 em sub (zful) e dub (ziphonec) grava duas fontes distintas
      const srcSub = await upsertEpisodeSource(
        {
          episodeId,
          provider: ANITUBE22_PROVIDER,
          externalId: SUB_URL_583375,
          lang: "sub",
          quality: "1080p",
          priority: 0,
        },
        {
          fetchImpl: async () => new Response("<html>player</html>", { status: 200 }),
        },
      );
      const srcDub = await upsertEpisodeSource(
        {
          episodeId,
          provider: ANITUBE22_PROVIDER,
          externalId: DUB_URL_583375,
          lang: "dub",
          quality: "1080p",
          priority: 0,
        },
        {
          fetchImpl: async () => new Response("<html>player</html>", { status: 200 }),
        },
      );

      assert.notEqual(srcSub.id, srcDub.id);
      assert.equal(srcSub.externalId, "583375");
      assert.equal(srcDub.externalId, "583375");
      assert.ok(srcSub.urlPath?.includes("/zful/583375.mp4"));
      assert.ok(srcDub.urlPath?.includes("/ziphonec/583375.mp4"));

      // Nenhuma coluna com time= no banco
      const timeLeakSources = await sql.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM "episode_sources"
         WHERE "episode_id" = $1
           AND (COALESCE("page_url", '') ILIKE '%time=%'
             OR COALESCE("direct_url", '') ILIKE '%time=%'
             OR COALESCE("url_path", '') ILIKE '%time=%');`,
        [episodeId],
      );
      assert.equal(timeLeakSources[0]?.count, 0);

      // resolveEpisode monta URL literal com bucket zful, nunca /api/hls
      const resolved = await resolveEpisode(episodeId);
      assert.equal(resolved.directUrl, null);
      assert.equal(resolved.provider, ANITUBE22_PROVIDER);
      assert.ok(resolved.iframeUrl?.includes("/zful/583375.mp4"));
      assert.equal(resolved.iframeUrl?.includes("/api/hls"), false);

      // 5. Fonte legada sem name_path/url_path fica marcada como incomplete e nunca faz fetch
      const legacyInserted = await sql.query<{ id: string }>(
        `INSERT INTO "episode_sources" (
           "episode_id", "provider", "external_id", "lang", "priority", "status"
         )
         VALUES ($1, $2, '999999', 'sub', 9, 'incomplete')
         RETURNING "id";`,
        [episodeId, ANITUBE22_PROVIDER],
      );
      const legacyId = legacyInserted[0]!.id;

      const withLegacy = await listEpisodeSources(episodeId, { includeBroken: true });
      const legacyItem = withLegacy.find((s) => s.id === legacyId);
      assert.equal(legacyItem?.status, "incomplete");

      const activeOnlyBefore = await listEpisodeSources(episodeId);
      assert.equal(activeOnlyBefore.some((s) => s.id === legacyId), false);

      let fetchCalledForLegacy = false;
      const legacyCheck = await checkAndRecordEpisodeSource(legacyId, {
        fetchImpl: async () => {
          fetchCalledForLegacy = true;
          return new Response("not found", { status: 404 });
        },
      });
      assert.equal(fetchCalledForLegacy, false);
      assert.equal(legacyCheck.status, "incomplete");
      assert.equal(legacyCheck.httpStatus, null);

      // 6. Saúde da fonte: rede offline não falha; 1a falha 5xx mantém active; 2a marca broken
      const networkThrowCheck = await checkAndRecordEpisodeSource(srcSub.id, {
        fetchImpl: async () => {
          throw new TypeError("fetch failed");
        },
      });
      assert.equal(networkThrowCheck.clientNetworkError, true);

      const firstFail = await checkAndRecordEpisodeSource(srcSub.id, {
        fetchImpl: async () => new Response("error", { status: 502 }),
      });
      assert.equal(firstFail.ok, false);
      assert.equal(firstFail.failCount, 1);
      assert.equal(firstFail.status, "active");

      const recovered = await checkAndRecordEpisodeSource(srcSub.id, {
        fetchImpl: async () => new Response("ok", { status: 200 }),
      });
      assert.equal(recovered.ok, true);
      assert.equal(recovered.failCount, 0);

      const failA = await recordEpisodeSourceIndexResult({
        sourceId: srcSub.id,
        httpStatus: 404,
      });
      assert.equal(failA.status, "active");
      const failB = await recordEpisodeSourceIndexResult({
        sourceId: srcSub.id,
        httpStatus: 500,
      });
      assert.equal(failB.status, "broken");

      // Sync ignora formato legado anitube22:// e aceita apenas playerricas.php completa
      const synced = await syncCatalogEpisodeSlotsToSources(
        episodeId,
        [
          { url: "anitube22://sub/589540", priority: 0 },
          {
            url: "https://www.anitube22.vip/playerricas.php?name=apphd/589540.mp4&img=https://www.hinatasoul.com/media/videos/tmb/589540/default.jpg&time=1770000000&url=https://r2.example.com/zful/589540.mp4",
            priority: 1,
          },
        ],
        { replaceAnitube22: false, skipProbe: true },
      );
      assert.equal(synced.length, 1);
      assert.equal(synced[0].externalId, "589540");
      assert.ok(synced[0].urlPath?.includes("/zful/589540.mp4"));
    } finally {
      await deleteEpisodeSourcesForEpisode(episodeId);
      await deleteEpisodeSourcesForEpisode(dubEpisodeId);
      await sql.query(`DELETE FROM "catalog_episode" WHERE "id" IN ($1, $2);`, [episodeId, dubEpisodeId]);
      await sql.query(`DELETE FROM "catalog_anime" WHERE "id" IN ($1, $2);`, [animeId, dubAnimeId]);
    }
  });

  it("remove duplicação 'Episódio N · Episódio N' no cabeçalho", () => {
    assert.equal(cleanEpisodeDisplay(1, "Episódio 1 · Episódio 1"), "Episódio 1");
    assert.equal(cleanEpisodeDisplay(12, "Episódio 12"), "Episódio 12");
    assert.equal(
      cleanEpisodeDisplay(5, "Episódio 5 · O Confronto Final"),
      "Episódio 5 — O Confronto Final",
    );
  });

  it("preserva atributos do iframe, botão Recarregar fonte, card opaco sem vazamento do provedor e placeholder-cover intacto", () => {
    const customPlayerSrc = fs.readFileSync(
      path.resolve("src/components/player/CustomVideoPlayer.tsx"),
      "utf8",
    );
    const simplePlayerSrc = fs.readFileSync(
      path.resolve("src/components/Player.tsx"),
      "utf8",
    );
    const imageUtilsSrc = fs.readFileSync(
      path.resolve("src/lib/image-utils.ts"),
      "utf8",
    );
    const watchSrc = fs.readFileSync(
      path.resolve("src/routes/watch_.$id.$ep.tsx"),
      "utf8",
    );

    assert.ok(customPlayerSrc.includes('referrerPolicy="no-referrer-when-downgrade"'));
    assert.ok(customPlayerSrc.includes('allow="autoplay; fullscreen; picture-in-picture"'));
    assert.ok(customPlayerSrc.includes("allowFullScreen"));
    assert.ok(customPlayerSrc.includes("Recarregar fonte"));
    assert.ok(customPlayerSrc.includes("!showIframeErrorBanner && !iframeChecking"));

    assert.ok(simplePlayerSrc.includes('referrerPolicy="no-referrer-when-downgrade"'));
    assert.ok(simplePlayerSrc.includes('allow="autoplay; fullscreen; picture-in-picture"'));
    assert.ok(simplePlayerSrc.includes("allowFullScreen"));
    assert.ok(simplePlayerSrc.includes("Recarregar fonte"));
    assert.ok(simplePlayerSrc.includes("!iframeError"));

    assert.equal(ANITUBE22_INCOMPLETE_PLAY_ERROR, "fonte incompleta, recadastre");
    assert.ok(watchSrc.includes("ANITUBE22_INCOMPLETE_PLAY_ERROR"));
    assert.ok(imageUtilsSrc.includes("/assets/placeholder-cover.webp"));
  });
});

describe("GET /api/source/resolve signed R2/HLS extraction, 3000s cache & error handling", () => {
  it("extrai URL assinada do R2 (MP4) com escapes HTML/JSON e playlists .m3u8 (HLS), ignorando playerricas.php", () => {
    const r2SignedMp4 =
      "https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/zful/583375.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=abc&X-Amz-Date=20261119T050000Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=deadbeef1234";

    const htmlEscaped = `<video><source src="${r2SignedMp4.replace(/&/g, "&amp;")}" type="video/mp4"></video>`;
    assert.deepEqual(extractSignedMediaUrlFromProviderHtml(htmlEscaped), {
      url: r2SignedMp4,
      kind: "mp4",
    });

    const jsEscaped = `<script>var cfg = {"src":"${r2SignedMp4.replace(/\//g, "\\/")}"};</script>`;
    assert.deepEqual(extractSignedMediaUrlFromProviderHtml(jsEscaped), {
      url: r2SignedMp4,
      kind: "mp4",
    });

    const hlsUrl = "https://cdn.example.com/streams/583375/master.m3u8?token=xyz999";
    assert.deepEqual(
      extractSignedMediaUrlFromProviderHtml(`<script>setup({file:"${hlsUrl}"})</script>`),
      { url: hlsUrl, kind: "hls" },
    );

    const noSigHtml = `<html><body><script>var u="${SUB_URL_583375}";</script></body></html>`;
    assert.equal(extractSignedMediaUrlFromProviderHtml(noSigHtml), null);

    const expMs = parseSignedUrlExpiresAtMs(r2SignedMp4);
    assert.equal(expMs, Date.UTC(2026, 10, 19, 5, 0, 0) + 3600 * 1000);
  });

  it("resolve com UA+Referer, faz cache de 3000s por sourceId, envia Cache-Control: private, max-age=0 e trata 404/403 vs erro de rede", async () => {
    const sql = await getSql();
    const ts = Date.now();
    const animeId = `test-resolve-anime-${ts}`;
    const episodeId = `test-resolve-ep-${ts}`;

    try {
      await sql.query(
        `INSERT INTO "catalog_anime" ("id", "title", "createdAt", "updatedAt")
         VALUES ($1, 'Anime Resolver Test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [animeId],
      );
      await sql.query(
        `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "createdAt", "updatedAt")
         VALUES ($1, $2, 1, 1, 'Episódio 1', $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [episodeId, animeId, sanitizePlayableVideoUrl(SUB_URL_583375)],
      );

      const src1 = await upsertEpisodeSource(
        {
          episodeId,
          provider: ANITUBE22_PROVIDER,
          externalId: SUB_URL_583375,
          lang: "sub",
          priority: 0,
        },
        { skipProbe: true },
      );
      const src2 = await upsertEpisodeSource(
        {
          episodeId,
          provider: ANITUBE22_PROVIDER,
          externalId: DUB_URL_583375.replace("/ziphonec/", "/altbucket/"),
          lang: "sub",
          priority: 1,
        },
        { skipProbe: true },
      );

      assert.equal(SOURCE_RESOLVE_CACHE_TTL_SEC, 3000);
      await invalidateCachedResolvedSourceUrl(src1.id);

      let providerCalls = 0;
      let capturedHeaders: Record<string, string> = {};
      let capturedUrl = "";
      const signedUrl1 =
        "https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/zful/583375.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20990101T000000Z&X-Amz-Expires=3600&X-Amz-Signature=sig1";

      const res1 = await handleSourceResolveRequest(
        new Request(`http://localhost/api/source/resolve?id=${encodeURIComponent(src1.id)}`),
        {
          fetchImpl: async (input, init) => {
            providerCalls += 1;
            capturedUrl = String(input);
            const h = new Headers(init?.headers);
            capturedHeaders = {
              ua: h.get("User-Agent") || "",
              referer: h.get("Referer") || "",
            };
            return new Response(`<video><source src="${signedUrl1}" /></video>`, {
              status: 200,
              headers: { "Content-Type": "text/html" },
            });
          },
        },
      );

      assert.equal(res1.status, 200);
      assert.equal(res1.headers.get("Cache-Control"), "private, max-age=0");
      assert.deepEqual(await res1.json(), { url: signedUrl1, kind: "mp4" });
      assert.equal(providerCalls, 1);
      assert.ok(capturedUrl.includes("playerricas.php"));
      assert.ok(capturedUrl.includes("/zful/583375.mp4"));
      assert.ok(capturedHeaders.ua.includes("Mozilla/5.0"));
      assert.equal(capturedHeaders.referer, "https://www.anitube22.vip/");

      // Segunda abertura devolve do cache sem nova chamada ao provedor
      const res2 = await handleSourceResolveRequest(
        new Request(`http://localhost/api/source/resolve?id=${encodeURIComponent(src1.id)}`),
        {
          fetchImpl: async () => {
            providerCalls += 1;
            throw new Error("Não deveria chamar o provedor quando há cache");
          },
        },
      );
      assert.equal(res2.status, 200);
      assert.equal(res2.headers.get("Cache-Control"), "private, max-age=0");
      assert.deepEqual(await res2.json(), { url: signedUrl1, kind: "mp4" });
      assert.equal(providerCalls, 1);

      // refresh=1 renova a URL assinada no provedor
      const signedUrlRefreshed = signedUrl1.replace("sig1", "sig2");
      const resRefresh = await handleSourceResolveRequest(
        new Request(`http://localhost/api/source/resolve?id=${encodeURIComponent(src1.id)}&refresh=1`),
        {
          fetchImpl: async () => {
            providerCalls += 1;
            return new Response(`<video src="${signedUrlRefreshed}"></video>`, {
              status: 200,
              headers: { "Content-Type": "text/html" },
            });
          },
        },
      );
      assert.equal(resRefresh.status, 200);
      assert.deepEqual(await resRefresh.json(), { url: signedUrlRefreshed, kind: "mp4" });
      assert.equal(providerCalls, 2);

      // Redirecionamento 302 direto para R2 devolve URL sem baixar bytes de vídeo
      let fetchedR2Binary = false;
      const redirectResult = await resolveAnitube22DirectStream(src1.id, {
        forceRefresh: true,
        fetchImpl: async (input) => {
          const u = String(input);
          if (new URL(u).hostname.includes("r2.cloudflarestorage.com")) {
            fetchedR2Binary = true;
            return new Response("binary-video-bytes", { status: 200 });
          }
          return new Response(null, {
            status: 302,
            headers: { Location: signedUrl1 },
          });
        },
      });
      assert.equal(redirectResult.ok, true);
      assert.equal(redirectResult.url, signedUrl1);
      assert.equal(fetchedR2Binary, false);

      // Erro de rede não marca falha na fonte
      const netErrResult = await resolveAnitube22DirectStream(src1.id, {
        forceRefresh: true,
        fetchImpl: async () => {
          throw new TypeError("network down");
        },
      });
      assert.equal(netErrResult.ok, false);
      assert.equal(netErrResult.networkError, true);
      let currentSrcs = await listEpisodeSources(episodeId, { includeBroken: true });
      assert.equal(currentSrcs.find((s) => s.id === src1.id)?.failCount, 0);

      // Corpo sem assinatura nem .m3u8 retorna erro 422 para cair para iframe, sem marcar falha
      const noSigResult = await resolveAnitube22DirectStream(src1.id, {
        forceRefresh: true,
        fetchImpl: async () => new Response("<html><body>sem link</body></html>", { status: 200 }),
      });
      assert.equal(noSigResult.ok, false);
      currentSrcs = await listEpisodeSources(episodeId, { includeBroken: true });
      assert.equal(currentSrcs.find((s) => s.id === src1.id)?.failCount, 0);

      // 403 do provedor marca falha na fonte (failCount=1)
      const err403 = await resolveAnitube22DirectStream(src1.id, {
        forceRefresh: true,
        fetchImpl: async () => new Response("Forbidden", { status: 403 }),
      });
      assert.equal(err403.ok, false);
      assert.equal(err403.httpStatus, 403);
      currentSrcs = await listEpisodeSources(episodeId, { includeBroken: true });
      assert.equal(currentSrcs.find((s) => s.id === src1.id)?.failCount, 1);
      assert.equal(currentSrcs.find((s) => s.id === src1.id)?.status, "active");

      // 404 do provedor marca falha adicional -> broken (e listEpisodeSources ativo passa para src2)
      const err404 = await resolveAnitube22DirectStream(src1.id, {
        forceRefresh: true,
        fetchImpl: async () => new Response("deleted 404 not found", { status: 404 }),
      });
      assert.equal(err404.ok, false);
      assert.equal(err404.httpStatus, 404);
      assert.equal(err404.sourceStatus, "broken");

      const activeRemaining = await listEpisodeSources(episodeId);
      assert.equal(activeRemaining.length, 1);
      assert.equal(activeRemaining[0]?.id, src2.id);
    } finally {
      await deleteEpisodeSourcesForEpisode(episodeId);
      await sql.query(`DELETE FROM "catalog_episode" WHERE "id" = $1;`, [episodeId]);
      await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [animeId]);
    }
  });

  it("garante player próprio direto para R2/HLS, fallback silencioso para iframe, 'fonte indisponível' e renovação <120s", () => {
    const customPlayerSrc = fs.readFileSync(
      path.resolve("src/components/player/CustomVideoPlayer.tsx"),
      "utf8",
    );
    const watchSrc = fs.readFileSync(
      path.resolve("src/routes/watch_.$id.$ep.tsx"),
      "utf8",
    );

    assert.ok(watchSrc.includes("/api/source/resolve?id="));
    assert.ok(watchSrc.includes("&refresh=1"));
    assert.ok(customPlayerSrc.includes("hasDirectNonIframeStream"));
    assert.ok(customPlayerSrc.includes("120_000"));
    assert.ok(customPlayerSrc.includes("fonte indisponível"));
    assert.ok(customPlayerSrc.includes("Próxima fonte"));
    assert.ok(customPlayerSrc.includes("seamlessResumeRef"));
  });
});

