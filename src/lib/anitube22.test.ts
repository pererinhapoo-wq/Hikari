import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ANITUBE22_PROVIDER,
  buildAnitube22PlayerUrl,
  extractAnitube22ExternalId,
  extractAnitube22Lang,
  formatDurableAnitube22Ref,
  isAnitube22PlayerUrl,
  isAnitube22SourceInput,
  partitionEpisodeSourcesByLang,
  sortEpisodeSourcesByPriority,
  stripTimeQueryParam,
  type EpisodeSourceItem,
} from "./anitube22";
import {
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
  syncCatalogEpisodeSlotsToSources,
  upsertEpisodeSource,
} from "./sources";

describe("anitube22 durable identifiers & runtime URL builder", () => {
  it("monta a URL exata do player em runtime mantendo pais=pais=BR literal", () => {
    const url1 = buildAnitube22PlayerUrl("589535", 1710000100);
    const url2 = buildAnitube22PlayerUrl("589535", 1710000200);

    assert.equal(
      url1,
      "https://www.anitube22.vip/playerricas.php?name=apphd/589535.mp4&img=https://www.hinatasoul.com/media/videos/tmb/589535/default.jpg&pais=pais=BR&time=1710000100&url=https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/ziphonec/589535.mp4",
    );
    assert.ok(url1.includes("&pais=pais=BR&"));
    assert.notEqual(url1, url2);
    assert.ok(url2.includes("&time=1710000200&"));
    assert.equal(isAnitube22PlayerUrl(url1), true);
  });

  it("nunca preserva time= ao sanitizar URLs assinadas, IDs numéricos ou referências duráveis", () => {
    const signedUrl =
      "https://www.anitube22.vip/playerricas.php?name=apphd/589535.mp4&img=https://www.hinatasoul.com/media/videos/tmb/589535/default.jpg&pais=pais=BR&time=1770000000&url=https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/ziphonec/589535.mp4";

    const sanitizedFromSigned = sanitizePlayableVideoUrl(signedUrl);
    const sanitizedFromId = sanitizePlayableVideoUrl("589535");
    const sanitizedFromDub = sanitizePlayableVideoUrl("anitube22://dub/589535");

    assert.equal(sanitizedFromSigned, "anitube22://sub/589535");
    assert.equal(sanitizedFromId, "anitube22://sub/589535");
    assert.equal(sanitizedFromDub, "anitube22://dub/589535");
    assert.equal(sanitizedFromSigned?.includes("time="), false);

    assert.equal(extractAnitube22ExternalId(signedUrl), "589535");
    assert.equal(extractAnitube22Lang("anitube22://dub/589535"), "dub");
    assert.equal(isAnitube22SourceInput("589535"), true);
    assert.equal(isHikariPlayableUrl("589535"), true);
    assert.equal(isWatchPlayableMediaUrl("anitube22://sub/589535"), true);
    assert.equal(isPersistablePlayableVideoUrl(signedUrl), true);
    assert.equal(hasEpisodePlayableSource({ videoUrl: "589535" }), true);

    assert.equal(
      stripTimeQueryParam("https://cdn.example.com/video.mp4?time=12345&hd=1"),
      "https://cdn.example.com/video.mp4?hd=1",
    );
    assert.equal(
      stripTimeQueryParam("https://cdn.example.com/video.mp4?time=12345"),
      "https://cdn.example.com/video.mp4",
    );

    const runtimeFromResolve = resolvePlayableStreamUrl("anitube22://sub/589535");
    assert.ok(runtimeFromResolve?.startsWith("https://www.anitube22.vip/playerricas.php?"));
    assert.ok(runtimeFromResolve?.includes("apphd/589535.mp4"));

    const resolvedList = resolveEpisodePlayerSources({
      videoUrl: formatDurableAnitube22Ref("589535", "sub"),
    });
    assert.equal(resolvedList.length, 1);
    assert.ok(resolvedList[0].url.includes("pais=pais=BR"));
  });

  it("ordena por prioridade crescente e mantém sub e dub independentes", () => {
    const items: EpisodeSourceItem[] = [
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
      },
      {
        id: "d2",
        episodeId: "ep-1",
        provider: ANITUBE22_PROVIDER,
        externalId: "900002",
        lang: "dub",
        quality: "1080p",
        priority: 3,
        status: "active",
        failCount: 0,
        lastCheckedAt: null,
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
      },
    ];

    const partitioned = partitionEpisodeSourcesByLang(items);
    assert.deepEqual(
      partitioned.sub.map((s) => s.externalId),
      ["200001", "300001"],
    );
    assert.deepEqual(
      partitioned.dub.map((s) => s.externalId),
      ["900001", "900002"],
    );
    assert.equal(sortEpisodeSourcesByPriority(items, "sub")[0]?.priority, 1);
  });
});

