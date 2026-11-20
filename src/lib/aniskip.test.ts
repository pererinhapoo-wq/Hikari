import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ANISKIP_NEGATIVE_CACHE_TTL_SEC,
  ANISKIP_POSITIVE_CACHE_TTL_SEC,
  applyAniSkipRelationRules,
  buildAniSkipSkipTimesUrl,
  fetchAniSkipRelationRules,
  fetchAniSkipTimestamps,
  formatSecondsToTime,
  parseTimeToSeconds,
  type RedisLike,
} from "./aniskip.ts";
import {
  EXTERNAL_IDS_POSITIVE_CACHE_TTL_SEC,
  resolveExternalAnimeIds,
  resolveExternalSeasonNumber,
} from "./opening-external-ids.ts";
import {
  fetchIntroDbOpening,
  fetchOpeningSuggestionsCascade,
  fetchTheIntroDbOpening,
  millisecondsToSeconds,
  PROVIDER_NEGATIVE_CACHE_TTL_SEC,
  PROVIDER_POSITIVE_CACHE_TTL_SEC,
} from "./opening-providers.ts";
import {
  applyOpeningSuggestionToAnime,
  discardOpeningSuggestion,
  getOpeningSuggestionKey,
  mergeLoadedOpeningSuggestions,
  parseReliableEpisodeDurationSeconds,
  reconcileDirtyEpisodeIdsAfterFormPopulation,
  type OpeningSuggestionEntry,
} from "./opening-admin-state.ts";
import type { LocalAnime } from "./types.ts";

class MockRedis implements RedisLike {
  store = new Map<string, { value: string; ex?: number }>();
  getCalls = 0;
  setCalls = 0;

  async get<T = unknown>(key: string): Promise<T | null> {
    this.getCalls += 1;
    const entry = this.store.get(key);
    return entry ? (entry.value as unknown as T) : null;
  }

  async set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown> {
    this.setCalls += 1;
    this.store.set(key, {
      value: typeof value === "string" ? value : JSON.stringify(value),
      ex: options?.ex,
    });
    return "OK";
  }
}

function mockJsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function makeSampleAnime(): LocalAnime {
  return {
    id: "anime-bc-test",
    malId: 34572,
    anilistId: 97940,
    titleRomaji: "Black Clover",
    titleEnglish: "Black Clover",
    titleNative: "ブラッククローバー",
    cover: "",
    banner: "",
    synopsis: "",
    score: 8.1,
    genres: ["Action"],
    format: "TV",
    status: "FINISHED",
    episodesCount: 170,
    season: "FALL",
    year: 2017,
    trailerId: null,
    hidden: false,
    seasons: [
      {
        id: "season-1",
        number: 1,
        title: "Temporada 1",
        episodes: [
          {
            id: "ep-1",
            number: 1,
            title: "Episódio 1",
            openingStartSeconds: 181,
            openingEndSeconds: 271,
          },
          {
            id: "ep-2",
            number: 2,
            title: "Episódio 2",
            openingStartSeconds: null,
            openingEndSeconds: null,
          },
        ],
      },
    ],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("Opening Timestamps — AniSkip, TheIntroDB, IntroDB, ID Mapping & Admin Approval", () => {
  test("0. Utilitários de conversão de tempo e duração confiável", () => {
    assert.equal(formatSecondsToTime(2), "00:02");
    assert.equal(formatSecondsToTime(180), "03:00");
    assert.equal(formatSecondsToTime(3665), "61:05");
    assert.equal(formatSecondsToTime(null), "");
    assert.equal(parseTimeToSeconds("00:02"), 2);
    assert.equal(parseTimeToSeconds("03:00"), 180);
    assert.equal(parseTimeToSeconds("   "), null);
    assert.equal(parseTimeToSeconds("abc"), null);
    assert.equal(parseReliableEpisodeDurationSeconds("23:54"), 1434);
    assert.equal(parseReliableEpisodeDurationSeconds("00:23:54"), 1434);
    assert.equal(parseReliableEpisodeDurationSeconds("1434s"), 1434);
    assert.equal(parseReliableEpisodeDurationSeconds("24 min"), 0);
    assert.equal(parseReliableEpisodeDurationSeconds(null), 0);
  });

  test("1. Consulta AniSkip envia types=op e types=mixed-op (OpenAPI 3.0) e prioriza op sobre mixed-op", async () => {
    const requestedUrls: string[] = [];
    const fetchMock: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      return mockJsonResponse({
        found: true,
        results: [
          {
            skipType: "mixed-op",
            interval: { startTime: 210, endTime: 300 },
            episodeLength: 1434,
          },
          {
            skipType: "op",
            interval: { startTime: 207.434, endTime: 297.434 },
            episodeLength: 1433.891,
          },
        ],
      });
    };

    const res = await fetchAniSkipTimestamps(34572, 2, {
      fetchFn: fetchMock,
      redis: null,
    });

    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /types=op/);
    assert.match(requestedUrls[0], /types=mixed-op/);
    assert.equal(res.found, true);
    assert.equal(res.skipType, "op");
    assert.equal(res.openingStartSeconds, 207);
    assert.equal(res.openingEndSeconds, 297);

    // Quando só há mixed-op, também deve aceitar
    const mixedOnlyRes = await fetchAniSkipTimestamps(34572, 3, {
      redis: null,
      fetchFn: async () =>
        mockJsonResponse({
          found: true,
          results: [
            {
              skipType: "mixed-op",
              interval: { startTime: 100, endTime: 190 },
              episodeLength: 1430,
            },
          ],
        }),
    });
    assert.equal(mixedOnlyRes.found, true);
    assert.equal(mixedOnlyRes.skipType, "mixed-op");
    assert.equal(mixedOnlyRes.openingStartSeconds, 100);
    assert.equal(mixedOnlyRes.openingEndSeconds, 190);
  });

  test("2. Envio correto de episodeLength, inclusive zero", async () => {
    assert.equal(
      buildAniSkipSkipTimesUrl(34572, 1),
      "https://api.aniskip.com/v2/skip-times/34572/1?types=op&types=mixed-op&episodeLength=0",
    );
    assert.equal(
      buildAniSkipSkipTimesUrl(34572, 1, 0),
      "https://api.aniskip.com/v2/skip-times/34572/1?types=op&types=mixed-op&episodeLength=0",
    );
    assert.equal(
      buildAniSkipSkipTimesUrl(34572, 1, 1434.2),
      "https://api.aniskip.com/v2/skip-times/34572/1?types=op&types=mixed-op&episodeLength=1434",
    );

    const urls: string[] = [];
    await fetchAniSkipTimestamps(34572, 2, {
      episodeLength: 1434,
      redis: null,
      fetchFn: async (input) => {
        urls.push(String(input));
        return mockJsonResponse({ found: false }, 404);
      },
    });
    assert.match(urls[0], /episodeLength=1434/);
  });

  test("3. Cache positivo (7d) e negativo (24h) no Redis sem chamadas repetidas", async () => {
    const redis = new MockRedis();
    let apiCalls = 0;

    const fetchPos: typeof fetch = async () => {
      apiCalls += 1;
      return mockJsonResponse({
        found: true,
        results: [
          {
            skipType: "op",
            interval: { startTime: 207, endTime: 296 },
            episodeLength: 1434,
          },
        ],
      });
    };

    const first = await fetchAniSkipTimestamps(34572, 2, { fetchFn: fetchPos, redis });
    assert.equal(first.found, true);
    assert.equal(apiCalls, 1);

    const second = await fetchAniSkipTimestamps(34572, 2, { fetchFn: fetchPos, redis });
    assert.equal(second.found, true);
    assert.equal(second.fromCache, true);
    assert.equal(apiCalls, 1);

    const posEntry = Array.from(redis.store.values())[0];
    assert.equal(posEntry?.ex, ANISKIP_POSITIVE_CACHE_TTL_SEC);

    // Cache negativo para 404 (TTL 24h)
    let negCalls = 0;
    const fetchNeg: typeof fetch = async () => {
      negCalls += 1;
      return mockJsonResponse({ found: false }, 404);
    };

    const neg1 = await fetchAniSkipTimestamps(34572, 99, { fetchFn: fetchNeg, redis });
    assert.equal(neg1.found, false);
    assert.equal(neg1.status, "not_found");
    assert.equal(negCalls, 1);

    const neg2 = await fetchAniSkipTimestamps(34572, 99, { fetchFn: fetchNeg, redis });
    assert.equal(neg2.found, false);
    assert.equal(neg2.fromCache, true);
    assert.equal(negCalls, 1);

    const negEntry = redis.store.get("hikari:aniskip:v4:34572:99:len0:op-mixed");
    assert.equal(negEntry?.ex, ANISKIP_NEGATIVE_CACHE_TTL_SEC);
  });

  test("4 e 5. Aplicação de relation-rules e remapeamento correto de episódios", async () => {
    const rules = [
      { from: { start: 171 }, to: { malId: 61967, start: 1 } },
      { from: { start: 13, end: 24 }, to: { malId: 99999, start: 1, end: 12 } },
    ];

    const ep170 = applyAniSkipRelationRules(34572, 170, rules);
    assert.deepEqual(ep170, { malId: 34572, episodeNumber: 170, remapped: false });

    const ep171 = applyAniSkipRelationRules(34572, 171, rules);
    assert.deepEqual(ep171, { malId: 61967, episodeNumber: 1, remapped: true });

    const ep175 = applyAniSkipRelationRules(34572, 175, rules);
    assert.deepEqual(ep175, { malId: 61967, episodeNumber: 5, remapped: true });

    const ep25 = applyAniSkipRelationRules(34572, 25, rules);
    assert.deepEqual(ep25, { malId: 34572, episodeNumber: 25, remapped: false });

    const calledUrls: string[] = [];
    const fetchMock: typeof fetch = async (input) => {
      const url = String(input);
      calledUrls.push(url);
      if (url.includes("/relation-rules/34572")) {
        return mockJsonResponse({ found: true, rules });
      }
      if (url.includes("/skip-times/61967/1?")) {
        return mockJsonResponse({
          found: true,
          results: [{ skipType: "op", interval: { startTime: 90, endTime: 180 }, episodeLength: 1440 }],
        });
      }
      return mockJsonResponse({}, 404);
    };

    const rulesRes = await fetchAniSkipRelationRules(34572, { fetchFn: fetchMock, redis: null });
    assert.equal(rulesRes.found, true);

    const mappedRes = await fetchAniSkipTimestamps(34572, 171, {
      relationRules: rulesRes.rules,
      fetchFn: fetchMock,
      redis: null,
    });
    assert.equal(mappedRes.found, true);
    assert.equal(mappedRes.resolvedMalId, 61967);
    assert.equal(mappedRes.resolvedEpisodeNumber, 1);
    assert.equal(mappedRes.remapped, true);
    assert.ok(calledUrls.some((u) => u.includes("/v2/skip-times/61967/1?")));
  });

  test("5b. Evita associar AniSkip de T1 a episódios reiniciados de T2 sem relation-rules", async () => {
    const calledUrls: string[] = [];
    const redis = new MockRedis();

    const res = await fetchOpeningSuggestionsCascade(
      { malId: 34572, anilistId: 97940 },
      [{ seasonNumber: 2, episodeNumber: 1 }],
      {
        redis,
        previousSeasonMaxEpisodes: { 1: 0, 2: 12 },
        fetchFn: async (input) => {
          const url = String(input);
          calledUrls.push(url);
          if (url.includes("relations.yuna.moe")) {
            return mockJsonResponse({
              myanimelist: 34572,
              anilist: 97940,
              thetvdb: 331753,
              "thetvdb-season": 1,
              imdb: "tt7441658",
            });
          }
          if (url.includes("api.theintrodb.org/v4/media") && url.includes("season=2&episode=1")) {
            return mockJsonResponse({
              tvdb_id: 331753,
              season: 2,
              episode: 1,
              intro: [{ start_ms: 100000, end_ms: 190000 }],
            });
          }
          return mockJsonResponse({}, 404);
        },
      },
    );

    assert.equal(res.suggestions[0]?.found, true);
    assert.equal(res.suggestions[0]?.source, "theintrodb");
    // Nunca deve consultar skip-times/34572/1 para a Temporada 2 Ep 1
    assert.equal(
      calledUrls.some((u) => u.includes("/v2/skip-times/34572/1")),
      false,
    );
  });

  test("6. Tratamento de 404, 429 e timeout sem gravar falhas temporárias no cache negativo", async () => {
    const redis = new MockRedis();

    // 429 após retries -> rate_limited e NÃO vai para o cache
    let rateCalls = 0;
    const res429 = await fetchAniSkipTimestamps(34572, 10, {
      redis,
      maxRetries: 1,
      retryDelayMs: 0,
      fetchFn: async () => {
        rateCalls += 1;
        return mockJsonResponse({ message: "Too Many Requests" }, 429);
      },
    });
    assert.equal(rateCalls, 2);
    assert.equal(res429.found, false);
    assert.equal(res429.status, "rate_limited");
    assert.equal(redis.store.size, 0);

    // Timeout / AbortError -> status timeout e NÃO vai para o cache
    const resTimeout = await fetchAniSkipTimestamps(34572, 11, {
      redis,
      fetchFn: async () => {
        const err = new Error("Aborted");
        err.name = "AbortError";
        throw err;
      },
    });
    assert.equal(resTimeout.found, false);
    assert.equal(resTimeout.status, "timeout");
    assert.equal(redis.store.size, 0);

    // Em cascata, timeout na AniSkip sem resultado nas seguintes NÃO vira not_found nem é cacheado
    const cascadeTimeout = await fetchOpeningSuggestionsCascade(
      { malId: 34572 },
      [{ seasonNumber: 1, episodeNumber: 11 }],
      {
        redis,
        fetchFn: async (input) => {
          const url = String(input);
          if (url.includes("api.aniskip.com/v2/skip-times")) {
            const err = new Error("Timeout");
            err.name = "AbortError";
            throw err;
          }
          return mockJsonResponse({}, 404);
        },
      },
    );
    assert.equal(cascadeTimeout.suggestions[0]?.found, false);
    assert.equal(cascadeTimeout.suggestions[0]?.status, "timeout");
    assert.equal(
      redis.store.has("hikari:opening:cascade:v2:mal:34572:s1:e11:len0"),
      false,
    );
  });

  test("7 e 8. TheIntroDB: consultado só quando AniSkip falha/miss e converte ms -> seg rejeitando incompletos", async () => {
    assert.equal(millisecondsToSeconds(202993), 203);
    assert.equal(millisecondsToSeconds(293041), 293);
    assert.equal(millisecondsToSeconds(null), null);

    // Início ausente (caso real do Ep 1 Black Clover no TheIntroDB) NÃO pode ser aceito
    const partialTidb = await fetchTheIntroDbOpening(
      { tvdbId: 331753, seasonNumber: 1, episodeNumber: 1 },
      {
        redis: null,
        fetchFn: async () =>
          mockJsonResponse({
            tvdb_id: 331753,
            season: 1,
            episode: 1,
            intro: [{ start_ms: null, end_ms: 96268 }],
          }),
      },
    );
    assert.equal(partialTidb.found, false);
    assert.equal(partialTidb.startSeconds, null);
    assert.equal(partialTidb.endSeconds, null);

    // Cascata: quando AniSkip encontra, TheIntroDB NÃO deve ser consultado
    const calledUrlsHitAniSkip: string[] = [];
    const hitAniSkip = await fetchOpeningSuggestionsCascade(
      { malId: 34572, anilistId: 97940 },
      [{ seasonNumber: 1, episodeNumber: 2 }],
      {
        redis: null,
        fetchFn: async (input) => {
          const url = String(input);
          calledUrlsHitAniSkip.push(url);
          if (url.includes("relations.yuna.moe")) {
            return mockJsonResponse({ myanimelist: 34572, thetvdb: 331753, "thetvdb-season": 1, imdb: "tt7441658" });
          }
          if (url.includes("/relation-rules/")) return mockJsonResponse({ found: false, rules: [] });
          if (url.includes("api.aniskip.com/v2/skip-times")) {
            return mockJsonResponse({
              found: true,
              results: [{ skipType: "op", interval: { startTime: 207.4, endTime: 297.4 }, episodeLength: 1434 }],
            });
          }
          throw new Error(`Fonte inesperada chamada: ${url}`);
        },
      },
    );
    assert.equal(hitAniSkip.suggestions[0]?.found, true);
    assert.equal(hitAniSkip.suggestions[0]?.source, "aniskip");
    assert.equal(
      calledUrlsHitAniSkip.some((u) => u.includes("theintrodb.org") || u.includes("introdb.app")),
      false,
    );

    // Cascata: quando AniSkip retorna 404, TheIntroDB é consultado e converte ms -> seg
    const calledUrlsFallback: string[] = [];
    const hitTidb = await fetchOpeningSuggestionsCascade(
      { malId: 34572 },
      [{ seasonNumber: 1, episodeNumber: 2 }],
      {
        redis: null,
        fetchFn: async (input) => {
          const url = String(input);
          calledUrlsFallback.push(url);
          if (url.includes("relations.yuna.moe")) {
            return mockJsonResponse({ myanimelist: 34572, thetvdb: 331753, "thetvdb-season": 1, imdb: "tt7441658" });
          }
          if (url.includes("/relation-rules/")) return mockJsonResponse({ found: false, rules: [] });
          if (url.includes("api.aniskip.com/v2/skip-times")) return mockJsonResponse({}, 404);
          if (url.includes("api.theintrodb.org/v4/media")) {
            assert.match(url, /tvdb_id=331753/);
            assert.match(url, /season=1/);
            assert.match(url, /episode=2/);
            assert.match(url, /details=true/);
            return mockJsonResponse({
              tvdb_id: 331753,
              season: 1,
              episode: 2,
              group_duration_ms: 1434000,
              intro: [{ start_ms: 202993, end_ms: 293041, confidence: 0.96, submission_count: 5 }],
            });
          }
          throw new Error(`IntroDB não deveria ser chamado quando TheIntroDB já encontrou: ${url}`);
        },
      },
    );
    assert.equal(hitTidb.suggestions[0]?.found, true);
    assert.equal(hitTidb.suggestions[0]?.source, "theintrodb");
    assert.equal(hitTidb.suggestions[0]?.startSeconds, 203);
    assert.equal(hitTidb.suggestions[0]?.endSeconds, 293);
    assert.equal(hitTidb.suggestions[0]?.startTime, "03:23");
    assert.equal(hitTidb.suggestions[0]?.endTime, "04:53");
    assert.equal(hitTidb.suggestions[0]?.confidence, 0.96);
    assert.equal(hitTidb.suggestions[0]?.submissionCount, 5);
    assert.equal(calledUrlsFallback.some((u) => u.includes("introdb.app")), false);
  });

  test("9 e 10. IntroDB: consultado só após falha de AniSkip+TheIntroDB, respeita no_intro e extrai confiança/contribuições", async () => {
    // no_intro = true nunca deve retornar timestamps
    const noIntro = await fetchIntroDbOpening(
      { imdbId: "tt7441658", seasonNumber: 1, episodeNumber: 1 },
      {
        redis: null,
        fetchFn: async () =>
          mockJsonResponse({
            imdb_id: "tt7441658",
            season: 1,
            episode: 1,
            no_intro: true,
            intro: { start_sec: 10, end_sec: 90, confidence: 1, submission_count: 2 },
          }),
      },
    );
    assert.equal(noIntro.found, false);
    assert.equal(noIntro.status, "no_intro");
    assert.equal(noIntro.startSeconds, null);
    assert.equal(noIntro.endSeconds, null);

    // Cascata até IntroDB
    const redis = new MockRedis();
    const res = await fetchOpeningSuggestionsCascade(
      { malId: 34572 },
      [{ seasonNumber: 1, episodeNumber: 2 }],
      {
        redis,
        fetchFn: async (input) => {
          const url = String(input);
          if (url.includes("relations.yuna.moe")) {
            return mockJsonResponse({ myanimelist: 34572, thetvdb: 331753, "thetvdb-season": 1, imdb: "tt7441658" });
          }
          if (url.includes("/relation-rules/")) return mockJsonResponse({ found: false, rules: [] });
          if (url.includes("api.aniskip.com/v2/skip-times")) return mockJsonResponse({}, 404);
          if (url.includes("api.theintrodb.org/v4/media")) return mockJsonResponse({}, 404);
          if (url.includes("api.introdb.app/segments")) {
            assert.match(url, /imdb_id=tt7441658/);
            return mockJsonResponse({
              imdb_id: "tt7441658",
              season: 1,
              episode: 2,
              no_intro: false,
              intro: {
                start_sec: 203.995,
                end_sec: 294.043,
                confidence: 0.94,
                submission_count: 7,
              },
            });
          }
          return mockJsonResponse({}, 404);
        },
      },
    );

    assert.equal(res.suggestions[0]?.found, true);
    assert.equal(res.suggestions[0]?.source, "introdb");
    assert.equal(res.suggestions[0]?.startSeconds, 204);
    assert.equal(res.suggestions[0]?.endSeconds, 294);
    assert.equal(res.suggestions[0]?.confidence, 0.94);
    assert.equal(res.suggestions[0]?.submissionCount, 7);
    assert.equal(
      redis.store.get("hikari:introdb:v1:tt7441658:s1:e2")?.ex,
      PROVIDER_POSITIVE_CACHE_TTL_SEC,
    );
  });

  test("11. Resolução de identificadores (Yuna + fallback ARM), validação cruzada e cache de 30 dias", async () => {
    const redis = new MockRedis();
    let armCalls = 0;

    // Yuna falha (500) -> fallback para ARM e grava cache de 30 dias
    const mapped = await resolveExternalAnimeIds(
      { malId: 25777, anilistId: 20958 },
      {
        redis,
        fetchFn: async (input) => {
          const url = String(input);
          if (url.includes("relations.yuna.moe")) return mockJsonResponse({}, 500);
          if (url.includes("arm.haglund.dev")) {
            armCalls += 1;
            return mockJsonResponse({
              myanimelist: 25777,
              anilist: 20958,
              thetvdb: 267440,
              "thetvdb-season": 2,
              themoviedb: 1429,
              "themoviedb-season": 2,
              imdb: "tt2560140",
              media: "TV",
            });
          }
          return mockJsonResponse({}, 404);
        },
      },
    );

    assert.equal(mapped.source, "arm");
    assert.equal(mapped.tvdbId, 267440);
    assert.equal(mapped.tvdbSeason, 2);
    assert.equal(mapped.imdbId, "tt2560140");
    assert.equal(armCalls, 1);
    assert.equal(
      redis.store.get("hikari:opening:ext-ids:v2:mal:25777")?.ex,
      EXTERNAL_IDS_POSITIVE_CACHE_TTL_SEC,
    );

    // Segunda chamada vem do cache Redis sem atingir Yuna/ARM
    const cached = await resolveExternalAnimeIds(
      { malId: 25777, anilistId: 20958 },
      {
        redis,
        fetchFn: async () => {
          throw new Error("Não deveria chamar rede com cache quente");
        },
      },
    );
    assert.equal(cached.fromCache, true);
    assert.equal(cached.tvdbId, 267440);

    // Rejeita mapeamento de outro anime (MAL ID divergente)
    const mismatched = await resolveExternalAnimeIds(
      { malId: 34572 },
      {
        redis: null,
        fetchFn: async () =>
          mockJsonResponse({
            myanimelist: 999999,
            thetvdb: 111111,
            imdb: "tt0000001",
          }),
      },
    );
    assert.equal(mismatched.tvdbId, null);
    assert.equal(mismatched.imdbId, null);

    // Cálculo de temporada mapeada
    assert.equal(resolveExternalSeasonNumber(1, 2), 2);
    assert.equal(resolveExternalSeasonNumber(2, 1), 2);
    assert.equal(resolveExternalSeasonNumber(1, null), 1);

    // Yuna retorna apenas MAL/AniList sem TVDB/IMDb -> deve consultar ARM para complementar IDs externos
    const partialMerged = await resolveExternalAnimeIds(
      { anilistId: 154587 },
      {
        redis: null,
        fetchFn: async (input) => {
          const url = String(input);
          if (url.includes("relations.yuna.moe")) {
            return mockJsonResponse({ myanimelist: 52991, anilist: 154587, media: "TV" });
          }
          if (url.includes("arm.haglund.dev")) {
            return mockJsonResponse({
              myanimelist: 52991,
              anilist: 154587,
              thetvdb: 424536,
              "thetvdb-season": 1,
              imdb: "tt22248376",
            });
          }
          return mockJsonResponse({}, 404);
        },
      },
    );
    assert.equal(partialMerged.malId, 52991);
    assert.equal(partialMerged.tvdbId, 424536);
    assert.equal(partialMerged.imdbId, "tt22248376");
    assert.equal(partialMerged.source, "arm");

    // Se Yuna retorna parcial e ARM falha com 500 -> NÃO grava cache de 30 dias com resultado incompleto
    const transientRedis = new MockRedis();
    const partialOnTransientErr = await resolveExternalAnimeIds(
      { anilistId: 154587 },
      {
        redis: transientRedis,
        fetchFn: async (input) => {
          const url = String(input);
          if (url.includes("relations.yuna.moe")) {
            return mockJsonResponse({ myanimelist: 52991, anilist: 154587 });
          }
          return mockJsonResponse({}, 500);
        },
      },
    );
    assert.equal(partialOnTransientErr.malId, 52991);
    assert.equal(transientRedis.store.size, 0);

    // Se TVDB não for resolvido, pula TheIntroDB e continua para IntroDB
    const skippedTidb = await fetchOpeningSuggestionsCascade(
      { malId: 12345 },
      [{ seasonNumber: 1, episodeNumber: 1 }],
      {
        redis: null,
        fetchFn: async (input) => {
          const url = String(input);
          if (url.includes("relations.yuna.moe")) {
            return mockJsonResponse({ myanimelist: 12345, imdb: "tt1234567" });
          }
          if (url.includes("/relation-rules/")) return mockJsonResponse({ found: false, rules: [] });
          if (url.includes("api.aniskip.com/v2/skip-times")) return mockJsonResponse({}, 404);
          if (url.includes("theintrodb.org")) {
            throw new Error("Não deveria chamar TheIntroDB sem tvdbId/tmdbId");
          }
          if (url.includes("api.introdb.app/segments")) {
            return mockJsonResponse({
              imdb_id: "tt1234567",
              season: 1,
              episode: 1,
              no_intro: false,
              intro: { start_sec: 15, end_sec: 105, confidence: 0.9, submission_count: 3 },
            });
          }
          return mockJsonResponse({}, 404);
        },
      },
    );
    assert.equal(skippedTidb.suggestions[0]?.found, true);
    assert.equal(skippedTidb.suggestions[0]?.source, "introdb");
  });

  test("12. Prevenção de mistura de resultados entre fontes", async () => {
    const redis = new MockRedis();
    // TheIntroDB retorna apenas start_ms (sem end_ms) e IntroDB retorna apenas end_sec (sem start_sec) -> NUNCA mistura
    const res = await fetchOpeningSuggestionsCascade(
      { malId: 34572 },
      [{ seasonNumber: 1, episodeNumber: 1 }],
      {
        redis,
        fetchFn: async (input) => {
          const url = String(input);
          if (url.includes("relations.yuna.moe")) {
            return mockJsonResponse({ myanimelist: 34572, thetvdb: 331753, "thetvdb-season": 1, imdb: "tt7441658" });
          }
          if (url.includes("/relation-rules/")) return mockJsonResponse({ found: false, rules: [] });
          if (url.includes("api.aniskip.com/v2/skip-times")) return mockJsonResponse({}, 404);
          if (url.includes("api.theintrodb.org/v4/media")) {
            return mockJsonResponse({
              tvdb_id: 331753,
              season: 1,
              episode: 1,
              intro: [{ start_ms: 90000, end_ms: null }],
            });
          }
          if (url.includes("api.introdb.app/segments")) {
            return mockJsonResponse({
              imdb_id: "tt7441658",
              season: 1,
              episode: 1,
              no_intro: false,
              intro: { start_sec: null, end_sec: 180 },
            });
          }
          return mockJsonResponse({}, 404);
        },
      },
    );

    assert.equal(res.suggestions[0]?.found, false);
    assert.equal(res.suggestions[0]?.startSeconds, null);
    assert.equal(res.suggestions[0]?.endSeconds, null);
    assert.equal(
      redis.store.get("hikari:opening:cascade:v2:mal:34572:s1:e1:len0")?.ex,
      PROVIDER_NEGATIVE_CACHE_TTL_SEC,
    );
  });

  test("13, 14 e 15. Aprovação explícita, dirtyEpisodeIds, descarte seguro e preservação dos horários existentes", () => {
    const anime = makeSampleAnime();
    const dirtyIds = new Set<string>();
    let suggestionsMap: Record<string, OpeningSuggestionEntry> = {};

    const loadedIncoming: Record<string, OpeningSuggestionEntry> = {
      [getOpeningSuggestionKey(1, 1)]: {
        seasonNumber: 1,
        episodeNumber: 1,
        found: true,
        startSeconds: 207,
        endSeconds: 296,
        startTime: "03:27",
        endTime: "04:56",
        source: "theintrodb",
        sourceLabel: "TheIntroDB",
        confidence: null,
        submissionCount: null,
        status: "found",
      },
      [getOpeningSuggestionKey(1, 2)]: {
        seasonNumber: 1,
        episodeNumber: 2,
        found: true,
        startSeconds: 207,
        endSeconds: 297,
        startTime: "03:27",
        endTime: "04:57",
        source: "aniskip",
        sourceLabel: "AniSkip",
        confidence: null,
        submissionCount: null,
        status: "found",
      },
    };

    // Carregar sugestões NÃO pode alterar o anime nem marcar episódios como dirty silenciosamente
    suggestionsMap = mergeLoadedOpeningSuggestions(suggestionsMap, loadedIncoming);
    assert.equal(anime.seasons[0].episodes[0].openingStartSeconds, 181);
    assert.equal(anime.seasons[0].episodes[0].openingEndSeconds, 271);
    assert.equal(anime.seasons[0].episodes[1].openingStartSeconds, null);
    assert.equal(anime.seasons[0].episodes[1].openingEndSeconds, null);
    assert.equal(dirtyIds.size, 0);

    // Descartar sugestão do Ep. 1 preserva os horários originais salvos (181..271) e mantém dirtyIds vazio
    suggestionsMap = discardOpeningSuggestion(suggestionsMap, 1, 1);
    assert.equal(getOpeningSuggestionKey(1, 1) in suggestionsMap, false);
    assert.equal(anime.seasons[0].episodes[0].openingStartSeconds, 181);
    assert.equal(anime.seasons[0].episodes[0].openingEndSeconds, 271);
    assert.equal(dirtyIds.size, 0);

    // Aplicar explicitamente a sugestão do Ep. 2 atualiza somente o Ep. 2 e registra em dirtyIds
    const updatedAnime = applyOpeningSuggestionToAnime(
      anime,
      dirtyIds,
      "season-1",
      "ep-2",
      207,
      297,
    );
    assert.equal(updatedAnime.seasons[0].episodes[0].openingStartSeconds, 181);
    assert.equal(updatedAnime.seasons[0].episodes[0].openingEndSeconds, 271);
    assert.equal(updatedAnime.seasons[0].episodes[1].openingStartSeconds, 207);
    assert.equal(updatedAnime.seasons[0].episodes[1].openingEndSeconds, 297);
    assert.equal(dirtyIds.has("ep-2"), true);
    assert.equal(dirtyIds.has("ep-1"), false);
  });

  test("16. Reconciliação de dirtyEpisodeIds após setForm(): preserva episódios preenchidos automaticamente", () => {
    const dirtyIds = new Set<string>(["ep-stale"]);
    const explicitDirty = new Set<string>();

    const seasons = [
      {
        id: "season-1",
        number: 1,
        title: "Temporada 1",
        episodes: [
          {
            id: "ep-1",
            number: 1,
            title: "Episódio 1",
            published: true,
            openingStartSeconds: 181,
            openingEndSeconds: 271,
          },
          {
            id: "ep-2",
            number: 2,
            title: "Episódio 2",
            published: false,
            openingStartSeconds: null,
            openingEndSeconds: null,
          },
          {
            id: "ep-imported-3",
            number: 3,
            title: "Episódio 3 (Importado/Duplicado)",
            published: false,
            openingStartSeconds: 90,
            openingEndSeconds: 180,
          },
        ],
      },
    ];

    const serverEpisodes = [
      {
        id: "ep-1",
        seasonNumber: 1,
        number: 1,
        published: true,
        openingStartSeconds: 181,
        openingEndSeconds: 271,
      },
      {
        id: "ep-2",
        seasonNumber: 1,
        number: 2,
        published: false,
        openingStartSeconds: 50,
        openingEndSeconds: 140,
      },
    ];

    reconcileDirtyEpisodeIdsAfterFormPopulation(dirtyIds, seasons, serverEpisodes, explicitDirty);

    // ep-1 já bate exatamente com o banco -> permanece limpo (sem regravação desnecessária)
    assert.equal(dirtyIds.has("ep-1"), false);
    // ep-2 diverge do snapshot do servidor -> marcado para persistência
    assert.equal(dirtyIds.has("ep-2"), true);
    // ep-imported-3 veio do setForm() (não existe ainda no servidor) -> garantido em dirtyIds
    assert.equal(dirtyIds.has("ep-imported-3"), true);

    // Edição explícita do usuário em ep-1 deve permanecer dirty mesmo batendo com snapshot antigo
    explicitDirty.add("ep-1");
    reconcileDirtyEpisodeIdsAfterFormPopulation(dirtyIds, seasons, serverEpisodes, explicitDirty);
    assert.equal(dirtyIds.has("ep-1"), true);
  });
});
