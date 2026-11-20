import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  domainCaches,
  fetchCachedAnimeCreditsWithDeps,
  fetchCachedAnimeEpisodesWithDeps,
  inFlight,
  invalidateServerCatalogCachesAsync,
  type AnimeCreditsResult,
} from "@/lib/api";
import { invalidateCatalogEpisodesCache } from "@/lib/catalog-episodes";
import {
  buildCreditsRedisKey,
  buildCreditsRedisScopeKey,
  buildJikanEpisodesRedisKey,
  CREDITS_GLOBAL_GEN_KEY,
  CREDITS_ID_GEN_PREFIX,
  CREDITS_REDIS_KEY_PREFIX,
  CREDITS_REDIS_TTL_SEC,
  getRedisAnimeCreditsWithFence,
  getRedisAnimeJikanEpisodesWithFence,
  invalidateRedisAnimeCredits,
  invalidateRedisAnimeJikanEpisodes,
  JIKAN_EPISODES_GLOBAL_GEN_KEY,
  JIKAN_EPISODES_ID_GEN_PREFIX,
  JIKAN_EPISODES_REDIS_KEY_PREFIX,
  JIKAN_EPISODES_REDIS_TTL_SEC,
  setRedisAnimeCredits,
  setRedisAnimeJikanEpisodes,
  type RedisEvalClient,
} from "@/lib/redis";
import type { Season } from "@/lib/types";

type StoredEntry = {
  value: string;
  ttlSec?: number;
};

class MockRedis implements RedisEvalClient {
  store = new Map<string, StoredEntry>();
  evalCalls: Array<{ keys: string[]; args: string[] }> = [];
  shouldThrow = false;

  private getString(key: string): string | null {
    return this.store.get(key)?.value ?? null;
  }

  private incr(key: string): number {
    const current = Number(this.getString(key) ?? "0") || 0;
    const next = current + 1;
    this.store.set(key, { value: String(next) });
    return next;
  }

  async eval<TArgs extends unknown[], TData = unknown>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData> {
    if (this.shouldThrow) {
      throw new Error("MockRedis failure (simulated outage)");
    }

    const strArgs = (args ?? []).map((a) => String(a));
    this.evalCalls.push({ keys: [...keys], args: strArgs });

    // GET_ENVELOPE_OR_FENCE_SCRIPT
    if (script.includes("redis.call(\"GET\", KEYS[1])") && script.includes("out = { v")) {
      const v = this.getString(keys[0]);
      const g = this.getString(keys[1]) ?? "0";
      const out: unknown[] = [v ? `:${v}` : "", `:${g}`];
      for (let i = 2; i < keys.length; i++) {
        out.push(`:${this.getString(keys[i]) ?? "0"}`);
      }
      return out as TData;
    }

    // SET_ENVELOPE_WITH_FENCE_SCRIPT
    if (script.includes("currentGen ~= tostring(ARGV[i + 1])") && script.includes("\"EX\"")) {
      for (let i = 1; i < keys.length; i++) {
        const curGen = this.getString(keys[i]) ?? "0";
        const expectedGen = strArgs[i + 1];
        if (curGen !== expectedGen) {
          return ["fenced"] as TData;
        }
      }
      const ttlSec = Number(strArgs[1]);
      this.store.set(keys[0], { value: strArgs[0], ttlSec });
      return ["inserted"] as TData;
    }

    // INVALIDATE_IDS_SCRIPT
    if (script.includes("tonumber(ARGV[1])") && script.includes("redis.call(\"DEL\"")) {
      const n = Number(strArgs[0] ?? 0) || 0;
      for (let i = 0; i < n; i++) {
        this.incr(keys[i]);
      }
      for (let i = n; i < keys.length; i++) {
        this.store.delete(keys[i]);
      }
      return n as TData;
    }

    // INCR_GLOBAL_GEN_SCRIPT
    if (script.includes("redis.call(\"INCR\", KEYS[1])")) {
      const next = this.incr(keys[0]);
      return `:${next}` as TData;
    }

    throw new Error(`Script Lua não mapeado no MockRedis: ${script.slice(0, 60)}`);
  }

