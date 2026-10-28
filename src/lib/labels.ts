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

export const SOURCE_PT: Record<string, string> = {
  ORIGINAL: "Obra original",
  MANGA: "Mangá",
  LIGHT_NOVEL: "Light novel",
  VISUAL_NOVEL: "Visual novel",
  VIDEO_GAME: "Jogo eletrônico",
  GAME: "Jogo eletrônico",
  OTHER: "Outro",
  NOVEL: "Livro / Romance",
  DOUJINSHI: "Doujinshi",
  ANIME: "Anime",
  WEB_NOVEL: "Web novel",
  LIVE_ACTION: "Live action",
  MULTIMEDIA_PROJECT: "Projeto multimídia",
  PICTURE_BOOK: "Livro ilustrado",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "";
  return SOURCE_PT[source.toUpperCase()] ?? source;
}

export const STAFF_ROLE_PT: Record<string, string> = {
  Director: "Diretor",
  "Series Composition": "Composição da série",
  "Character Design": "Design de personagens",
  "Original Creator": "Criador original",
  "Original Character Design": "Design original de personagens",
  Music: "Música / Trilha sonora",
  Script: "Roteiro",
  Screenplay: "Roteiro",
  Writer: "Roteirista",
  "Sound Director": "Direção de som",
  "Art Director": "Direção de arte",
  "Chief Animation Director": "Direção-chefe de animação",
  "Animation Director": "Direção de animação",
  Producer: "Produtor",
  "Executive Producer": "Produtor executivo",
  "Theme Song Performance": "Tema musical",
  Editing: "Edição",
  "Director of Photography": "Direção de fotografia",
  "Color Design": "Design de cores",
  "Assistant Director": "Assistente de direção",
  "Key Animation": "Animação-chave",
  Storyboard: "Storyboard",
  "Sound Effects": "Efeitos sonoros",
  Planning: "Planejamento",
};

export function staffRoleLabel(role: string | null | undefined): string {
  if (!role) return "";
  if (STAFF_ROLE_PT[role]) return STAFF_ROLE_PT[role];
  for (const [key, val] of Object.entries(STAFF_ROLE_PT)) {
    if (role.toLowerCase() === key.toLowerCase()) return val;
  }
  return role;
}

export function formatDateLabel(
  date?: { year?: number | null; month?: number | null; day?: number | null } | null,
): string {
  if (!date || !date.year) return "";
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  if (date.day && date.month && date.month >= 1 && date.month <= 12) {
    const dayStr = String(date.day).padStart(2, "0");
    return `${dayStr} de ${months[date.month - 1]} de ${date.year}`;
  }
  if (date.month && date.month >= 1 && date.month <= 12) {
    return `${months[date.month - 1]} de ${date.year}`;
  }
  return String(date.year);
}

export function ratingLabel(rating?: string | null, isAdult?: boolean): string {
  if (isAdult) return "18+ (Conteúdo Adulto)";
  if (!rating) return "";
  const r = rating.toLowerCase();
  if (r.includes("rx") || r.includes("hentai") || r.includes("18+")) return "18+ (Conteúdo Adulto)";
  if (r.includes("r - 17+") || r.includes("r+")) return "16+ (Não recomendado para menores de 16 anos)";
  if (r.includes("pg-13") || r.includes("13") || r.includes("14")) return "14+ (Não recomendado para menores de 14 anos)";
  if (r.includes("pg") || r.includes("10")) return "10+ (Não recomendado para menores de 10 anos)";
  if (r.includes("g -") || r.includes("all ages") || r.includes("livre")) return "Livre para todos os públicos";
  return rating;
}


