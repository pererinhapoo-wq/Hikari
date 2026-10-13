import { i as createServerFn } from "./ssr.mjs";
import { i as stripHtml, n as currentAnimeSeason } from "./utils-Cws_m9jY.mjs";
import { t as reviewHikariAINews } from "./api-hikari-ai-review-B56bDek1.mjs";
import { t as createServerRpc } from "./createServerRpc--phiu8Av.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news-api-eSbM3I65.js
var ANILIST = "https://graphql.anilist.co";
var cache = /* @__PURE__ */ new Map();
var translationCache = /* @__PURE__ */ new Map();
var TTL = 6e5;
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
function formatDate(media) {
	const date = media.startDate;
	if (!date?.year || !date.month || !date.day) return `${media.seasonYear ?? "2026"}`;
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(new Date(date.year, date.month - 1, date.day));
}
function formatAiringDate(airingAt) {
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(/* @__PURE__ */ new Date(airingAt * 1e3));
}
function titleOf(media) {
	return media.title?.english || media.title?.romaji || media.title?.native || "Anime";
}
function cleanDescription(value) {
	return stripHtml(value).trim();
}
async function translateToPortuguese(text) {
	const cleaned = text.trim();
	if (!cleaned) return "";
	const cached = translationCache.get(cleaned);
	if (cached) return cached;
	const source = cleaned.slice(0, 5e3);
	for (let attempt = 0; attempt < 2; attempt += 1) try {
		const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(source)}`;
		const response = await fetch(url, { signal: AbortSignal.timeout(8e3) });
		if (!response.ok) continue;
		const json = await response.json();
		if (!Array.isArray(json) || !Array.isArray(json[0])) continue;
		const translated = json[0].filter((part) => Array.isArray(part) && typeof part[0] === "string").map((part) => part[0]).join("").trim();
		if (!translated) continue;
		translationCache.set(cleaned, translated);
		return translated;
	} catch {}
	return cleaned;
}
async function descriptionOf(media) {
	const description = cleanDescription(media.description);
	if (!description) return `${titleOf(media)} faz parte da programação da temporada de ${(media.season ?? "").toLowerCase()} de ${media.seasonYear ?? ""}.`;
	return translateToPortuguese(description);
}
function trailerOf(media) {
	const trailer = media.trailer;
	if (!trailer?.id || trailer.site !== "youtube") return;
	return `https://www.youtube.com/embed/${trailer.id}`;
}
async function fetchLatestAiredEpisodes() {
	const result = /* @__PURE__ */ new Map();
	try {
		const response = await fetch(ANILIST, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify({ query: `
              query LatestAiredEpisodes {
                Page(
                  page: 1
                  perPage: 50
                ) {
                  airingSchedules(
                    notYetAired: false
                    sort: TIME_DESC
                  ) {
                    id
                    mediaId
                    episode
                    airingAt
                  }
                }
              }
            ` }),
			signal: AbortSignal.timeout(12e3)
		});
		if (!response.ok) return result;
		const json = await response.json();
		if (json.errors?.length || !json.data?.Page) return result;
		for (const item of json.data.Page.airingSchedules ?? []) {
			if (typeof item.mediaId !== "number" || typeof item.episode !== "number" || typeof item.airingAt !== "number") continue;
			if (item.episode <= 0 || item.airingAt * 1e3 > Date.now()) continue;
			if (!result.has(item.mediaId)) result.set(item.mediaId, {
				episode: item.episode,
				airingAt: item.airingAt
			});
		}
	} catch {
		return result;
	}
	return result;
}
async function fetchSeason(season, year) {
	const response = await fetch(ANILIST, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify({
			query: `
            query AutomaticNews(
              $season: MediaSeason
              $year: Int
            ) {
              Page(
                page: 1
                perPage: 50
              ) {
                media(
                  type: ANIME
                  season: $season
                  seasonYear: $year
                  sort: START_DATE_DESC
                ) {
                  id
                  isAdult

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }

                  description(
                    asHtml: false
                  )

                  format
                  status
                  episodes
                  season
                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }

                  trailer {
                    id
                    site
                    thumbnail
                  }
                }
              }
            }
          `,
			variables: {
				season: season.toUpperCase(),
				year
			}
		}),
		signal: AbortSignal.timeout(12e3)
	});
	if (!response.ok) throw new Error(`AniList indisponível (${response.status})`);
	const json = await response.json();
	if (json.errors?.length || !json.data?.Page) throw new Error(json.errors?.[0]?.message ?? "AniList sem dados");
	return json.data.Page.media;
}
async function fetchAdultCatalogNews() {
	const response = await fetch(ANILIST, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify({ query: `
            query AdultNews {
              trending: Page(
                page: 1
                perPage: 50
              ) {
                media(
                  type: ANIME
                  isAdult: true
                  sort: TRENDING_DESC
                ) {
                  id
                  isAdult
                  score
                  popularity

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }

                  description(
                    asHtml: false
                  )

                  format
                  status
                  episodes
                  season
                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }

                  trailer {
                    id
                    site
                    thumbnail
                  }
                }
              }

              upcoming: Page(
                page: 1
                perPage: 50
              ) {
                media(
                  type: ANIME
                  isAdult: true
                  status: NOT_YET_RELEASED
                  sort: START_DATE_DESC
                ) {
                  id
                  isAdult
                  score
                  popularity

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }

                  description(
                    asHtml: false
                  )

                  format
                  status
                  episodes
                  season
                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }

                  trailer {
                    id
                    site
                    thumbnail
                  }
                }
              }

              topRated: Page(
                page: 1
                perPage: 50
              ) {
                media(
                  type: ANIME
                  isAdult: true
                  sort: SCORE_DESC
                ) {
                  id
                  isAdult
                  score
                  popularity

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }

                  description(
                    asHtml: false
                  )

                  format
                  status
                  episodes
                  season
                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }

                  trailer {
                    id
                    site
                    thumbnail
                  }
                }
              }
            }
          ` }),
		signal: AbortSignal.timeout(12e3)
	});
	if (!response.ok) throw new Error(`AniList indisponível (${response.status})`);
	const json = await response.json();
	if (json.errors?.length || !json.data) throw new Error(json.errors?.[0]?.message ?? "AniList sem dados");
	const trending = json.data.trending?.media ?? [];
	const upcoming = json.data.upcoming?.media ?? [];
	const topRated = json.data.topRated?.media ?? [];
	const selected = /* @__PURE__ */ new Map();
	for (const anime of [
		...trending.slice(0, 24),
		...upcoming.slice(0, 24),
		...topRated.slice(0, 24)
	]) if (anime.isAdult === true && anime.id > 0 && anime.format !== "MUSIC") selected.set(anime.id, anime);
	return Array.from(selected.values());
}
var EXTERNAL_NEWS_FEEDS = [
	{
		kind: "rss",
		name: "MyAnimeList",
		url: "https://myanimelist.net/rss/news.xml"
	},
	{
		kind: "rss",
		name: "Anime Corner",
		url: "https://animecorner.me/feed/"
	},
	{
		kind: "x-mirror",
		name: "SugoiLITE",
		handle: "SugoiLITE",
		url: "https://twstalker.com/SugoiLITE"
	},
	{
		kind: "x-mirror",
		name: "SugoiBingus",
		handle: "SugoiBingus",
		url: "https://twstalker.com/SugoiBingus"
	}
];
function xmlDecode(value) {
	return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"").replace(/&#039;|&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}
function xmlTag(block, name) {
	return xmlDecode(block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1]?.trim() ?? "");
}
function xmlAttribute(block, tag, attribute) {
	return xmlDecode(block.match(new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, "i"))?.[1]?.trim() ?? "");
}
function absoluteUrl(value, baseUrl) {
	try {
		return new URL(value, baseUrl).toString();
	} catch {
		return "";
	}
}
function stripMarkup(value) {
	return stripHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")).replace(/\s+/g, " ").trim();
}
function imageFromHtml(html, baseUrl) {
	const og = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i);
	if (og?.[1]) return absoluteUrl(og[1], baseUrl);
	const reverseOg = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["'][^>]*>/i);
	return reverseOg?.[1] ? absoluteUrl(reverseOg[1], baseUrl) : "";
}
function imagesFromHtml(html, baseUrl) {
	const images = /* @__PURE__ */ new Set();
	const pattern = /<img\b[^>]+src=["']([^"']+)["'][^>]*>/gi;
	let match;
	while ((match = pattern.exec(html)) && images.size < 8) {
		const url = absoluteUrl(match[1], baseUrl);
		if (url && !url.startsWith("data:")) images.add(url);
	}
	return Array.from(images);
}
function isGameNews(title, content, url) {
	const normalized = `${title} ${content} ${url}`.toLowerCase();
	return /\\b(video game|video games|gaming|gameplay|game trailer|game pv|game announcement|game release|mobile game|gacha game|console game|pc game|playstation|xbox|nintendo|steam|switch|ps4|ps5|xbox series|xbox one|rpg game|action game|fighting game|visual novel game|smartphone game)\\b/i.test(normalized) || /(?:^|[\\s:/_-])game(?:$|[\\s:/_-])/i.test(normalized);
}
function typeFromExternalNews(title) {
	const normalized = title.toLowerCase();
	if (/\b(rumou?r|rumor|leak|leaked|scoop|according to leaks|reportedly|allegedly)\b/i.test(normalized)) return {
		type: "RUMOR",
		isRumor: true
	};
	if (/\b(trailer|pv|teaser|promo|promotional video|cm)\b/i.test(normalized)) return {
		type: "TRAILER",
		isRumor: false
	};
	if (/\b(new season|season [0-9ivx]+|season [0-9ivx]+ announced|sequel|second season|third season|fourth season|returning)\b/i.test(normalized)) return {
		type: "NOVA TEMPORADA",
		isRumor: false
	};
	if (/\b(key visual|new visual|visual revealed|poster|artwork|illustration)\b/i.test(normalized)) return {
		type: "NOVO VISUAL",
		isRumor: false
	};
	if (/\b(release date|premiere date|premieres|premiere|debut|starts? airing|air date)\b/i.test(normalized)) return {
		type: "DATA DE ESTREIA",
		isRumor: false
	};
	if (/\b(cast|staff|voice actor|voice actress|additional cast|additional staff)\b/i.test(normalized)) return {
		type: "ELENCO",
		isRumor: false
	};
	if (/\b(anime adaptation|anime announced|gets an anime|anime project|anime series announced|adaptation announced)\b/i.test(normalized)) return {
		type: "ANÚNCIO",
		isRumor: false
	};
	return {
		type: "NOTÍCIA",
		isRumor: false
	};
}
function formatExternalDate(iso) {
	const timestamp = Date.parse(iso);
	if (Number.isNaN(timestamp)) return "";
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(new Date(timestamp));
}
async function fetchExternalFeed(feed) {
	if (feed.kind === "x-mirror") return [];
	const response = await fetch(feed.url, {
		cache: "no-store",
		headers: {
			Accept: "application/rss+xml, application/xml, text/xml",
			"User-Agent": "Hikari/1.0 (anime news)"
		},
		signal: AbortSignal.timeout(12e3)
	});
	if (!response.ok) throw new Error(`${feed.name} indisponível (${response.status})`);
	const parsed = ((await response.text()).match(/<item\b[\s\S]*?<\/item>/gi) ?? []).slice(0, 30).map((block) => {
		const url = xmlTag(block, "link") || xmlAttribute(block, "guid", "isPermaLink");
		const title = xmlTag(block, "title");
		const publishedAt = xmlTag(block, "pubDate") || xmlTag(block, "dc:date") || xmlTag(block, "published") || xmlTag(block, "updated");
		if (!title || !url || !publishedAt) return null;
		const content = xmlTag(block, "content:encoded") || xmlTag(block, "description") || "";
		const image = xmlAttribute(block, "media:content", "url") || xmlAttribute(block, "media:thumbnail", "url") || xmlAttribute(block, "enclosure", "url") || imageFromHtml(content, url);
		if (isGameNews(title, content, url)) return null;
		const articleImages = imagesFromHtml(content, url);
		const classified = typeFromExternalNews(title);
		return {
			id: `external-${encodeURIComponent(url)}`,
			title,
			description: stripMarkup(content).slice(0, 700),
			publishedAt: new Date(publishedAt).toISOString(),
			url,
			image: image || articleImages[0] || "",
			articleImages,
			source: feed.name,
			type: classified.type,
			isRumor: classified.isRumor,
			animeId: ""
		};
	}).filter(Boolean);
	return await Promise.all(parsed.map(async (item) => {
		try {
			const response = await fetch(item.url, {
				headers: {
					Accept: "text/html,application/xhtml+xml",
					"User-Agent": "Hikari/1.0 (anime news)"
				},
				signal: AbortSignal.timeout(8e3)
			});
			if (response.ok) {
				const html = await response.text();
				item.image = imageFromHtml(html, item.url) || item.image;
				item.articleImages = Array.from(/* @__PURE__ */ new Set([...item.articleImages, ...imagesFromHtml(html, item.url)])).slice(0, 8);
				const pageDescription = html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ?? "";
				if (pageDescription) item.description = stripMarkup(pageDescription).slice(0, 700);
			}
		} catch {}
		const animeId = await findAniListAnimeId(item.title);
		item.animeId = animeId;
		item.bannerImage = (await fetchAniListMeta(animeId)).bannerImage || item.bannerImage;
		item.title = finalizeExternalNewsTitle(await translateExternalTitle(item.title, animeId));
		if (item.type === "TRAILER" && item.url.includes("youtube.com")) item.trailerUrl = item.url;
		return item;
	}));
}
var hikariAIReviewCache = /* @__PURE__ */ new Map();
var HIKARI_AI_REVIEW_TTL = 36e5;
function typeFromHikariAIReview(label) {
	switch (label) {
		case "Rumor": return {
			type: "RUMOR",
			isRumor: true
		};
		case "Trailer/PV": return {
			type: "TRAILER",
			isRumor: false
		};
		case "Nova temporada": return {
			type: "NOVA TEMPORADA",
			isRumor: false
		};
		case "Anúncio": return {
			type: "ANÚNCIO",
			isRumor: false
		};
		default: return {
			type: "NOTÍCIA",
			isRumor: false
		};
	}
}
async function reviewExternalNewsInBatches(items, concurrency = 3) {
	const results = new Array(items.length);
	let nextIndex = 0;
	async function worker() {
		while (true) {
			const index = nextIndex++;
			if (index >= items.length) return;
			results[index] = await reviewExternalNewsWithHikariAI(items[index]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
	return results;
}
async function reviewExternalNewsWithHikariAI(item) {
	const cacheKey = `${item.url}|${item.title}`;
	const cached = hikariAIReviewCache.get(cacheKey);
	if (cached && Date.now() - cached.at <= HIKARI_AI_REVIEW_TTL) return cached.item;
	try {
		const knownAnime = item.animeId ? await fetchAniListMeta(item.animeId) : null;
		const review = await reviewHikariAINews({
			title: item.title,
			description: item.description,
			source: item.source,
			sourceUrl: item.url,
			animeName: knownAnime?.title || ""
		});
		if (review.reason.startsWith("GEMINI_API_KEY") || review.reason.startsWith("Gemini retornou HTTP") || review.reason.startsWith("A Hikari AI não recebeu") || review.reason.startsWith("A resposta da Hikari AI não estava") || review.reason.startsWith("Falha na Hikari AI:")) {
			hikariAIReviewCache.set(cacheKey, {
				at: Date.now(),
				item: null
			});
			return null;
		}
		if (!review.approved || !review.isAnime || review.isGameNews) {
			hikariAIReviewCache.set(cacheKey, {
				at: Date.now(),
				item: null
			});
			return null;
		}
		const classified = typeFromHikariAIReview(review.label);
		const animeId = item.animeId || (review.animeName ? await findAniListAnimeId(review.animeName) : "");
		const reviewedTitle = finalizeExternalNewsTitle(review.title || item.title).replace(/\bShoujo\s+Romcom\s+Anime\s+de\s+TV\s+/gi, "").replace(/\bShoujo\s+Romcom\s+TV\s+Anime\s+/gi, "");
		const reviewedDescription = review.description?.trim() ? await translateNewsFragment(review.description.trim()) : item.description;
		const reviewedItem = {
			...item,
			title: reviewedTitle,
			description: reviewedDescription,
			type: classified.type,
			isRumor: classified.isRumor,
			animeId
		};
		if (animeId && !item.bannerImage) {
			const meta = await fetchAniListMeta(animeId);
			reviewedItem.image = meta.image || reviewedItem.image;
			reviewedItem.bannerImage = meta.bannerImage || reviewedItem.bannerImage;
		}
		hikariAIReviewCache.set(cacheKey, {
			at: Date.now(),
			item: reviewedItem
		});
		return reviewedItem;
	} catch {
		hikariAIReviewCache.set(cacheKey, {
			at: Date.now(),
			item: null
		});
		return null;
	}
}
var aniListSearchCache = /* @__PURE__ */ new Map();
var aniListMetaCache = /* @__PURE__ */ new Map();
async function fetchAniListMeta(animeId) {
	if (!animeId) return {
		title: "",
		english: "",
		romaji: "",
		image: "",
		bannerImage: ""
	};
	const cached = aniListMetaCache.get(animeId);
	if (cached) return cached;
	try {
		const response = await fetch(ANILIST, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify({
				query: `
          query AnimeMeta($id: Int) {
            Media(id: $id, type: ANIME) {
              id
              isAdult
              title {
                english
                romaji
              }
              coverImage {
                extraLarge
                large
              }
              bannerImage
            }
          }
        `,
				variables: { id: Number(animeId) }
			}),
			signal: AbortSignal.timeout(8e3)
		});
		if (!response.ok) return {
			title: "",
			english: "",
			romaji: "",
			image: "",
			bannerImage: ""
		};
		const media = (await response.json()).data?.Media;
		if (!media || media.isAdult === true) return {
			title: "",
			english: "",
			romaji: "",
			image: "",
			bannerImage: ""
		};
		const english = media.title?.english?.trim() || "";
		const romaji = media.title?.romaji?.trim() || "";
		const meta = {
			title: english || romaji,
			english,
			romaji,
			image: media.coverImage?.extraLarge || media.coverImage?.large || "",
			bannerImage: media.bannerImage || ""
		};
		aniListMetaCache.set(animeId, meta);
		return meta;
	} catch {
		return {
			title: "",
			english: "",
			romaji: "",
			image: "",
			bannerImage: ""
		};
	}
}
function cleanExternalTitle(value) {
	return xmlDecode(value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ")).replace(/^FixupX\s*[-:–—]?\s*/i, "").replace(/^Media\s+\d+\s*\/\s*\d+\s*[:|-]?\s*/i, "").replace(/^\d{1,2}:\d{2}\s*/i, "").replace(/^[✅☑️✔️✓\s]+/u, "").replace(/^(?:SUGOI\s+)?(?:LITE|BINGUS)\s*\([^)]*\)\s*/i, "").replace(/^(?:SUGOI\s+)?(?:LITE|BINGUS)\s*[-:–—]?\s*/i, "").replace(/\b(?:@SugoiLITE|@SugoiBingus)\b/gi, "").replace(/\s+/g, " ").trim();
}
function joinNewsTitleParts(...parts) {
	return parts.map((part) => part.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}
function normalizePortugueseNewsFragment(value) {
	return value.replace(/\bTV Anime\b/gi, "Anime de TV").replace(/\bis listed for\b/gi, "está listado com").replace(/\blisted for\b/gi, "listado com").replace(/\bepisodes\b/gi, "episódios").replace(/\bconsecutive episodes\b/gi, "episódios consecutivos").replace(/\bhas officially revealed\b/gi, "revelou oficialmente").replace(/\bofficially revealed\b/gi, "revelou oficialmente").replace(/\brevealed its latest promo\b/gi, "revelou sua última promoção").replace(/\breveals its latest promo\b/gi, "revela sua última promoção").replace(/\bEnds with\b/gi, "termina com").replace(/\bends with\b/gi, "termina com").replace(/\b6th Volume\b/gi, "6º volume").replace(/\b5th Volume\b/gi, "5º volume").replace(/\b4th Volume\b/gi, "4º volume").replace(/\b3rd Volume\b/gi, "3º volume").replace(/\b2nd Volume\b/gi, "2º volume").replace(/\b1st Volume\b/gi, "1º volume").replace(/\bVolume\b/gi, "volume").replace(/\bannounces\b/gi, "anuncia").replace(/\bannounced\b/gi, "anunciado").replace(/\breveals\b/gi, "revela").replace(/\brevealed\b/gi, "revelou").replace(/\bnew visual\b/gi, "novo visual").replace(/\blatest visual\b/gi, "novo visual").replace(/\badditional cast\b/gi, "elenco adicional").replace(/\bcast members\b/gi, "membros do elenco").replace(/\bmain cast\b/gi, "elenco principal").replace(/\bsecond teaser promotional\b/gi, "segundo teaser promocional").replace(/\bsecond promotional teaser\b/gi, "segundo teaser promocional").replace(/\bpromotional teaser\b/gi, "teaser promocional").replace(/\btrailer\b/gi, "trailer").replace(/\btheatrical film\b/gi, "filme para os cinemas").replace(/\bfilm project\b/gi, "projeto de filme").replace(/\bgets an anime adaptation\b/gi, "ganha adaptação para anime").replace(/\bwill get an anime adaptation\b/gi, "ganhará adaptação para anime").replace(/\bhas been announced\b/gi, "foi anunciado").replace(/\bhas announced\b/gi, "anunciou").replace(/\bnew season\b/gi, "nova temporada").replace(/\bsecond season\b/gi, "segunda temporada").replace(/\bthird season\b/gi, "terceira temporada").replace(/\bfirst season\b/gi, "primeira temporada").replace(/\bfirst project\b/gi, "primeiro projeto").replace(/\bfor the first time\b/gi, "pela primeira vez").replace(/\bthe anime\b/gi, "o anime").replace(/\bthe light novel\b/gi, "a light novel").replace(/\bnovela leve\b/gi, "Light Novel").replace(/\blight novel\b/gi, "Light Novel").replace(/\bJapanese TV\b/gi, "TV japonesa").replace(/\bwebsite\b/gi, "site oficial").replace(/\bofficial website\b/gi, "site oficial").replace(/\s+/g, " ").trim();
}
async function translateNewsFragment(value) {
	return normalizePortugueseNewsFragment(await translateToPortuguese(value) || value);
}
function finalizeExternalNewsTitle(value) {
	let title = joinNewsTitleParts(value).replace(/\bAnime\s+TV\b/gi, "Anime de TV").replace(/\bTV\s+Anime\b/gi, "Anime de TV").replace(/\bTV(?=[A-Z])/g, "TV ").replace(/(?<=[a-záéíóúãõç)])(?=[A-Z][a-z])/g, " ").replace(/\s+/g, " ").trim();
	title = title.replace(/\bAnime de TV\s+Gensou Suikoden\b/i, "O anime de TV Gensou Suikoden").replace(/\bAnime de TV\s+Sekai Saikyou no Majo, Hajimemashita\b/i, "O anime de TV Sekai Saikyou no Majo, Hajimemashita").replace(/\bAnime de TV\s+HIRAYASUMI\b/i, "O anime de TV HIRAYASUMI").replace(/\blight novel\b/gi, "light novel").replace(/\bends with\b/gi, "termina com").replace(/\b6th volume\b/gi, "6º volume").replace(/\bis listed for\b/gi, "está listado para").replace(/\bepisodes\b/gi, "episódios");
	return title.replace(/\s+/g, " ").trim();
}
async function translateExternalTitle(rawTitle, animeId) {
	const cleaned = cleanExternalTitle(rawTitle).replace(/&quot;|&#34;|&#x22;/gi, "\"").replace(/&#39;|&#x27;/gi, "'").replace(/\s+/g, " ").trim();
	if (!cleaned) return "";
	const meta = await fetchAniListMeta(animeId);
	const official = (meta.english || meta.romaji || meta.title || "").trim();
	const quotedWithParenthetical = cleaned.match(/(?:"([^"“”]{2,120})"|“([^”]{2,120})”)\s*\(([^()]{2,160})\)/);
	if (quotedWithParenthetical) {
		const quotedName = (quotedWithParenthetical[1] || quotedWithParenthetical[2] || "").trim();
		const parentheticalName = quotedWithParenthetical[3].trim();
		const titleName = parentheticalName.length >= quotedName.length ? parentheticalName : quotedName;
		const blockStart = quotedWithParenthetical.index ?? -1;
		if (blockStart >= 0) {
			const blockEnd = blockStart + quotedWithParenthetical[0].length;
			const before = cleaned.slice(0, blockStart);
			const after = cleaned.slice(blockEnd);
			const [beforePt, afterPt] = await Promise.all([translateNewsFragment(before), translateNewsFragment(after)]);
			return joinNewsTitleParts(beforePt, titleName, afterPt);
		}
	}
	const quoted = cleaned.match(/"([^"“”]{2,160})"/) || cleaned.match(/“([^”]{2,160})”/) || cleaned.match(/'([^']{2,160})'/);
	if (quoted?.[1]) {
		const quotedName = quoted[1].trim();
		const quotedIndex = quoted.index ?? cleaned.indexOf(quoted[0]);
		if (quotedIndex >= 0) {
			const before = cleaned.slice(0, quotedIndex);
			const after = cleaned.slice(quotedIndex + quoted[0].length);
			const [beforePt, afterPt] = await Promise.all([translateNewsFragment(before), translateNewsFragment(after)]);
			return joinNewsTitleParts(beforePt, quotedName, afterPt);
		}
	}
	if (official) {
		const index = cleaned.toLocaleLowerCase().indexOf(official.toLocaleLowerCase());
		if (index >= 0) {
			const before = cleaned.slice(0, index);
			const after = cleaned.slice(index + official.length);
			const [beforePt, afterPt] = await Promise.all([translateNewsFragment(before), translateNewsFragment(after)]);
			return joinNewsTitleParts(beforePt, official, afterPt);
		}
	}
	return joinNewsTitleParts(await translateNewsFragment(cleaned));
}
async function findAniListAnimeId(newsTitle) {
	const raw = xmlDecode(newsTitle).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
	const candidates = [
		...Array.from(raw.matchAll(/["“”']([^"“”']{2,120})["“”']/g)).map((match) => match[1].trim()),
		...Array.from(raw.matchAll(/\(([^()]{2,120})\)/g)).map((match) => match[1].trim()),
		raw.replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ").replace(/\b(tv anime|anime|new trailer|trailer|teaser|pv|visual|key visual|announced|revealed|season [0-9ivx]+|premiere date|release date|listed|episodes?)\b/gi, " ").replace(/[:|—–-]+/g, " ").replace(/\s+/g, " ").trim()
	].filter(Boolean).map((value) => value.slice(0, 100)).filter((value, index, list) => list.indexOf(value) === index);
	for (const cleaned of candidates) {
		const key = cleaned.toLowerCase();
		const cached = aniListSearchCache.get(key);
		if (cached) return cached;
		try {
			const response = await fetch(ANILIST, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json"
				},
				body: JSON.stringify({
					query: `
            query FindAnime($search: String) {
              Page(page: 1, perPage: 5) {
                media(type: ANIME, search: $search, sort: SEARCH_MATCH) {
                  id
                  isAdult
                  title {
                    english
                    romaji
                  }
                }
              }
            }
          `,
					variables: { search: cleaned }
				}),
				signal: AbortSignal.timeout(8e3)
			});
			if (!response.ok) continue;
			const media = (await response.json()).data?.Page?.media ?? [];
			const match = media.find((item) => item.isAdult !== true) ?? media[0];
			if (!match?.id) continue;
			const id = String(match.id);
			aniListSearchCache.set(key, id);
			return id;
		} catch {}
	}
	return "";
}
function telegramPostBlock(html, matchIndex) {
	const marker = "<div class=\"tgme_widget_message_wrap";
	const start = html.lastIndexOf(marker, matchIndex);
	if (start < 0) return html.slice(Math.max(0, matchIndex - 4e3), Math.min(html.length, matchIndex + 5e3));
	const next = html.indexOf(marker, matchIndex + 1);
	return html.slice(start, next >= 0 ? next : Math.min(html.length, start + 3e4));
}
function telegramPostImage(html, baseUrl) {
	const photo = html.match(/tgme_widget_message_photo_wrap[^>]*style=["'][^"']*background-image\s*:\s*url\((?:["']?)([^\)"']+)(?:["']?)\)[^"']*["']/i)?.[1];
	if (photo) return absoluteUrl(photo, baseUrl);
	const background = html.match(/style=["'][^"']*background-image\s*:\s*url\((?:["']?)([^\)"']+)(?:["']?)\)[^"']*["']/i)?.[1];
	return background ? absoluteUrl(background, baseUrl) : "";
}
async function fetchSugoiProfile(source) {
	const telegramUrl = "https://t.me/s/sugoileaks";
	const response = await fetch(telegramUrl, {
		headers: {
			Accept: "text/html,application/xhtml+xml",
			"User-Agent": "Hikari/1.0 (anime news)"
		},
		signal: AbortSignal.timeout(12e3)
	});
	if (!response.ok) throw new Error(`${source.name} indisponível (${response.status})`);
	const html = await response.text();
	const results = [];
	const seen = /* @__PURE__ */ new Set();
	const linkPattern = /<a\b[^>]*href=["'](?:https?:\/\/)?fixupx\.com\/(SugoiLITE|SugoiBingus)\/status\/(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
	let match;
	while ((match = linkPattern.exec(html)) && results.length < 24) {
		const handle = match[1];
		const statusId = match[2];
		const anchorHtml = match[3];
		if (handle.toLowerCase() !== source.handle.toLowerCase()) continue;
		if (seen.has(statusId)) continue;
		seen.add(statusId);
		const context = telegramPostBlock(html, match.index);
		const text = stripMarkup(anchorHtml).replace(/\s+/g, " ").trim();
		if (text.length < 30 || isGameNews(text, "", `https://x.com/${handle}/status/${statusId}`)) continue;
		const publishedAt = context.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1] ?? context.match(/datetime=["']([^"']+)["']/i)?.[1] ?? "";
		const image = telegramPostImage(context, telegramUrl);
		const articleImages = image ? [image] : [];
		const xUrl = `https://x.com/${handle}/status/${statusId}`;
		const rawTitle = cleanExternalTitle(text);
		if (!rawTitle) continue;
		const animeId = await findAniListAnimeId(rawTitle);
		const meta = await fetchAniListMeta(animeId);
		const translatedTitle = await translateExternalTitle(rawTitle, animeId);
		const bestImage = meta.image || image || articleImages[0] || "";
		const bannerImage = meta.bannerImage || image || "";
		results.push({
			id: `sugoi-${handle.toLowerCase()}-${statusId}`,
			title: finalizeExternalNewsTitle(translatedTitle || rawTitle),
			description: translatedTitle || rawTitle,
			publishedAt: publishedAt && !Number.isNaN(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
			url: xUrl,
			image: bestImage,
			bannerImage,
			articleImages,
			source: handle,
			type: "RUMOR",
			isRumor: true,
			animeId,
			xPosts: [xUrl]
		});
	}
	return results;
}
async function fetchExternalNews() {
	const [rssResults, sugoiResults] = await Promise.all([Promise.allSettled(EXTERNAL_NEWS_FEEDS.filter((feed) => feed.kind === "rss").map((feed) => fetchExternalFeed(feed))), Promise.allSettled(EXTERNAL_NEWS_FEEDS.filter((feed) => feed.kind === "x-mirror").map((source) => fetchSugoiProfile(source)))]);
	const merged = [...rssResults.flatMap((result) => result.status === "fulfilled" ? result.value : []), ...sugoiResults.flatMap((result) => result.status === "fulfilled" ? result.value : [])];
	const unique = /* @__PURE__ */ new Map();
	for (const item of merged) {
		const key = item.url || `${item.source}:${item.title}`;
		if (!unique.has(key)) unique.set(key, item);
	}
	const sorted = Array.from(unique.values()).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
	const reviewed = (await reviewExternalNewsInBatches(Array.from(new Map(EXTERNAL_NEWS_FEEDS.flatMap((feed) => sorted.filter((item) => item.source === feed.name).slice(0, 10).map((item) => [item.url || `${item.source}:${item.title}`, item]))).values()).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)), 3)).filter((item) => Boolean(item));
	return Promise.all(reviewed.map(async (item) => ({
		id: item.id,
		type: item.type,
		title: item.title,
		description: item.description || "Descrição indisponível.",
		date: formatExternalDate(item.publishedAt),
		image: item.image,
		bannerImage: item.bannerImage,
		animeId: item.animeId,
		trailerUrl: item.trailerUrl,
		source: item.source,
		sourceUrl: item.url,
		publishedAt: item.publishedAt,
		articleImages: item.articleImages,
		isRumor: item.isRumor,
		xPosts: item.xPosts
	})));
}
async function buildNews(media, latestEpisodes) {
	const prepared = media.map((anime) => {
		return {
			anime,
			title: titleOf(anime),
			trailerUrl: trailerOf(anime),
			latestEpisode: latestEpisodes.get(anime.id)
		};
	});
	const descriptions = await Promise.all(prepared.map(({ anime }) => descriptionOf(anime)));
	const news = [];
	const now = Date.now();
	const isAdultFeed = media.some((anime) => anime.isAdult === true);
	const topRated = [...media].filter((anime) => typeof anime.score === "number" && anime.score > 0).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 8);
	if (isAdultFeed) for (const anime of topRated) {
		const title = titleOf(anime);
		const preparedIndex = prepared.findIndex(({ anime: preparedAnime }) => preparedAnime.id === anime.id);
		const description = preparedIndex >= 0 ? descriptions[preparedIndex] : "";
		news.push({
			id: `auto-highlight-${anime.id}`,
			type: "DESTAQUE",
			title,
			description,
			date: formatDate(anime),
			image: anime.coverImage?.extraLarge || anime.coverImage?.large || "",
			animeId: String(anime.id),
			trailerUrl: trailerOf(anime),
			isAdult: true
		});
	}
	for (let index = 0; index < prepared.length; index++) {
		const { anime, title, trailerUrl, latestEpisode } = prepared[index];
		const description = descriptions[index];
		const isAdult = anime.isAdult === true;
		const startDate = anime.startDate;
		const startTimestamp = startDate?.year && startDate.month && startDate.day ? new Date(startDate.year, startDate.month - 1, startDate.day).getTime() : 0;
		if (isAdultFeed && isAdult && startTimestamp > now) news.push({
			id: `auto-upcoming-${anime.id}`,
			type: "PRÓXIMO LANÇAMENTO",
			title: isAdult ? title : `${title} — próximo lançamento`,
			description: `Novo conteúdo de ${title} está previsto para ${formatDate(anime)}. ${description}`,
			date: formatDate(anime),
			image: anime.coverImage?.extraLarge || anime.coverImage?.large || "",
			animeId: String(anime.id),
			trailerUrl,
			isAdult: anime.isAdult === true
		});
		if (latestEpisode && latestEpisode.episode > 0 && latestEpisode.airingAt * 1e3 <= Date.now()) news.push({
			id: `auto-episode-${anime.id}-${latestEpisode.episode}`,
			type: "NOVO EPISÓDIO",
			title: isAdult ? `${title} — Episode ${latestEpisode.episode}` : `${title} — episódio ${latestEpisode.episode}`,
			description: `O episódio ${latestEpisode.episode} de ${title} foi ao ar em ${formatAiringDate(latestEpisode.airingAt)}. ${description}`,
			date: formatAiringDate(latestEpisode.airingAt),
			image: anime.coverImage?.extraLarge || anime.coverImage?.large || "",
			animeId: String(anime.id),
			trailerUrl,
			isAdult: anime.isAdult === true
		});
		if (trailerUrl) news.push({
			id: `auto-trailer-${anime.id}`,
			type: "TRAILER",
			title: isAdult ? title : `${title} — novo trailer`,
			description,
			date: formatDate(anime),
			image: anime.coverImage?.extraLarge || anime.coverImage?.large || "",
			animeId: String(anime.id),
			trailerUrl,
			isAdult: anime.isAdult === true
		});
		else news.push({
			id: `auto-season-${anime.id}`,
			type: isAdult ? "NOVO HENTAI" : "NOVA TEMPORADA",
			title: isAdult ? title : `${title} — nova temporada`,
			description,
			date: formatDate(anime),
			image: anime.coverImage?.extraLarge || anime.coverImage?.large || "",
			animeId: String(anime.id),
			isAdult: anime.isAdult === true
		});
	}
	const validNews = news.filter((item) => Boolean(item.image));
	validNews.sort((a, b) => {
		const parse = (value) => {
			const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
			if (!match) return 0;
			return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
		};
		return parse(b.date) - parse(a.date);
	});
	return validNews;
}
var fetchAutomaticNews_createServerFn_handler = createServerRpc({
	id: "f1ea62b78b432fed6ec1bf43cf8f2ba5b3df45c894c267b3e9df637937f58c52",
	name: "fetchAutomaticNews",
	filename: "src/lib/news-api.ts"
}, (opts) => fetchAutomaticNews.__executeServer(opts));
var fetchAutomaticNews = createServerFn({ method: "GET" }).handler(fetchAutomaticNews_createServerFn_handler, async () => {
	const current = currentAnimeSeason();
	const season = String(current.season).toUpperCase();
	const year = Number(current.year);
	const key = `automatic-news:v3:${season}:${year}`;
	const cached = fromCache(key);
	if (cached) return cached.filter((item) => item.isAdult !== true);
	try {
		const [media, latestEpisodes, externalNews] = await Promise.all([
			fetchSeason(season, year),
			fetchLatestAiredEpisodes(),
			fetchExternalNews()
		]);
		const catalogNews = await buildNews(media.filter((anime) => anime.isAdult !== true), latestEpisodes);
		return toCache(key, [...externalNews, ...catalogNews].filter((item) => item.isAdult !== true && Boolean(item.image)).sort((a, b) => {
			const aTime = a.publishedAt ? Date.parse(a.publishedAt) : parseNewsDateServer(a.date);
			return (b.publishedAt ? Date.parse(b.publishedAt) : parseNewsDateServer(b.date)) - aTime;
		}));
	} catch {
		return [];
	}
});
function parseNewsDateServer(value) {
	const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	if (!match) return Date.parse(value) || 0;
	return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
}
var fetchAdultNews_createServerFn_handler = createServerRpc({
	id: "b2c77178d85209ea05f26a484f1b5f00d6861d0a5ca93642cfa26ebc34cc900b",
	name: "fetchAdultNews",
	filename: "src/lib/news-api.ts"
}, (opts) => fetchAdultNews.__executeServer(opts));
var fetchAdultNews = createServerFn({ method: "GET" }).handler(fetchAdultNews_createServerFn_handler, async () => {
	const current = currentAnimeSeason();
	const key = `automatic-adult-news:${String(current.season).toUpperCase()}:${Number(current.year)}`;
	const cached = fromCache(key);
	if (cached) return cached.filter((item) => item.isAdult === true);
	try {
		const [adultMedia, latestEpisodes] = await Promise.all([fetchAdultCatalogNews(), fetchLatestAiredEpisodes()]);
		return toCache(key, await buildNews(adultMedia, latestEpisodes));
	} catch {
		return [];
	}
});
//#endregion
export { fetchAdultNews_createServerFn_handler, fetchAutomaticNews_createServerFn_handler };