  async keys(pattern: string): Promise<string[]> {
    if (this.shouldThrow) {
      throw new Error("MockRedis keys failure");
    }
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    return Array.from(this.store.keys()).filter((k) =>
      pattern.endsWith("*") ? k.startsWith(prefix) : k === pattern,
    );
  }

  async del(...keys: string[]): Promise<number> {
    if (this.shouldThrow) {
      throw new Error("MockRedis del failure");
    }
    let deleted = 0;
    for (const k of keys) {
      if (this.store.delete(k)) deleted += 1;
    }
    return deleted;
  }
}

function makeSampleCredits(tag: string, ids?: { anilistId?: number; malId?: number }): AnimeCreditsResult {
  return {
    studios: [`Studio ${tag}`],
    characters: [
      {
        id: 1,
        name: { full: `Hero ${tag}`, native: `ヒーロー${tag}` },
        role: "MAIN",
        voiceActors: [
          {
            id: 10,
            name: { full: `Seiyuu ${tag}` },
            language: "Japanese",
          },
        ],
      },
    ],
    staff: [
      {
        id: 20,
        name: `Director ${tag}`,
        role: "Director",
      },
    ],
    anilistId: ids?.anilistId,
    malId: ids?.malId,
  };
}

function makeSampleSeasons(malId: number, titlePrefix: string): Season[] {
  return [
    {
      id: `mal-s1-${malId}`,
      number: 1,
      title: "Temporada 1",
      episodes: [
        {
          id: `mal-ep-${malId}-1`,
          number: 1,
          title: `${titlePrefix} - Episódio 1`,
          aired: "2025-01-10T00:00:00+00:00",
        },
        {
          id: `mal-ep-${malId}-2`,
          number: 2,
          title: `${titlePrefix} - Episódio 2`,
          aired: "2025-01-17T00:00:00+00:00",
        },
      ],
    },
  ];
}

function clearLocalMemoryCaches(): void {
  domainCaches.clear();
  inFlight.clear();
}

