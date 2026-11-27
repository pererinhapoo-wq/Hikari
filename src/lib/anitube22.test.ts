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
  isAnitube22PlayerUrl,
  isLegacyAnitube22Ref,
  parseAnitube22PlayerUrl,
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
  checkAndRecordEpisodeSource,
  deleteEpisodeSourcesForEpisode,
  listEpisodeSources,
  recordEpisodeSourceIndexResult,
  resolveEpisode,
  SourceValidationError,
  syncCatalogEpisodeSlotsToSources,
  upsertEpisodeSource,
} from "./sources";

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

    assert.ok(customPlayerSrc.includes("referrerPolicy") || customPlayerSrc.includes("allowFullScreen"));
    assert.ok(customPlayerSrc.includes("autoplay") || customPlayerSrc.includes("fullscreen"));
    assert.ok(customPlayerSrc.includes("allowFullScreen"));
    assert.ok(customPlayerSrc.includes("Tentar Novamente") || customPlayerSrc.includes("Recarregar"));
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
