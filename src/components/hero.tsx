import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Info, Play } from "lucide-react";

import { displayTitle, type SlimAnime } from "@/lib/types";
import { genreLabel, scoreLabel, seasonLabel, statusLabel } from "@/lib/labels";
import { getAnimeLogo } from "@/lib/anime-logos";

/**
 * Determina o total de temporadas confirmadas para o anime em formato compacto (ex.: "S1–S3").
 * Representa o total de temporadas confirmadas da franquia, não apenas a temporada atual exibida.
 * Omite para filmes, OVAs ou quando não for possível confirmar com segurança.
 */
function getConfirmedSeasonsSpan(anime: SlimAnime): string | null {
  if (!anime) return null;

  // Filmes e especiais nunca exibem contagem de temporadas
  if (
    anime.format === "MOVIE" ||
    anime.format === "SPECIAL" ||
    anime.format === "OVA" ||
    anime.format === "ONA"
  ) {
    return null;
  }

  const titleStr = [
    anime.titles?.english,
    anime.titles?.romaji,
    anime.titles?.native,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Se o título indicar explicitamente um filme
  if (/\b(?:movie|the movie|gekijouban|film)\b/i.test(titleStr)) {
    return null;
  }

  const anilistId =
    anime.anilistId ||
    (Number.isInteger(Number(anime.id)) ? Number(anime.id) : undefined);
  const malId = anime.malId;

  // Franquias longas/contínuas sem temporadas tradicionais
  if (
    /\bone\s*piece\b/i.test(titleStr) ||
    anilistId === 21 ||
    malId === 21 ||
    /\bdragon\s*ball\b/i.test(titleStr) ||
    anilistId === 813 ||
    anilistId === 223 ||
    anilistId === 206814 ||
    /\bnaruto\b/i.test(titleStr) ||
    anilistId === 20 ||
    anilistId === 1735
  ) {
    return null;
  }

  // Franquias conhecidas do catálogo com total de temporadas confirmadas
  // The Apothecary Diaries / Kusuriya no Hitorigoto: 3 temporadas confirmadas
  if (
    /\b(?:the\s+)?apothecary\s+diaries\b/i.test(titleStr) ||
    /\bkusuriya\s+no\s+hitorigoto\b/i.test(titleStr) ||
    titleStr.includes("薬屋のひとりごと") ||
    anilistId === 195516 ||
    anilistId === 176583 ||
    anilistId === 161645
  ) {
    return "S1–S3";
  }

  // Demon Slayer / Kimetsu no Yaiba: 4 temporadas de TV confirmadas
  if (
    /\bdemon\s+slayer\b/i.test(titleStr) ||
    /\bkimetsu\s+no\s+yaiba\b/i.test(titleStr) ||
    titleStr.includes("鬼滅の刃") ||
    anilistId === 101922 ||
    anilistId === 129874 ||
    anilistId === 145139 ||
    anilistId === 166240
  ) {
    return "S1–S4";
  }

  // Attack on Titan / Shingeki no Kyojin: 4 temporadas
  if (
    /\battack\s+on\s+titan\b/i.test(titleStr) ||
    /\bshingeki\s+no\s+kyojin\b/i.test(titleStr) ||
    titleStr.includes("進撃の巨人") ||
    anilistId === 16498 ||
    anilistId === 20958 ||
    anilistId === 99147 ||
    anilistId === 104578 ||
    anilistId === 110277
  ) {
    return "S1–S4";
  }

  // My Hero Academia / Boku no Hero Academia: 8 temporadas confirmadas
  if (
    /\bmy\s+hero\s+academia\b/i.test(titleStr) ||
    /\bboku\s+no\s+hero\s+academia\b/i.test(titleStr) ||
    titleStr.includes("僕のヒーローアカデミア") ||
    anilistId === 21459 ||
    anilistId === 98659 ||
    anilistId === 100166 ||
    anilistId === 114440 ||
    anilistId === 131881 ||
    anilistId === 158569 ||
    anilistId === 178229
  ) {
    return "S1–S8";
  }

  // Jujutsu Kaisen: 3 temporadas confirmadas
  if (
    /\bjujutsu\s+kaisen\b/i.test(titleStr) ||
    titleStr.includes("呪術廻戦") ||
    anilistId === 113415 ||
    anilistId === 145064 ||
    anilistId === 169052
  ) {
    return "S1–S3";
  }

  // Spy x Family: 3 temporadas confirmadas
  if (
    /\bspy\s*[x×]?\s*family\b/i.test(titleStr) ||
    anilistId === 140960 ||
    anilistId === 158870 ||
    anilistId === 170881
  ) {
    return "S1–S3";
  }

  // Tokyo Revengers: 4 temporadas confirmadas
  if (
    /\btokyo\s+revengers\b/i.test(titleStr) ||
    /\btoukyou\s+revengers\b/i.test(titleStr) ||
    titleStr.includes("東京リベンジャーズ") ||
    anilistId === 129201 ||
    anilistId === 145139 ||
    anilistId === 178083
  ) {
    return "S1–S4";
  }

  // Dr. STONE: 4 temporadas confirmadas
  if (
    /\bdr\.\s*stone\b/i.test(titleStr) ||
    anilistId === 105333 ||
    anilistId === 113936 ||
    anilistId === 131518 ||
    anilistId === 169935
  ) {
    return "S1–S4";
  }

  // Overlord: 4 temporadas confirmadas
  if (
    /\boverlord\b/i.test(titleStr) ||
    anilistId === 20832 ||
    anilistId === 98437 ||
    anilistId === 101478 ||
    anilistId === 133844
  ) {
    return "S1–S4";
  }

  // Haikyuu!!: 4 temporadas de TV confirmadas
  if (
    /\bhaikyuu\b/i.test(titleStr) ||
    anilistId === 20464 ||
    anilistId === 20992 ||
    anilistId === 21856 ||
    anilistId === 106625
  ) {
    return "S1–S4";
  }

  // Classroom of the Elite / Youkoso Jitsuryoku: 4 temporadas confirmadas
  if (
    /\bclassroom\s+of\s+the\s+elite\b/i.test(titleStr) ||
    /\byoukoso\s+jitsuryoku\b/i.test(titleStr) ||
    anilistId === 98659 ||
    anilistId === 145545 ||
    anilistId === 165545
  ) {
    return "S1–S4";
  }

  // Re:Zero: 3 temporadas confirmadas
  if (
    /\bre:?zero\b/i.test(titleStr) ||
    anilistId === 21355 ||
    anilistId === 108632 ||
    anilistId === 163134
  ) {
    return "S1–S3";
  }

  // Mushoku Tensei: 3 temporadas confirmadas
  if (
    /\bmushoku\s+tensei\b/i.test(titleStr) ||
    anilistId === 108465 ||
    anilistId === 146065 ||
    anilistId === 178711
  ) {
    return "S1–S3";
  }

  // Oshi no Ko: 3 temporadas confirmadas
  if (
    /\boshi\s+no\s+ko\b/i.test(titleStr) ||
    titleStr.includes("【推しの子】") ||
    anilistId === 150672 ||
    anilistId === 166531 ||
    anilistId === 180015
  ) {
    return "S1–S3";
  }

  // KonoSuba: 3 temporadas confirmadas
  if (
    /\bkonosuba\b/i.test(titleStr) ||
    /\bkono\s+subarashii\b/i.test(titleStr) ||
    anilistId === 21202 ||
    anilistId === 21699 ||
    anilistId === 146984
  ) {
    return "S1–S3";
  }

  // That Time I Got Reincarnated as a Slime / Tensei shitara Slime Datta Ken: 4 temporadas confirmadas
  if (
    /\btensei\s+shitara\s+slime\b/i.test(titleStr) ||
    /\breincarnated\s+as\s+a\s+slime\b/i.test(titleStr) ||
    anilistId === 101280 ||
    anilistId === 108511 ||
    anilistId === 156822
  ) {
    return "S1–S4";
  }

  // One-Punch Man: 3 temporadas confirmadas
  if (
    /\bone[- ]?punch\s+man\b/i.test(titleStr) ||
    anilistId === 21087 ||
    anilistId === 101348 ||
    anilistId === 152795
  ) {
    return "S1–S3";
  }

  // Blue Box / Ao no Hako: 2 temporadas confirmadas
  if (
    /\bblue\s*box\b/i.test(titleStr) ||
    /\bao\s+no\s+hako\b/i.test(titleStr) ||
    titleStr.includes("アオのハコ") ||
    anilistId === 189123 ||
    anilistId === 170942
  ) {
    return "S1–S2";
  }

  // Frieren / Sousou no Frieren: 2 temporadas confirmadas
  if (
    /\bfrieren\b/i.test(titleStr) ||
    /\bsousou\s+no\s+frieren\b/i.test(titleStr) ||
    titleStr.includes("葬送のフリーレン") ||
    anilistId === 154587 ||
    anilistId === 181973
  ) {
    return "S1–S2";
  }

  // Solo Leveling: 2 temporadas confirmadas
  if (
    /\bsolo\s+leveling\b/i.test(titleStr) ||
    /\bore\s+dake\s+level\s+up\b/i.test(titleStr) ||
    anilistId === 151807 ||
    anilistId === 175841
  ) {
    return "S1–S2";
  }

  // Bleach: 2 temporadas principais
  if (
    /\bbleach\b/i.test(titleStr) ||
    anilistId === 269 ||
    anilistId === 185874 ||
    anilistId === 159322 ||
    anilistId === 144665
  ) {
    return "S1–S2";
  }

  // Steins;Gate: 2 temporadas
  if (
    /\bsteins[;:]?\s*gate\b/i.test(titleStr) ||
    anilistId === 9253 ||
    anilistId === 100469
  ) {
    return "S1–S2";
  }

  // Black Clover: 2 temporadas
  if (
    /\bblack\s+clover\b/i.test(titleStr) ||
    anilistId === 97940 ||
    anilistId === 157252 ||
    anilistId === 195604
  ) {
    return "S1–S2";
  }

  // Vinland Saga: 2 temporadas
  if (
    /\bvinland\s+saga\b/i.test(titleStr) ||
    anilistId === 101348 ||
    anilistId === 136430
  ) {
    return "S1–S2";
  }

  // Steel Ball Run: 1 temporada confirmada
  if (
    /\bsteel\s*ball\s*run\b/i.test(titleStr) ||
    anilistId === 210482 ||
    anilistId === 190327
  ) {
    return "S1";
  }

  // The Ramparts of Ice / Koori no Jouheki: 1 temporada
  if (
    /\b(?:the\s+)?ramparts\s+of\s+ice\b/i.test(titleStr) ||
    /\bkoori\s+no\s+jouheki\b/i.test(titleStr) ||
    anilistId === 213805 ||
    anilistId === 186497
  ) {
    return "S1";
  }

  // Tougen Anki: 1 temporada
  if (
    /\btougen\s*anki\b/i.test(titleStr) ||
    anilistId === 204650 ||
    anilistId === 177474 ||
    anilistId === 194835
  ) {
    return "S1";
  }

  // The Exiled Heavy Knight: 1 temporada
  if (
    /\b(?:the\s+)?exiled\s+heavy\s+knight\b/i.test(titleStr) ||
    /\btsuihou.*juukishi\b/i.test(titleStr) ||
    anilistId === 180136
  ) {
    return "S1";
  }

  // Even the Student Council Has Its Holes: 1 temporada
  if (
    /\b(?:even\s+the\s+)?student\s+council\s+has\s+its\s+holes\b/i.test(titleStr) ||
    /\bseitokai\s+ni\s*mo\s+ana\s+wa\s+aru\b/i.test(titleStr) ||
    anilistId === 191656 ||
    anilistId === 179207
  ) {
    return "S1";
  }

  // Firefly Wedding / Hotaru no Yomeiri: 1 temporada
  if (
    /\bfirefly\s*wedding\b/i.test(titleStr) ||
    /\bhotaru\s*no\s*yomeiri\b/i.test(titleStr) ||
    anilistId === 205909
  ) {
    return "S1";
  }

  // Cyberpunk: Edgerunners: 1 temporada
  if (
    /\bcyberpunk\b.*\bedgerunners\b/i.test(titleStr) ||
    anilistId === 120516 ||
    anilistId === 195539
  ) {
    return "S1";
  }

  // Death Note: 1 temporada
  if (
    /\bdeath\s+note\b/i.test(titleStr) ||
    anilistId === 1535
  ) {
    return "S1";
  }

  // Se o título contiver indicativo numérico explícito de temporada N
  const seasonMatch =
    titleStr.match(/\b(?:season\s*|s)(\d+)\b/i) ||
    titleStr.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/i);
  if (seasonMatch && seasonMatch[1]) {
    const num = parseInt(seasonMatch[1], 10);
    if (num > 1 && num <= 12) {
      return `S1–S${num}`;
    }
    if (num === 1) {
      return "S1";
    }
  }

  // Se o objeto anime possuir temporadas estruturadas
  const customSeasons = (anime as unknown as { seasons?: Array<{ number: number }> }).seasons;
  if (Array.isArray(customSeasons) && customSeasons.length > 0) {
    const seasonNumbers = customSeasons
      .map((s) => s.number)
      .filter((n) => typeof n === "number" && n > 0);
    if (seasonNumbers.length > 1) {
      const maxSeason = Math.max(...seasonNumbers);
      return `S1–S${maxSeason}`;
    }
    if (seasonNumbers.length === 1) {
      return "S1";
    }
  }

  // Caso padrão para produções de TV sem confirmação de múltiplas temporadas
  if (anime.format === "TV" && anime.year) {
    return "S1";
  }

  return null;
}

