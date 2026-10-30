import type { SlimAnime } from "@/lib/types";

export interface AnimeLogoConfig {
  src: string;
  alt: string;
  sizeClasses: string;
  aspectRatioHint: "wide" | "tall" | "balanced";
}

/**
 * Mapeamento e resolução de logotipos oficiais autênticos dos animes para o banner principal.
 * Todos os logos preservam transparência, proporções e cores originais.
 * Caso nenhum logo adequado seja encontrado, retorna null para ativar o fallback tipográfico.
 */
const LOGO_DEFINITIONS: Record<
  string,
  {
    src: string;
    alt: string;
    sizeClasses: string;
    aspectRatioHint: "wide" | "tall" | "balanced";
    aniListIds: number[];
    malIds: number[];
    titlePatterns: RegExp[];
  }
> = {
  bleach: {
    src: "/assets/anime-logos/bleach.png",
    alt: "BLEACH",
    sizeClasses:
      "max-h-12 sm:max-h-15 md:max-h-18 max-w-[230px] sm:max-w-[290px] md:max-w-[350px]",
    aspectRatioHint: "balanced",
    aniListIds: [269, 185874, 159322, 144665, 114444],
    malIds: [269, 41467, 56784, 60636],
    titlePatterns: [/\bbleach\b/i],
  },
  "one-piece": {
    src: "/assets/anime-logos/one-piece.svg",
    alt: "ONE PIECE",
    sizeClasses:
      "max-h-14 sm:max-h-18 md:max-h-22 max-w-[260px] sm:max-w-[340px] md:max-w-[420px]",
    aspectRatioHint: "wide",
    aniListIds: [21],
    malIds: [21],
    titlePatterns: [/\bone\s*piece\b/i],
  },
  "attack-on-titan": {
    src: "/assets/anime-logos/attack-on-titan.svg",
    alt: "Shingeki no Kyojin / Attack on Titan",
    sizeClasses:
      "max-h-13 sm:max-h-17 md:max-h-20 max-w-[250px] sm:max-w-[320px] md:max-w-[390px]",
    aspectRatioHint: "wide",
    aniListIds: [16498, 20958, 99147, 104578, 110277, 145064],
    malIds: [16498, 25777, 35760, 38524, 40028, 48583],
    titlePatterns: [/\battack\s+on\s+titan\b/i, /\bshingeki\s+no\s+kyojin\b/i],
  },
  "jujutsu-kaisen": {
    src: "/assets/anime-logos/jujutsu-kaisen.svg",
    alt: "Jujutsu Kaisen",
    sizeClasses:
      "max-h-16 sm:max-h-20 md:max-h-24 max-w-[190px] sm:max-w-[240px] md:max-w-[280px]",
    aspectRatioHint: "tall",
    aniListIds: [113415, 145064, 169052],
    malIds: [40748, 51009, 56064],
    titlePatterns: [/\bjujutsu\s+kaisen\b/i],
  },
  "demon-slayer": {
    src: "/assets/anime-logos/demon-slayer.svg",
    alt: "Kimetsu no Yaiba / Demon Slayer",
    sizeClasses:
      "max-h-16 sm:max-h-20 md:max-h-24 max-w-[200px] sm:max-w-[250px] md:max-w-[290px]",
    aspectRatioHint: "tall",
    aniListIds: [101922, 129874, 145139, 166240],
    malIds: [38000, 47778, 51019, 55701],
    titlePatterns: [/\bkimetsu\s+no\s+yaiba\b/i, /\bdemon\s+slayer\b/i],
  },
  "black-clover": {
    src: "/assets/anime-logos/black-clover.png",
    alt: "Black Clover",
    sizeClasses:
      "max-h-13 sm:max-h-16 md:max-h-20 max-w-[240px] sm:max-w-[310px] md:max-w-[370px]",
    aspectRatioHint: "wide",
    aniListIds: [97940, 157252],
    malIds: [34572, 48849],
    titlePatterns: [/\bblack\s+clover\b/i],
  },
  "cyberpunk-edgerunners": {
    src: "/assets/anime-logos/cyberpunk-edgerunners.png",
    alt: "Cyberpunk: Edgerunners",
    sizeClasses:
      "max-h-11 sm:max-h-14 md:max-h-17 max-w-[270px] sm:max-w-[350px] md:max-w-[430px]",
    aspectRatioHint: "wide",
    aniListIds: [120516, 195539],
    malIds: [42364, 61990],
    titlePatterns: [/\bcyberpunk\b.*\bedgerunners\b/i],
  },
  "solo-leveling": {
    src: "/assets/anime-logos/solo-leveling.svg",
    alt: "Solo Leveling",
    sizeClasses:
      "max-h-12 sm:max-h-15 md:max-h-18 max-w-[250px] sm:max-w-[320px] md:max-w-[390px]",
    aspectRatioHint: "wide",
    aniListIds: [151807, 175841],
    malIds: [52299, 58567],
    titlePatterns: [/\bsolo\s+leveling\b/i, /\bore\s+dake\s+level\s+up\b/i],
  },
  "frieren": {
    src: "/assets/anime-logos/frieren.png",
    alt: "Sousou no Frieren",
    sizeClasses:
      "max-h-14 sm:max-h-17 md:max-h-21 max-w-[230px] sm:max-w-[290px] md:max-w-[350px]",
    aspectRatioHint: "balanced",
    aniListIds: [154587],
    malIds: [52991],
    titlePatterns: [/\bfrieren\b/i, /\bsousou\s+no\s+frieren\b/i],
  },
  "death-note": {
    src: "/assets/anime-logos/death-note.svg",
    alt: "DEATH NOTE",
    sizeClasses:
      "max-h-12 sm:max-h-15 md:max-h-18 max-w-[240px] sm:max-w-[300px] md:max-w-[360px]",
    aspectRatioHint: "wide",
    aniListIds: [1535],
    malIds: [1535],
    titlePatterns: [/\bdeath\s+note\b/i],
  },
  "my-hero-academia": {
    src: "/assets/anime-logos/my-hero-academia.png",
    alt: "My Hero Academia",
    sizeClasses:
      "max-h-14 sm:max-h-18 md:max-h-22 max-w-[220px] sm:max-w-[280px] md:max-w-[340px]",
    aspectRatioHint: "balanced",
    aniListIds: [21459, 98659, 100166, 114440, 131881, 158569, 178229],
    malIds: [31964, 35247, 36456, 38408, 41587, 49918, 54789],
    titlePatterns: [/\bmy\s+hero\s+academia\b/i, /\bboku\s+no\s+hero\s+academia\b/i],
  },
  naruto: {
    src: "/assets/anime-logos/naruto-shippuden.svg",
    alt: "Naruto Shippuden",
    sizeClasses:
      "max-h-13 sm:max-h-16 md:max-h-20 max-w-[230px] sm:max-w-[290px] md:max-w-[350px]",
    aspectRatioHint: "balanced",
    aniListIds: [20, 1735],
    malIds: [20, 1735],
    titlePatterns: [/\bnaruto\b/i],
  },
  "dragon-ball": {
    src: "/assets/anime-logos/dragon-ball-z.svg",
    alt: "Dragon Ball Z",
    sizeClasses:
      "max-h-13 sm:max-h-16 md:max-h-20 max-w-[240px] sm:max-w-[300px] md:max-w-[360px]",
    aspectRatioHint: "wide",
    aniListIds: [813, 21175, 223],
    malIds: [813, 30694, 223],
    titlePatterns: [/\bdragon\s*ball\b/i],
  },
  "fullmetal-alchemist": {
    src: "/assets/anime-logos/fullmetal-alchemist.svg",
    alt: "Fullmetal Alchemist",
    sizeClasses:
      "max-h-13 sm:max-h-16 md:max-h-20 max-w-[240px] sm:max-w-[310px] md:max-w-[370px]",
    aspectRatioHint: "wide",
    aniListIds: [5114, 121],
    malIds: [5114, 121],
    titlePatterns: [/\bfullmetal\s+alchemist\b/i, /\bhagane\s+no\s+renkinjutsushi\b/i],
  },
  "one-punch-man": {
    src: "/assets/anime-logos/one-punch-man.svg",
    alt: "One-Punch Man",
    sizeClasses:
      "max-h-13 sm:max-h-16 md:max-h-19 max-w-[240px] sm:max-w-[300px] md:max-w-[360px]",
    aspectRatioHint: "wide",
    aniListIds: [21087, 101348],
    malIds: [30276, 34134],
    titlePatterns: [/\bone[- ]?punch\s+man\b/i],
  },
  "spy-x-family": {
    src: "/assets/anime-logos/spy-x-family.svg",
    alt: "SPY×FAMILY",
    sizeClasses:
      "max-h-13 sm:max-h-16 md:max-h-20 max-w-[230px] sm:max-w-[290px] md:max-w-[350px]",
    aspectRatioHint: "wide",
    aniListIds: [140960, 158870, 170881],
    malIds: [50273, 53887, 57790],
    titlePatterns: [/\bspy\s*[x×]?\s*family\b/i],
  },
  "steins-gate": {
    src: "/assets/anime-logos/steins-gate.svg",
    alt: "Steins;Gate",
    sizeClasses:
      "max-h-12 sm:max-h-15 md:max-h-18 max-w-[240px] sm:max-w-[300px] md:max-w-[360px]",
    aspectRatioHint: "wide",
    aniListIds: [9253, 100469],
    malIds: [9253, 30484],
    titlePatterns: [/\bsteins[;:]?\s*gate\b/i],
  },
};

