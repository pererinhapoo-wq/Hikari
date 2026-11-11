import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LocalAnime, SlimAnime } from "@/lib/types";
import { flushAnimes, loadAnimes, scheduleSave } from "@/lib/catalog-storage";

export type ContinueWatch = {
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  cover: string;
  title: string;
  updatedAt: number;
};

const MAX_WATCHED_PER_ANIME = 1000;

export function slimSnapshot(anime: SlimAnime): SlimAnime {
  return {
    id: anime.id,
    anilistId: anime.anilistId,
    malId: anime.malId,
    kitsuId: anime.kitsuId,
    titles: anime.titles ?? { romaji: "", english: "", native: "" },
    cover: anime.cover ?? "",
    banner: anime.banner ?? "",
    synopsis: "", // sem sinopse completa para otimizar espaço no localStorage
    score: anime.score ?? null,
    genres: (anime.genres ?? []).slice(0, 3),
    format: anime.format ?? "TV",
    status: anime.status ?? "",
    episodesCount: anime.episodesCount ?? null,
    season: anime.season ?? null,
    year: anime.year ?? null,
    trailerId: null,
    color: anime.color,
    source: anime.source ?? "cache",
  };
}

function slimSnapshotsRecord(
  record: Record<string, SlimAnime> | undefined,
): Record<string, SlimAnime> {
  if (!record) return {};
  const out: Record<string, SlimAnime> = {};
  for (const [id, anime] of Object.entries(record)) {
    if (anime) {
      out[id] = slimSnapshot(anime);
    }
  }
  return out;
}

function slimUserSnapshotsRecord(
  record: Record<string, Record<string, SlimAnime>> | undefined,
): Record<string, Record<string, SlimAnime>> {
  if (!record) return {};
  const out: Record<string, Record<string, SlimAnime>> = {};
  for (const [userId, userSnaps] of Object.entries(record)) {
    if (userSnaps) {
      out[userId] = slimSnapshotsRecord(userSnaps);
    }
  }
  return out;
}

/**
 * Captura dados existentes de "hikari-catalog-v1" no localStorage antes que
 * o Zustand possa sobrescrever a chave antiga durante a inicialização.
 */
function captureLegacyCatalogFromLocalStorage(): LocalAnime[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("hikari-catalog-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const candidate = parsed?.state?.animes ?? parsed?.animes;
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate as LocalAnime[];
    }
  } catch (err) {
    console.warn("[Hikari] Erro ao capturar catálogo legado do localStorage:", err);
  }
  return null;
}

// Capturado imediatamente na avaliação do módulo antes de qualquer gravação do persist
const initialLegacyCatalog: LocalAnime[] | null = captureLegacyCatalogFromLocalStorage();

type HikariState = {
  animes: LocalAnime[];
  myList: string[];
  snapshots: Record<string, SlimAnime>;
  userLists: Record<string, string[]>;
  userSnapshots: Record<string, Record<string, SlimAnime>>;
  currentUserId: string | null;
  continueWatching: ContinueWatch[];

  /**
   * Episódios que o usuário já abriu/assistiu (visão ativa da sessão atual).
   * Chave: animeId
   * Valor: lista de episodeId
   */
  watchedEpisodes: Record<string, string[]>;

  /**
   * Progresso local isolado de usuários anônimos.
   */
  anonymousWatchedEpisodes: Record<string, string[]>;

  /**
   * Progresso de reprodução particionado por usuário autenticado.
   */
  userWatchedEpisodes: Record<string, Record<string, string[]>>;

  hydrated: boolean;

  setHydrated: (v: boolean) => void;
  setCurrentUserId: (userId: string | null) => void;
  upsertAnime: (anime: LocalAnime) => void;
  removeAnime: (id: string) => void;
  toggleHidden: (id: string) => void;
  importAll: (animes: LocalAnime[]) => void;
  isInList: (id: string, userId?: string | null) => boolean;
  toggleList: (anime: SlimAnime, userId?: string | null) => void;

  markContinue: (entry: ContinueWatch) => void;
  clearContinue: (animeId: string) => void;

  /**
   * Marca um episódio como assistido.
   */
  markEpisodeWatched: (animeId: string, episodeId: string) => void;

  /**
   * Verifica se um episódio foi assistido.
   */
  isEpisodeWatched: (animeId: string, episodeId: string) => boolean;
};

