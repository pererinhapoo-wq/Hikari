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
    src: "/assets/anime-logos/one-piece.png",
    alt: "ONE PIECE",
    sizeClasses:
      "max-h-14 sm:max-h-18 md:max-h-22 max-w-[260px] sm:max-w-[340px] md:max-w-[420px]",
    aspectRatioHint: "wide",
    aniListIds: [21, 171630, 459, 19123],
    malIds: [21, 57557, 459, 19123],
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
    aniListIds: [97940, 157252, 195604],
    malIds: [34572, 48849],
    titlePatterns: [/\bblack\s+clover\b/i, /ブラッククローバー/],
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
  "dragon-ball-super": {
    src: "/assets/anime-logos/dragon-ball-super.png",
    alt: "Dragon Ball Super",
    sizeClasses:
      "max-h-14 sm:max-h-18 md:max-h-22 max-w-[270px] sm:max-w-[350px] md:max-w-[430px]",
    aspectRatioHint: "wide",
    aniListIds: [206814, 21175, 133898, 101302, 206812],
    malIds: [63367, 30694, 48903, 36946, 63368],
    titlePatterns: [
      /\bdragon\s*ball\s*super\b/i,
      /ドラゴンボール超/,
    ],
  },
  "dragon-ball": {
    src: "/assets/anime-logos/dragon-ball-z.svg",
    alt: "Dragon Ball Z",
    sizeClasses:
      "max-h-13 sm:max-h-16 md:max-h-20 max-w-[240px] sm:max-w-[300px] md:max-w-[360px]",
    aspectRatioHint: "wide",
    aniListIds: [813, 223],
    malIds: [813, 223],
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
  "steel-ball-run": {
    src: "/assets/anime-logos/steel-ball-run.png",
    alt: "STEEL BALL RUN JoJo's Bizarre Adventure",
    sizeClasses:
      "max-h-14 sm:max-h-18 md:max-h-22 max-w-[270px] sm:max-w-[350px] md:max-w-[430px]",
    aspectRatioHint: "wide",
    aniListIds: [210482, 190327],
    malIds: [61469],
    titlePatterns: [
      /\bsteel\s*ball\s*run\b/i,
      /ジョジョの奇妙な冒険\s*スティール・ボール・ラン/,
      /\bjojo.*steel\s*ball\s*run\b/i,
    ],
  },
  "the-ramparts-of-ice": {
    src: "/assets/anime-logos/the-ramparts-of-ice.png",
    alt: "The Ramparts of Ice / 氷の城壁",
    sizeClasses:
      "max-h-14 sm:max-h-17 md:max-h-21 max-w-[240px] sm:max-w-[310px] md:max-w-[380px]",
    aspectRatioHint: "wide",
    aniListIds: [213805, 186497],
    malIds: [64534, 60852],
    titlePatterns: [
      /\b(?:the\s+)?ramparts\s+of\s+ice\b/i,
      /\bkoori\s+no\s+jouheki\b/i,
      /氷の城壁/,
    ],
  },
  "the-apothecary-diaries": {
    src: "/assets/anime-logos/the-apothecary-diaries.png",
    alt: "The Apothecary Diaries",
    sizeClasses:
      "max-h-14 sm:max-h-18 md:max-h-22 max-w-[260px] sm:max-w-[340px] md:max-w-[420px]",
    aspectRatioHint: "wide",
    aniListIds: [161645, 176583, 195516],
    malIds: [54492, 58514, 61987],
    titlePatterns: [
      /\b(?:the\s+)?apothecary\s+diaries\b/i,
      /\bkusuriya\s+no\s+hitorigoto\b/i,
      /薬屋のひとりごと/,
    ],
  },
  "firefly-wedding": {
    src: "/assets/anime-logos/firefly-wedding.png",
    alt: "Firefly Wedding",
    sizeClasses:
      "max-h-13 sm:max-h-16 md:max-h-20 max-w-[240px] sm:max-w-[310px] md:max-w-[380px]",
    aspectRatioHint: "balanced",
    aniListIds: [205909],
    malIds: [63293],
    titlePatterns: [
      /\bfirefly\s*wedding\b/i,
      /\bhotaru\s*no\s*yomeiri\b/i,
      /ホタルの嫁入り/,
    ],
  },
  "tokyo-revengers": {
    src: "/assets/anime-logos/tokyo-revengers.svg",
    alt: "Tokyo Revengers / 東京リベンジャーズ",
    sizeClasses:
      "max-h-12 sm:max-h-15 md:max-h-18 max-w-[250px] sm:max-w-[320px] md:max-w-[390px]",
    aspectRatioHint: "wide",
    aniListIds: [129201, 145139, 178083],
    malIds: [42249, 49535, 59088],
    titlePatterns: [
      /\btokyo\s+revengers\b/i,
      /\btoukyou\s+revengers\b/i,
      /東京リベンジャーズ/,
    ],
  },
  "tougen-anki": {
    src: "/assets/anime-logos/tougen-anki.png",
    alt: "TOUGEN ANKI / 桃源暗鬼",
    sizeClasses:
      "max-h-14 sm:max-h-18 md:max-h-22 max-w-[260px] sm:max-w-[340px] md:max-w-[420px]",
    aspectRatioHint: "wide",
    aniListIds: [204650, 177474, 194835],
    malIds: [63181, 58811, 61891],
    titlePatterns: [
      /\btougen\s*anki\b/i,
      /桃源暗鬼/,
    ],
  },
  "the-exiled-heavy-knight": {
    src: "/assets/anime-logos/the-exiled-heavy-knight.png",
    alt: "The Exiled Heavy Knight Knows How to Game the System / 追放された転生重騎士はゲーム知識で無双する",
    sizeClasses:
      "max-h-14 sm:max-h-18 md:max-h-22 max-w-[260px] sm:max-w-[340px] md:max-w-[420px]",
    aspectRatioHint: "wide",
    aniListIds: [180136],
    malIds: [59741],
    titlePatterns: [
      /\b(?:the\s+)?exiled\s+heavy\s+knight\b/i,
      /\btsuihou.*(?:tensei\s+)?juukishi\b/i,
      /追放された転生重騎士/,
    ],
  },
  "blue-box": {
    src: "/assets/anime-logos/blue-box.png",
    alt: "Blue Box Season 2 / Ao no Hako / アオのハコ",
    sizeClasses:
      "max-h-13 sm:max-h-17 md:max-h-21 max-w-[250px] sm:max-w-[320px] md:max-w-[390px]",
    aspectRatioHint: "wide",
    aniListIds: [189123, 170942],
    malIds: [61323, 57181],
    titlePatterns: [
      /\bblue\s*box\b/i,
      /\bao\s+no\s+hako\b/i,
      /アオのハコ/,
    ],
  },
  "even-the-student-council-has-its-holes": {
    src: "/assets/anime-logos/even-the-student-council-has-its-holes.png",
    alt: "Even the Student Council Has Its Holes / 生徒会にも穴はある！",
    sizeClasses:
      "max-h-15 sm:max-h-19 md:max-h-23 max-w-[210px] sm:max-w-[270px] md:max-w-[330px]",
    aspectRatioHint: "balanced",
    aniListIds: [191656, 179207],
    malIds: [61578, 59276],
    titlePatterns: [
      /\b(?:even\s+the\s+)?student\s+council\s+has\s+its\s+holes\b/i,
      /\bseitokai\s+ni\s*mo\s+ana\s+wa\s+aru\b/i,
      /生徒会にも穴はある/,
    ],
  },
};