describe("Cache Redis compartilhado para fetchAnimeCredits e fetchAnimeEpisodes", () => {
  let mockRedis: MockRedis;

  beforeEach(() => {
    clearLocalMemoryCaches();
    mockRedis = new MockRedis();
  });

  it("1. Cache hit no Redis (RAM fria): retorna créditos e episódios do Redis sem chamar upstream e hidrata RAM", async () => {
    // Pré-popula Redis para Créditos via escrita controlada
    const creditsInput = {
      anilistId: 154587,
      malId: 52991,
      titles: ["Sousou no Frieren"],
      year: 2023,
      format: "TV",
      animeId: "154587",
    };
    const scopeKey = buildCreditsRedisScopeKey(creditsInput);
    const expectedCredits = makeSampleCredits("Frieren", { anilistId: 154587, malId: 52991 });
    const preReadCredits = await getRedisAnimeCreditsWithFence(scopeKey, ["154587", "mal-52991"], mockRedis);
    assert.equal(preReadCredits.status, "miss");
    await setRedisAnimeCredits(scopeKey, expectedCredits, preReadCredits.fence, mockRedis);

    let creditsUpstreamCalls = 0;
    const hitCredits = await fetchCachedAnimeCreditsWithDeps(
      creditsInput,
      async (markOk) => {
        creditsUpstreamCalls += 1;
        markOk();
        return makeSampleCredits("ShouldNotRun");
      },
      { redis: mockRedis },
    );
    assert.equal(creditsUpstreamCalls, 0);
    assert.deepEqual(hitCredits, expectedCredits);
    assert.ok(domainCaches.get("credits")?.size === 1);

    // Pré-popula Redis para Episódios Jikan
    const expectedSeasons = makeSampleSeasons(52991, "Frieren");
    const preReadEps = await getRedisAnimeJikanEpisodesWithFence(52991, ["154587"], mockRedis);
    assert.equal(preReadEps.status, "miss");
    await setRedisAnimeJikanEpisodes(52991, expectedSeasons, preReadEps.fence, mockRedis);

    let episodesUpstreamCalls = 0;
    const hitEpisodes = await fetchCachedAnimeEpisodesWithDeps(
      52991,
      async () => {
        episodesUpstreamCalls += 1;
        return makeSampleSeasons(52991, "ShouldNotRun");
      },
      { animeId: "154587", redis: mockRedis },
    );
    assert.equal(episodesUpstreamCalls, 0);
    assert.deepEqual(hitEpisodes, expectedSeasons);
    assert.ok(domainCaches.get("episodes")?.size === 1);
  });

  it("2. Cache miss no Redis: consulta upstream uma vez e grava com chave versionada, TTL esperado e sem dados pessoais", async () => {
    const creditsInput = {
      anilistId: 21,
      malId: 21,
      titles: ["One Piece"],
      year: 1999,
      format: "TV",
      animeId: "21",
    };
    const expectedCredits = makeSampleCredits("OnePiece", { anilistId: 21, malId: 21 });
    let creditsFetchCount = 0;

    const firstCredits = await fetchCachedAnimeCreditsWithDeps(
      creditsInput,
      async (markOk) => {
        creditsFetchCount += 1;
        markOk();
        return expectedCredits;
      },
      { redis: mockRedis },
    );
    assert.equal(creditsFetchCount, 1);
    assert.deepEqual(firstCredits, expectedCredits);

    const creditsRedisKey = buildCreditsRedisKey(buildCreditsRedisScopeKey(creditsInput));
    assert.ok(creditsRedisKey.startsWith(CREDITS_REDIS_KEY_PREFIX));
    const storedCreditsEntry = mockRedis.store.get(creditsRedisKey);
    assert.ok(storedCreditsEntry, "Esperava entrada gravada no Redis para créditos");
    assert.equal(storedCreditsEntry.ttlSec, CREDITS_REDIS_TTL_SEC);
    assert.equal(storedCreditsEntry.value.includes("userId"), false);

    // Nova instância (RAM limpa) deve acertar no Redis sem chamar upstream novamente
    clearLocalMemoryCaches();
    const secondCredits = await fetchCachedAnimeCreditsWithDeps(
      creditsInput,
      async (markOk) => {
        creditsFetchCount += 1;
        markOk();
        return makeSampleCredits("Unexpected");
      },
      { redis: mockRedis },
    );
    assert.equal(creditsFetchCount, 1);
    assert.deepEqual(secondCredits, expectedCredits);

    // Episódios Jikan: miss -> upstream -> escrita no Redis com TTL 1800s
    const expectedSeasons = makeSampleSeasons(21, "One Piece");
    let epsFetchCount = 0;
    const firstEpisodes = await fetchCachedAnimeEpisodesWithDeps(
      21,
      async () => {
        epsFetchCount += 1;
        return expectedSeasons;
      },
      { animeId: "21", redis: mockRedis },
    );
    assert.equal(epsFetchCount, 1);
    assert.deepEqual(firstEpisodes, expectedSeasons);

    const epsRedisKey = buildJikanEpisodesRedisKey(21);
    assert.equal(epsRedisKey, `${JIKAN_EPISODES_REDIS_KEY_PREFIX}21`);
    const storedEpsEntry = mockRedis.store.get(epsRedisKey);
    assert.ok(storedEpsEntry, "Esperava entrada gravada no Redis para episódios");
    assert.equal(storedEpsEntry.ttlSec, JIKAN_EPISODES_REDIS_TTL_SEC);
    assert.equal(storedEpsEntry.value.includes("userId"), false);

    clearLocalMemoryCaches();
    const secondEpisodes = await fetchCachedAnimeEpisodesWithDeps(
      21,
      async () => {
        epsFetchCount += 1;
        return makeSampleSeasons(21, "Unexpected");
      },
      { animeId: "21", redis: mockRedis },
    );
    assert.equal(epsFetchCount, 1);
    assert.deepEqual(secondEpisodes, expectedSeasons);
  });

  it("3. Falha ou indisponibilidade do Redis (fail-open): não quebra e usa fallback upstream normalmente", async () => {
    mockRedis.shouldThrow = true;

    const creditsInput = {
      anilistId: 3001,
      malId: 3002,
      titles: ["Bleach"],
      year: 2004,
      format: "TV",
      animeId: "3001",
    };
    const expectedCredits = makeSampleCredits("Bleach", { anilistId: 3001, malId: 3002 });

    const credits = await fetchCachedAnimeCreditsWithDeps(
      creditsInput,
      async (markOk) => {
        markOk();
        return expectedCredits;
      },
      { redis: mockRedis },
    );
    assert.deepEqual(credits, expectedCredits);

    const expectedSeasons = makeSampleSeasons(3002, "Bleach");
    const seasons = await fetchCachedAnimeEpisodesWithDeps(
      3002,
      async () => expectedSeasons,
      { animeId: "3001", redis: mockRedis },
    );
    assert.deepEqual(seasons, expectedSeasons);

    // Redis explicitamente ausente (null) também deve funcionar sem erro
    clearLocalMemoryCaches();
    const creditsNoRedis = await fetchCachedAnimeCreditsWithDeps(
      creditsInput,
      async (markOk) => {
        markOk();
        return expectedCredits;
      },
      { redis: null },
    );
    assert.deepEqual(creditsNoRedis, expectedCredits);
  });

  it("4. Requisições simultâneas concorrentes (singleflight): executa apenas 1 leitura Redis e 1 busca upstream", async () => {
    const creditsInput = {
      anilistId: 4001,
      malId: 4002,
      titles: ["Fullmetal Alchemist"],
      year: 2009,
      format: "TV",
      animeId: "4001",
    };

    let upstreamCreditsRuns = 0;
    const expectedCredits = makeSampleCredits("FMA", { anilistId: 4001, malId: 4002 });

    const concurrentCredits = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetchCachedAnimeCreditsWithDeps(
          creditsInput,
          async (markOk) => {
            upstreamCreditsRuns += 1;
            await new Promise((r) => setTimeout(r, 20));
            markOk();
            return expectedCredits;
          },
          { redis: mockRedis },
        ),
      ),
    );

    assert.equal(upstreamCreditsRuns, 1);
    for (const item of concurrentCredits) {
      assert.deepEqual(item, expectedCredits);
    }

    // Singleflight também para episódios
    let upstreamEpsRuns = 0;
    const expectedSeasons = makeSampleSeasons(4002, "FMA");
    mockRedis.evalCalls = [];

    const concurrentEpisodes = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetchCachedAnimeEpisodesWithDeps(
          4002,
          async () => {
            upstreamEpsRuns += 1;
            await new Promise((r) => setTimeout(r, 20));
            return expectedSeasons;
          },
          { animeId: "4001", redis: mockRedis },
        ),
      ),
    );

    assert.equal(upstreamEpsRuns, 1);
    // 1 leitura no Redis (GET_ENVELOPE) + 1 gravação no Redis (SET_ENVELOPE) = 2 chamadas eval
    assert.equal(mockRedis.evalCalls.length, 2);
    for (const res of concurrentEpisodes) {
      assert.deepEqual(res, expectedSeasons);
    }
  });

  it("5. Invalidação administrativa (pontual, global e corrida com flight em andamento): invalida chaves e impede escrita obsoleta", async () => {
    const animeAInput = {
      anilistId: 5001,
      malId: 5002,
      titles: ["Attack on Titan"],
      year: 2013,
      format: "TV",
      animeId: "custom-aot",
    };

    let creditsFetchCount = 0;
    let epsFetchCount = 0;

    // Popula cache de Anime A (créditos + episódios)
    const creditsV1 = await fetchCachedAnimeCreditsWithDeps(
      animeAInput,
      async (markOk) => {
        creditsFetchCount += 1;
        markOk();
        return makeSampleCredits("AOT-V1", { anilistId: 5001, malId: 5002 });
      },
      { redis: mockRedis },
    );
    const epsV1 = await fetchCachedAnimeEpisodesWithDeps(
      5002,
      async () => {
        epsFetchCount += 1;
        return makeSampleSeasons(5002, "AOT-V1");
      },
      { animeId: "custom-aot", redis: mockRedis },
    );
    assert.equal(creditsV1.studios[0], "Studio AOT-V1");
    assert.equal(epsV1[0].episodes[0].title, "AOT-V1 - Episódio 1");

    // Invalidação pontual pelo ID do Admin
    await invalidateServerCatalogCachesAsync(
      "custom-aot",
      { anilistId: 5001, malId: 5002 },
      mockRedis,
    );

    // Confirma que os contadores de geração por ID foram incrementados e a chave direta de episódios foi removida
    assert.equal(mockRedis.store.get(`${CREDITS_ID_GEN_PREFIX}custom-aot`)?.value, "1");
    assert.equal(mockRedis.store.get(`${CREDITS_ID_GEN_PREFIX}mal-5002`)?.value, "1");
    assert.equal(mockRedis.store.get(`${JIKAN_EPISODES_ID_GEN_PREFIX}custom-aot`)?.value, "1");
    assert.equal(mockRedis.store.get(buildJikanEpisodesRedisKey(5002)), undefined);

    // Próxima chamada após invalidação deve buscar dados atualizados (V2)
    const creditsV2 = await fetchCachedAnimeCreditsWithDeps(
      animeAInput,
      async (markOk) => {
        creditsFetchCount += 1;
        markOk();
        return makeSampleCredits("AOT-V2", { anilistId: 5001, malId: 5002 });
      },
      { redis: mockRedis },
    );
    const epsV2 = await fetchCachedAnimeEpisodesWithDeps(
      5002,
      async () => {
        epsFetchCount += 1;
        return makeSampleSeasons(5002, "AOT-V2");
      },
      { animeId: "custom-aot", redis: mockRedis },
    );
    assert.equal(creditsFetchCount, 2);
    assert.equal(epsFetchCount, 2);
    assert.equal(creditsV2.studios[0], "Studio AOT-V2");
    assert.equal(epsV2[0].episodes[0].title, "AOT-V2 - Episódio 1");

    // Corrida (fence): invalidação acontece ENQUANTO um flight lento está buscando dados antigos
    await invalidateServerCatalogCachesAsync("custom-aot", { anilistId: 5001, malId: 5002 }, mockRedis);
    let releaseSlowFetch!: () => void;
    const slowFetchGate = new Promise<void>((resolve) => {
      releaseSlowFetch = resolve;
    });

    const slowFlight = fetchCachedAnimeEpisodesWithDeps(
      5002,
      async () => {
        await slowFetchGate;
        return makeSampleSeasons(5002, "AOT-STALE");
      },
      { animeId: "custom-aot", redis: mockRedis },
    );

    // Dispara invalidação administrativa durante o flight antes de ele terminar
    await new Promise((r) => setTimeout(r, 10));
    await invalidateRedisAnimeJikanEpisodes("custom-aot", { malId: 5002 }, mockRedis);
    invalidateCatalogEpisodesCache("custom-aot", "mal-5002");

    releaseSlowFetch();
    const slowResult = await slowFlight;
    assert.equal(slowResult[0].episodes[0].title, "AOT-STALE - Episódio 1");

    // A escrita obsoleta NÃO pode ter ficado no Redis nem na RAM
    const afterRaceRead = await getRedisAnimeJikanEpisodesWithFence(5002, ["custom-aot"], mockRedis);
    assert.equal(afterRaceRead.status, "miss");
    assert.equal(domainCaches.get("episodes")?.get("jikan-episodes:v2:5002"), undefined);

    // Invalidação global incrementa geração global e remove chaves
    await fetchCachedAnimeCreditsWithDeps(
      animeAInput,
      async (markOk) => {
        markOk();
        return makeSampleCredits("AOT-V3", { anilistId: 5001, malId: 5002 });
      },
      { redis: mockRedis },
    );
    await invalidateServerCatalogCachesAsync(undefined, undefined, mockRedis);
    assert.equal(mockRedis.store.get(CREDITS_GLOBAL_GEN_KEY)?.value, "1");
    assert.equal(mockRedis.store.get(JIKAN_EPISODES_GLOBAL_GEN_KEY)?.value, "1");

    const afterGlobalCredits = await getRedisAnimeCreditsWithFence(
      buildCreditsRedisScopeKey(animeAInput),
      ["custom-aot"],
      mockRedis,
    );
    assert.equal(afterGlobalCredits.status, "miss");

    // Limpa explicitamente cache local via helper de episódios também (teste de integração com hook)
    await invalidateRedisAnimeCredits(undefined, undefined, mockRedis);
  });

  it("6. Isolamento estrito por anime: animes distintos usam chaves separadas e invalidação de um não afeta o outro", async () => {
    const animeA = {
      anilistId: 6001,
      malId: 6002,
      titles: ["Naruto"],
      year: 2002,
      format: "TV",
      animeId: "6001",
    };
    const animeB = {
      anilistId: 7001,
      malId: 7002,
      titles: ["Hunter x Hunter"],
      year: 2011,
      format: "TV",
      animeId: "7001",
    };

    // Também testa isolamento entre animes locais sem IDs externos mesmo com título idêntico
    const localA = {
      titles: ["OVA Exclusivo"],
      year: 2025,
      format: "OVA",
      animeId: "local-alpha",
    };
    const localB = {
      titles: ["OVA Exclusivo"],
      year: 2025,
      format: "OVA",
      animeId: "local-beta",
    };

    const keyLocalA = buildCreditsRedisKey(buildCreditsRedisScopeKey(localA));
    const keyLocalB = buildCreditsRedisKey(buildCreditsRedisScopeKey(localB));
    assert.notEqual(keyLocalA, keyLocalB);

    await fetchCachedAnimeCreditsWithDeps(
      animeA,
      async (markOk) => {
        markOk();
        return makeSampleCredits("Naruto", { anilistId: 6001, malId: 6002 });
      },
      { redis: mockRedis },
    );
    await fetchCachedAnimeCreditsWithDeps(
      animeB,
      async (markOk) => {
        markOk();
        return makeSampleCredits("HxH", { anilistId: 7001, malId: 7002 });
      },
      { redis: mockRedis },
    );
    await fetchCachedAnimeEpisodesWithDeps(
      6002,
      async () => makeSampleSeasons(6002, "Naruto"),
      { animeId: "6001", redis: mockRedis },
    );
    await fetchCachedAnimeEpisodesWithDeps(
      7002,
      async () => makeSampleSeasons(7002, "HxH"),
      { animeId: "7001", redis: mockRedis },
    );

    // Invalida APENAS Anime A
    await invalidateServerCatalogCachesAsync("6001", { anilistId: 6001, malId: 6002 }, mockRedis);

    clearLocalMemoryCaches();

    // Anime A deve ser MISS no Redis (chama upstream), enquanto Anime B deve permanecer HIT (0 chamadas upstream)
    let animeACreditsCalls = 0;
    let animeBCreditsCalls = 0;
    let animeAEpsCalls = 0;
    let animeBEpsCalls = 0;

    const refreshedA = await fetchCachedAnimeCreditsWithDeps(
      animeA,
      async (markOk) => {
        animeACreditsCalls += 1;
        markOk();
        return makeSampleCredits("Naruto-Novo", { anilistId: 6001, malId: 6002 });
      },
      { redis: mockRedis },
    );
    const cachedB = await fetchCachedAnimeCreditsWithDeps(
      animeB,
      async (markOk) => {
        animeBCreditsCalls += 1;
        markOk();
        return makeSampleCredits("ShouldNotFetchHxH");
      },
      { redis: mockRedis },
    );

    const refreshedEpsA = await fetchCachedAnimeEpisodesWithDeps(
      6002,
      async () => {
        animeAEpsCalls += 1;
        return makeSampleSeasons(6002, "Naruto-Novo");
      },
      { animeId: "6001", redis: mockRedis },
    );
    const cachedEpsB = await fetchCachedAnimeEpisodesWithDeps(
      7002,
      async () => {
        animeBEpsCalls += 1;
        return makeSampleSeasons(7002, "ShouldNotFetchHxH");
      },
      { animeId: "7001", redis: mockRedis },
    );

    assert.equal(animeACreditsCalls, 1);
    assert.equal(animeBCreditsCalls, 0);
    assert.equal(animeAEpsCalls, 1);
    assert.equal(animeBEpsCalls, 0);

    assert.equal(refreshedA.studios[0], "Studio Naruto-Novo");
    assert.equal(cachedB.studios[0], "Studio HxH");
    assert.equal(refreshedEpsA[0].episodes[0].title, "Naruto-Novo - Episódio 1");
    assert.equal(cachedEpsB[0].episodes[0].title, "HxH - Episódio 1");
  });
});