export const useHikariStore = create<HikariState>()(
  persist(
    (set, get) => ({
      animes: [],
      myList: [],
      snapshots: {},
      userLists: {},
      userSnapshots: {},
      currentUserId: null,
      continueWatching: [],
      watchedEpisodes: {},
      anonymousWatchedEpisodes: {},
      userWatchedEpisodes: {},
      hydrated: false,

      setHydrated: (v) => set({ hydrated: v }),

      setCurrentUserId: (userId) => {
        set((s) => {
          // Se estava logado antes, guarda o progresso do usuário anterior
          const prevUserWatched = s.currentUserId
            ? {
                ...(s.userWatchedEpisodes ?? {}),
                [s.currentUserId]: s.watchedEpisodes ?? {},
              }
            : s.userWatchedEpisodes ?? {};

          if (!userId) {
            // Logout: limpa sessão autenticada e restaura progresso anônimo local
            return {
              currentUserId: null,
              myList: [],
              snapshots: {},
              userWatchedEpisodes: prevUserWatched,
              watchedEpisodes: s.anonymousWatchedEpisodes ?? {},
            };
          }

          // Login ou troca de conta:
          const existingUserList =
            s.userLists?.[userId] ?? (s.myList.length > 0 ? [...s.myList] : []);
          const existingUserSnapshots =
            s.userSnapshots?.[userId] ??
            (Object.keys(s.snapshots).length > 0 ? { ...s.snapshots } : {});
          const existingUserWatched = prevUserWatched[userId] ?? {};

          return {
            currentUserId: userId,
            myList: existingUserList,
            snapshots: existingUserSnapshots,
            userLists: {
              ...(s.userLists ?? {}),
              [userId]: existingUserList,
            },
            userSnapshots: {
              ...(s.userSnapshots ?? {}),
              [userId]: existingUserSnapshots,
            },
            userWatchedEpisodes: prevUserWatched,
            watchedEpisodes: existingUserWatched,
          };
        });

        // Dispara sincronização autoritativa com o servidor para o usuário logado
        if (userId && typeof window !== "undefined") {
          void syncAuthenticatedWatchedEpisodes(userId);
        }
      },

      upsertAnime: (anime) =>
        set((s) => {
          const idx = s.animes.findIndex((a) => a.id === anime.id);

          if (idx === -1) {
            return {
              animes: [anime, ...s.animes],
            };
          }

          const next = s.animes.slice();
          next[idx] = {
            ...next[idx],
            ...anime,
            id: next[idx].id,
          };

          return {
            animes: next,
          };
        }),

      removeAnime: (id) =>
        set((s) => {
          const watchedEpisodes = {
            ...s.watchedEpisodes,
          };

          delete watchedEpisodes[id];

          return {
            animes: s.animes.filter((a) => a.id !== id),
            myList: s.myList.filter((x) => x !== id),
            continueWatching: s.continueWatching.filter((c) => c.animeId !== id),
            watchedEpisodes,
          };
        }),

      toggleHidden: (id) =>
        set((s) => ({
          animes: s.animes.map((a) =>
            a.id === id
              ? {
                  ...a,
                  hidden: !a.hidden,
                }
              : a,
          ),
        })),

      importAll: (animes) =>
        set({
          animes,
        }),

      isInList: (id, userId) => {
        const activeUserId = userId ?? get().currentUserId;
        if (!activeUserId) return false;
        const list = get().userLists?.[activeUserId] ?? get().myList;
        return list.includes(id);
      },

      toggleList: (anime, userId) => {
        const activeUserId = userId ?? get().currentUserId;
        if (!activeUserId) {
          console.warn(
            "[Hikari] Operação de gravação bloqueada: Minha Lista é exclusiva para usuários autenticados.",
          );
          return;
        }

        set((s) => {
          const currentList =
            s.userLists?.[activeUserId] ?? (s.myList.length > 0 ? [...s.myList] : []);
          const currentSnapshots =
            s.userSnapshots?.[activeUserId] ??
            (Object.keys(s.snapshots).length > 0 ? { ...s.snapshots } : {});

          const on = currentList.includes(anime.id);
          const nextList = on
            ? currentList.filter((x) => x !== anime.id)
            : [anime.id, ...currentList];

          const nextSnapshots = {
            ...currentSnapshots,
          };

          if (on) {
            delete nextSnapshots[anime.id];
          } else {
            nextSnapshots[anime.id] = anime;
          }

          return {
            userLists: {
              ...(s.userLists ?? {}),
              [activeUserId]: nextList,
            },
            userSnapshots: {
              ...(s.userSnapshots ?? {}),
              [activeUserId]: nextSnapshots,
            },
            myList: nextList,
            snapshots: nextSnapshots,
          };
        });
      },

      markContinue: (entry) =>
        set((s) => {
          const currentWatched = s.watchedEpisodes[entry.animeId] ?? [];
          const alreadyWatched = currentWatched.includes(entry.episodeId);

          let nextWatched = currentWatched;
          if (!alreadyWatched) {
            const updated = [...currentWatched, entry.episodeId];
            nextWatched =
              updated.length > MAX_WATCHED_PER_ANIME
                ? updated.slice(updated.length - MAX_WATCHED_PER_ANIME)
                : updated;
          }

          const watchedEpisodes = alreadyWatched
            ? s.watchedEpisodes
            : {
                ...s.watchedEpisodes,
                [entry.animeId]: nextWatched,
              };

          const continueWatching = [
            entry,
            ...s.continueWatching.filter((c) => c.animeId !== entry.animeId),
          ].slice(0, 12);

          if (s.currentUserId) {
            return {
              continueWatching,
              watchedEpisodes,
              userWatchedEpisodes: {
                ...(s.userWatchedEpisodes ?? {}),
                [s.currentUserId]: watchedEpisodes,
              },
            };
          } else {
            return {
              continueWatching,
              watchedEpisodes,
              anonymousWatchedEpisodes: watchedEpisodes,
            };
          }
        }),

      clearContinue: (animeId) =>
        set((s) => ({
          continueWatching: s.continueWatching.filter((c) => c.animeId !== animeId),
        })),

      markEpisodeWatched: (animeId, episodeId) =>
        set((s) => {
          const current = s.watchedEpisodes[animeId] ?? [];

          // Evita recriar watchedEpisodes se o episódio já estiver registrado
          if (current.includes(episodeId)) {
            return s;
          }

          const updated = [...current, episodeId];
          const clamped =
            updated.length > MAX_WATCHED_PER_ANIME
              ? updated.slice(updated.length - MAX_WATCHED_PER_ANIME)
              : updated;

          const nextWatched = {
            ...s.watchedEpisodes,
            [animeId]: clamped,
          };

          if (s.currentUserId) {
            return {
              watchedEpisodes: nextWatched,
              userWatchedEpisodes: {
                ...(s.userWatchedEpisodes ?? {}),
                [s.currentUserId]: nextWatched,
              },
            };
          } else {
            return {
              watchedEpisodes: nextWatched,
              anonymousWatchedEpisodes: nextWatched,
            };
          }
        }),

      isEpisodeWatched: (animeId, episodeId) => {
        const s = get();
        if (s.currentUserId) {
          // Usuário autenticado: o servidor é a fonte da verdade (cache de sessão particionado por usuário)
          const userEpisodes = s.userWatchedEpisodes?.[s.currentUserId]?.[animeId];
          if (userEpisodes) {
            return userEpisodes.includes(episodeId);
          }
          return s.watchedEpisodes[animeId]?.includes(episodeId) ?? false;
        }
        // Usuário anônimo: isolamento exclusivo no progresso local anônimo
        return (
          s.anonymousWatchedEpisodes?.[animeId]?.includes(episodeId) ??
          s.watchedEpisodes[animeId]?.includes(episodeId) ??
          false
        );
      },
    }),
    {
      name: "hikari-catalog-v1",
      version: 2,

      migrate: (persistedState: unknown, version: number) => {
        if (version < 2 && persistedState && typeof persistedState === "object") {
          const stateObj = persistedState as {
            animes?: LocalAnime[];
            state?: { animes?: LocalAnime[] };
          };
          const legacy = stateObj.state?.animes ?? stateObj.animes;
          if (Array.isArray(legacy) && legacy.length > 0) {
            scheduleSave(legacy);
          }
        }
        return persistedState as HikariState;
      },

      onRehydrateStorage: () => () => {
        // A hidratação só é concluída após carregar o catálogo do IndexedDB ou fallback
      },

      partialize: (s) => ({
        myList: s.myList,
        snapshots: slimSnapshotsRecord(s.snapshots),
        userLists: s.userLists,
        userSnapshots: slimUserSnapshotsRecord(s.userSnapshots),
        currentUserId: s.currentUserId,
        continueWatching: (s.continueWatching ?? []).slice(0, 12),
        watchedEpisodes: s.watchedEpisodes,
        anonymousWatchedEpisodes: s.anonymousWatchedEpisodes ?? {},
        userWatchedEpisodes: s.userWatchedEpisodes ?? {},
      }),
    },
  ),
);

