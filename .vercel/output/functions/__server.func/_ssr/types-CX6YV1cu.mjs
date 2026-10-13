import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/store-D2GT2m_p.js
var useHikariStore = create()(persist((set, get) => ({
	animes: [],
	myList: [],
	snapshots: {},
	continueWatching: [],
	watchedEpisodes: {},
	hydrated: false,
	setHydrated: (v) => set({ hydrated: v }),
	upsertAnime: (anime) => set((s) => {
		const idx = s.animes.findIndex((a) => a.id === anime.id || anime.anilistId && a.anilistId === anime.anilistId);
		if (idx === -1) return { animes: [anime, ...s.animes] };
		const next = s.animes.slice();
		next[idx] = {
			...next[idx],
			...anime,
			id: next[idx].id
		};
		return { animes: next };
	}),
	removeAnime: (id) => set((s) => {
		const watchedEpisodes = { ...s.watchedEpisodes };
		delete watchedEpisodes[id];
		return {
			animes: s.animes.filter((a) => a.id !== id),
			myList: s.myList.filter((x) => x !== id),
			continueWatching: s.continueWatching.filter((c) => c.animeId !== id),
			watchedEpisodes
		};
	}),
	toggleHidden: (id) => set((s) => ({ animes: s.animes.map((a) => a.id === id ? {
		...a,
		hidden: !a.hidden
	} : a) })),
	importAll: (animes) => set({ animes }),
	isInList: (id) => get().myList.includes(id),
	toggleList: (anime) => set((s) => {
		const on = s.myList.includes(anime.id);
		const myList = on ? s.myList.filter((x) => x !== anime.id) : [anime.id, ...s.myList];
		const snapshots = { ...s.snapshots };
		if (on) delete snapshots[anime.id];
		else snapshots[anime.id] = anime;
		return {
			myList,
			snapshots
		};
	}),
	markContinue: (entry) => set((s) => {
		const currentWatched = s.watchedEpisodes[entry.animeId] ?? [];
		const alreadyWatched = currentWatched.includes(entry.episodeId);
		const watchedEpisodes = {
			...s.watchedEpisodes,
			[entry.animeId]: alreadyWatched ? currentWatched : [...currentWatched, entry.episodeId]
		};
		return {
			continueWatching: [entry, ...s.continueWatching.filter((c) => c.animeId !== entry.animeId)].slice(0, 12),
			watchedEpisodes
		};
	}),
	clearContinue: (animeId) => set((s) => ({ continueWatching: s.continueWatching.filter((c) => c.animeId !== animeId) })),
	markEpisodeWatched: (animeId, episodeId) => set((s) => {
		const current = s.watchedEpisodes[animeId] ?? [];
		if (current.includes(episodeId)) return s;
		return { watchedEpisodes: {
			...s.watchedEpisodes,
			[animeId]: [...current, episodeId]
		} };
	}),
	isEpisodeWatched: (animeId, episodeId) => {
		return get().watchedEpisodes[animeId]?.includes(episodeId) ?? false;
	}
}), {
	name: "hikari-catalog-v1",
	onRehydrateStorage: () => (state) => {
		state?.setHydrated(true);
	},
	partialize: (s) => ({
		animes: s.animes,
		myList: s.myList,
		snapshots: s.snapshots,
		continueWatching: s.continueWatching,
		watchedEpisodes: s.watchedEpisodes
	})
}));
if (typeof window !== "undefined") {
	const persistApi = useHikariStore.persist;
	persistApi.onFinishHydration(() => {
		useHikariStore.getState().setHydrated(true);
	});
	if (persistApi.hasHydrated()) useHikariStore.getState().setHydrated(true);
}
function overlaySlim(remote, locals, toLocalItem) {
	const hiddenAnilist = new Set(locals.filter((a) => a.hidden && a.anilistId).map((a) => a.anilistId));
	const override = /* @__PURE__ */ new Map();
	for (const a of locals) if (a.anilistId && !a.hidden) override.set(a.anilistId, a);
	const mapped = remote.filter((r) => !r.anilistId || !hiddenAnilist.has(r.anilistId)).map((r) => {
		if (r.anilistId && override.has(r.anilistId)) return toLocalItem(override.get(r.anilistId));
		return r;
	});
	const remoteIds = new Set(mapped.map((m) => m.id));
	return [...locals.filter((a) => !a.hidden && !a.anilistId && !remoteIds.has(a.id)).map(toLocalItem), ...mapped];
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/types-CX6YV1cu.js
function displayTitle(a) {
	return a.titles.english || a.titles.romaji || a.titles.native || "Sem título";
}
function localToAnime(local) {
	return {
		id: local.id,
		anilistId: local.anilistId,
		malId: local.malId,
		titles: {
			romaji: local.titleRomaji,
			english: local.titleEnglish,
			native: local.titleNative
		},
		cover: local.cover,
		banner: local.banner,
		synopsis: local.synopsis,
		score: local.score,
		genres: local.genres,
		format: local.format,
		status: local.status,
		episodesCount: local.episodesCount,
		season: local.season,
		year: local.year,
		trailerId: local.trailerId,
		source: "local",
		studios: [],
		streamingEpisodes: [],
		seasons: local.seasons,
		recommendations: []
	};
}
function animeToLocal(anime, existing) {
	const now = Date.now();
	return {
		id: existing?.id ?? (anime.source === "local" ? anime.id : `local-${crypto.randomUUID()}`),
		anilistId: anime.anilistId,
		malId: anime.malId,
		titleRomaji: anime.titles.romaji,
		titleEnglish: anime.titles.english,
		titleNative: anime.titles.native,
		cover: anime.cover,
		banner: anime.banner,
		synopsis: anime.synopsis,
		score: anime.score,
		genres: anime.genres,
		format: anime.format,
		status: anime.status,
		episodesCount: anime.episodesCount,
		season: anime.season,
		year: anime.year,
		trailerId: anime.trailerId,
		hidden: existing?.hidden ?? false,
		seasons: existing?.seasons ?? ("seasons" in anime ? anime.seasons : []),
		createdAt: existing?.createdAt ?? now,
		updatedAt: now
	};
}
//#endregion
export { useHikariStore as a, overlaySlim as i, displayTitle as n, localToAnime as r, animeToLocal as t };
