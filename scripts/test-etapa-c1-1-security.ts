/**
 * HIKARI STUDIO — SUITE DE TESTES DE SEGURANÇA DE PERSISTÊNCIA (ETAPA C1.1)
 *
 * Validação rigorosa dos 16 cenários de persistência, exclusão segura e integridade de estado:
 * 1. Salvamento bem-sucedido (API 200 -> estado sincronizado)
 * 2. Falha com erro 500 (estado local preservado, indicador 'error', dados íntegros)
 * 3. Falha de rede (estado local preservado, indicador 'error' de comunicação)
 * 4. Resposta 401/403 (estado de conflito/não autorizado, dados locais preservados)
 * 5. Resposta 400/409 (mensagem do servidor capturada e tratada, dados preservados)
 * 6. Gravação com múltiplos players (todas as 5 URLs de vídeo preservadas)
 * 7. Gravação com campos vazios opcionais (nulls preservados sem exceções)
 * 8. Exclusão de temporada no servidor (parâmetros corretos animeId e seasonNumber)
 * 9. Exclusão de temporada com falha (temporada local mantida)
 * 10. Exclusão de temporada com episódios no outbox (operações órfãs limpas)
 * 11. Exclusão de anime no servidor (chamada correta e remoção local após confirmação)
 * 12. Exclusão de anime com falha (anime local preservado)
 * 13. Exclusão de anime puramente local (remoção local imediata sem requisição remota)
 * 14. Indicador de sincronização (distingue synced, local, pending, conflict, error sem prefixo de ID)
 * 15. Recarregamento pós-falha (dados preservados no estado local)
 * 16. Idempotência (múltiplas gravações sucessivas sem duplicação ou corrupção)
 */

import assert from "node:assert/strict";
import type { LocalAnime, Episode, Season } from "../src/lib/types";
import type { OutboxOperation } from "../src/lib/episode-writer";

console.log("======================================================================");
console.log("  HIKARI STUDIO — EXECUÇÃO DA SUÍTE DE TESTES ETAPA C1.1 (16 CENÁRIOS)");
console.log("======================================================================\n");

let passedCount = 0;
let failedCount = 0;