let isSyncingUserProgress = false;

/**
 * Sincroniza o progresso assistido do usuário autenticado a partir do PostgreSQL (user_watched_episode).
 * O servidor é a fonte autoritativa de verdade para contas autenticadas.
 */
export async function syncAuthenticatedWatchedEpisodes(
  userId: string,
  animeId?: string,
): Promise<void> {
  if (typeof window === "undefined" || !userId) return;

  try {
    if (animeId) {
      const { getAnimeWatchedEpisodes } = await import("@/lib/profile-playback.functions");
      const epIds = await getAnimeWatchedEpisodes({ data: { animeId } });
      if (useHikariStore.getState().currentUserId === userId) {
        useHikariStore.setState((s) => {
          const prevUserMap = s.userWatchedEpisodes?.[userId] ?? {};
          const nextUserMap = {
            ...prevUserMap,
            [animeId]: epIds,
          };
          return {
            watchedEpisodes: {
              ...s.watchedEpisodes,
              [animeId]: epIds,
            },
            userWatchedEpisodes: {
              ...(s.userWatchedEpisodes ?? {}),
              [userId]: nextUserMap,
            },
          };
        });
      }
    } else {
      if (isSyncingUserProgress) return;
      isSyncingUserProgress = true;
      try {
        const { getUserWatchedEpisodesCatalog } = await import("@/lib/profile-playback.functions");
        const serverCatalog = await getUserWatchedEpisodesCatalog();
        if (useHikariStore.getState().currentUserId === userId) {
          useHikariStore.setState((s) => ({
            watchedEpisodes: serverCatalog,
            userWatchedEpisodes: {
              ...(s.userWatchedEpisodes ?? {}),
              [userId]: serverCatalog,
            },
          }));
        }
      } finally {
        isSyncingUserProgress = false;
      }
    }
  } catch (err) {
    console.warn("[Hikari] Falha não impeditiva ao sincronizar progresso com o servidor:", err);
  }
}

