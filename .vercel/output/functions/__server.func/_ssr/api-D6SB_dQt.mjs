import { i as createServerFn } from "./ssr.mjs";
import { Dt as boolean, Ft as string, Mt as object, jt as number, wt as _enum } from "../_libs/@better-auth/core+[...].mjs";
import { a as youtubeIdFrom, i as stripHtml, n as currentAnimeSeason } from "./utils-Cws_m9jY.mjs";
import { l as seasonLabel } from "./labels-BsexCKFj.mjs";
import { t as createServerRpc } from "./createServerRpc--phiu8Av.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-D6SB_dQt.js
var ANILIST = "https://graphql.anilist.co";
var JIKAN = "https://api.jikan.moe/v4";
var CARD_FIELDS = `
  id
  idMal
  isAdult
  tags {
    name
    category
    rank
    isAdult
  }
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    color
  }
  bannerImage
  averageScore
  genres
  format
  status
  episodes
  season
  seasonYear
  description(asHtml: false)
  trailer {
    id
    site
    thumbnail
  }
`;
var cache = /* @__PURE__ */ new Map();
var TTL = 3e5;
function fromCache(key) {
	const hit = cache.get(key);
	if (!hit) return null;
	if (Date.now() - hit.at > TTL) {
		cache.delete(key);
		return null;
	}
	return hit.data;
}
function toCache(key, data) {
	cache.set(key, {
		at: Date.now(),
		data
	});
	return data;
}
async function anilistGraphQL(query, variables) {
	let lastError;
	for (let attempt = 0; attempt < 3; attempt++) try {
		const res = await fetch(ANILIST, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify({
				query,
				variables
			}),
			signal: AbortSignal.timeout(12e3)
		});
		if (!res.ok) {
			if ((res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) && attempt < 2) {
				const retryAfter = Number(res.headers.get("Retry-After"));
				const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1e3, 1e4) : 1200 * (attempt + 1);
				await new Promise((resolve) => setTimeout(resolve, waitMs));
				continue;
			}
			throw new Error(`AniList indisponível (${res.status})`);
		}
		const json = await res.json();
		if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "AniList error");
		if (!json.data) throw new Error("AniList sem dados");
		return json.data;
	} catch (error) {
		lastError = error;
		if (attempt < 2) {
			await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
			continue;
		}
		throw error;
	}
	throw lastError instanceof Error ? lastError : /* @__PURE__ */ new Error("AniList indisponível");
}
async function jikanFetch(path, attempt = 0) {
	const res = await fetch(`${JIKAN}${path}`, {
		headers: {
			Accept: "application/json",
			"User-Agent": "Hikari/1.0 (anime catalog)"
		},
		signal: AbortSignal.timeout(12e3)
	});
	if ((res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) && attempt < 2) {
		await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
		return jikanFetch(path, attempt + 1);
	}
	if (!res.ok) throw new Error(`MyAnimeList indisponível (${res.status})`);
	return await res.json();
}
function isAdultAnime(media) {
	return media.isAdult === true;
}
function isHentaiAnime(media) {
	return media.isAdult === true && (media.genres ?? []).some((genre) => genre.trim().toLowerCase() === "hentai");
}
function trailerFromAni(media) {
	const trailer = media.trailer;
	if (!trailer?.id) return null;
	if ((trailer.site ?? "youtube").toLowerCase() === "youtube") return trailer.id;
	return youtubeIdFrom(trailer.id);
}
function mapAniSlim(media) {
	return {
		id: String(media.id),
		anilistId: media.id,
		malId: media.idMal ?? void 0,
		titles: {
			romaji: media.title?.romaji ?? "",
			english: media.title?.english ?? "",
			native: media.title?.native ?? ""
		},
		cover: media.coverImage?.extraLarge || media.coverImage?.large || "",
		banner: media.bannerImage || "",
		synopsis: stripHtml(media.description),
		score: media.averageScore ?? null,
		genres: media.genres ?? [],
		format: media.format ?? "",
		status: media.status ?? "",
		episodesCount: media.episodes ?? null,
		season: media.season ?? null,
		year: media.seasonYear ?? null,
		trailerId: trailerFromAni(media),
		color: media.coverImage?.color ?? void 0,
		source: "anilist"
	};
}
function jikanStatus(status) {
	const value = (status ?? "").toLowerCase();
	if (value.includes("air")) return "RELEASING";
	if (value.includes("finish") || value.includes("complete")) return "FINISHED";
	if (value.includes("not yet") || value.includes("upcoming")) return "NOT_YET_RELEASED";
	if (value.includes("hiatus")) return "HIATUS";
	return status?.toUpperCase().replace(/\s+/g, "_") ?? "";
}
function jikanFormat(type) {
	const value = (type ?? "").toUpperCase();
	if (value === "TV") return "TV";
	if (value === "MOVIE") return "MOVIE";
	if (value === "OVA") return "OVA";
	if (value === "ONA") return "ONA";
	if (value === "SPECIAL") return "SPECIAL";
	if (value === "MUSIC") return "MUSIC";
	return value;
}
function mapJikanSlim(anime) {
	return {
		id: `mal-${anime.mal_id}`,
		malId: anime.mal_id,
		titles: {
			romaji: anime.title ?? "",
			english: anime.title_english ?? "",
			native: anime.title_japanese ?? ""
		},
		cover: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "",
		banner: anime.trailer?.images?.maximum_image_url || "",
		synopsis: stripHtml(anime.synopsis),
		score: anime.score != null ? Math.round(anime.score * 10) : null,
		genres: (anime.genres ?? []).map((genre) => genre.name),
		format: jikanFormat(anime.type),
		status: jikanStatus(anime.status),
		episodesCount: anime.episodes ?? null,
		season: anime.season ? anime.season.toUpperCase() : null,
		year: anime.year ?? null,
		trailerId: anime.trailer?.youtube_id ?? null,
		source: "jikan"
	};
}
async function jikanEpisodes(malId) {
	const episodes = [];
	let page = 1;
	let hasNext = true;
	while (hasNext && page <= 8) {
		const json = await jikanFetch(`/anime/${malId}/episodes?page=${page}`);
		for (const episode of json.data ?? []) episodes.push({
			id: `mal-ep-${malId}-${episode.mal_id}`,
			number: episode.mal_id,
			title: episode.title || episode.title_japanese || `Episódio ${episode.mal_id}`,
			aired: episode.aired ?? void 0
		});
		hasNext = Boolean(json.pagination?.has_next_page);
		page += 1;
	}
	if (!episodes.length) return [];
	return [{
		id: `mal-s1-${malId}`,
		number: 1,
		title: "Temporada 1",
		episodes
	}];
}
function streamingFromAni(media) {
	return (media.streamingEpisodes ?? []).filter((episode) => Boolean(episode.url)).map((episode) => ({
		title: episode.title ?? "Episódio",
		thumbnail: episode.thumbnail ?? "",
		url: episode.url ?? "",
		site: episode.site ?? ""
	}));
}
async function fetchAniMediaByMalId(malId) {
	return (await anilistGraphQL(`
      query MediaByMalId($malId: Int) {
        Media(
          idMal: $malId,
          type: ANIME
        ) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          relations {
            edges {
              relationType
              node {
                id
                title {
                  romaji
                  english
                }
              }
            }
          }
        }
      }
      `, { malId })).Media;
}
async function buildSeasonNavigation(media) {
	const current = {
		id: String(media.id),
		title: media.title?.english ?? media.title?.romaji ?? void 0
	};
	const findRelation = (source, type) => (source.relations?.edges ?? []).find((relation) => relation.relationType === type && Boolean(relation.node?.id))?.node;
	const fetchRelations = async (id) => {
		return (await anilistGraphQL(`
        query SeasonRelations($id: Int) {
          Media(id: $id, type: ANIME) {
            relations {
              edges {
                relationType
                node {
                  id
                  title {
                    romaji
                    english
                  }
                }
              }
            }
          }
        }
        `, { id })).Media?.relations;
	};
	const previous = [];
	const next = [];
	const visited = /* @__PURE__ */ new Set([current.id]);
	let cursor = findRelation(media, "PREQUEL");
	let steps = 0;
	while (cursor?.id && steps < 10) {
		const item = {
			id: String(cursor.id),
			title: cursor.title?.english ?? cursor.title?.romaji ?? void 0
		};
		if (visited.has(item.id)) break;
		visited.add(item.id);
		previous.unshift(item);
		steps++;
		const relations = await fetchRelations(cursor.id);
		cursor = relations ? (relations.edges ?? []).find((relation) => relation.relationType === "PREQUEL" && Boolean(relation.node?.id))?.node : void 0;
	}
	cursor = findRelation(media, "SEQUEL");
	steps = 0;
	while (cursor?.id && steps < 10) {
		const item = {
			id: String(cursor.id),
			title: cursor.title?.english ?? cursor.title?.romaji ?? void 0
		};
		if (visited.has(item.id)) break;
		visited.add(item.id);
		next.push(item);
		steps++;
		const relations = await fetchRelations(cursor.id);
		cursor = relations ? (relations.edges ?? []).find((relation) => relation.relationType === "SEQUEL" && Boolean(relation.node?.id))?.node : void 0;
	}
	return {
		items: [
			...previous,
			current,
			...next
		],
		previous: previous.at(-1),
		next: next[0]
	};
}
function mapAniFull(media, seasons, seasonNavigation) {
	const slim = mapAniSlim(media);
	const relations = media.relations?.edges ?? [];
	const previousRelation = relations.find((relation) => relation.relationType === "PREQUEL");
	const nextRelation = relations.find((relation) => relation.relationType === "SEQUEL");
	return {
		...slim,
		duration: media.duration ?? null,
		studios: (media.studios?.nodes ?? []).map((studio) => studio.name),
		nextEpisode: media.nextAiringEpisode ?? void 0,
		streamingEpisodes: streamingFromAni(media),
		seasons,
		seasonNavigation: seasonNavigation ?? {
			items: [{
				id: String(media.id),
				title: media.title?.english ?? media.title?.romaji ?? void 0
			}],
			previous: previousRelation?.node?.id ? {
				id: String(previousRelation.node.id),
				title: previousRelation.node.title?.english ?? previousRelation.node.title?.romaji ?? void 0
			} : void 0,
			next: nextRelation?.node?.id ? {
				id: String(nextRelation.node.id),
				title: nextRelation.node.title?.english ?? nextRelation.node.title?.romaji ?? void 0
			} : void 0
		},
		recommendations: (media.recommendations?.nodes ?? []).map((node) => node.mediaRecommendation).filter((item) => Boolean(item?.id)).slice(0, 12).map(mapAniSlim)
	};
}
async function fetchRecentAdultReleasesFromAni() {
	const now = Math.floor(Date.now() / 1e3);
	const recentWindow = now - 7776e3;
	const seen = /* @__PURE__ */ new Set();
	const releases = [];
	for (let page = 1; page <= 10 && releases.length < 18; page++) {
		const data = await anilistGraphQL(`
        query RecentAdultReleases(
          $airingAtGreater: Int,
          $airingAtLesser: Int,
          $page: Int!
        ) {
          Page(
            page: $page,
            perPage: 30
          ) {
            airingSchedules(
              airingAt_greater: $airingAtGreater,
              airingAt_lesser: $airingAtLesser,
              sort: TIME_DESC
            ) {
              airingAt
              episode
              media {
                ${CARD_FIELDS}
              }
            }
          }
        }
        `, {
			airingAtGreater: recentWindow,
			airingAtLesser: now,
			page
		});
		for (const item of data.Page.airingSchedules ?? []) {
			const media = item.media;
			if (!media?.id) continue;
			if (!isHentaiAnime(media)) continue;
			if (seen.has(media.id)) continue;
			seen.add(media.id);
			releases.push(mapAniSlim(media));
			if (releases.length >= 18) break;
		}
	}
	return releases;
}
async function fetchRecentReleasesFromAni() {
	const now = Math.floor(Date.now() / 1e3);
	const weekAgo = now - 604800;
	const data = await anilistGraphQL(`
      query RecentReleases(
        $airingAtGreater: Int,
        $airingAtLesser: Int
      ) {
        Page(
          page: 1,
          perPage: 30
        ) {
          airingSchedules(
            airingAt_greater: $airingAtGreater,
            airingAt_lesser: $airingAtLesser,
            sort: TIME_DESC
          ) {
            airingAt
            episode
            media {
              ${CARD_FIELDS}
            }
          }
        }
      }
      `, {
		airingAtGreater: weekAgo,
		airingAtLesser: now
	});
	const seen = /* @__PURE__ */ new Set();
	const releases = [];
	for (const item of data.Page.airingSchedules ?? []) {
		const media = item.media;
		if (!media?.id) continue;
		if (isAdultAnime(media)) continue;
		if (seen.has(media.id)) continue;
		seen.add(media.id);
		releases.push(mapAniSlim(media));
		if (releases.length >= 18) break;
	}
	return releases;
}
async function fetchHomeFromAni() {
	const { season, year } = currentAnimeSeason();
	const data = await anilistGraphQL(`
      query Home(
        $season: MediaSeason,
        $year: Int
      ) {
        trending: Page(
          page: 1,
          perPage: 18
        ) {
          media(
            type: ANIME,
            sort: TRENDING_DESC
          ) {
            ${CARD_FIELDS}
          }
        }

        popular: Page(
          page: 1,
          perPage: 18
        ) {
          media(
            type: ANIME,
            sort: POPULARITY_DESC
          ) {
            ${CARD_FIELDS}
          }
        }

        top: Page(
          page: 1,
          perPage: 18
        ) {
          media(
            type: ANIME,
            sort: SCORE_DESC
          ) {
            ${CARD_FIELDS}
          }
        }

        season: Page(
          page: 1,
          perPage: 18
        ) {
          media(
            type: ANIME,
            season: $season,
            seasonYear: $year,
            sort: POPULARITY_DESC
          ) {
            ${CARD_FIELDS}
          }
        }

        genres: GenreCollection
      }
      `, {
		season,
		year
	});
	const releases = await fetchRecentReleasesFromAni();
	const trending = (data.trending.media ?? []).filter((anime) => !isAdultAnime(anime));
	const popular = (data.popular.media ?? []).filter((anime) => !isAdultAnime(anime));
	const top = (data.top.media ?? []).filter((anime) => !isAdultAnime(anime));
	const seasonItems = (data.season.media ?? []).filter((anime) => !isAdultAnime(anime));
	return {
		trending: trending.map(mapAniSlim),
		popular: popular.map(mapAniSlim),
		top: top.map(mapAniSlim),
		season: seasonItems.map(mapAniSlim),
		releases,
		seasonName: seasonLabel(season),
		seasonYear: year,
		source: "anilist",
		genres: (data.genres ?? []).filter((genre) => genre && genre !== "Hentai")
	};
}
async function fetchHomeFromJikan() {
	const { season, year } = currentAnimeSeason();
	const [now, top, popular] = await Promise.all([
		jikanFetch("/seasons/now?limit=18"),
		jikanFetch("/top/anime?filter=bypopularity&limit=18"),
		jikanFetch("/top/anime?limit=18")
	]);
	const seasonItems = (now.data ?? []).map(mapJikanSlim);
	return {
		trending: seasonItems,
		popular: (top.data ?? []).map(mapJikanSlim),
		top: (popular.data ?? []).map(mapJikanSlim),
		season: seasonItems,
		releases: seasonItems.slice(0, 18),
		seasonName: seasonLabel(season),
		seasonYear: year,
		source: "jikan",
		genres: [
			"Action",
			"Adventure",
			"Comedy",
			"Drama",
			"Fantasy",
			"Horror",
			"Mecha",
			"Mystery",
			"Romance",
			"Sci-Fi",
			"Slice of Life",
			"Sports",
			"Supernatural",
			"Thriller"
		]
	};
}
var fetchHomeCatalog_createServerFn_handler = createServerRpc({
	id: "d3b9b89920391ed81aae2521622fa9c80548287d9302fbe6eeae13a8f28bf360",
	name: "fetchHomeCatalog",
	filename: "src/lib/api.ts"
}, (opts) => fetchHomeCatalog.__executeServer(opts));
var fetchHomeCatalog = createServerFn({ method: "GET" }).handler(fetchHomeCatalog_createServerFn_handler, async () => {
	const key = "home";
	const cached = fromCache(key);
	if (cached) return cached;
	try {
		return toCache(key, await fetchHomeFromAni());
	} catch {
		return toCache(key, await fetchHomeFromJikan());
	}
});
var searchSchema = object({
	q: string().optional(),
	genre: string().optional(),
	year: string().optional(),
	format: string().optional(),
	status: string().optional(),
	sort: string().optional(),
	page: number().optional(),
	adult: boolean().optional()
});
function normalizeSearchText(value) {
	return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}