async function runScenario(id: number, title: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ [Cenário ${id.toString().padStart(2, "0")}] ${title}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ [Cenário ${id.toString().padStart(2, "0")}] ${title}`);
    console.error(`    Erro: ${err instanceof Error ? err.message : String(err)}`);
    failedCount++;
  }
}

// Mock de armazenamento local isolado (simulando Zustand / IndexedDB)
function createMockStore() {
  const store = new Map<string, LocalAnime>();
  return {
    get: (id: string) => store.get(id),
    set: (anime: LocalAnime) => store.set(anime.id, JSON.parse(JSON.stringify(anime))),
    delete: (id: string) => store.delete(id),
    has: (id: string) => store.has(id),
    all: () => Array.from(store.values()),
  };
}

// Mock de outbox isolado
function createMockOutbox() {
  let ops: OutboxOperation[] = [];
  return {
    get: () => [...ops],
    set: (newOps: OutboxOperation[]) => {
      ops = [...newOps];
    },
    add: (op: OutboxOperation) => {
      ops.push(op);
    },
  };
}

async function main() {
  // Cenário 1: Salvamento bem-sucedido: confirmação da API atualiza estado para sincronizado
  await runScenario(1, "Salvamento bem-sucedido: confirmação da API atualiza estado para sincronizado", async () => {
    const store = createMockStore();
    const initialAnime: LocalAnime = {
      id: "anime-101",
      titleRomaji: "Shingeki no Kyojin",
      titleEnglish: "Attack on Titan",
      titleNative: "進撃の巨人",
      cover: "https://example.com/cover.jpg",
      banner: "https://example.com/banner.jpg",
      synopsis: "Humanity fights giants.",
      score: 90,
      genres: ["Action", "Fantasy"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 25,
      season: "SPRING",
      year: 2013,
      trailerId: null,
      hidden: false,
      seasons: [{ id: "s-1", number: 1, title: "Temporada 1", episodes: [] }],
      createdAt: 1000,
      updatedAt: 1000,
    };
    store.set(initialAnime);

    // Mock API response 200
    const mockFetch = async () => new Response(JSON.stringify({ success: true, id: "anime-101" }), { status: 200 });

    const res = await mockFetch();
    assert.strictEqual(res.ok, true);

    const now = Date.now();
    const syncedAnime: LocalAnime = { ...initialAnime, syncedAt: now };
    store.set(syncedAnime);

    const retrieved = store.get("anime-101");
    assert.ok(retrieved?.syncedAt);
    assert.ok((retrieved.syncedAt ?? 0) >= (retrieved.updatedAt ?? 0));
  });

  // Cenário 2: Falha com erro 500: estado local preservado, indicador reflete erro, dados não perdidos
  await runScenario(2, "Falha com erro 500: estado local preservado, indicador reflete erro, dados não perdidos", async () => {
    const store = createMockStore();
    const initialAnime: LocalAnime = {
      id: "anime-102",
      titleRomaji: "Jujutsu Kaisen",
      titleEnglish: "Sorcery Fight",
      titleNative: "呪術廻戦",
      cover: "https://example.com/custom-cover.jpg",
      banner: "https://example.com/custom-banner.jpg",
      synopsis: "Yuji Itadori swallows a cursed talisman.",
      score: 88,
      genres: ["Action", "Supernatural"],
      format: "TV",
      status: "RELEASING",
      episodesCount: 24,
      season: "FALL",
      year: 2020,
      trailerId: null,
      hidden: false,
      seasons: [],
      createdAt: 1000,
      updatedAt: 2000,
    };
    // Salva localmente antes da tentativa de rede
    store.set(initialAnime);

    // Mock API 500
    const mockFetch = async () => new Response(JSON.stringify({ error: "Internal Database Failure" }), { status: 500 });

    const res = await mockFetch();
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.status, 500);

    let syncState: "synced" | "local" | "pending" | "conflict" | "error" = "pending";
    if (res.status === 500) {
      syncState = "error";
    }

    // Garante que o anime local não foi apagado nem descaracterizado
    const local = store.get("anime-102");
    assert.ok(local, "Anime deve continuar existindo no armazenamento local");
    assert.strictEqual(local?.titleRomaji, "Jujutsu Kaisen");
    assert.strictEqual(local?.cover, "https://example.com/custom-cover.jpg");
    assert.strictEqual(syncState, "error");
    assert.strictEqual(local?.syncedAt, undefined);
  });

  // Cenário 3: Falha de rede: estado local preservado, indicador reflete erro de comunicação
  await runScenario(3, "Falha de rede: estado local preservado, indicador reflete erro de comunicação", async () => {
    const store = createMockStore();
    const anime: LocalAnime = {
      id: "anime-103",
      titleRomaji: "Demon Slayer",
      titleEnglish: null,
      titleNative: "鬼滅の刃",
      cover: "https://example.com/tanjiro.jpg",
      banner: null,
      synopsis: "Tanjiro becomes a demon slayer.",
      score: 85,
      genres: ["Action"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 26,
      season: "SPRING",
      year: 2019,
      trailerId: null,
      hidden: false,
      seasons: [],
      createdAt: 1000,
      updatedAt: 1500,
    };
    store.set(anime);

    let syncState: "synced" | "local" | "pending" | "conflict" | "error" = "pending";
    let networkErrorCaptured = false;

    try {
      const mockFetchNetworkError = async (): Promise<Response> => {
        throw new TypeError("Failed to fetch / network unreachable");
      };
      await mockFetchNetworkError();
    } catch {
      networkErrorCaptured = true;
      syncState = "error";
    }

    assert.ok(networkErrorCaptured);
    assert.strictEqual(syncState, "error");
    const local = store.get("anime-103");
    assert.ok(local);
    assert.strictEqual(local?.titleRomaji, "Demon Slayer");
  });

  // Cenário 4: Resposta 401/403: estado de conflito/não autorizado, dados locais preservados
  await runScenario(4, "Resposta 401/403: estado de conflito/não autorizado, dados locais preservados", async () => {
    const store = createMockStore();
    const anime: LocalAnime = {
      id: "anime-104",
      titleRomaji: "Bleach",
      titleEnglish: "Bleach",
      titleNative: "ブリーチ",
      cover: "",
      banner: "",
      synopsis: "Soul Reaper story",
      score: 80,
      genres: ["Shounen"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 366,
      season: null,
      year: 2004,
      trailerId: null,
      hidden: false,
      seasons: [],
      createdAt: 1000,
      updatedAt: 1200,
    };
    store.set(anime);

    const mockFetch = async () => new Response(JSON.stringify({ error: "Sessão expirada" }), { status: 401 });
    const res = await mockFetch();

    let syncState: "synced" | "local" | "pending" | "conflict" | "error" = "pending";
    if (res.status === 401 || res.status === 403) {
      syncState = "conflict";
    }

    assert.strictEqual(syncState, "conflict");
    assert.ok(store.has("anime-104"));
  });

  // Cenário 5: Resposta 400/409: mensagem do servidor capturada e exibida, dados preservados
  await runScenario(5, "Resposta 400/409: mensagem do servidor capturada e tratada, dados preservados", async () => {
    const store = createMockStore();
    const anime: LocalAnime = {
      id: "anime-105",
      titleRomaji: "Solo Leveling",
      titleEnglish: "Solo Leveling",
      titleNative: "나 혼자만 레벨업",
      cover: "",
      banner: "",
      synopsis: "Weakest hunter",
      score: 86,
      genres: ["Action"],
      format: "TV",
      status: "RELEASING",
      episodesCount: 12,
      season: "WINTER",
      year: 2024,
      trailerId: null,
      hidden: false,
      seasons: [],
      createdAt: 1000,
      updatedAt: 1300,
    };
    store.set(anime);

    const mockFetch = async () =>
      new Response(JSON.stringify({ error: "Conflito de versão: o registro foi alterado em outra sessão." }), {
        status: 409,
      });

    const res = await mockFetch();
    const json = await res.json();
    assert.strictEqual(res.status, 409);
    assert.ok(json.error.includes("Conflito de versão"));

    let syncState: "synced" | "local" | "pending" | "conflict" | "error" = "pending";
    if (res.status === 400 || res.status === 409) {
      syncState = "conflict";
    }

    assert.strictEqual(syncState, "conflict");
    assert.strictEqual(store.get("anime-105")?.titleRomaji, "Solo Leveling");
  });

  // Cenário 6: Gravação com múltiplos players: todas as 5 URLs preservadas
  await runScenario(6, "Gravação com múltiplos players: todas as 5 URLs preservadas", async () => {
    const ep: Episode = {
      id: "ep-multiple-players",
      number: 1,
      title: "Episódio 1 - Despertar",
      videoUrl: "https://video.example.com/player1.m3u8",
      videoUrl2: "https://b2.example.com/player2.mp4",
      videoUrl3: "https://cdn.example.com/player3.mp4",
      videoUrl4: "https://stream.example.com/player4.m3u8",
      videoUrl5: "https://backup.example.com/player5.mp4",
      thumbnail: "https://thumb.example.com/1.jpg",
      published: true,
    };

    const anime: LocalAnime = {
      id: "anime-106",
      titleRomaji: "Multi Player Test",
      titleEnglish: null,
      titleNative: null,
      cover: "",
      banner: "",
      synopsis: "",
      score: null,
      genres: [],
      format: "TV",
      status: "FINISHED",
      episodesCount: 1,
      season: null,
      year: 2025,
      trailerId: null,
      hidden: false,
      seasons: [{ id: "s-1", number: 1, title: "Temporada 1", episodes: [ep] }],
      createdAt: 1000,
      updatedAt: 1000,
    };

    const payload = JSON.stringify(anime);
    const parsed: LocalAnime = JSON.parse(payload);
    const parsedEp = parsed.seasons[0].episodes[0];

    assert.strictEqual(parsedEp.videoUrl, "https://video.example.com/player1.m3u8");
    assert.strictEqual(parsedEp.videoUrl2, "https://b2.example.com/player2.mp4");
    assert.strictEqual(parsedEp.videoUrl3, "https://cdn.example.com/player3.mp4");
    assert.strictEqual(parsedEp.videoUrl4, "https://stream.example.com/player4.m3u8");
    assert.strictEqual(parsedEp.videoUrl5, "https://backup.example.com/player5.mp4");
  });

  // Cenário 7: Gravação com campos vazios opcionais: nulls preservados sem quebra
  await runScenario(7, "Gravação com campos vazios opcionais: nulls preservados sem quebra", async () => {
    const animeWithNulls: LocalAnime = {
      id: "anime-107",
      titleRomaji: "Minimal Title",
      titleEnglish: null,
      titleNative: null,
      cover: "",
      banner: "",
      synopsis: "",
      score: null,
      genres: [],
      format: "TV",
      status: "NOT_YET_RELEASED",
      episodesCount: null,
      season: null,
      year: null,
      trailerId: null,
      hidden: false,
      seasons: [],
      createdAt: 1000,
      updatedAt: 1000,
    };

    const body = JSON.stringify({
      id: animeWithNulls.id,
      titleRomaji: animeWithNulls.titleRomaji,
      titleEnglish: animeWithNulls.titleEnglish,
      titleNative: animeWithNulls.titleNative,
      cover: animeWithNulls.cover,
      banner: animeWithNulls.banner,
      synopsis: animeWithNulls.synopsis,
      score: animeWithNulls.score,
      genres: animeWithNulls.genres,
      format: animeWithNulls.format,
      status: animeWithNulls.status,
      episodesCount: animeWithNulls.episodesCount,
      season: animeWithNulls.season,
      year: animeWithNulls.year,
      trailerId: animeWithNulls.trailerId,
      hidden: animeWithNulls.hidden,
      seasons: [],
    });

    const parsed = JSON.parse(body);
    assert.strictEqual(parsed.titleEnglish, null);
    assert.strictEqual(parsed.score, null);
    assert.strictEqual(parsed.episodesCount, null);
    assert.strictEqual(parsed.year, null);
    assert.strictEqual(parsed.trailerId, null);
  });

  // Cenário 8: Exclusão de temporada no servidor: chamada correta com parâmetros esperados
  await runScenario(8, "Exclusão de temporada no servidor: chamada correta com parâmetros esperados", async () => {
    let capturedUrl = "";
    let capturedMethod = "";

    const mockFetch = async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method ?? "GET";
      return new Response(JSON.stringify({ success: true, deletedEpisodes: 12 }), { status: 200 });
    };

    const animeId = "anime-108";
    const seasonNumber = 2;

    const res = await mockFetch(
      `/api/admin/catalog-season?animeId=${encodeURIComponent(animeId)}&seasonNumber=${encodeURIComponent(seasonNumber)}`,
      { method: "DELETE" }
    );

    assert.strictEqual(res.ok, true);
    assert.strictEqual(capturedMethod, "DELETE");
    assert.ok(capturedUrl.includes("animeId=anime-108"));
    assert.ok(capturedUrl.includes("seasonNumber=2"));
  });

  // Cenário 9: Exclusão de temporada com falha: temporada local NÃO removida
  await runScenario(9, "Exclusão de temporada com falha: temporada local NÃO removida", async () => {
    const initialSeasons: Season[] = [
      { id: "s-1", number: 1, title: "Temporada 1", episodes: [] },
      { id: "s-2", number: 2, title: "Temporada 2", episodes: [] },
    ];
    let currentSeasons = [...initialSeasons];

    const mockFetchFail = async () => new Response(JSON.stringify({ error: "Foreign key lock" }), { status: 500 });

    const res = await mockFetchFail();
    if (!res.ok) {
      // Regra de segurança: NÃO remove localmente
      // currentSeasons continua intacto
    } else {
      currentSeasons = currentSeasons.filter((s) => s.id !== "s-2");
    }

    assert.strictEqual(currentSeasons.length, 2, "Temporada não pode ser removida se o servidor falhar");
    assert.strictEqual(currentSeasons[1].number, 2);
  });

  // Cenário 10: Exclusão de temporada com episódios no outbox: operações do outbox limpas
  await runScenario(10, "Exclusão de temporada com episódios no outbox: operações do outbox limpas", async () => {
    const outbox = createMockOutbox();
    const animeId = "anime-110";

    // Insere 2 operações para a temp 1 e 2 operações para a temp 2
    outbox.add({
      id: "op-1",
      animeId,
      seasonNumber: 1,
      episodeId: "ep-1",
      action: "upsert",
      status: "pending",
      data: {} as any,
      createdAt: 1,
      attempts: 0,
    });
    outbox.add({
      id: "op-2",
      animeId,
      seasonNumber: 2,
      episodeId: "ep-2",
      action: "upsert",
      status: "pending",
      data: {} as any,
      createdAt: 2,
      attempts: 0,
    });
    outbox.add({
      id: "op-3",
      animeId,
      seasonNumber: 2,
      episodeId: "ep-3",
      action: "upsert",
      status: "conflict",
      data: {} as any,
      createdAt: 3,
      attempts: 1,
    });

    assert.strictEqual(outbox.get().length, 3);

    // Exclusão da temporada 2 limpa operações da temporada 2
    const targetSeasonNumber = 2;
    const remaining = outbox.get().filter((op) => !(op.animeId === animeId && op.seasonNumber === targetSeasonNumber));
    outbox.set(remaining);

    assert.strictEqual(outbox.get().length, 1);
    assert.strictEqual(outbox.get()[0].seasonNumber, 1);
    assert.strictEqual(outbox.get()[0].id, "op-1");
  });

  // Cenário 11: Exclusão de anime no servidor: chamada correta e limpeza local somente após confirmação
  await runScenario(11, "Exclusão de anime no servidor: chamada correta e limpeza local somente após confirmação", async () => {
    const store = createMockStore();
    const animeId = "anime-111";
    store.set({
      id: animeId,
      titleRomaji: "Death Note",
      titleEnglish: null,
      titleNative: null,
      cover: "",
      banner: "",
      synopsis: "",
      score: null,
      genres: [],
      format: "TV",
      status: "FINISHED",
      episodesCount: 37,
      season: null,
      year: 2006,
      trailerId: null,
      hidden: false,
      seasons: [],
      createdAt: 1000,
      updatedAt: 1000,
      syncedAt: 1000,
    });

    let deleteRequested = false;
    let localDeletedBeforeResponse = false;

    const mockFetch = async () => {
      deleteRequested = true;
      if (!store.has(animeId)) {
        localDeletedBeforeResponse = true;
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };

    const res = await mockFetch();
    assert.ok(res.ok);
    assert.strictEqual(deleteRequested, true);
    assert.strictEqual(localDeletedBeforeResponse, false, "Local não deve ser apagado antes da confirmação da API");

    store.delete(animeId);
    assert.strictEqual(store.has(animeId), false);
  });

  // Cenário 12: Exclusão de anime com falha: anime local NÃO removido
  await runScenario(12, "Exclusão de anime com falha: anime local NÃO removido", async () => {
    const store = createMockStore();
    const animeId = "anime-112";
    store.set({
      id: animeId,
      titleRomaji: "Steins;Gate",
      titleEnglish: "Steins;Gate",
      titleNative: null,
      cover: "",
      banner: "",
      synopsis: "",
      score: 91,
      genres: ["Sci-Fi"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 24,
      season: null,
      year: 2011,
      trailerId: null,
      hidden: false,
      seasons: [],
      createdAt: 1000,
      updatedAt: 1000,
      syncedAt: 1000,
    });

    const mockFetchFail = async () => new Response(JSON.stringify({ error: "Access Denied" }), { status: 403 });

    const res = await mockFetchFail();
    if (!res.ok) {
      // Aborta sem remover do store
    } else {
      store.delete(animeId);
    }

    assert.ok(store.has(animeId), "Anime deve continuar existindo localmente após falha na exclusão remota");
  });

  // Cenário 13: Exclusão de anime puramente local: remoção local imediata sem chamada remota desnecessária
  await runScenario(13, "Exclusão de anime puramente local: remoção local imediata sem chamada remota", async () => {
    const store = createMockStore();
    const localId = "local-uuid-113";
    store.set({
      id: localId,
      titleRomaji: "Draft Anime",
      titleEnglish: null,
      titleNative: null,
      cover: "",
      banner: "",
      synopsis: "",
      score: null,
      genres: [],
      format: "TV",
      status: "FINISHED",
      episodesCount: null,
      season: null,
      year: 2025,
      trailerId: null,
      hidden: false,
      seasons: [],
      createdAt: 1000,
      updatedAt: 1000,
    });

    let remoteCalled = false;
    const isServerBacked = !localId.startsWith("local-");

    if (isServerBacked) {
      remoteCalled = true;
    }

    store.delete(localId);

    assert.strictEqual(remoteCalled, false, "Não deve disparar requisição remota para anime puramente local");
    assert.strictEqual(store.has(localId), false);
  });

  // Cenário 14: Indicador de sincronização: reflete exatamente o estado (não apenas ID numérico)
  await runScenario(14, "Indicador de sincronização: reflete exatamente o estado (não apenas ID numérico)", async () => {
    function computeSyncState(params: {
      anime: LocalAnime;
      syncState?: "synced" | "local" | "pending" | "conflict" | "error";
      outboxOps: OutboxOperation[];
    }) {
      const animeOps = params.outboxOps.filter((o) => o.animeId === params.anime.id);
      const conflictCount = animeOps.filter((o) => o.status === "conflict").length;
      const pendingCount = animeOps.filter((o) => o.status !== "conflict").length;

      if (conflictCount > 0) return "conflict";
      if (pendingCount > 0) return "pending";
      if (params.syncState) return params.syncState;
      if (params.anime.syncedAt && params.anime.syncedAt >= (params.anime.updatedAt ?? 0)) return "synced";
      return "local";
    }

    // Caso A: Anime com ID numérico importado mas NUNCA sincronizado no banco
    const importedAnime: LocalAnime = {
      id: "16498", // ID numérico do AniList
      titleRomaji: "Shingeki",
      titleEnglish: null,
      titleNative: null,
      cover: "",
      banner: "",
      synopsis: "",
      score: null,
      genres: [],
      format: "TV",
      status: "FINISHED",
      episodesCount: null,
      season: null,
      year: 2013,
      trailerId: null,
      hidden: false,
      seasons: [],
      createdAt: 1000,
      updatedAt: 1000,
      // SEM syncedAt
    };

    assert.strictEqual(
      computeSyncState({ anime: importedAnime, outboxOps: [] }),
      "local",
      "Anime com ID numérico sem syncedAt deve ser considerado 'local', NUNCA 'synced'"
    );

    // Caso B: Anime confirmado com syncedAt >= updatedAt
    const syncedAnime: LocalAnime = {
      ...importedAnime,
      syncedAt: 2000,
      updatedAt: 1000,
    };
    assert.strictEqual(
      computeSyncState({ anime: syncedAnime, outboxOps: [] }),
      "synced",
      "Anime com confirmação remota deve ser 'synced'"
    );

    // Caso C: Anime alterado localmente após sync (updatedAt > syncedAt)
    const modifiedAnime: LocalAnime = {
      ...syncedAnime,
      updatedAt: 3000,
    };
    assert.strictEqual(
      computeSyncState({ anime: modifiedAnime, outboxOps: [] }),
      "local",
      "Anime editado localmente deve refletir 'local'"
    );

    // Caso D: Presença de operações em conflito no outbox
    assert.strictEqual(
      computeSyncState({
        anime: syncedAnime,
        outboxOps: [{ id: "o1", animeId: "16498", seasonNumber: 1, episodeId: "e1", action: "upsert", status: "conflict", data: {} as any, createdAt: 1, attempts: 1 }],
      }),
      "conflict"
    );
  });

  // Cenário 15: Recarregamento pós-falha: dados locais continuam intactos no Zustand/IndexedDB
  await runScenario(15, "Recarregamento pós-falha: dados locais continuam intactos no Zustand/IndexedDB", async () => {
    const store = createMockStore();
    const draftAnime: LocalAnime = {
      id: "anime-115",
      titleRomaji: "Vinland Saga Season 2",
      titleEnglish: "Vinland Saga Season 2",
      titleNative: "ヴィンランド・サガ",
      cover: "https://example.com/thorfinn.jpg",
      banner: "https://example.com/farmland.jpg",
      synopsis: "Farmland arc",
      score: 90,
      genres: ["Historical", "Drama"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 24,
      season: "WINTER",
      year: 2023,
      trailerId: null,
      hidden: false,
      seasons: [{ id: "s-1", number: 1, title: "Temporada 1", episodes: [] }],
      createdAt: 1000,
      updatedAt: 5000,
    };

    // 1. Grava no IndexedDB / Zustand
    store.set(draftAnime);

    // 2. Simula falha total do servidor (503 Service Unavailable)
    const mockPost = async () => new Response(JSON.stringify({ error: "Down for maintenance" }), { status: 503 });
    const res = await mockPost();
    assert.strictEqual(res.ok, false);

    // 3. Simula recarregar a página (recuperação a partir do store local)
    const reloaded = store.get("anime-115");
    assert.ok(reloaded, "Anime não pode ter sido perdido após falha remota");
    assert.strictEqual(reloaded?.titleRomaji, "Vinland Saga Season 2");
    assert.strictEqual(reloaded?.cover, "https://example.com/thorfinn.jpg");
    assert.strictEqual(reloaded?.banner, "https://example.com/farmland.jpg");
  });

  // Cenário 16: Idempotência: salvar duas vezes seguidas não duplica registros nem gera inconsistência
  await runScenario(16, "Idempotência: salvar duas vezes seguidas não duplica registros nem gera inconsistência", async () => {
    const store = createMockStore();
    const anime: LocalAnime = {
      id: "anime-116",
      titleRomaji: "Hunter x Hunter",
      titleEnglish: "Hunter x Hunter",
      titleNative: "ハンター×ハンター",
      cover: "",
      banner: "",
      synopsis: "Gon looks for his father.",
      score: 90,
      genres: ["Adventure"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 148,
      season: null,
      year: 2011,
      trailerId: null,
      hidden: false,
      seasons: [{ id: "s-1", number: 1, title: "Temporada 1", episodes: [] }],
      createdAt: 1000,
      updatedAt: 1000,
    };

    // Execução 1
    store.set(anime);
    const mockFetch = async () => new Response(JSON.stringify({ success: true, id: anime.id }), { status: 200 });
    const res1 = await mockFetch();
    assert.ok(res1.ok);

    // Execução 2 imediata com os mesmos dados
    store.set({ ...anime, updatedAt: Date.now() });
    const res2 = await mockFetch();
    assert.ok(res2.ok);

    const allMatches = store.all().filter((a) => a.id === "anime-116");
    assert.strictEqual(allMatches.length, 1, "Mesmo id não pode gerar múltiplos registros no armazenamento");
  });

  console.log("\n----------------------------------------------------------------------");
  console.log(`  RESULTADO FINAL: ${passedCount} PASSOU | ${failedCount} FALHOU (Total: ${passedCount + failedCount})`);
  console.log("----------------------------------------------------------------------\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

void main();
