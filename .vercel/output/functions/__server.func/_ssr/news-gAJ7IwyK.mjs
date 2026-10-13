import { i as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc--phiu8Av.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news-gAJ7IwyK.js
var fetchCrunchyrollCalendar_createServerFn_handler = createServerRpc({
	id: "222b3dfe54295947a131bb0d19c0ff0a9e661db4872cb60be14e310af07374d7",
	name: "fetchCrunchyrollCalendar",
	filename: "src/routes/news.tsx"
}, (opts) => fetchCrunchyrollCalendar.__executeServer(opts));
var fetchCrunchyrollCalendar = createServerFn({ method: "GET" }).handler(fetchCrunchyrollCalendar_createServerFn_handler, async () => {
	try {
		const response = await fetch("https://www.crunchyroll.com/simulcastcalendar?filter=premium", {
			cache: "no-store",
			headers: {
				Accept: "text/html,application/xhtml+xml",
				"User-Agent": "Hikari/1.0 (anime calendar)"
			},
			signal: AbortSignal.timeout(12e3)
		});
		if (!response.ok) return [];
		const html = await response.text();
		const slugMatches = Array.from(html.matchAll(/data-slug=["']([^"']+)["']/gi));
		const releases = [];
		for (let index = 0; index < slugMatches.length; index += 1) {
			const match = slugMatches[index];
			const slug = match[1]?.trim();
			const start = match.index ?? -1;
			if (!slug || start < 0 || slug === "showSlug") continue;
			const nextStart = slugMatches[index + 1]?.index ?? html.length;
			const block = html.slice(start, nextStart);
			const datetime = block.match(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/i)?.[1];
			if (!datetime) continue;
			const timestamp = Date.parse(datetime);
			if (Number.isNaN(timestamp)) continue;
			const episodeMatch = block.match(/\b(?:Episode|Episódio)\s+(\d+(?:\.\d+)?)\b/i);
			releases.push({
				slug,
				airingAt: Math.floor(timestamp / 1e3),
				episode: episodeMatch?.[1] ? Number(episodeMatch[1]) : void 0
			});
		}
		const unique = /* @__PURE__ */ new Map();
		for (const release of releases) {
			const key = `${release.slug}:${release.episode ?? ""}:${release.airingAt}`;
			if (!unique.has(key)) unique.set(key, release);
		}
		return Array.from(unique.values());
	} catch {
		return [];
	}
});
//#endregion
export { fetchCrunchyrollCalendar_createServerFn_handler };