let ensureCatalogPromise: Promise<void> | null = null;

/**
 * Garante que o catálogo de animes esteja carregado no store.
 * Protegido contra execuções concorrentes ou duplicadas.
 * Remove de watchedEpisodes animes que não existem no catálogo carregado.
 */
export function ensureCatalogLoaded(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (ensureCatalogPromise) {
    return ensureCatalogPromise;
  }

  ensureCatalogPromise = (async () => {
    try {
      // 1. Tentar ler do IndexedDB (ou fallback configurado em catalog-storage)
      let animes = await loadAnimes();

      // 2. Se o IndexedDB estiver vazio, tentar migrar dados legados de hikari-catalog-v1
      if (animes.length === 0) {
        const legacy = initialLegacyCatalog ?? captureLegacyCatalogFromLocalStorage();
        if (legacy && legacy.length > 0) {
          console.log(`[Hikari] Migrando ${legacy.length} animes legados para o IndexedDB...`);
          animes = legacy;
          scheduleSave(animes);
          // Aguarda confirmação da gravação antes de finalizar
          await flushAnimes();
        }
      }

      // 3. Atualizar store Zustand em memória
      useHikariStore.setState({
        animes,
        hydrated: true,
      });

      // 4. Limpeza de progresso órfão: remover watchedEpisodes de animes que não existem
      if (animes.length > 0) {
        const validIds = new Set(animes.map((a) => a.id));
        const currentWatched = useHikariStore.getState().watchedEpisodes;
        let hasOrphan = false;
        const cleaned: Record<string, string[]> = {};

        for (const [aId, epIds] of Object.entries(currentWatched)) {
          if (validIds.has(aId)) {
            cleaned[aId] = epIds;
          } else {
            hasOrphan = true;
          }
        }

        if (hasOrphan) {
          useHikariStore.setState((s) => ({
            watchedEpisodes: cleaned,
            anonymousWatchedEpisodes: s.currentUserId
              ? s.anonymousWatchedEpisodes
              : cleaned,
            userWatchedEpisodes: s.currentUserId
              ? {
                  ...(s.userWatchedEpisodes ?? {}),
                  [s.currentUserId]: cleaned,
                }
              : s.userWatchedEpisodes,
          }));
        }
      }
    } catch (err) {
      console.warn("[Hikari] Erro ao carregar catálogo:", err);
      useHikariStore.setState({ hydrated: true });
    }
  })();

  return ensureCatalogPromise;
}

