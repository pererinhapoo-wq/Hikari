import { twMerge } from "tailwind-merge";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs)).replace(/\s+/g, " ").trim();
}

export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function youtubeIdFrom(input: string | null | undefined): string | null {
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

export function isHlsSource(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.m3u8(\?|$)/i.test(url) || url.includes(".m3u8");
}

export function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(url) || url.includes(".m3u8");
}

export type OfficialAnimeSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export function normalizeAnimeSeason(
  value: unknown,
): OfficialAnimeSeason | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  if (
    upper === "WINTER" ||
    upper === "SPRING" ||
    upper === "SUMMER" ||
    upper === "FALL"
  ) {
    return upper;
  }
  return null;
}

export function currentAnimeSeason(now = new Date()): {
  season: OfficialAnimeSeason;
  year: number;
} {
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month <= 2) return { season: "WINTER", year };
  if (month <= 5) return { season: "SPRING", year };
  if (month <= 8) return { season: "SUMMER", year };
  return { season: "FALL", year };
}

const SEASON_ORDER: readonly OfficialAnimeSeason[] = [
  "WINTER",
  "SPRING",
  "SUMMER",
  "FALL",
];

export function stepAnimeSeason(
  season: OfficialAnimeSeason,
  year: number,
  delta: number,
): {
  season: OfficialAnimeSeason;
  year: number;
} {
  const index = SEASON_ORDER.indexOf(season);
  const safeIndex = index >= 0 ? index : 0;
  const total = year * 4 + safeIndex + delta;
  const nextYear = Math.floor(total / 4);
  const nextIndex = ((total % 4) + 4) % 4;
  return {
    season: SEASON_ORDER[nextIndex],
    year: nextYear,
  };
}

export function compareAnimeSeasons(
  a: { season: OfficialAnimeSeason; year: number },
  b: { season: OfficialAnimeSeason; year: number },
): number {
  const idxA = SEASON_ORDER.indexOf(a.season);
  const idxB = SEASON_ORDER.indexOf(b.season);
  return a.year * 4 + idxA - (b.year * 4 + idxB);
}

export function prevAnimeSeason(now = new Date()): {
  season: OfficialAnimeSeason;
  year: number;
} {
  const current = currentAnimeSeason(now);
  return stepAnimeSeason(current.season, current.year, -1);
}

export function nextAnimeSeason(now = new Date()): {
  season: OfficialAnimeSeason;
  year: number;
} {
  const current = currentAnimeSeason(now);
  return stepAnimeSeason(current.season, current.year, 1);
}
