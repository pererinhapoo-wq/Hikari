import { i as createServerFn } from "./ssr.mjs";
import { i as stripHtml, n as currentAnimeSeason } from "./utils-Cws_m9jY.mjs";
import { t as createServerRpc } from "./createServerRpc--phiu8Av.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news-api-adulto-separado-2FACFQ8e.js
var ANILIST = "https://graphql.anilist.co";
var ADULT_NEWS_RSS_FEEDS = ["https://eroeronews.com/categorias/estrenos/feed/", "https://www.lune-soft.jp/feed"];
var cache = /* @__PURE__ */ new Map();
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
function titleOf(media) {
	return media.title?.english || media.title?.romaji || media.title?.native || "Anime";
}
function descriptionOf(media) {
	const description = stripHtml(media.description);
	if (description) return description;
	return `${titleOf(media)} faz parte da programação da temporada de ${(media.season ?? "").toLowerCase()} de ${media.seasonYear ?? ""}.`;
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
                  sort: START_DATE
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
                }
              }
            }
          `,
			variables: {
				season,
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
function decodeXml(value) {
	return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function firstXmlValue(block, tag) {
	return decodeXml(block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1]?.trim() ?? "");
}
function imageFromRss(block) {
	for (const pattern of [
		/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i,
		/<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i,
		/<thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i,
		/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i,
		/<(?:img|source)[^>]+(?:data-src|data-lazy-src|data-original|data-image)=["']([^"']+)["'][^>]*>/i,
		/<(?:img|source)[^>]+src=["']([^"']+)["'][^>]*>/i
	]) {
		const match = block.match(pattern);
		if (match?.[1]) return decodeXml(match[1]);
	}
	return decodeXml(firstXmlValue(block, "content:encoded").match(/<img[^>]+(?:data-src|data-lazy-src|data-original|src)=["']([^"']+)["'][^>]*>/i)?.[1] ?? "");
}
function isSourceBrandImage(imageUrl) {
	try {
		const url = new URL(imageUrl);
		const value = decodeURIComponent(`${url.pathname}${url.search}`).toLowerCase();
		return /(?:^|[\/_?=&.-])(logo|favicon|site-logo|header-logo|footer-logo|lune-logo)(?:[\/_?=&.-]|$)/i.test(value);
	} catch {
		return false;
	}
}
function removeSourceBrandText(value) {
	return value.replace(/(?:fonte\s*:\s*)?(?:eroero[ -]?news|lune\s*soft(?:\s*&\s*lune\s*pictures)?)/gi, "").replace(/\s{2,}/g, " ").trim();
}
function imagesFromHtml(html, baseUrl) {
	const values = [];
	const add = (value, context = "") => {
		const decoded = decodeXml(value.trim());
		if (!decoded) return;
		try {
			const absolute = new URL(decoded, baseUrl).href;
			const contextValue = context.toLowerCase();
			if (/\b(?:logo|favicon|branding|site-brand|header-brand|footer-brand)\b/.test(contextValue) || /(?:eroero\s*news|lune\s*soft|lune\s*pictures)/i.test(contextValue) || isSourceBrandImage(absolute)) return;
			if (/^https?:\/\//i.test(absolute) && !values.includes(absolute)) values.push(absolute);
		} catch {}
	};
	for (const pattern of [
		/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
		/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/gi,
		/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
		/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/gi
	]) for (const match of html.matchAll(pattern)) if (match[1]) add(match[1]);
	for (const match of html.matchAll(/<img[^>]+(?:data-src|data-lazy-src|data-original|data-image|src)=["']([^"']+)["'][^>]*>/gi)) if (match[1]) add(match[1], match[0]);
	return values.slice(0, 5);
}
async function fetchArticleImages(articleUrl) {
	const url = articleUrl.trim();
	if (!/^https?:\/\//i.test(url)) return [];
	try {
		const response = await fetch(url, {
			headers: {
				Accept: "text/html,application/xhtml+xml",
				"User-Agent": "Hikari/1.0 (adult news image)"
			},
			signal: AbortSignal.timeout(8e3)
		});
		if (!response.ok) return [];
		return imagesFromHtml(await response.text(), url);
	} catch {
		return [];
	}
}
async function proxyRssImage(imageUrl, maxImageBytes = 15e5) {
	const url = imageUrl.trim();
	if (!/^https?:\/\//i.test(url)) return "";
	const MAX_IMAGE_BYTES = maxImageBytes;
	try {
		const response = await fetch(url, {
			headers: {
				Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
				Referer: `${new URL(url).origin}/`,
				"User-Agent": "Hikari/1.0 (adult news image)"
			},
			signal: AbortSignal.timeout(8e3)
		});
		if (!response.ok) return "";
		const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
		if (!contentType.startsWith("image/")) return "";
		const contentLength = Number(response.headers.get("content-length") ?? "0");
		if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) return "";
		const buffer = new Uint8Array(await response.arrayBuffer());
		if (buffer.byteLength > MAX_IMAGE_BYTES) return "";
		let binary = "";
		const CHUNK_SIZE = 32768;
		for (let index = 0; index < buffer.length; index += CHUNK_SIZE) binary += String.fromCharCode(...buffer.subarray(index, Math.min(index + CHUNK_SIZE, buffer.length)));
		return `data:${contentType};base64,${btoa(binary)}`;
	} catch {
		return "";
	}
}
function looksSpanish(value) {
	const text = ` ${value.toLowerCase()} `;
	return [
		" el ",
		" la ",
		" los ",
		" las ",
		" un ",
		" una ",
		" de ",
		" del ",
		" para ",
		" con ",
		" por ",
		" que ",
		" se ",
		" este ",
		" estos ",
		" esta ",
		" estas ",
		" nueva ",
		" nuevo ",
		" estrenos ",
		" tráiler ",
		" termina ",
		" fueron ",
		" vendidos ",
		" imágenes ",
		" revelan "
	].filter((marker) => text.includes(marker)).length >= 2;
}
async function translateTextToPortuguese(value) {
	const text = value.trim();
	if (!text || !looksSpanish(text)) return text;
	const MAX_QUERY_CHARS = 450;
	const splitIntoChunks = (input) => {
		const chunks = [];
		let remaining = input.trim();
		while (remaining.length > MAX_QUERY_CHARS) {
			let cut = remaining.lastIndexOf(" ", MAX_QUERY_CHARS);
			if (cut < 120) cut = MAX_QUERY_CHARS;
			chunks.push(remaining.slice(0, cut).trim());
			remaining = remaining.slice(cut).trim();
		}
		if (remaining) chunks.push(remaining);
		return chunks;
	};
	const buildGoogleUrl = (baseUrl, chunk) => {
		const url = new URL(baseUrl);
		url.searchParams.set("client", "gtx");
		url.searchParams.set("sl", "es");
		url.searchParams.set("tl", "pt");
		url.searchParams.set("dt", "t");
		url.searchParams.set("q", chunk);
		return url.toString();
	};
	const extractGoogleTranslation = (data) => {
		if (Array.isArray(data) && Array.isArray(data[0])) return data[0].filter((part) => Array.isArray(part)).map((part) => String(part[0] ?? "")).join("").trim();
		if (typeof data === "object" && data !== null && "sentences" in data) {
			const sentences = data.sentences;
			if (Array.isArray(sentences)) return sentences.map((sentence) => sentence.trans ?? "").join("").trim();
		}
		return "";
	};
	const translateChunkWithGoogle = async (chunk) => {
		for (const endpoint of [
			"https://translate.googleapis.com/translate_a/single",
			"https://translate.google.com/translate_a/single",
			"https://clients5.google.com/translate_a/t"
		]) try {
			const url = buildGoogleUrl(endpoint, chunk);
			const response = await fetch(url, {
				headers: {
					Accept: "application/json",
					"User-Agent": "Mozilla/5.0 (compatible; Hikari/1.0; adult news translation)"
				},
				signal: AbortSignal.timeout(7e3)
			});
			if (!response.ok) continue;
			const data = await response.json();
			const translated = extractGoogleTranslation(data);
			if (translated && translated !== chunk) return translated;
		} catch {}
		return "";
	};
	const translateChunkWithMyMemory = async (chunk) => {
		try {
			const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=es|pt-BR`, {
				headers: {
					Accept: "application/json",
					"User-Agent": "Hikari/1.0 (adult news translation)"
				},
				signal: AbortSignal.timeout(7e3)
			});
			if (!response.ok) return "";
			const translated = (await response.json()).responseData?.translatedText?.trim() ?? "";
			if (translated && translated !== chunk) return translated;
		} catch {}
		return "";
	};
	const chunks = splitIntoChunks(text);
	const translatedChunks = [];
	for (const chunk of chunks) {
		const translated = await translateChunkWithGoogle(chunk) || await translateChunkWithMyMemory(chunk);
		translatedChunks.push(translated || chunk);
	}
	return translatedChunks.join(" ").replace(/\s+/g, " ").trim() || text;
}
async function translateEroEroItem(title, description) {
	const [translatedTitle, translatedDescription] = await Promise.all([translateTextToPortuguese(title), translateTextToPortuguese(description)]);
	return {
		title: translatedTitle,
		description: translatedDescription
	};
}
function normalizeSearchText(value) {
	return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function mediaSearchCandidates(title, description) {
	const source = `${title}\n${description}`;
	const candidates = [];
	for (const pattern of [/[“「『"]([^”」』"\n]{2,120})[”」』"]/g, /[‘']([^’'\n]{2,120})[’']/g]) for (const match of source.matchAll(pattern)) {
		const value = match[1]?.trim();
		if (value && value.length >= 3) candidates.push(value);
	}
	candidates.push(title.trim());
	return Array.from(new Set(candidates.map((value) => value.trim()).filter(Boolean))).slice(0, 4);
}
function mediaTitleValues(media) {
	return [
		media.title?.english,
		media.title?.romaji,
		media.title?.native
	].filter((value) => Boolean(value?.trim()));
}
function titleMatchScore(candidate, media) {
	const query = normalizeSearchText(candidate);
	if (!query) return 0;
	let best = 0;
	for (const title of mediaTitleValues(media)) {
		const normalized = normalizeSearchText(title);
		if (!normalized) continue;
		if (normalized === query) {
			best = Math.max(best, 100);
			continue;
		}
		if (normalized.includes(query) || query.includes(normalized)) {
			best = Math.max(best, 80);
			continue;
		}
		const queryTokens = new Set(query.split(" ").filter(Boolean));
		const titleTokens = new Set(normalized.split(" ").filter(Boolean));
		if (!queryTokens.size || !titleTokens.size) continue;
		let overlap = 0;
		for (const token of queryTokens) if (titleTokens.has(token)) overlap += 1;
		best = Math.max(best, Math.round(overlap / queryTokens.size * 70));
	}
	return best;
}
var mediaCoverCache = /* @__PURE__ */ new Map();
async function fetchAniListCover(title, description) {
	const candidates = mediaSearchCandidates(title, description);
	for (const candidate of candidates) {
		const key = normalizeSearchText(candidate);
		if (!key) continue;
		const cached = mediaCoverCache.get(key);
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
              query AdultNewsMediaCover(
                $search: String!
              ) {
                Page(
                  page: 1
                  perPage: 10
                ) {
                  media(
                    search: $search
                    type: ANIME
                    isAdult: true
                  ) {
                    id
                    type
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
                  }
                }
              }
            `,
					variables: { search: candidate }
				}),
				signal: AbortSignal.timeout(8e3)
			});
			if (!response.ok) continue;
			const match = ((await response.json()).data?.Page?.media ?? []).filter((item) => item.isAdult === true && Boolean(item.coverImage?.extraLarge || item.coverImage?.large)).sort((a, b) => titleMatchScore(candidate, b) - titleMatchScore(candidate, a))[0];
			const image = match?.coverImage?.extraLarge || match?.coverImage?.large || "";
			if (image) {
				mediaCoverCache.set(key, image);
				return image;
			}
		} catch {}
	}
	return "";
}
function isListLikeAdultNews(title, description) {
	const value = `${title} ${description}`.toLowerCase();
	return /\b(lista|ranking|mais vendidos|recomend|outubro|novembro|dezembro|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro)\b/.test(value);
}
function cleanMentionedHentaiTitle(value) {
	return value.replace(/\s+(?:a\s+)?animação\s+\d+(?:\s+e\s+\d+)?\s*$/i, "").replace(/\s+\d{1,2}(?:\s+e\s+\d{1,2})?\s*(?:\(pacote\))?\s*$/i, "").replace(/\s+\(pacote\)\s*$/i, "").replace(/\s+/g, " ").trim();
}
function extractHentaiTitles(title, description) {
	if (!isListLikeAdultNews(title, description)) return [];
	const source = stripHtml(description).replace(/\r/g, "").replace(/\u00a0/g, " ");
	const values = [];
	for (const match of source.matchAll(/(?:^|[\n\r]|\s)(\d+)\s*(?:\.\s*-|-\s*|\)\s*|\.\s*)([^\n]+?)(?=(?:\s+\d+\s*(?:\.\s*-|-\s*|\)\s*|\.\s*))|[\n\r]+|$)/g)) {
		const value = cleanMentionedHentaiTitle(match[2] ?? "");
		if (value && value.length >= 4 && value.length <= 140) values.push(value);
	}
	return Array.from(new Map(values.map((value) => [normalizeSearchText(value), value])).values()).slice(0, 12);
}
async function fetchMentionedHentai(title, description) {
	const titles = extractHentaiTitles(title, description);
	if (!titles.length) return [];
	return (await Promise.all(titles.map(async (hentaiTitle) => {
		const image = await fetchAniListCover(hentaiTitle, hentaiTitle);
		if (!image) return null;
		return {
			title: hentaiTitle,
			image
		};
	}))).filter((item) => Boolean(item));
}
var ADULT_IMAGE_FALLBACK = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
      <rect width="800" height="450" fill="#17131f"/>
      <text x="400" y="225" fill="#a855f7" font-family="Arial, sans-serif" font-size="42" text-anchor="middle" dominant-baseline="middle">Hikari +18</text>
    </svg>
  `)}`;
function formatRssDate(value) {
	if (!value) return "";
	const timestamp = Date.parse(value);
	if (Number.isNaN(timestamp)) return value;
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(new Date(timestamp));
}
function isoDateFromParts(year, month, day) {
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
var EROERO_MONTHS = {
	enero: 1,
	febrero: 2,
	marzo: 3,
	abril: 4,
	mayo: 5,
	junio: 6,
	julio: 7,
	agosto: 8,
	septiembre: 9,
	octubre: 10,
	noviembre: 11,
	diciembre: 12
};
function extractCanonicalPublishedAt(html, source) {
	if (!html) return "";
	const visibleText = stripHtml(html).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
	if (source === "eroero") {
		const visible = visibleText.match(/EroEro\s+News\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{1,2}),\s*(20\d{2})/i);
		if (visible) {
			const month = EROERO_MONTHS[visible[1].toLowerCase()];
			if (month) return isoDateFromParts(visible[3], String(month), visible[2]);
		}
	}
	if (source === "lune") {
		const visible = visibleText.match(/(?:アニメ|ニュース)\s+(20\d{2})\.(\d{1,2})\.(\d{1,2})/i);
		if (visible) return isoDateFromParts(visible[1], visible[2], visible[3]);
	}
	const jsonLd = html.match(/["']datePublished["']\s*:\s*["'](20\d{2})[-.](\d{1,2})[-.](\d{1,2})(?:T[^"']*)?["']/i);
	if (jsonLd) return isoDateFromParts(jsonLd[1], jsonLd[2], jsonLd[3]);
	const meta = html.match(/<meta[^>]+(?:property|name)=["'](?:article:published_time|date|publishdate)["'][^>]+content=["']([^"']+)["'][^>]*>/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:published_time|date|publishdate)["'][^>]*>/i);
	if (meta?.[1]) {
		const parsed = new Date(meta[1]);
		if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
	}
	return "";
}
async function fetchCanonicalPublishedAt(url, source, fallback) {
	try {
		const response = await fetch(url, {
			headers: {
				Accept: "text/html,application/xhtml+xml",
				"User-Agent": "Hikari/1.0 (adult news date)"
			},
			signal: AbortSignal.timeout(8e3)
		});
		if (!response.ok) return fallback;
		return extractCanonicalPublishedAt(await response.text(), source) || fallback;
	} catch {
		return fallback;
	}
}
function typeFromRss(title, categories) {
	const value = `${title} ${categories}`.toLowerCase();
	if (value.includes("trailer") || value.includes("tráiler") || value.includes("デモムービー") || value.includes("pv")) return "TRAILER";
	if (value.includes("episodio") || value.includes("episode") || value.includes("capítulo") || value.includes("chapter")) return "NOVO EPISÓDIO";
	if (value.includes("estreno") || value.includes("estreia") || value.includes("ova") || value.includes("lançamento") || value.includes("発売") || value.includes("発売中")) return "ESTREIA";
	if (value.includes("recomend") || value.includes("vendidos") || value.includes("ranking") || value.includes("top ")) return "RECOMENDAÇÃO";
	if (value.includes("nuevo") || value.includes("nuevo hentai") || value.includes("novo") || value.includes("hentai") || value.includes("manga hentai") || value.includes("manhwa") || value.includes("manhua") || value.includes("アニメ化") || value.includes("新作") || value.includes("続編")) return "NOVO HENTAI";
	return "ANÚNCIO";
}
async function fetchAdultNewsFeed(feedUrl) {
	const response = await fetch(feedUrl, {
		headers: {
			Accept: "application/rss+xml, application/xml, text/xml",
			"User-Agent": "Hikari/1.0 (adult news)"
		},
		signal: AbortSignal.timeout(12e3)
	});
	if (!response.ok) throw new Error(`Fonte de notícias indisponível (${response.status})`);
	const items = (await response.text()).match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
	const source = feedUrl.includes("eroeronews.com") ? "eroero" : "lune";
	const hentaiOnly = (await Promise.all(items.map(async (item) => {
		const title = firstXmlValue(item, "title");
		const link = firstXmlValue(item, "link");
		const rssDate = firstXmlValue(item, "pubDate");
		const categories = Array.from(item.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)).map((match) => decodeXml(match[1] ?? "")).join(" ");
		const categoryValue = categories.toLowerCase();
		if (source === "lune" && !categoryValue.includes("アニメ") && !categoryValue.includes("anime")) return null;
		if (/\bmanhwa\b/.test(categoryValue) || /\bmanhua\b/.test(categoryValue) || /\bmanga\b/.test(categoryValue) || /manga hentai/i.test(categoryValue)) return null;
		const rawDescription = firstXmlValue(item, "content:encoded") || firstXmlValue(item, "description");
		const articleImages = imagesFromHtml(rawDescription, link);
		const description = removeSourceBrandText(stripHtml(rawDescription));
		if (!title || !link) return null;
		const rssImage = imageFromRss(item);
		const rssPublishedAt = Number.isNaN(Date.parse(rssDate)) ? "" : new Date(Date.parse(rssDate)).toISOString();
		const publishedAt = await fetchCanonicalPublishedAt(link, source, rssPublishedAt);
		if (!publishedAt) return null;
		return {
			id: `auto-adult-${source}-${encodeURIComponent(link)}`,
			type: typeFromRss(title, categories),
			title,
			description: description || "Nova notícia da área adulta.",
			date: formatRssDate(publishedAt),
			publishedAt,
			image: isSourceBrandImage(rssImage) ? "" : rssImage,
			animeId: "",
			isAdult: true,
			url: link,
			source: source === "eroero" ? "EroEro News" : "Lune Soft & Lune Pictures",
			articleImages
		};
	}))).filter((item) => Boolean(item?.title && item?.url && item?.publishedAt)).filter((item) => {
		const value = `${item.title} ${item.description}`.toLowerCase();
		return !(/\bmanhwa\b/.test(value) || /\bmanhua\b/.test(value) || /\bmanga\b/.test(value) || /\bmanga hentai\b/.test(value) || /\bjav\b/.test(value) || /\blive action\b/.test(value));
	});
	return Promise.all(hentaiOnly.map(async (item) => {
		const translated = item.source === "EroEro News" ? await translateEroEroItem(item.title, item.description) : {
			title: item.title,
			description: item.description
		};
		const title = translated.title;
		const description = translated.description;
		let rssImage = "";
		let articleImages = [...item.articleImages ?? []];
		if (item.image) rssImage = await proxyRssImage(item.image, 5e6) || item.image;
		if (item.url) {
			const pageImages = await fetchArticleImages(item.url);
			articleImages = [...articleImages, ...pageImages].filter((value, index, list) => list.indexOf(value) === index).slice(0, 8);
			if (!rssImage && pageImages.length) for (const pageImage of pageImages) {
				const proxied = await proxyRssImage(pageImage, 5e6);
				if (proxied) {
					rssImage = proxied;
					break;
				}
			}
		}
		const proxiedArticleImages = (await Promise.all(articleImages.map(async (imageUrl) => {
			return await proxyRssImage(imageUrl, 5e6);
		}))).filter(Boolean);
		const mentionedHentai = await fetchMentionedHentai(item.title, item.description);
		return {
			...item,
			title,
			description,
			image: proxiedArticleImages[0] || rssImage || ADULT_IMAGE_FALLBACK,
			articleImages: proxiedArticleImages,
			mentionedHentai
		};
	}));
}
var fetchAutomaticNews_createServerFn_handler = createServerRpc({
	id: "2408c7aaba9fc9016c2215b439cac163d811f6952160ab01aa2ead2d191d6b8a",
	name: "fetchAutomaticNews",
	filename: "src/lib/news-api-adulto-separado.ts"
}, (opts) => fetchAutomaticNews.__executeServer(opts));
var fetchAutomaticNews = createServerFn({ method: "GET" }).handler(fetchAutomaticNews_createServerFn_handler, async () => {
	const current = currentAnimeSeason();
	const key = `automatic-news:${current.season}:${current.year}`;
	const cached = fromCache(key);
	if (cached) return cached;
	try {
		return toCache(key, (await fetchSeason(current.season, current.year)).filter((anime) => anime.id > 0 && anime.format !== "MUSIC" && anime.isAdult !== true).map((anime) => ({
			id: `auto-${anime.id}`,
			type: "NOVA TEMPORADA",
			title: `${titleOf(anime)} — nova temporada`,
			description: descriptionOf(anime),
			date: formatDate(anime),
			publishedAt: anime.startDate?.year && anime.startDate?.month && anime.startDate?.day ? new Date(anime.startDate.year, anime.startDate.month - 1, anime.startDate.day).toISOString() : "",
			image: anime.coverImage?.extraLarge || anime.coverImage?.large || "",
			animeId: String(anime.id),
			isAdult: anime.isAdult === true
		})).filter((news) => Boolean(news.image)));
	} catch {
		return [];
	}
});
var fetchAdultNews_createServerFn_handler = createServerRpc({
	id: "5cc973c32ede02a65485e2adfda14684d5de9105f544e48c223da6362c746cf0",
	name: "fetchAdultNews",
	filename: "src/lib/news-api-adulto-separado.ts"
}, (opts) => fetchAdultNews.__executeServer(opts));
var fetchAdultNews = createServerFn({ method: "GET" }).handler(fetchAdultNews_createServerFn_handler, async () => {
	const current = currentAnimeSeason();
	const key = `automatic-adult-news:hentai-real-publication-date:v4-news-images:${current.season}:${current.year}`;
	const cached = fromCache(key);
	if (cached) return cached;
	try {
		const [media, ...rssResults] = await Promise.all([fetchSeason(current.season, current.year).catch(() => []), ...ADULT_NEWS_RSS_FEEDS.map((feedUrl) => fetchAdultNewsFeed(feedUrl).catch(() => []))]);
		const combined = [...rssResults.flat()];
		const unique = Array.from(new Map(combined.map((item) => [item.url || `${item.title}-${item.date}`, item])).values());
		unique.sort((a, b) => {
			const timeA = a.publishedAt ? Date.parse(a.publishedAt) : Date.parse(a.date.split("/").reverse().join("-"));
			const timeB = b.publishedAt ? Date.parse(b.publishedAt) : Date.parse(b.date.split("/").reverse().join("-"));
			return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
		});
		return toCache(key, unique);
	} catch {
		return [];
	}
});
//#endregion
export { fetchAdultNews_createServerFn_handler, fetchAutomaticNews_createServerFn_handler };