/**
 * Obtém a configuração de logo para um anime, verificando IDs, títulos e fontes.
 * Retorna null se não houver arquivo oficial verificado.
 */
export function getAnimeLogo(anime: SlimAnime): AnimeLogoConfig | null {
  if (!anime) return null;

  // 1. Se o objeto de anime já possui um campo de logo oficial direto
  const directLogo = (anime as unknown as { logo?: string }).logo;
  if (typeof directLogo === "string" && directLogo.trim().length > 0) {
    return {
      src: directLogo.trim(),
      alt: anime.titles?.romaji || anime.titles?.english || "Logo",
      sizeClasses:
        "max-h-14 sm:max-h-18 md:max-h-22 max-w-[260px] sm:max-w-[340px] md:max-w-[400px]",
      aspectRatioHint: "balanced",
    };
  }

  // Identificadores numéricos
  const anilistId =
    anime.anilistId || (Number.isInteger(Number(anime.id)) ? Number(anime.id) : undefined);
  const malId = anime.malId;

  // Títulos para correspondência por padrão
  const titles = [
    anime.titles?.romaji,
    anime.titles?.english,
    anime.titles?.native,
  ].filter(Boolean) as string[];

  // 2. Busca por ID direto
  for (const def of Object.values(LOGO_DEFINITIONS)) {
    if (anilistId && def.aniListIds.includes(anilistId)) {
      return {
        src: def.src,
        alt: def.alt,
        sizeClasses: def.sizeClasses,
        aspectRatioHint: def.aspectRatioHint,
      };
    }
    if (malId && def.malIds.includes(malId)) {
      return {
        src: def.src,
        alt: def.alt,
        sizeClasses: def.sizeClasses,
        aspectRatioHint: def.aspectRatioHint,
      };
    }
  }

  // 3. Busca por padrões de título
  for (const def of Object.values(LOGO_DEFINITIONS)) {
    for (const title of titles) {
      for (const pattern of def.titlePatterns) {
        if (pattern.test(title)) {
          return {
            src: def.src,
            alt: def.alt,
            sizeClasses: def.sizeClasses,
            aspectRatioHint: def.aspectRatioHint,
          };
        }
      }
    }
  }

  return null;
}