function searchDistance(a, b) {
	if (a === b) return 0;
	if (!a) return b.length;
	if (!b) return a.length;
	const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i += 1) {
		let diagonal = previous[0];
		previous[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const above = previous[j];
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
			diagonal = above;
		}
	}
	return previous[b.length];
}
function searchScore(anime, query) {
	const q = normalizeSearchText(query);
	if (!q) return 0;
	const titles = [
		anime.titles.romaji,
		anime.titles.english,
		anime.titles.native
	].filter(Boolean).map(normalizeSearchText);
	const compactQuery = q.replace(/\s/g, "");
	const queryWords = q.split(" ").filter(Boolean);
	let score = 0;
	for (const title of titles) {
		const compactTitle = title.replace(/\s/g, "");
		const titleWords = title.split(" ").filter(Boolean);
		if (title === q) {
			score = Math.max(score, 1200);
			continue;
		}
		if (title.startsWith(q)) score = Math.max(score, 1100);
		if (compactTitle.startsWith(compactQuery)) score = Math.max(score, 1050);
		if (title.includes(q)) score = Math.max(score, 950);
		if (compactTitle.includes(compactQuery)) score = Math.max(score, 900);
		if (queryWords.every((queryWord) => titleWords.some((titleWord) => titleWord.startsWith(queryWord)))) score = Math.max(score, 1e3);
		if (compactQuery.length >= 4) {
			if (titleWords.some((titleWord) => {
				if (titleWord.length < compactQuery.length - 1) return false;
				const sample = titleWord.slice(0, compactQuery.length);
				return searchDistance(compactQuery, sample) <= (compactQuery.length >= 7 ? 2 : 1);
			})) score = Math.max(score, 820);
		}
		if (compactQuery.length >= 4) {
			let queryIndex = 0;
			for (const character of compactTitle) if (character === compactQuery[queryIndex]) {
				queryIndex += 1;
				if (queryIndex === compactQuery.length) break;
			}
			if (queryIndex === compactQuery.length) score = Math.max(score, 650);
		}
	}
	return score;
}
function rankSearchResults(items, query) {
	if (!query?.trim()) return items;
	return [...items].map((anime, index) => ({
		anime,
		relevance: searchScore(anime, query),
		rating: anime.score ?? -1,
		index
	})).sort((a, b) => b.relevance - a.relevance || b.rating - a.rating || a.index - b.index).map((item) => item.anime);
}
function mergeSearchItems(first, second) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const anime of [...first, ...second]) {
		const key = anime.anilistId ? `ani-${anime.anilistId}` : anime.malId ? `mal-${anime.malId}` : anime.id;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(anime);
	}
	return result;
}
async function searchAni(params) {
	const page = params.page ?? 1;
	const sort = params.sort || (params.q ? "SEARCH_MATCH" : "TRENDING_DESC");
	const year = params.year ? Number(params.year) : void 0;
	const data = await anilistGraphQL(`
      query Search(
        $page: Int,
        $search: String,
        $genre: String,
        $year: Int,
        $format: MediaFormat,
        $status: MediaStatus,
        $sort: [MediaSort],
        $isAdult: Boolean
      ) {
        Page(
          page: $page,
          perPage: 24
        ) {
          pageInfo {
            hasNextPage
          }

          media(
            type: ANIME,
            search: $search,
            genre: $genre,
            seasonYear: $year,
            format: $format,
            status: $status,
            sort: $sort,
            isAdult: $isAdult
          ) {
            ${CARD_FIELDS}
          }
        }
      }
      `, {
		page,
		search: params.q || void 0,
		genre: params.adult ? "Hentai" : params.genre || void 0,
		year: year && Number.isFinite(year) ? year : void 0,
		format: params.format || void 0,
		status: params.status || void 0,
		sort: [sort],
		isAdult: Boolean(params.adult)
	});
	return {
		items: rankSearchResults((data.Page.media ?? []).filter((anime) => params.adult ? isHentaiAnime(anime) : !isAdultAnime(anime)).map(mapAniSlim), params.q),
		page,
		hasNext: Boolean(data.Page.pageInfo?.hasNextPage),
		source: "anilist"
	};
}
async function searchJikan(params) {
	const page = params.page ?? 1;
	if (params.adult) return {
		items: [],
		page,
		hasNext: false,
		source: "jikan"
	};
	const query = new URLSearchParams();
	if (params.q) query.set("q", params.q);
	query.set("page", String(page));
	query.set("limit", "24");
	query.set("sfw", "true");
	if (params.genre) query.set("genres", params.genre);
	const json = await jikanFetch(`/anime?${query.toString()}`);
	return {
		items: rankSearchResults((json.data ?? []).map(mapJikanSlim), params.q),
		page,
		hasNext: Boolean(json.pagination?.has_next_page),
		source: "jikan"
	};
}
async function searchRelaxed(params) {
	const original = params.q?.trim() ?? "";
	const normalized = normalizeSearchText(original);
	if (normalized.length < 2) return [];
	const compact = normalized.replace(/\s/g, "");
	const variants = /* @__PURE__ */ new Set();
	variants.add(original);
	variants.add(normalized);
	if (compact && compact !== normalized) variants.add(compact);
	if (compact.length >= 4) variants.add(compact.slice(0, -1));
	if (compact.length >= 6) variants.add(compact.slice(0, -2));
	const attempts = [...variants].filter((value) => value.trim().length >= 3).map(async (variant) => {
		const searchParams = {
			...params,
			q: variant,
			page: 1
		};
		const results = await Promise.allSettled([searchAni(searchParams), searchJikan(searchParams)]);
		return rankSearchResults(mergeSearchItems(results[0].status === "fulfilled" ? results[0].value.items : [], results[1].status === "fulfilled" ? results[1].value.items : []), original);
	});
	const pending = new Set(attempts);
	while (pending.size > 0) {
		const settled = await Promise.race([...pending].map(async (promise) => ({
			promise,
			items: await promise
		})));
		pending.delete(settled.promise);
		if (settled.items.some((anime) => searchScore(anime, original) >= 1100)) return settled.items;
	}
	return rankSearchResults((await Promise.all(attempts)).reduce((accumulated, current) => mergeSearchItems(accumulated, current), []), original);
}
function isStrongSearchResult(items, query) {
	return items.some((anime) => searchScore(anime, query) >= 1100);
}
async function searchDirectFast(params) {
	const attempts = [searchAni(params).catch(() => null), searchJikan(params).catch(() => null)];
	const pending = new Set(attempts);
	const results = [];
	while (pending.size > 0) {
		const settled = await Promise.race([...pending].map(async (promise) => ({
			promise,
			result: await promise
		})));
		pending.delete(settled.promise);
		if (!settled.result) continue;
		results.push(settled.result);
		if (params.q && isStrongSearchResult(settled.result.items, params.q)) return {
			items: rankSearchResults(settled.result.items, params.q),
			hasNext: settled.result.hasNext,
			source: settled.result.source
		};
	}
	return {
		items: rankSearchResults(results.reduce((accumulated, current) => mergeSearchItems(accumulated, current.items), []), params.q),
		hasNext: results.some((result) => result.hasNext),
		source: results[0]?.source ?? "anilist"
	};
}
var searchCatalog_createServerFn_handler = createServerRpc({
	id: "1aba2ecb2c3d3034b6e5626ce7aa323dbe8a6377fd2a3a06673ff30cc0db79c0",
	name: "searchCatalog",
	filename: "src/lib/api.ts"
}, (opts) => searchCatalog.__executeServer(opts));
var searchCatalog = createServerFn({ method: "GET" }).validator(searchSchema).handler(searchCatalog_createServerFn_handler, async ({ data }) => {
	const key = `search:v4:${JSON.stringify(data)}`;
	const cached = fromCache(key);
	if (cached) return cached;
	const q = data.q?.trim() ?? "";
	if (q) {
		const direct = await searchDirectFast(data);
		let items = direct.items;
		if (!items.some((anime) => searchScore(anime, q) >= 1100)) try {
			const relaxed = await searchRelaxed(data);
			items = rankSearchResults(mergeSearchItems(items, relaxed), q);
		} catch {}
		return toCache(key, {
			items: items.slice(0, 24),
			page: data.page ?? 1,
			hasNext: direct.hasNext,
			source: direct.source
		});
	}
	try {
		return toCache(key, await searchAni(data));
	} catch {
		return toCache(key, await searchJikan(data));
	}
});
var fetchAdultCatalog_createServerFn_handler = createServerRpc({
	id: "536087411b44da1d2870172c15468b103292f21b26d7d42389c9f26c71f19c9f",
	name: "fetchAdultCatalog",
	filename: "src/lib/api.ts"
}, (opts) => fetchAdultCatalog.__executeServer(opts));
var fetchAdultCatalog = createServerFn({ method: "GET" }).handler(fetchAdultCatalog_createServerFn_handler, async () => {
	const key = "adult-catalog:v2";
	const cached = fromCache(key);
	if (cached) return cached;
	const data = await anilistGraphQL(`
          query AdultCatalog {
            Page(
              page: 1,
              perPage: 30
            ) {
              pageInfo {
                hasNextPage
              }

              media(
                type: ANIME,
                isAdult: true,
                genre: "Hentai",
                sort: TRENDING_DESC
              ) {
                ${CARD_FIELDS}
              }
            }
          }
          `);
	return toCache(key, {
		items: (data.Page.media ?? []).filter((anime) => isHentaiAnime(anime)).map(mapAniSlim),
		recentItems: await fetchRecentAdultReleasesFromAni(),
		page: 1,
		hasNext: Boolean(data.Page.pageInfo?.hasNextPage),
		source: "anilist"
	});
});
var MAIN_ADULT_TAGS = [
	{
		name: "Anal",
		type: "tag",
		aliases: ["Anal Sex"]
	},
	{
		name: "Boquete",
		type: "tag",
		aliases: ["Fellatio"]
	},
	{
		name: "Harém",
		type: "tag",
		aliases: [
			"Female Harem",
			"Male Harem",
			"Mixed Gender Harem"
		]
	},
	{
		name: "Incesto",
		type: "tag",
		aliases: ["Incest"]
	},
	{
		name: "Lactante",
		type: "tag",
		aliases: ["Lactation"]
	},
	{
		name: "Milf",
		type: "tag",
		aliases: ["MILF"]
	},
	{
		name: "Futanari",
		type: "tag",
		aliases: ["Futanari"]
	},
	{
		name: "Ecchi",
		type: "genre",
		aliases: ["Ecchi"]
	},
	{
		name: "Yuri",
		type: "tag",
		aliases: ["Yuri"]
	},
	{
		name: "Yaoi",
		type: "tag",
		aliases: ["Boys' Love"]
	},
	{
		name: "Romance",
		type: "genre",
		aliases: ["Romance"]
	},
	{
		name: "Masturbação",
		type: "tag",
		aliases: ["Masturbation"]
	},
	{
		name: "Orgia",
		type: "tag",
		aliases: ["Group Sex"]
	},
	{
		name: "Peitões",
		type: "tag",
		aliases: ["Large Breasts"]
	},
	{
		name: "Brinquedos",
		type: "tag",
		aliases: ["Sex Toys"]
	},
	{
		name: "BDSM",
		type: "tag",
		aliases: ["Bondage"]
	},
	{
		name: "Cunnilingus",
		type: "tag",
		aliases: ["Cunnilingus"]
	},
	{
		name: "Tentáculos",
		type: "tag",
		aliases: ["Tentacles"]
	},
	{
		name: "NTR",
		type: "tag",
		aliases: ["Netorare"]
	},
	{
		name: "Netorare",
		type: "tag",
		aliases: ["Netorare"]
	},
	{
		name: "Cosplay",
		type: "tag",
		aliases: ["Cosplay"]
	},
	{
		name: "Voyeur",
		type: "tag",
		aliases: ["Voyeur"]
	},
	{
		name: "Exibicionismo",
		type: "tag",
		aliases: ["Exhibitionism"]
	},
	{
		name: "Vida Escolar",
		type: "tag",
		aliases: ["School"]
	},
	{
		name: "Professora",
		type: "tag",
		aliases: ["Teacher"]
	},
	{
		name: "Boobjob",
		type: "tag",
		aliases: ["Boobjob"]
	},
	{
		name: "Empregada",
		type: "tag",
		aliases: ["Maids"]
	},
	{
		name: "Handjob",
		type: "tag",
		aliases: ["Handjob"]
	},
	{
		name: "Human Pet",
		type: "tag",
		aliases: ["Human Pet"]
	},
	{
		name: "Sumata",
		type: "tag",
		aliases: ["Sumata"]
	},
	{
		name: "Office / Escritório",
		type: "tag",
		aliases: ["Office"]
	},
	{
		name: "Comédia",
		type: "genre",
		aliases: ["Comedy"]
	},
	{
		name: "Magia",
		type: "tag",
		aliases: ["Magic"]
	},
	{
		name: "Elfos",
		type: "tag",
		aliases: ["Elf"]
	},
	{
		name: "Demônios",
		type: "tag",
		aliases: ["Demons"]
	},
	{
		name: "Vampiros",
		type: "tag",
		aliases: ["Vampire"]
	},
	{
		name: "Terror",
		type: "genre",
		aliases: ["Horror"]
	},
	{
		name: "Virgem",
		type: "tag",
		aliases: ["Virginity"]
	},
	{
		name: "Esporte",
		type: "genre",
		aliases: ["Sports"]
	},
	{
		name: "Ahegao",
		type: "tag",
		aliases: ["Ahegao"]
	}
];
var fetchAdultTags_createServerFn_handler = createServerRpc({
	id: "da0af59a524d5adfc58ff1c99f18cb3f440b25666e961a003ce0fa77074274b8",
	name: "fetchAdultTags",
	filename: "src/lib/api.ts"
}, (opts) => fetchAdultTags.__executeServer(opts));
var fetchAdultTags = createServerFn({ method: "GET" }).handler(fetchAdultTags_createServerFn_handler, async () => {
	const key = "adult-tags:v10";
	const cached = fromCache(key);
	if (cached) return cached;
	const allMedia = /* @__PURE__ */ new Map();
	const addMedia = (media) => {
		for (const anime of media ?? []) if (isHentaiAnime(anime)) allMedia.set(anime.id, anime);
	};
	const addFallbackMedia = (media) => {
		for (const anime of media ?? []) if ((anime.genres ?? []).some((genre) => normalizeAdultTagName(genre) === "hentai")) allMedia.set(anime.id, anime);
	};
	const firstPage = await anilistGraphQL(`
          query AdultTagsFirst {
            Page(
              page: 1,
              perPage: 50
            ) {
              pageInfo {
                hasNextPage
              }

              media(
                type: ANIME,
                isAdult: true,
                genre: "Hentai",
                sort: TRENDING_DESC
              ) {
                ${CARD_FIELDS}
              }
            }
          }
          `);
	addMedia(firstPage.Page.media);
	let nextPage = 2;
	let hasNextPage = Boolean(firstPage.Page.pageInfo?.hasNextPage);
	const batchSize = 5;
	while (hasNextPage) {
		const pages = Array.from({ length: batchSize }, (_, index) => nextPage + index);
		const data = await anilistGraphQL(`
            query AdultTagsBatch {
              ${pages.map((page) => `
                page${page}: Page(
                  page: ${page},
                  perPage: 50
                ) {
                  pageInfo {
                    hasNextPage
                  }

                  media(
                    type: ANIME,
                    isAdult: true,
                    genre: "Hentai",
                    sort: TRENDING_DESC
                  ) {
                    ${CARD_FIELDS}
                  }
                }
              `).join("\n")}
            }
            `);
		hasNextPage = false;
		for (const page of pages) {
			const result = data[`page${page}`];
			if (!result) continue;
			addMedia(result.media);
			if (result.pageInfo?.hasNextPage) hasNextPage = true;
		}
		nextPage += batchSize;
		if (hasNextPage) await new Promise((resolve) => setTimeout(resolve, 750));
	}
	const fallbackTags = MAIN_ADULT_TAGS.filter((tag) => tag.type === "tag");
	for (const mainTag of fallbackTags) {
		const alias = mainTag.aliases[0];
		if (!alias) continue;
		try {
			addFallbackMedia((await anilistGraphQL(`
              query AdultTagFallback(
                $tag: String
              ) {
                Page(
                  page: 1,
                  perPage: 50
                ) {
                  media(
                    type: ANIME,
                    genre: "Hentai",
                    tag: $tag,
                    sort: TRENDING_DESC
                  ) {
                    ${CARD_FIELDS}
                  }
                }
              }
              `, { tag: alias })).Page.media ?? []);
			await new Promise((resolve) => setTimeout(resolve, 350));
		} catch {}
	}
	const media = Array.from(allMedia.values());
	return toCache(key, {
		items: media.map(mapAniSlim),
		tags: MAIN_ADULT_TAGS.map((mainTag) => {
			const aliases = new Set([mainTag.name, ...mainTag.aliases].map(normalizeAdultTagName));
			const animeIds = /* @__PURE__ */ new Set();
			for (const anime of media) {
				if (mainTag.type === "genre") {
					if ((anime.genres ?? []).some((genre) => aliases.has(normalizeAdultTagName(genre)))) animeIds.add(String(anime.id));
					continue;
				}
				if ((anime.tags ?? []).some((tag) => aliases.has(normalizeAdultTagName(tag.name)))) animeIds.add(String(anime.id));
			}
			return {
				name: mainTag.name,
				count: animeIds.size,
				animeIds: Array.from(animeIds)
			};
		})
	});
});
var idSchema = object({ id: string() });
var fetchAnimeDetail_createServerFn_handler = createServerRpc({
	id: "360b5d0dac3f25b0b4b525917f3925b73dd02a3596d0c36a27307ec961b976f9",
	name: "fetchAnimeDetail",
	filename: "src/lib/api.ts"
}, (opts) => fetchAnimeDetail.__executeServer(opts));
var fetchAnimeDetail = createServerFn({ method: "GET" }).validator(idSchema).handler(fetchAnimeDetail_createServerFn_handler, async ({ data }) => {
	const { id } = data;
	if (id.startsWith("local-")) return null;
	const key = `detail:v3:${id}`;
	const cached = fromCache(key);
	if (cached) return cached;
	if (id.startsWith("mal-")) {
		const malId = Number(id.replace("mal-", ""));
		const json = await jikanFetch(`/anime/${malId}/full`);
		const slim = mapJikanSlim(json.data);
		let seasons = [];
		try {
			seasons = await jikanEpisodes(malId);
		} catch {
			seasons = [];
		}
		let seasonNavigation;
		try {
			const aniMedia = await fetchAniMediaByMalId(malId);
			if (aniMedia) {
				const navigation = await buildSeasonNavigation(aniMedia);
				const currentAniId = String(aniMedia.id);
				seasonNavigation = {
					...navigation,
					items: navigation.items.map((item) => item.id === currentAniId ? {
						...item,
						id: `mal-${malId}`
					} : item)
				};
			}
		} catch {
			seasonNavigation = void 0;
		}
		return toCache(key, {
			...slim,
			studios: (json.data.studios ?? []).map((studio) => studio.name),
			streamingEpisodes: [],
			seasons,
			recommendations: [],
			seasonNavigation
		});
	}
	const anilistId = Number(id);
	if (!Number.isFinite(anilistId)) return null;
	try {
		const media = (await anilistGraphQL(`
              query Detail($id: Int) {
                Media(
                  id: $id,
                  type: ANIME
                ) {
                  ${CARD_FIELDS}

                  duration

                  studios(
                    isMain: true
                  ) {
                    nodes {
                      name
                    }
                  }

                  nextAiringEpisode {
                    episode
                    airingAt
                  }

                  streamingEpisodes {
                    title
                    thumbnail
                    url
                    site
                  }

                  relations {
                    edges {
                      relationType
                      node {
                        id
                        title {
                          romaji
                          english
                        }
                      }
                    }
                  }

                  recommendations(
                    sort: RATING_DESC,
                    perPage: 10
                  ) {
                    nodes {
                      mediaRecommendation {
                        id
                        idMal

                        title {
                          romaji
                          english
                          native
                        }

                        coverImage {
                          extraLarge
                          large
                          color
                        }

                        bannerImage
                        averageScore
                        genres
                        format
                        status
                        episodes
                        season
                        seasonYear

                        trailer {
                          id
                          site
                        }
                      }
                    }
                  }
                }
              }
              `, { id: anilistId })).Media;
		if (!media) return null;
		let seasons = [];
		if (media.idMal) try {
			seasons = await jikanEpisodes(media.idMal);
		} catch {
			seasons = [];
		}
		if (!seasons.length && (media.streamingEpisodes?.length || media.episodes)) {
			const fromStream = (media.streamingEpisodes ?? []).map((episode, index) => ({
				id: `stream-${media.id}-${index}`,
				number: index + 1,
				title: episode.title ?? `Episódio ${index + 1}`,
				thumbnail: episode.thumbnail,
				videoUrl: episode.url
			}));
			const count = media.episodes ?? fromStream.length;
			const episodes = fromStream.length >= count ? fromStream : Array.from({ length: count }, (_, index) => {
				return fromStream[index] ?? {
					id: `ep-${media.id}-${index + 1}`,
					number: index + 1,
					title: `Episódio ${index + 1}`
				};
			});
			seasons = [{
				id: `s1-${media.id}`,
				number: 1,
				title: "Temporada 1",
				episodes
			}];
		}
		const seasonNavigation = await buildSeasonNavigation(media);
		return toCache(key, mapAniFull(media, seasons, seasonNavigation));
	} catch {
		return null;
	}
});
var fetchGenres_createServerFn_handler = createServerRpc({
	id: "70100f70c2f1d2d8f996f900c08336cce9b5fe3ef0bc6a06b79fecdcd2c190b3",
	name: "fetchGenres",
	filename: "src/lib/api.ts"
}, (opts) => fetchGenres.__executeServer(opts));
var fetchGenres = createServerFn({ method: "GET" }).handler(fetchGenres_createServerFn_handler, async () => {
	const key = "genres:all";
	const cached = fromCache(key);
	if (cached) return cached;
	try {
		return toCache(key, ((await anilistGraphQL(`
        query Genres {
          GenreCollection
        }
        `)).GenreCollection ?? []).filter((genre) => genre && genre !== "Hentai").sort((a, b) => a.localeCompare(b)));
	} catch {
		return [];
	}
});
var browseSchema = object({
	section: _enum([
		"popular",
		"season",
		"top",
		"trending"
	]),
	page: number().optional(),
	season: _enum([
		"WINTER",
		"SPRING",
		"SUMMER",
		"FALL"
	]).optional(),
	year: number().optional(),
	genre: string().optional()
});
var fetchBrowse_createServerFn_handler = createServerRpc({
	id: "e33500c3c281a5f6a547ed12cbad641f00fef7783a8c9729d18cdbf27e717ed4",
	name: "fetchBrowse",
	filename: "src/lib/api.ts"
}, (opts) => fetchBrowse.__executeServer(opts));
var fetchBrowse = createServerFn({ method: "GET" }).validator(browseSchema).handler(fetchBrowse_createServerFn_handler, async ({ data }) => {
	const page = data.page ?? 1;
	const current = currentAnimeSeason();
	const season = data.season ?? current.season;
	const year = data.year ?? current.year;
	const genre = data.genre?.trim() || void 0;
	const key = `browse:${data.section}:${season}:${year}:${genre ?? "all"}:${page}`;
	const cached = fromCache(key);
	if (cached) return cached;
	const sortMap = {
		popular: "POPULARITY_DESC",
		top: "SCORE_DESC",
		trending: "TRENDING_DESC",
		season: "POPULARITY_DESC"
	};
	try {
		const isSeason = data.section === "season";
		const result = await anilistGraphQL(isSeason ? `
            query BrowseSeason(
              $page: Int,
              $sort: [MediaSort],
              $season: MediaSeason,
              $year: Int
            ) {
              Page(
                page: $page,
                perPage: 24
              ) {
                pageInfo {
                  hasNextPage
                }

                media(
                  type: ANIME,
                  sort: $sort,
                  season: $season,
                  seasonYear: $year
                ) {
                  ${CARD_FIELDS}
                }
              }
            }
            ` : `
            query Browse(
              $page: Int,
              $sort: [MediaSort],
              $genre: String
            ) {
              Page(
                page: $page,
                perPage: 24
              ) {
                pageInfo {
                  hasNextPage
                }

                media(
                  type: ANIME,
                  sort: $sort,
                  genre: $genre
                ) {
                  ${CARD_FIELDS}
                }
              }
            }
            `, isSeason ? {
			page,
			sort: [sortMap.season],
			season,
			year
		} : {
			page,
			sort: [sortMap[data.section]],
			genre
		});
		return toCache(key, {
			items: (result.Page.media ?? []).filter((anime) => !isAdultAnime(anime)).map(mapAniSlim),
			page,
			hasNext: Boolean(result.Page.pageInfo?.hasNextPage),
			source: "anilist"
		});
	} catch {
		const json = await jikanFetch(data.section === "top" ? `/top/anime?page=${page}&limit=24` : data.section === "popular" ? `/top/anime?filter=bypopularity&page=${page}&limit=24` : `/seasons/now?page=${page}&limit=24`);
		return toCache(key, {
			items: (json.data ?? []).map(mapJikanSlim),
			page,
			hasNext: Boolean(json.pagination?.has_next_page),
			source: "jikan"
		});
	}
});
//#endregion
export { fetchAdultCatalog_createServerFn_handler, fetchAdultTags_createServerFn_handler, fetchAnimeDetail_createServerFn_handler, fetchBrowse_createServerFn_handler, fetchGenres_createServerFn_handler, fetchHomeCatalog_createServerFn_handler, searchCatalog_createServerFn_handler };