describe("episode_sources database persistence & health rules", () => {
  it("grava schema durável sem time=, faz fallback na 1a falha, marca broken só na 2a falha consecutiva e ignora erro de rede do cliente", async () => {
    const sql = await getSql();
    const animeId = `test-anime-${Date.now()}`;
    const episodeId = `test-ep-${Date.now()}`;

    try {
      await sql.query(
        `INSERT INTO "catalog_anime" ("id", "title", "createdAt", "updatedAt")
         VALUES ($1, 'Teste Anime', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [animeId],
      );
      await sql.query(
        `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "createdAt", "updatedAt")
         VALUES ($1, $2, 1, 1, 'Episódio 1', $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [episodeId, animeId, sanitizePlayableVideoUrl("589535")],
      );

      // 1. Verifica colunas da tabela episode_sources
      const colRows = await sql.query<{ column_name: string }>(
        `SELECT "column_name"
         FROM "information_schema"."columns"
         WHERE "table_name" = 'episode_sources';`,
      );
      const colSet = new Set(colRows.map((c) => c.column_name));
      for (const expectedCol of [
        "episode_id",
        "provider",
        "external_id",
        "lang",
        "quality",
        "priority",
        "status",
        "fail_count",
        "last_checked_at",
      ]) {
        assert.ok(colSet.has(expectedCol), `Coluna ausente: ${expectedCol}`);
      }

      // 2. Insere fonte 1 (priority 0, sub), fonte 2 (priority 1, sub), fonte dub (priority 0, dub)
      const src1 = await upsertEpisodeSource({
        episodeId,
        provider: ANITUBE22_PROVIDER,
        externalId: "https://www.anitube22.vip/playerricas.php?name=apphd/589535.mp4&pais=pais=BR&time=1710000000&url=https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/ziphonec/589535.mp4",
        lang: "sub",
        quality: "1080p",
        priority: 0,
      });
      const src2 = await upsertEpisodeSource({
        episodeId,
        provider: ANITUBE22_PROVIDER,
        externalId: "589536",
        lang: "sub",
        quality: "720p",
        priority: 1,
      });
      const srcDub = await upsertEpisodeSource({
        episodeId,
        provider: ANITUBE22_PROVIDER,
        externalId: "789001",
        lang: "dub",
        quality: "1080p",
        priority: 0,
      });

      assert.ok(src1 && src2 && srcDub);
      assert.equal(src1.externalId, "589535");
      assert.equal(src1.lang, "sub");
      assert.equal(src1.priority, 0);
      assert.equal(srcDub.lang, "dub");

      // Verifica nenhuma linha com time= no banco
      const timeLeakSources = await sql.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM "episode_sources"
         WHERE COALESCE("page_url", '') ILIKE '%time=%'
            OR COALESCE("direct_url", '') ILIKE '%time=%'
            OR COALESCE("external_id", '') ILIKE '%time=%';`,
      );
      assert.equal(timeLeakSources[0]?.count, 0);

      const timeLeakEpisodes = await sql.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM "catalog_episode"
         WHERE COALESCE("videoUrl", '') ILIKE '%time=%'
            OR COALESCE("videoUrl2", '') ILIKE '%time=%'
            OR COALESCE("videoUrl3", '') ILIKE '%time=%'
            OR COALESCE("videoUrl4", '') ILIKE '%time=%'
            OR COALESCE("videoUrl5", '') ILIKE '%time=%';`,
      );
      assert.equal(timeLeakEpisodes[0]?.count, 0);

      // resolveEpisode nunca usa /api/hls para anitube22
      const resolved = await resolveEpisode(episodeId);
      assert.equal(resolved.directUrl, null);
      assert.equal(resolved.provider, ANITUBE22_PROVIDER);
      assert.ok(resolved.iframeUrl?.includes("apphd/589535.mp4"));
      assert.equal(resolved.iframeUrl?.includes("/api/hls"), false);

      // 3. Erro de rede do cliente NÃO incrementa fail_count nem marca broken
      const offlineCheck = await checkAndRecordEpisodeSource(src1.id, {
        clientOffline: true,
      });
      assert.equal(offlineCheck.clientNetworkError, true);
      assert.equal(offlineCheck.status, "active");

      const networkThrowCheck = await checkAndRecordEpisodeSource(src1.id, {
        fetchImpl: async () => {
          throw new TypeError("fetch failed");
        },
      });
      assert.equal(networkThrowCheck.clientNetworkError, true);

      const afterNetErr = await listEpisodeSources(episodeId);
      assert.equal(afterNetErr.find((s) => s.id === src1.id)?.failCount, 0);
      assert.equal(afterNetErr.find((s) => s.id === src1.id)?.status, "active");

      // 4. 1a falha 5xx do índice -> fail_count = 1, ainda active
      const firstFail = await checkAndRecordEpisodeSource(src1.id, {
        fetchImpl: async () => new Response("error", { status: 502 }),
      });
      assert.equal(firstFail.ok, false);
      assert.equal(firstFail.httpStatus, 502);
      assert.equal(firstFail.failCount, 1);
      assert.equal(firstFail.status, "active");

      // 5. Recuperação 200 antes da 2a falha zera fail_count
      const recovered = await checkAndRecordEpisodeSource(src1.id, {
        fetchImpl: async () => new Response("ok", { status: 200 }),
      });
      assert.equal(recovered.ok, true);
      assert.equal(recovered.failCount, 0);
      assert.equal(recovered.status, "active");

      // 6. Duas falhas consecutivas 4xx/5xx -> status = 'broken'
      const failA = await recordEpisodeSourceIndexResult({
        sourceId: src1.id,
        httpStatus: 404,
      });
      assert.equal(failA.failCount, 1);
      assert.equal(failA.status, "active");

      const failB = await recordEpisodeSourceIndexResult({
        sourceId: src1.id,
        httpStatus: 500,
      });
      assert.equal(failB.failCount, 2);
      assert.equal(failB.status, "broken");

      // Ao listar apenas ativas, fonte 2 (589536) assume como primeira sub
      const activeOnly = await listEpisodeSources(episodeId);
      const { sub, dub } = partitionEpisodeSourcesByLang(activeOnly);
      assert.deepEqual(sub.map((s) => s.externalId), ["589536"]);
      assert.deepEqual(dub.map((s) => s.externalId), ["789001"]);

      // Sincronização de slots reativa / cria sem time=
      const synced = await syncCatalogEpisodeSlotsToSources(
        episodeId,
        [{ url: "anitube22://sub/589540", priority: 0 }],
        { replaceAnitube22: false },
      );
      assert.equal(synced.length, 1);
      assert.equal(synced[0].externalId, "589540");
    } finally {
      await deleteEpisodeSourcesForEpisode(episodeId);
      await sql.query(`DELETE FROM "catalog_episode" WHERE "id" = $1;`, [episodeId]);
      await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [animeId]);
    }
  });

  it("preserva atributos do iframe, botão Recarregar fonte, sem proxy/wsrv.nl no vídeo e fallback placeholder-cover intacto", () => {
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

    assert.ok(customPlayerSrc.includes('referrerPolicy="no-referrer-when-downgrade"'));
    assert.ok(customPlayerSrc.includes('allow="autoplay; fullscreen; picture-in-picture"'));
    assert.ok(customPlayerSrc.includes("allowFullScreen"));
    assert.ok(customPlayerSrc.includes("Recarregar fonte"));

    assert.ok(simplePlayerSrc.includes('referrerPolicy="no-referrer-when-downgrade"'));
    assert.ok(simplePlayerSrc.includes('allow="autoplay; fullscreen; picture-in-picture"'));
    assert.ok(simplePlayerSrc.includes("allowFullScreen"));
    assert.ok(simplePlayerSrc.includes("Recarregar fonte"));

    assert.ok(imageUtilsSrc.includes("/assets/placeholder-cover.webp"));
  });
});