if (typeof window !== "undefined") {
  const persistApi = useHikariStore.persist;

  // Carregar catálogo após hidratação do persist ou imediatamente
  persistApi.onFinishHydration(() => {
    void ensureCatalogLoaded();
  });

  if (persistApi.hasHydrated()) {
    void ensureCatalogLoaded();
  } else {
    void ensureCatalogLoaded();
  }

  // Subscriber para mudanças na referência de state.animes
  let prevAnimes = useHikariStore.getState().animes;
  useHikariStore.subscribe((state) => {
    if (state.animes !== prevAnimes) {
      prevAnimes = state.animes;
      // Somente agenda gravação se a hidratação já tiver ocorrido
      if (state.hydrated) {
        scheduleSave(state.animes);
      }
    }
  });
}

export function overlaySlim<
  T extends {
    id: string;
    anilistId?: number;
  },
>(
  remote: T[],
  locals: LocalAnime[],
  toLocalItem: (l: LocalAnime) => T,
): T[] {
  const hiddenAnilist = new Set(
    locals
      .filter((a) => a.hidden && a.anilistId)
      .map((a) => a.anilistId as number),
  );
  const hiddenIds = new Set(
    locals.filter((a) => a.hidden).map((a) => a.id),
  );

  const isDubbed = (a: LocalAnime) =>
    /\b(dub|dublado|dublada)\b/i.test(`${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`);

  const usedLocalIds = new Set<string>();

  const mapped = remote
    .filter(
      (r) =>
        !hiddenIds.has(r.id) &&
        (!r.anilistId || !hiddenAnilist.has(r.anilistId)),
    )
    .map((r) => {
      // 1. Direct ID match
      const direct = locals.find((a) => !a.hidden && a.id === r.id);
      if (direct) {
        usedLocalIds.add(direct.id);
        return toLocalItem(direct);
      }

      // 2. AniList ID match: prefer original/non-dubbed local anime to replace the canonical remote entry
      if (r.anilistId) {
        const aniLocal =
          locals.find(
            (a) =>
              !a.hidden &&
              !usedLocalIds.has(a.id) &&
              a.anilistId === r.anilistId &&
              !isDubbed(a),
          ) ||
          locals.find(
            (a) =>
              !a.hidden &&
              !usedLocalIds.has(a.id) &&
              a.anilistId === r.anilistId,
          );

        if (aniLocal) {
          usedLocalIds.add(aniLocal.id);
          return toLocalItem(aniLocal);
        }
      }

      return r;
    });

  const remoteIds = new Set(mapped.map((m) => m.id));

  const extras = locals
    .filter(
      (a) =>
        !a.hidden &&
        !usedLocalIds.has(a.id) &&
        !remoteIds.has(a.id),
    )
    .map(toLocalItem);

  return [...extras, ...mapped];
}
