import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/utils-Cws_m9jY.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function stripHtml(input) {
	if (!input) return "";
	return input.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&/g, "&").replace(/"/g, "\"").replace(/&#039;/g, "'").replace(/</g, "<").replace(/>/g, ">").replace(/\n{3,}/g, "\n\n").trim();
}
function youtubeIdFrom(input) {
	if (!input) return null;
	const trimmed = input.trim();
	if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
	try {
		const url = new URL(trimmed);
		if (url.hostname.includes("youtu.be")) {
			const id = url.pathname.split("/").filter(Boolean)[0];
			return id && id.length === 11 ? id : null;
		}
		const v = url.searchParams.get("v");
		if (v && v.length === 11) return v;
		const embed = url.pathname.match(/\/embed\/([\w-]{11})/);
		if (embed?.[1]) return embed[1];
	} catch {
		return null;
	}
	return null;
}
function isDirectVideo(url) {
	return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}
function currentAnimeSeason(now = /* @__PURE__ */ new Date()) {
	const month = now.getMonth();
	const year = now.getFullYear();
	if (month <= 2) return {
		season: "WINTER",
		year
	};
	if (month <= 5) return {
		season: "SPRING",
		year
	};
	if (month <= 8) return {
		season: "SUMMER",
		year
	};
	return {
		season: "FALL",
		year
	};
}
//#endregion
export { youtubeIdFrom as a, stripHtml as i, currentAnimeSeason as n, isDirectVideo as r, cn as t };
