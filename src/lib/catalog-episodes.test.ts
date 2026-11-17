import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { getSql } from "./db";
import {
  executeGetPaginatedPublicCatalogEpisodes,
  executeGetPublicCatalogAnimeOptions,
  executeGetPublicCatalogEpisodes,
  parsePublicEpisodeSearchQuery,
} from "./catalog-episodes";

describe("catalog-episodes — Etapa 8A (paginação real no servidor)", () => {
  before(async () => {
    const sql = await getSql();

    // Limpa tabelas de catálogo para um cenário determinístico no PGLite local
    await sql.query(`DELETE FROM "catalog_episode";`);
    await sql.query(`DELETE FROM "catalog_season";`);
    await sql.query(`DELETE FROM "catalog_anime";`);

    // 1. Animes de teste
    await sql.query(
      `INSERT INTO "catalog_anime" (
         "id", "title", "titleRomaji", "titleEnglish", "titleNative", "status", "episodesCount"
       ) VALUES
       ($1, $2, $3, $4, $5, 'RELEASING', 35),
       ($6, $7, $8, $9, $10, 'FINISHED', 24),
       ($11, $12, $13, $14, $15, 'FINISHED', 12),
       ($16, $17, $18, $19, $20, 'FINISHED', 12);`,
      [
        "anime-a",
        "Sousou no Frieren",
        "Sousou no Frieren",
        "Frieren: Beyond Journey's End",
        "葬送のフリーレン",
        "anime-b",
        "Kimetsu no Yaiba",
        "Kimetsu no Yaiba",
        "Demon Slayer",
        "鬼滅の刃",
        "anime-draft-only",
        "Anime Apenas Rascunho",
        "Anime Apenas Rascunho",
        "Draft Only Anime",
        null,
        "anime-blocked-only",
        "Anime Apenas YouTube",
        "Anime Apenas YouTube",
        "YouTube Only Anime",
        null,
      ],
    );

    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position") VALUES
       ('anime-a', 1, 'Temporada 1', 1),
       ('anime-b', 1, 'Temporada 1', 1),
       ('anime-b', 2, 'Arco do Distrito', 2);`,
    );

    const baseTime = Date.UTC(2026, 0, 1, 12, 0, 0);

    // 2. 28 episódios válidos para anime-a (1..28), sendo o ep 12 com vídeo válido apenas no slot videoUrl2
    for (let ep = 1; ep <= 28; ep++) {
      const ts = new Date(baseTime + ep * 60_000).toISOString();
      const videoUrl =
        ep === 12
          ? "https://www.youtube.com/watch?v=blocked12"
          : `https://cdn.hikari.test/anime-a/ep-${ep}.m3u8`;
      const videoUrl2 =
        ep === 12 ? "https://cdn.hikari.test/anime-a/ep-12-alt.m3u8" : null;
      const title =
        ep === 12 ? "A Jornada Continua" : `Capítulo Especial ${ep}`;

      await sql.query(
        `INSERT INTO "catalog_episode" (
           "id", "animeId", "seasonNumber", "number", "title",
           "videoUrl", "videoUrl2", "published", "publishedAt", "createdAt"
         ) VALUES ($1, 'anime-a', 1, $2, $3, $4, $5, true, $6::timestamptz, $6::timestamptz);`,
        [`ep-a-${ep}`, ep, title, videoUrl, videoUrl2, ts],
      );
    }

    // Episódio 120 de anime-a para garantir que busca "12" / "ep 12" não capture ep 120 como número exato
    await sql.query(
      `INSERT INTO "catalog_episode" (
         "id", "animeId", "seasonNumber", "number", "title",
         "videoUrl", "published", "publishedAt", "createdAt"
       ) VALUES ($1, 'anime-a', 1, 120, 'Grande Batalha', 'https://cdn.hikari.test/anime-a/ep-120.m3u8', true, $2::timestamptz, $2::timestamptz);`,
      ["ep-a-120", new Date(baseTime + 29 * 60_000).toISOString()],
    );

    // 3. Mais 3 episódios válidos de anime-b com empate de timestamp para testar ordenação determinística
    // e episódio com publishedAt NULL (NULLS LAST)
    const tieTs = new Date(baseTime + 40 * 60_000).toISOString();
    await sql.query(
      `INSERT INTO "catalog_episode" (
         "id", "animeId", "seasonNumber", "number", "title",
         "videoUrl", "videoUrl5", "published", "publishedAt", "createdAt"
       ) VALUES
       ('ep-b-s2-2', 'anime-b', 2, 2, 'Empate Maior Numero', 'https://cdn.hikari.test/b/s2-2.m3u8', NULL, true, $1::timestamptz, $1::timestamptz),
       ('ep-b-s2-1', 'anime-b', 2, 1, 'Empate Menor Numero', NULL, 'https://cdn.hikari.test/b/s2-1.m3u8', true, $1::timestamptz, $1::timestamptz),
       ('ep-b-null-pub', 'anime-b', 1, 5, 'Sem Data Publicacao', 'https://cdn.hikari.test/b/s1-5.m3u8', NULL, true, NULL, $2::timestamptz);`,
      [tieTs, new Date(baseTime - 60_000).toISOString()],
    );

    // 4. Episódios inválidos / rascunhos que NÃO podem entrar na paginação nem na contagem nem nas opções
    await sql.query(
      `INSERT INTO "catalog_episode" (
         "id", "animeId", "seasonNumber", "number", "title",
         "videoUrl", "videoUrl2", "published", "publishedAt", "createdAt"
       ) VALUES
       ('ep-draft-1', 'anime-draft-only', 1, 1, 'Rascunho', 'https://cdn.hikari.test/draft/1.m3u8', NULL, false, $1::timestamptz, $1::timestamptz),
       ('ep-yt-only', 'anime-blocked-only', 1, 1, 'YouTube Apenas', 'https://youtu.be/xyz123', 'https://sub.crunchyroll.com/watch/1', true, $1::timestamptz, $1::timestamptz),
       ('ep-js-only', 'anime-blocked-only', 1, 2, 'JS Inválido', 'javascript:alert(1)', '#', true, $1::timestamptz, $1::timestamptz),
       ('ep-bad-port', 'anime-blocked-only', 1, 3, 'Porta Inválida', 'https://cdn.hikari.test:70000/bad.m3u8', NULL, true, $1::timestamptz, $1::timestamptz),
       ('ep-bad-ipv6', 'anime-blocked-only', 1, 4, 'IPv6 Malformado', 'https://[:::::]/bad.m3u8', NULL, true, $1::timestamptz, $1::timestamptz),
       ('ep-rel-only', 'anime-blocked-only', 1, 5, 'Relativo', '/api/local/1.m3u8', '', true, $1::timestamptz, $1::timestamptz);`,
      [new Date(baseTime + 50 * 60_000).toISOString()],
    );
  });

  it("1. Retorna página 1 com 24 resultados e totalCount/totalPages consistentes", async () => {
    // Total esperado: 28 (anime-a 1..28) + 1 (ep 120) + 3 (anime-b) = 32 episódios válidos
    const p1 = await executeGetPaginatedPublicCatalogEpisodes({ page: 1 });
    assert.equal(p1.status, "success");
    assert.equal(p1.page, 1);
    assert.equal(p1.pageSize, 24);
    assert.equal(p1.totalCount, 32);
    assert.equal(p1.totalPages, 2);
    assert.equal(p1.episodes.length, 24);
  });

  it("2. Retorna página seguinte sem repetição de itens e com ordenação determinística", async () => {
    const p1 = await executeGetPaginatedPublicCatalogEpisodes({ page: 1 });
    const p2 = await executeGetPaginatedPublicCatalogEpisodes({ page: 2 });

    assert.equal(p2.status, "success");
    assert.equal(p2.page, 2);
    assert.equal(p2.totalCount, 32);
    assert.equal(p2.totalPages, 2);
    assert.equal(p2.episodes.length, 8);

    const p1Ids = new Set(p1.episodes.map((e) => e.id));
    for (const ep of p2.episodes) {
      assert.equal(p1Ids.has(ep.id), false, `Item duplicado entre páginas: ${ep.id}`);
    }

    // Ordenação: empate no topo resolve por seasonNumber/number DESC (ep-b-s2-2 antes de ep-b-s2-1)
    assert.equal(p1.episodes[0].id, "ep-b-s2-2");
    assert.equal(p1.episodes[1].id, "ep-b-s2-1");
    assert.equal(p1.episodes[2].id, "ep-a-120");
    // publishedAt NULL deve ir por último (NULLS LAST)
    assert.equal(p2.episodes[p2.episodes.length - 1].id, "ep-b-null-pub");
  });

  it("3. Filtra por animeId mantendo contagem e paginação consistentes", async () => {
    const res = await executeGetPaginatedPublicCatalogEpisodes({
      animeId: "anime-b",
      page: 1,
      pageSize: 24,
    });
    assert.equal(res.status, "success");
    assert.equal(res.totalCount, 3);
    assert.equal(res.totalPages, 1);
    assert.deepEqual(
      res.episodes.map((e) => e.id),
      ["ep-b-s2-2", "ep-b-s2-1", "ep-b-null-pub"],
    );
  });

  it("4. Busca por título do anime, variantes (inglês/nativo) e título do episódio", async () => {
    // Variante em inglês de anime-b ("Demon Slayer")
    const byEnglish = await executeGetPaginatedPublicCatalogEpisodes({
      q: "Demon Slayer",
    });
    assert.equal(byEnglish.status, "success");
    assert.equal(byEnglish.totalCount, 3);
    assert.ok(byEnglish.episodes.every((e) => e.animeId === "anime-b"));

    // Variante em inglês de anime-a ("Beyond Journey")
    const byFrierenEng = await executeGetPaginatedPublicCatalogEpisodes({
      q: "Beyond Journey",
      pageSize: 50,
    });
    assert.equal(byFrierenEng.totalCount, 29);

    // Variante nativa
    const byNative = await executeGetPaginatedPublicCatalogEpisodes({
      q: "鬼滅の刃",
    });
    assert.equal(byNative.totalCount, 3);

    // Título específico do episódio
    const byEpTitle = await executeGetPaginatedPublicCatalogEpisodes({
      q: "Jornada Continua",
    });
    assert.equal(byEpTitle.totalCount, 1);
    assert.equal(byEpTitle.episodes[0].id, "ep-a-12");
  });

  it("5. Busca por número exato ('12', 'ep 12', 'episodio 12', 'episódio 12')", async () => {
    assert.deepEqual(parsePublicEpisodeSearchQuery("  episódio 12  "), {
      hasQuery: true,
      likePattern: "%episódio 12%",
      exactEpisodeNumber: 12,
    });

    for (const term of ["12", "ep 12", "episodio 12", "episódio 12"]) {
      const res = await executeGetPaginatedPublicCatalogEpisodes({ q: term });
      assert.equal(res.status, "success");
      assert.equal(
        res.totalCount,
        1,
        `Termo '${term}' deveria casar exatamente o episódio 12 (e não 120)`,
      );
      assert.equal(res.episodes[0].id, "ep-a-12");
      // Confirma preservação do slot secundário videoUrl2 quando videoUrl é YouTube
      assert.equal(
        res.episodes[0].videoUrl2,
        "https://cdn.hikari.test/anime-a/ep-12-alt.m3u8",
      );
    }
  });

  it("6. Busca vazia/espaços usa listagem normal e escapa caracteres curinga com segurança", async () => {
    const emptySearch = await executeGetPaginatedPublicCatalogEpisodes({
      q: "   ",
    });
    assert.equal(emptySearch.totalCount, 32);

    // '%' literal não deve funcionar como wildcard global
    const wildcardSearch = await executeGetPaginatedPublicCatalogEpisodes({
      q: "%",
    });
    assert.equal(wildcardSearch.status, "empty");
    assert.equal(wildcardSearch.totalCount, 0);
    assert.equal(wildcardSearch.totalPages, 0);
    assert.deepEqual(wildcardSearch.episodes, []);
  });

  it("7. Trata página fora do intervalo, sem resultados e protege page/pageSize inválidos ou excessivos", async () => {
    const outOfRange = await executeGetPaginatedPublicCatalogEpisodes({
      page: 99,
      pageSize: 24,
    });
    assert.equal(outOfRange.status, "empty");
    assert.equal(outOfRange.episodes.length, 0);
    assert.equal(outOfRange.totalCount, 32);
    assert.equal(outOfRange.totalPages, 2);
    assert.equal(outOfRange.page, 99);

    const noResults = await executeGetPaginatedPublicCatalogEpisodes({
      animeId: "nao-existe",
    });
    assert.equal(noResults.status, "empty");
    assert.equal(noResults.totalCount, 0);
    assert.equal(noResults.totalPages, 0);

    // Proteção de limites inválidos e teto máximo de 100
    const clamped = await executeGetPaginatedPublicCatalogEpisodes({
      page: -3,
      pageSize: 999,
    });
    assert.equal(clamped.page, 1);
    assert.equal(clamped.pageSize, 100);
    assert.equal(clamped.episodes.length, 32);

    const defaultFallback = await executeGetPaginatedPublicCatalogEpisodes({
      page: Number.NaN,
      pageSize: 0,
    });
    assert.equal(defaultFallback.page, 1);
    assert.equal(defaultFallback.pageSize, 24);
    assert.equal(defaultFallback.episodes.length, 24);
  });

  it("8. Consulta leve de opções de animes retorna apenas animes com episódios publicados e reproduzíveis", async () => {
    const options = await executeGetPublicCatalogAnimeOptions();
    assert.deepEqual(options, [
      { id: "anime-b", title: "Kimetsu no Yaiba" },
      { id: "anime-a", title: "Sousou no Frieren" },
    ]);
  });

  it("9. Função legada executeGetPublicCatalogEpisodes() mantém formato e comportamento inalterados", async () => {
    const legacy = await executeGetPublicCatalogEpisodes();
    assert.equal(legacy.status, "success");
    assert.equal(typeof legacy.total, "number");
    assert.equal(legacy.total, legacy.episodes.length);
    assert.equal("totalCount" in legacy, false);
    assert.equal("totalPages" in legacy, false);
    assert.ok(legacy.episodes.length >= 32);
  });

  it("10. Auditoria corretiva: URLs aceitas/rejeitadas, slots secundários, consistência e recomposição sem duplicações", async () => {
    const { isHikariPlayableUrl } = await import("./published-episodes");

    // A. URL aceita pelo SQL e também pelo isHikariPlayableUrl()
    const validUrl = "https://cdn.hikari.test/stream.m3u8";
    assert.equal(isHikariPlayableUrl(validUrl), true);

    // B. URL aceita pelo SQL mas rejeitada por isHikariPlayableUrl() / esquema inválido
    const invalidSchemeUrl = "ftp://cdn.hikari.test/stream.m3u8";
    assert.equal(isHikariPlayableUrl(invalidSchemeUrl), false);

    // C. URL inválida no primeiro slot mas válida em slot secundário (ex: ep 12 do anime-a)
    const p1 = await executeGetPaginatedPublicCatalogEpisodes({
      animeId: "anime-a",
      page: 1,
      pageSize: 50,
    });
    const ep12 = p1.episodes.find((e) => e.number === 12);
    assert.ok(ep12);
    assert.equal(isHikariPlayableUrl(ep12.videoUrl), false); // YouTube block
    assert.equal(isHikariPlayableUrl(ep12.videoUrl2), true); // Alt valid stream

    // D. Consistência de totalCount e totalPages sem duplicações ou omissões
    assert.equal(p1.status, "success");
    assert.equal(p1.pageSize, 50);
    assert.ok(p1.totalCount > 0);
    assert.equal(p1.totalPages, Math.ceil(p1.totalCount / 50));

    const p2 = await executeGetPaginatedPublicCatalogEpisodes({
      animeId: "anime-a",
      page: 2,
      pageSize: 50,
    });
    const p1Ids = new Set(p1.episodes.map((e) => e.id));
    for (const ep of p2.episodes) {
      assert.equal(p1Ids.has(ep.id), false, `Omissão/duplicação detectada: ${ep.id}`);
    }
  });
});
