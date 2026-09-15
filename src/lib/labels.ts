export const GENRE_PT: Record<string, string> = {
  Action: "Ação",
  Adventure: "Aventura",
  Comedy: "Comédia",
  Drama: "Drama",
  Ecchi: "Ecchi",
  Fantasy: "Fantasia",
  Horror: "Terror",
  MahouShoujo: "Mahou Shoujo",
  "Mahou Shoujo": "Mahou Shoujo",
  Mecha: "Mecha",
  Music: "Música",
  Mystery: "Mistério",
  Psychological: "Psicológico",
  Romance: "Romance",
  "Sci-Fi": "Ficção científica",
  "Slice of Life": "Slice of Life",
  Sports: "Esportes",
  Supernatural: "Sobrenatural",
  Thriller: "Suspense",
  Hentai: "Hentai",
};

export const FORMAT_PT: Record<string, string> = {
  TV: "Série",
  TV_SHORT: "TV Short",
  MOVIE: "Filme",
  SPECIAL: "Especial",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Música",
  MANGA: "Mangá",
  NOVEL: "Light novel",
  ONE_SHOT: "One-shot",
};

export const STATUS_PT: Record<string, string> = {
  FINISHED: "Encerrado",
  RELEASING: "Em exibição",
  NOT_YET_RELEASED: "Em breve",
  CANCELLED: "Cancelado",
  HIATUS: "Hiato",
};

export const SEASON_PT: Record<string, string> = {
  WINTER: "Inverno",
  SPRING: "Primavera",
  SUMMER: "Verão",
  FALL: "Outono",
};

export const SORT_OPTIONS = [
  { value: "TRENDING_DESC", label: "Em alta" },
  { value: "POPULARITY_DESC", label: "Popularidade" },
  { value: "SCORE_DESC", label: "Nota" },
  { value: "START_DATE_DESC", label: "Mais recentes" },
  { value: "TITLE_ROMAJI", label: "Título A–Z" },
] as const;

export function genreLabel(genre: string): string {
  return GENRE_PT[genre] ?? genre;
}

export function formatLabel(format: string | null | undefined): string {
  if (!format) return "";
  return FORMAT_PT[format] ?? format;
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return STATUS_PT[status] ?? status;
}

export function seasonLabel(season: string | null | undefined, year?: number | null): string {
  if (!season) return year ? String(year) : "";
  const s = SEASON_PT[season] ?? season;
  return year ? `${s} ${year}` : s;
}

export function scoreLabel(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "—";
  return (score / 10).toFixed(1);
}