interface HeroSlideProps {
  anime: SlimAnime;
  priority?: boolean;
}

function HeroSlide({ anime, priority = false }: HeroSlideProps) {
  const preferredTitle =
    anime.titles?.english?.trim() ||
    anime.titles?.romaji?.trim() ||
    anime.titles?.native?.trim() ||
    displayTitle(anime);

  const logoConfig = getAnimeLogo(anime);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [anime.id]);

  const mobileBackdrop = anime.cover || anime.banner || "";
  const desktopBackdrop = anime.banner || anime.cover || "";

  const scoreValue = anime.score != null ? scoreLabel(anime.score) : null;
  const seasonsSpan = getConfirmedSeasonsSpan(anime);
  const seasonValue =
    anime.format === "MOVIE"
      ? "Filme"
      : anime.season
        ? seasonLabel(anime.season, anime.year)
        : anime.year
          ? `Temporada ${anime.year}`
          : "T1";

  const episodesValue =
    anime.episodesCount != null
      ? `${anime.episodesCount} ${anime.episodesCount === 1 ? "Episódio" : "Episódios"}`
      : anime.format === "MOVIE"
        ? "Filme único"
        : "Em lançamento";

  const statusText = statusLabel(anime.status);
  const isAiring =
    anime.status === "RELEASING" ||
    anime.status?.toLowerCase() === "airing" ||
    anime.status?.toLowerCase() === "currently_airing" ||
    statusText?.toLowerCase() === "em exibição";

  return (
    <div className="relative size-full min-w-full shrink-0 flex flex-col justify-end select-none overflow-hidden min-h-[560px] sm:min-h-[620px] md:min-h-[560px] lg:min-h-[600px]">
      {/* CAMADA DE IMAGEM AMPLA EM BACKGROUND (CORES E LUZ NATURAIS) */}
      <div className="absolute inset-0 size-full pointer-events-none overflow-hidden select-none">
        {/* MOBILE: Imagem ampla ocupando a tela com enquadramento focado nos personagens e cores originais */}
        <div className="relative size-full md:hidden">
          <img
            src={mobileBackdrop}
            alt={preferredTitle}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="size-full object-cover object-top"
          />
        </div>

        {/* DESKTOP: Banner horizontal em alta definição */}
        <div className="hidden md:block relative size-full">
          <img
            src={desktopBackdrop}
            alt={preferredTitle}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="size-full object-cover object-center"
          />
        </div>

        {/* GRADIENTE INFERIOR NEUTRO: Limitado estritamente à região dos textos */}
        <div
          className="
            absolute
            inset-x-0
            bottom-0
            h-[38%]
            sm:h-[35%]
            md:h-[32%]
            bg-gradient-to-t
            from-black
            via-black/50
            via-40%
            to-transparent
          "
        />
      </div>

      {/* CONTEÚDO CENTRALIZADO E ELEGANTE */}
      <div
        className="
          relative
          z-20
          w-full
          max-w-2xl
          mx-auto
          px-4
          pt-28
          pb-8
          sm:px-6
          sm:pb-10
          flex
          flex-col
          items-center
          text-center
          space-y-3
          sm:space-y-3.5
        "
      >
        {/* Título Principal: Logotipo Oficial ou Fallback Tipográfico */}
        <div className="w-full max-w-xl flex flex-col items-center justify-center min-h-[50px] sm:min-h-[64px] md:min-h-[76px]">
          {logoConfig && !logoFailed ? (
            <div className="flex items-center justify-center w-full px-2">
              <h1 className="sr-only">{preferredTitle}</h1>
              <img
                src={logoConfig.src}
                alt={logoConfig.alt || preferredTitle}
                title={preferredTitle}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={priority ? "high" : "auto"}
                onError={() => setLogoFailed(true)}
                className={`
                  w-auto
                  object-contain
                  select-none
                  pointer-events-none
                  drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]
                  filter
                  transition-all
                  duration-200
                  ${logoConfig.sizeClasses}
                `}
              />
            </div>
          ) : (
            <h1
              title={preferredTitle}
              className="
                font-display
                text-xl
                sm:text-2xl
                md:text-3xl
                lg:text-4xl
                font-bold
                tracking-tight
                text-white
                leading-snug
                drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]
                line-clamp-2
              "
            >
              {preferredTitle}
            </h1>
          )}
        </div>

        {/* Linha Compacta de Informações: Nota ★ · Total Temporadas · Temporada de Lançamento · Episódios */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:text-[12.5px] font-semibold text-zinc-100 drop-shadow-[0_2px_5px_rgba(0,0,0,0.95)]">
          {scoreValue && (
            <span className="inline-flex items-center gap-1 text-amber-300 font-bold tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              <span className="text-amber-400 text-xs sm:text-[13px] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">★</span>
              <span className="tabular-nums text-amber-200 font-bold">{scoreValue}</span>
            </span>
          )}

          {scoreValue && (seasonsSpan || seasonValue || episodesValue) && (
            <span className="size-1 rounded-full bg-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.9)] shrink-0" aria-hidden="true" />
          )}

          {seasonsSpan && (
            <span className="font-bold text-white tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{seasonsSpan}</span>
          )}

          {seasonsSpan && (seasonValue || episodesValue) && (
            <span className="size-1 rounded-full bg-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.9)] shrink-0" aria-hidden="true" />
          )}

          {seasonValue && (
            <span className="text-zinc-100 font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{seasonValue}</span>
          )}

          {seasonValue && episodesValue && (
            <span className="size-1 rounded-full bg-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.9)] shrink-0" aria-hidden="true" />
          )}

          {episodesValue && (
            <span className="text-zinc-200 font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{episodesValue}</span>
          )}
        </div>

        {/* Status da Transmissão */}
        {statusText && (
          <div className="flex items-center justify-center pt-0.5">
            <span
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-md
                border
                border-white/15
                bg-black/60
                px-2.5
                py-0.5
                text-[10px]
                sm:text-[11px]
                font-semibold
                tracking-wider
                uppercase
                text-zinc-100
                backdrop-blur-md
                shadow-xs
              "
            >
              {isAiring && (
                <span
                  className="relative flex size-2 items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)] motion-safe:animate-pulse motion-reduce:animate-none" />
                </span>
              )}
              <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{statusText}</span>
            </span>
          </div>
        )}

        {/* Gêneros / Categorias: Cápsulas compactas translúcidas com contraste aprimorado */}
        {anime.genres.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5 max-w-lg">
            {anime.genres.slice(0, 4).map((genre) => (
              <span
                key={genre}
                className="
                  rounded-full
                  border
                  border-white/20
                  bg-black/65
                  px-2.5
                  py-0.5
                  text-[9.5px]
                  sm:text-[10.5px]
                  font-semibold
                  uppercase
                  tracking-wider
                  text-zinc-100
                  backdrop-blur-md
                  shadow-xs
                "
              >
                {genreLabel(genre)}
              </span>
            ))}
          </div>
        )}

        {/* Controles de Ação */}
        <div className="mt-2 flex items-center justify-center gap-2 sm:gap-2.5 w-auto pt-0.5">
          {/* Botão Assistir: Contraste discreto com fundo suave elegante e texto/ícone pretos nítidos */}
          <Link
            to="/watch/$id"
            params={{ id: anime.id }}
            preload="intent"
            className="
              inline-flex
              items-center
              justify-center
              gap-1.5
              h-8
              sm:h-8.5
              px-3.5
              sm:px-4
              rounded-lg
              sm:rounded-xl
              bg-white/95
              hover:bg-white
              active:bg-white/90
              text-black
              font-bold
              text-xs
              sm:text-[13px]
              tracking-normal
              border
              border-white/40
              backdrop-blur-md
              shadow-[0_2px_12px_rgba(0,0,0,0.4)]
              transition-all
              duration-150
              cursor-pointer
              active:scale-[0.98]
              select-none
            "
          >
            <Play className="size-3 sm:size-3.5 fill-black text-black shrink-0" />
            <span>Assistir</span>
          </Link>

          {/* Controle Detalhes: Ação secundária em vidro escuro translúcido com texto, ícone, seta e contorno nítidos */}
          <Link
            to="/anime/$id"
            params={{ id: anime.id }}
            className="
              group
              inline-flex
              items-center
              justify-center
              gap-1.5
              h-8
              sm:h-8.5
              px-3
              sm:px-3.5
              rounded-lg
              sm:rounded-xl
              bg-black/50
              hover:bg-black/65
              active:bg-black/75
              border
              border-white/30
              hover:border-white/45
              text-white
              font-semibold
              text-xs
              sm:text-[13px]
              backdrop-blur-md
              shadow-xs
              transition-all
              duration-150
              cursor-pointer
              active:scale-[0.98]
              select-none
            "
          >
            <Info className="size-3 sm:size-3.5 text-zinc-200 group-hover:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] shrink-0" />
            <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Detalhes</span>
            <ChevronRight className="size-3 sm:size-3.5 text-zinc-200 group-hover:text-white group-hover:translate-x-0.5 transition-transform drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Hero({
  anime,
  animes = [anime],
}: {
  anime: SlimAnime;
  animes?: SlimAnime[];
}) {
  const items = (animes.length > 0 ? animes : [anime]).slice(0, 8);
  const total = items.length;

  const [index, setIndex] = useState(0);
  const [transitioning, setTransitioning] = useState<{
    fromIndex: number;
    toIndex: number;
    direction: "next" | "prev";
  } | null>(null);

  const containerRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | null>(null);

  const pointerState = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    currentX: number;
    startTime: number;
    isLockedHorizontal: boolean;
    isLockedVertical: boolean;
    hasMoved: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    startTime: 0,
    isLockedHorizontal: false,
    isLockedVertical: false,
    hasMoved: false,
  });

  // Pré-carregamento imediato das imagens e logos de todos os 8 animes para transição sem atrasos
  useEffect(() => {
    if (typeof window === "undefined" || items.length === 0) return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;

    items.forEach((item) => {
      const primaryUrl = isDesktop
        ? item.banner || item.cover
        : item.cover || item.banner;
      const secondaryUrl = isDesktop
        ? item.cover || item.banner
        : item.banner || item.cover;

      if (primaryUrl) {
        const img = new Image();
        img.decoding = "async";
        img.src = primaryUrl;
      }
      if (secondaryUrl && secondaryUrl !== primaryUrl) {
        const img = new Image();
        img.decoding = "async";
        img.src = secondaryUrl;
      }

      const logoConfig = getAnimeLogo(item);
      if (logoConfig?.src) {
        const logoImg = new Image();
        logoImg.decoding = "async";
        logoImg.src = logoConfig.src;
      }
    });
  }, [items]);

  // Disparo da transição suave com crossfade e sobreposição
  const triggerTransition = useCallback(
    (direction: "next" | "prev") => {
      if (total < 2 || transitioning !== null) return;

      const targetIndex =
        direction === "next" ? (index + 1) % total : (index - 1 + total) % total;

      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReduced) {
        setIndex(targetIndex);
        return;
      }

      setTransitioning({
        fromIndex: index,
        toIndex: targetIndex,
        direction,
      });
    },
    [total, index, transitioning]
  );

  // Reinicia o temporizador automático de aproximadamente 8 segundos
  const resetAutoTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (total < 2) return;

    timerRef.current = window.setInterval(() => {
      if (
        document.hidden ||
        pointerState.current.active ||
        transitioning !== null
      ) {
        return;
      }
      triggerTransition("next");
    }, 8000);
  }, [total, triggerTransition, transitioning]);

  // Efeito do temporizador automático: reinicia após cada mudança de anime ou transição
  useEffect(() => {
    resetAutoTimer();
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [resetAutoTimer, index]);

  // Conclui a animação após exatamente 1300ms (~1200-1400ms) com aceleração e desaceleração naturais
  useEffect(() => {
    if (!transitioning) return;

    const timeout = window.setTimeout(() => {
      setIndex(transitioning.toIndex);
      setTransitioning(null);
    }, 1300);

    return () => window.clearTimeout(timeout);
  }, [transitioning]);

  // Manipulação de gestos de toque/ponteiro
  // O gesto apenas detecta a intenção de navegação (sem arrastar a imagem diretamente como galeria)
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (total < 2 || e.button !== 0 || transitioning !== null) return;

    pointerState.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      startTime: Date.now(),
      isLockedHorizontal: false,
      isLockedVertical: false,
      hasMoved: false,
    };

    resetAutoTimer();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const state = pointerState.current;
    if (!state.active || state.pointerId !== e.pointerId || state.isLockedVertical) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (!state.isLockedHorizontal) {
      if (Math.hypot(dx, dy) > 8) {
        if (Math.abs(dy) > Math.abs(dx)) {
          state.isLockedVertical = true;
          return;
        }
        state.isLockedHorizontal = true;
        state.hasMoved = true;

        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    }

    if (state.isLockedHorizontal) {
      state.currentX = e.clientX;
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLElement>) => {
    const state = pointerState.current;
    if (!state.active || state.pointerId !== e.pointerId) return;

    state.active = false;
    state.pointerId = null;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (state.isLockedHorizontal) {
      const containerWidth = containerRef.current?.offsetWidth || 390;
      const threshold = Math.max(40, containerWidth * 0.12);
      const dx = state.currentX - state.startX;
      const elapsed = Date.now() - state.startTime;
      const isQuickSwipe = elapsed < 350 && Math.abs(dx) > 30;

      if (dx < -threshold || (isQuickSwipe && dx < 0)) {
        // Deslizar para esquerda avança para o próximo anime com a mesma transição suave
        triggerTransition("next");
      } else if (dx > threshold || (isQuickSwipe && dx > 0)) {
        // Deslizar para direita retorna para o anime anterior com a mesma transição suave
        triggerTransition("prev");
      }
    }

    resetAutoTimer();
  };

  // Previne clique inadvertido em links ou botões se o usuário fez um gesto de deslizar
  const handleClickCapture = (e: React.MouseEvent) => {
    if (pointerState.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      pointerState.current.hasMoved = false;
    }
  };

  if (total <= 1) {
    return (
      <section
        aria-label="Destaque principal"
        className="
          relative
          -mx-4
          overflow-hidden
          bg-black
          border-b
          border-white/5
          shadow-[0_12px_40px_rgba(0,0,0,0.85)]
          sm:-mx-6
          md:mx-0
          md:rounded-3xl
          md:border
          md:border-white/10
          md:shadow-[0_20px_50px_rgba(0,0,0,0.7)]
          min-h-[560px]
          sm:min-h-[620px]
          md:min-h-[560px]
          lg:min-h-[600px]
          flex
          flex-col
          justify-end
        "
      >
        <HeroSlide anime={items[0]} priority />
      </section>
    );
  }

  return (
    <section
      aria-label="Destaque principal"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onClickCapture={handleClickCapture}
      style={{ touchAction: "pan-y" }}
      className="
        relative
        -mx-4
        overflow-hidden
        bg-black
        border-b
        border-white/5
        shadow-[0_12px_40px_rgba(0,0,0,0.85)]
        sm:-mx-6
        md:mx-0
        md:rounded-3xl
        md:border
        md:border-white/10
        md:shadow-[0_20px_50px_rgba(0,0,0,0.7)]
        min-h-[560px]
        sm:min-h-[620px]
        md:min-h-[560px]
        lg:min-h-[600px]
        flex
        flex-col
        justify-end
        select-none
        touch-pan-y
        cursor-default
      "
    >
      <style>{`
        @keyframes heroCrossfadeOutNext {
          0% {
            opacity: 1;
            filter: brightness(1) contrast(1);
          }
          18% {
            opacity: 0.95;
            filter: brightness(0.82) contrast(1.02);
          }
          45% {
            opacity: 0.68;
            filter: brightness(0.68) contrast(1.04);
          }
          75% {
            opacity: 0.28;
            filter: brightness(0.55) contrast(1.02);
          }
          100% {
            opacity: 0;
            filter: brightness(0.45) contrast(1);
          }
        }

        @keyframes heroCrossfadeInNext {
          0% {
            opacity: 0;
            filter: brightness(0.9);
          }
          20% {
            opacity: 0.18;
            filter: brightness(0.94);
          }
          50% {
            opacity: 0.65;
            filter: brightness(0.98);
          }
          80% {
            opacity: 0.92;
            filter: brightness(1);
          }
          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }

        @keyframes heroCrossfadeOutPrev {
          0% {
            opacity: 1;
            filter: brightness(1) contrast(1);
          }
          18% {
            opacity: 0.95;
            filter: brightness(0.82) contrast(1.02);
          }
          45% {
            opacity: 0.68;
            filter: brightness(0.68) contrast(1.04);
          }
          75% {
            opacity: 0.28;
            filter: brightness(0.55) contrast(1.02);
          }
          100% {
            opacity: 0;
            filter: brightness(0.45) contrast(1);
          }
        }

        @keyframes heroCrossfadeInPrev {
          0% {
            opacity: 0;
            filter: brightness(0.9);
          }
          20% {
            opacity: 0.18;
            filter: brightness(0.94);
          }
          50% {
            opacity: 0.65;
            filter: brightness(0.98);
          }
          80% {
            opacity: 0.92;
            filter: brightness(1);
          }
          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }
      `}</style>

      {/* Camadas da transição ou anime ativo */}
      {transitioning ? (
        <div className="relative size-full min-h-[560px] sm:min-h-[620px] md:min-h-[560px] lg:min-h-[600px] flex flex-col justify-end">
          {/* Camada inferior: Anime saindo com leve escurecimento inicial, rastro sutil e desvanecimento */}
          <div
            key={`outgoing-${transitioning.fromIndex}-${items[transitioning.fromIndex].id}`}
            className="absolute inset-0 size-full pointer-events-none overflow-hidden z-10 will-change-[opacity,filter]"
            style={{
              animation: `${transitioning.direction === "next" ? "heroCrossfadeOutNext" : "heroCrossfadeOutPrev"} 1300ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            }}
          >
            <HeroSlide anime={items[transitioning.fromIndex]} />
          </div>

          {/* Camada superior: Próximo anime surgindo gradualmente por cima com crossfade e sincronização completa */}
          <div
            key={`incoming-${transitioning.toIndex}-${items[transitioning.toIndex].id}`}
            className="relative size-full overflow-hidden z-20 will-change-[opacity,filter]"
            style={{
              animation: `${transitioning.direction === "next" ? "heroCrossfadeInNext" : "heroCrossfadeInPrev"} 1300ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            }}
          >
            <HeroSlide anime={items[transitioning.toIndex]} priority />
          </div>
        </div>
      ) : (
        <div
          key={`active-${index}-${items[index].id}`}
          className="relative size-full overflow-hidden z-10"
        >
          <HeroSlide anime={items[index]} priority />
        </div>
      )}
    </section>
  );
}