/**
 * Normaliza o título para extrair a raiz da franquia, permitindo que sequências,
 * temporadas (Season 2, Season 3, 2nd Season, Part 2, etc.) e arcos dinâmicos
 * herdem com precisão o logotipo oficial da franquia.
 */
function normalizeFranchiseTitle(title: string): string {
  if (!title) return "";
  let clean = title.trim();

  // Remove parênteses como "(TV)", "(TV 2)", "(Movie)", etc.
  clean = clean.replace(/\s*\((?:TV|Movie|OVA|ONA|Season|Part|\d+)[^)]*\)/gi, "");

  // Remove sufixos de temporada específicos em inglês e japonês
  clean = clean.replace(
    /\s*[:\-\uff5e\u301c]\s*(?:Season\b|\d+(?:st|nd|rd|th)\s+Season|Part\b|Cour\b|Stage\b|Arc\b|Hen\b|Movie\b|The\s+Final|S\d+\b|Final\s+Season|2nd\s*&\s*3rd\s*STAGE).*/gi,
    ""
  );

  clean = clean.replace(/\s+(?:Season|\bS)\s*\d+.*$/gi, "");
  clean = clean.replace(/\s+\d+(?:st|nd|rd|th)\s+Season.*$/gi, "");
  clean = clean.replace(/\s*-\s*\d+.*STAGE.*$/gi, "");
  clean = clean.replace(/\s*(?:第[0-9一二三四五六七八九十]+期|シーズン[0-9]+|完結編).*$/g, "");

  // Remove subtítulos de arcos após ":" ou "：" preservando o nome da franquia principal
  const colonIdx = clean.search(/[:：]/);
  if (colonIdx > 3) {
    const prefix = clean.substring(0, colonIdx).trim();
    if (prefix.length >= 3) return prefix;
  }

  return clean.trim();
}

