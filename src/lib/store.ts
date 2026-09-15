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
  continueWatching: ContinueWatch[];
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  upsertAnime: (anime: LocalAnime) => void;
  removeAnime: (id: string) => void;
  toggleHidden: (id: string) => void;
  importAll: (animes: LocalAnime[]) => void;
  isInList: (id: string) => boolean;
  toggleList: (anime: SlimAnime) => void;
  markContinue: (entry: ContinueWatch) => void;
  clearContinue: (animeId: string) => void;
};

export const useHikariStore = create<HikariState>()(
  persist(
    (set, get) => ({
      animes: [],
      myList: [],
      snapshots: {},
      continueWatching: [],
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      upsertAnime: (anime) =>
        set((s) => {
          const idx = s.animes.findIndex(
            (a) => a.id === anime.id || (anime.anilistId && a.anilistId === anime.anilistId),
          );
          if (idx === -1) return { animes: [anime, ...s.animes] };
          const next = s.animes.slice();
          next[idx] = { ...next[idx], ...anime, id: next[idx].id };
          return { animes: next };
        }),
      removeAnime: (id) =>
        set((s) => ({
          animes: s.animes.filter((a) => a.id !== id),
          myList: s.myList.filter((x) => x !== id),
          continueWatching: s.continueWatching.filter((c) => c.animeId !== id),
        })),
      toggleHidden: (id) =>
        set((s) => ({
          animes: s.animes.map((a) => (a.id === id ? { ...a, hidden: !a.hidden } : a)),
        })),
      importAll: (animes) => set({ animes }),
      isInList: (id) => get().myList.includes(id),
      toggleList: (anime) =>
        set((s) => {
          const on = s.myList.includes(anime.id);
          const myList = on ? s.myList.filter((x) => x !== anime.id) : [anime.id, ...s.myList];
          const snapshots = { ...s.snapshots };
          if (on) delete snapshots[anime.id];
          else snapshots[anime.id] = anime;
          return { myList, snapshots };
        }),
      markContinue: (entry) =>
        set((s) => ({
          continueWatching: [
            entry,
            ...s.continueWatching.filter((c) => c.animeId !== entry.animeId),
          ].slice(0, 12),
        })),
      clearContinue: (animeId) =>
        set((s) => ({
          continueWatching: s.continueWatching.filter((c) => c.animeId !== animeId),
        })),
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
        continueWatching: s.continueWatching,
      }),
    },
  ),
);

if (typeof window !== "undefined") {
  const persistApi = useHikariStore.persist;
  persistApi.onFinishHydration(() => {
    useHikariStore.getState().setHydrated(true);
  });
  if (persistApi.hasHydrated()) {
    useHikariStore.getState().setHydrated(true);
  }
}

export function overlaySlim<T extends { id: string; anilistId?: number }>(
  remote: T[],
  locals: LocalAnime[],
  toLocalItem: (l: LocalAnime) => T,
): T[] {
  const hiddenAnilist = new Set(
    locals.filter((a) => a.hidden && a.anilistId).map((a) => a.anilistId as number),
  );
  const override = new Map<number, LocalAnime>();
  for (const a of locals) {
    if (a.anilistId && !a.hidden) override.set(a.anilistId, a);
  }
  const mapped = remote
    .filter((r) => !r.anilistId || !hiddenAnilist.has(r.anilistId))
    .map((r) => {
      if (r.anilistId && override.has(r.anilistId)) return toLocalItem(override.get(r.anilistId)!);
      return r;
    });
  const remoteIds = new Set(mapped.map((m) => m.id));
  const extras = locals
    .filter((a) => !a.hidden && !a.anilistId && !remoteIds.has(a.id))
    .map(toLocalItem);
  return [...extras, ...mapped];
}
