import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LocalAnime, SlimAnime } from "@/lib/types";

export type ContinueWatch = {
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  cover: string;
  title: string;
  updatedAt: number;
};

type HikariState = {
  animes: LocalAnime[];
  myList: string[];
  snapshots: Record<string, SlimAnime>;
  userLists: Record<string, string[]>;
  userSnapshots: Record<string, Record<string, SlimAnime>>;
  currentUserId: string | null;
  continueWatching: ContinueWatch[];

  /**
   * Episódios que o usuário já abriu/assistiu.
   *
   * Chave:
   *   animeId
   *
   * Valor:
   *   lista de episodeId
   */
  watchedEpisodes: Record<string, string[]>;

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
  markEpisodeWatched: (
    animeId: string,
    episodeId: string,
  ) => void;

  /**
   * Verifica se um episódio foi assistido.
   */
  isEpisodeWatched: (
    animeId: string,
    episodeId: string,
  ) => boolean;
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
      hydrated: false,

      setHydrated: (v) => set({ hydrated: v }),

      setCurrentUserId: (userId) =>
        set((s) => {
          if (!userId) {
            return {
              currentUserId: null,
              myList: [],
              snapshots: {},
            };
          }

          // Recupera lista do usuário ou migra a lista existente (preservando dados)
          const existingUserList =
            s.userLists?.[userId] ?? (s.myList.length > 0 ? [...s.myList] : []);
          const existingUserSnapshots =
            s.userSnapshots?.[userId] ??
            (Object.keys(s.snapshots).length > 0 ? { ...s.snapshots } : {});

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
          };
        }),

      upsertAnime: (anime) =>
        set((s) => {
          const idx = s.animes.findIndex(
            (a) => a.id === anime.id,
          );

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
            animes: s.animes.filter(
              (a) => a.id !== id,
            ),

            myList: s.myList.filter(
              (x) => x !== id,
            ),

            continueWatching:
              s.continueWatching.filter(
                (c) => c.animeId !== id,
              ),

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
        // REGRA OBRIGATÓRIA 5: Proteção da operação de gravação
        // Visitantes sem sessão iniciada não conseguem adicionar ou remover animes
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
          const currentWatched =
            s.watchedEpisodes[
              entry.animeId
            ] ?? [];

          const alreadyWatched =
            currentWatched.includes(
              entry.episodeId,
            );

          const watchedEpisodes = {
            ...s.watchedEpisodes,
            [entry.animeId]:
              alreadyWatched
                ? currentWatched
                : [
                    ...currentWatched,
                    entry.episodeId,
                  ],
          };

          return {
            continueWatching: [
              entry,
              ...s.continueWatching.filter(
                (c) =>
                  c.animeId !==
                  entry.animeId,
              ),
            ].slice(0, 12),

            watchedEpisodes,
          };
        }),

      clearContinue: (animeId) =>
        set((s) => ({
          continueWatching:
            s.continueWatching.filter(
              (c) => c.animeId !== animeId,
            ),
        })),

      markEpisodeWatched: (
        animeId,
        episodeId,
      ) =>
        set((s) => {
          const current =
            s.watchedEpisodes[animeId] ??
            [];

          if (current.includes(episodeId)) {
            return s;
          }

          return {
            watchedEpisodes: {
              ...s.watchedEpisodes,
              [animeId]: [
                ...current,
                episodeId,
              ],
            },
          };
        }),

      isEpisodeWatched: (
        animeId,
        episodeId,
      ) => {
        if (!get().currentUserId) return false;
        return (
          get().watchedEpisodes[
            animeId
          ]?.includes(episodeId) ??
          false
        );
      },
    }),
    {
      name: "hikari-catalog-v1",

      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },

      partialize: (s) => ({
        animes: s.animes,
        myList: s.myList,
        snapshots: s.snapshots,
        userLists: s.userLists,
        userSnapshots: s.userSnapshots,
        currentUserId: s.currentUserId,
        continueWatching:
          s.continueWatching,
        watchedEpisodes:
          s.watchedEpisodes,
      }),
    },
  ),
);

if (typeof window !== "undefined") {
  const persistApi =
    useHikariStore.persist;

  persistApi.onFinishHydration(() => {
    useHikariStore
      .getState()
      .setHydrated(true);
  });

  if (persistApi.hasHydrated()) {
    useHikariStore
      .getState()
      .setHydrated(true);
  }
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