/**
 * Obtém a configuração de logo para um anime, verificando IDs, títulos e fontes.
 * Prioriza logotipos oficiais em inglês com fundo transparente.
 * Retorna null se não houver arquivo oficial verificado, acionando o fallback tipográfico.
 */
export function getAnimeLogo(anime: SlimAnime): AnimeLogoConfig | null {
  if (!anime) return null;

  // 1. Se o objeto de anime já possui um campo de logo oficial direto
  const directLogo =
    (anime as unknown as { logo?: string; clearlogo?: string; titleLogo?: string }).logo ||
    (anime as unknown as { logo?: string; clearlogo?: string; titleLogo?: string }).clearlogo ||
    (anime as unknown as { logo?: string; clearlogo?: string; titleLogo?: string }).titleLogo;

  if (typeof directLogo === "string" && directLogo.trim().length > 0) {
    return {
      src: directLogo.trim(),
      alt: anime.titles?.english?.trim() || anime.titles?.romaji?.trim() || "Logo",
      sizeClasses:
        "max-h-14 sm:max-h-18 md:max-h-22 max-w-[260px] sm:max-w-[340px] md:max-w-[400px]",
      aspectRatioHint: "balanced",
    };
  }

  // Identificadores numéricos normalizados
  let anilistId = anime.anilistId;
  let malId = anime.malId;
  let kitsuId = anime.kitsuId;

  if (!anilistId && Number.isInteger(Number(anime.id))) {
    anilistId = Number(anime.id);
  } else if (!malId && typeof anime.id === "string" && anime.id.startsWith("mal-")) {
    const parsed = Number(anime.id.replace("mal-", ""));
    if (Number.isInteger(parsed)) malId = parsed;
  } else if (!kitsuId && typeof anime.id === "string" && anime.id.startsWith("kitsu-")) {
    const parsed = Number(anime.id.replace("kitsu-", ""));
    if (Number.isInteger(parsed)) kitsuId = parsed;
  }

  // Títulos originais (priorizando inglês, romaji e nativo)
  const rawTitles = [
    anime.titles?.english,
    anime.titles?.romaji,
    anime.titles?.native,
  ]
    .map((t) => t?.trim())
    .filter(Boolean) as string[];

  // 2. Busca prioritária por ID direto
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

  // 3. Busca por padrões de título exato
  for (const def of Object.values(LOGO_DEFINITIONS)) {
    for (const title of rawTitles) {
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

  // 4. Busca resiliente pela raiz normalizada da franquia (para sequências e novas temporadas dinâmicas)
  const normalizedTitles = rawTitles
    .map(normalizeFranchiseTitle)
    .filter((t) => t.length > 0 && !rawTitles.includes(t));

  for (const def of Object.values(LOGO_DEFINITIONS)) {
    for (const title of normalizedTitles) {
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

  // Sem logo oficial verificado disponível -> ativa fallback tipográfico sem exibir imagem de outro anime
  return null;
}
