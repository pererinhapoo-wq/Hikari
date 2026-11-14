import { Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Info, Play } from "lucide-react";

import { displayTitle, type SlimAnime } from "@/lib/types";
import { genreLabel, scoreLabel, seasonLabel, statusLabel } from "@/lib/labels";
import { getAnimeLogo } from "@/lib/anime-logos";
import { anilistImage, withCatalogImageVersion } from "@/lib/image-utils";
import { useSynchronizedImageRef } from "@/lib/presentation-sync";

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

const HeroSlide = memo(function HeroSlide({ anime, priority = false }: HeroSlideProps) {
  const preferredTitle =
    anime.titles?.english?.trim() ||
    anime.titles?.romaji?.trim() ||
    anime.titles?.native?.trim() ||
    displayTitle(anime);

  const logoConfig = getAnimeLogo(anime);
  const [failedLogoAnimeId, setFailedLogoAnimeId] = useState<string | null>(
    null,
  );
  const logoFailed = failedLogoAnimeId === anime.id;

  const rawMobileBackdrop = withCatalogImageVersion(
    anime.cover?.trim() || anime.banner?.trim() || "",
    anime.catalogUpdatedAt,
  );
  const rawDesktopBackdrop = withCatalogImageVersion(
    anime.banner?.trim() || anime.cover?.trim() || "",
    anime.catalogUpdatedAt,
  );

  const mobileSrc480 = anilistImage(rawMobileBackdrop, 480);
  const mobileSrc768 = anilistImage(rawMobileBackdrop, 768);
  const desktopSrc1200 = anilistImage(rawDesktopBackdrop, 1200);
  const desktopSrc1600 = anilistImage(rawDesktopBackdrop, 1600);

  const mobileSrcSet = rawMobileBackdrop
    ? `${mobileSrc480} 480w, ${mobileSrc768} 768w`
    : "";
  const desktopSrcSet = rawDesktopBackdrop
    ? `${desktopSrc1200} 1200w, ${desktopSrc1600} 1600w`
    : "";
  const hasDistinctSources = Boolean(
    rawMobileBackdrop &&
      rawDesktopBackdrop &&
      rawMobileBackdrop !== rawDesktopBackdrop,
  );
  const heroSizes = "(min-width: 768px) 100vw, 100vw";

  const fallbackImgSrc = hasDistinctSources
    ? mobileSrc768
    : anilistImage(rawMobileBackdrop || rawDesktopBackdrop, 1600);
  const fallbackImgSrcSet = hasDistinctSources
    ? mobileSrcSet
    : rawMobileBackdrop || rawDesktopBackdrop
      ? `${anilistImage(rawMobileBackdrop || rawDesktopBackdrop, 480)} 480w, ${anilistImage(rawMobileBackdrop || rawDesktopBackdrop, 768)} 768w, ${anilistImage(rawMobileBackdrop || rawDesktopBackdrop, 1200)} 1200w, ${anilistImage(rawMobileBackdrop || rawDesktopBackdrop, 1600)} 1600w`
      : undefined;

  const heroBackdropRef = useSynchronizedImageRef(
    priority,
    fallbackImgSrc,
  );

  const scoreValue = anime.score != null ? scoreLabel(anime.score) : null;
  const seasonsSpan = useMemo(
    () => getConfirmedSeasonsSpan(anime),
    [anime]
  );
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
  const rawStatus = (anime.status || "").toLowerCase();
  const isAiring =
    rawStatus === "releasing" ||
    rawStatus === "airing" ||
    rawStatus === "currently_airing" ||
    statusText?.toLowerCase() === "em exibição";

  const isFinished =
    !isAiring &&
    (rawStatus === "finished" ||
      rawStatus === "completed" ||
      statusText?.toLowerCase() === "encerrado");

  return (
    <div className="relative size-full min-w-full shrink-0 flex flex-col justify-end select-none overflow-hidden min-h-[560px] sm:min-h-[620px] md:min-h-[560px] lg:min-h-[600px]">
      {/* CAMADA DE IMAGEM AMPLA EM BACKGROUND (CORES E LUZ NATURAIS) */}
      <div className="absolute inset-0 size-full pointer-events-none overflow-hidden select-none">
        {/* MOBILE / DESKTOP: Elemento único <picture> para priorizar apenas a imagem LCP real do viewport ativo */}
        <picture className="relative block size-full">
          {hasDistinctSources ? (
            <>
              <source
                media="(min-width: 768px)"
                srcSet={desktopSrcSet}
                sizes={heroSizes}
                width={1900}
                height={400}
              />
              <source
                media="(max-width: 767.98px)"
                srcSet={mobileSrcSet}
                sizes={heroSizes}
                width={460}
                height={690}
              />
            </>
          ) : null}
          <img
            ref={heroBackdropRef}
            src={fallbackImgSrc}
            srcSet={fallbackImgSrcSet}
            sizes={heroSizes}
            alt={preferredTitle}
            width={hasDistinctSources ? 460 : 1600}
            height={hasDistinctSources ? 690 : 900}
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            fetchPriority={priority ? "high" : "low"}
            className="size-full object-cover object-top md:object-center"
          />
        </picture>

        {/* GRADIENTE INFERIOR NEUTRO: Limitado estritamente à região dos textos */}
        <div
          className="absolute inset-x-0 bottom-0 h-[38%] sm:h-[35%] md:h-[32%] bg-gradient-to-t from-black via-black/50 via-40% to-transparent"
        />
      </div>

      {/* CONTEÚDO CENTRALIZADO E ELEGANTE */}
      <div
        className="relative z-20 w-full max-w-2xl mx-auto px-4 pt-28 pb-8 sm:px-6 sm:pb-10 flex flex-col items-center text-center space-y-3 sm:space-y-3.5"
      >
        {/* Título Principal: Logotipo Oficial ou Fallback Tipográfico */}
        <div className="w-full max-w-xl flex flex-col items-center justify-center min-h-[50px] sm:min-h-[64px] md:min-h-[76px]">
          {logoConfig && !logoFailed ? (
            <div className="flex items-center justify-center w-full px-2">
              <h1 className="sr-only">{preferredTitle}</h1>
              <picture className="contents">
                {logoConfig.webpSrcSet ? (
                  <source
                    type="image/webp"
                    srcSet={logoConfig.webpSrcSet}
                    sizes={logoConfig.sizes}
                  />
                ) : null}
                <img
                  src={logoConfig.src}
                  alt={logoConfig.alt || preferredTitle}
                  title={preferredTitle}
                  width={logoConfig.width ?? 360}
                  height={logoConfig.height ?? 176}
                  loading={priority ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={priority ? "high" : "low"}
                  onError={() => setFailedLogoAnimeId(anime.id)}
                  className={`object-contain select-none pointer-events-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] filter ${logoConfig.sizeClasses}`.replace(/\s+/g, " ").trim()}
                />
              </picture>
            </div>
          ) : (
              <h1
                title={preferredTitle}
                className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-snug [text-shadow:0_2px_8px_rgba(0,0,0,0.85)] line-clamp-2"
              >
              {preferredTitle}
            </h1>
          )}
        </div>

        {/* Linha de Metadados: Nota com estrela dourada · Total Temporadas · Lançamento · Episódios */}
        <div className="flex flex-wrap items-center justify-center gap-x-2.5 sm:gap-x-3 gap-y-1 text-xs sm:text-[13px] font-semibold text-zinc-100 [text-shadow:0_2px_6px_rgba(0,0,0,0.95)]">
          {scoreValue && (
            <span className="inline-flex items-center gap-1 font-extrabold tracking-tight text-amber-400 [text-shadow:0_2px_8px_rgba(245,158,11,0.4)]">
              <span className="text-sm sm:text-base leading-none text-amber-400 [text-shadow:0_1px_3px_rgba(245,158,11,0.6)]">★</span>
              <span className="tabular-nums text-xs sm:text-[13.5px] leading-none font-extrabold text-amber-300">{scoreValue}</span>
            </span>
          )}

          {scoreValue && (seasonsSpan || seasonValue || episodesValue) && (
            <span className="size-1 rounded-full bg-zinc-400/80 shrink-0" aria-hidden="true" />
          )}

          {seasonsSpan && (
            <span className="font-bold text-white tracking-wide text-xs sm:text-[13px] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{seasonsSpan}</span>
          )}

          {seasonsSpan && (seasonValue || episodesValue) && (
            <span className="size-1 rounded-full bg-zinc-400/80 shrink-0" aria-hidden="true" />
          )}

          {seasonValue && (
            <span className="font-semibold text-zinc-100 tracking-normal text-xs sm:text-[13px] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{seasonValue}</span>
          )}

          {seasonValue && episodesValue && (
            <span className="size-1 rounded-full bg-zinc-400/80 shrink-0" aria-hidden="true" />
          )}

          {episodesValue && (
            <span className="font-semibold text-zinc-200 tracking-normal text-xs sm:text-[13px] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{episodesValue}</span>
          )}
        </div>

        {/* Status da Transmissão */}
        {statusText && (
          <div className="flex items-center justify-center pt-0.5">
            <span
              className="hero-glass-capsule--status inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/40 px-3 py-1 text-[10.5px] sm:text-[11.5px] font-extrabold tracking-wider uppercase text-zinc-900"
            >
              {isAiring && (
                <span
                  className="relative flex size-2 sm:size-2.5 items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <span
                    className="size-1.5 sm:size-2 rounded-full bg-[#1ef066] shadow-[0_0_7px_1.5px_rgba(30,240,102,0.9),0_0_2px_0.5px_rgba(0,180,60,0.65)] motion-safe:animate-[heroGreenDotPulse_2.2s_ease-in-out_infinite] motion-reduce:animate-none"
                  />
                </span>
              )}
              {isFinished && (
                <Check
                  className="size-3 sm:size-3.5 text-[#1ef066] [filter:drop-shadow(0_0.5px_1px_rgba(0,0,0,0.38))_drop-shadow(0_0_4px_rgba(30,240,102,0.5))] shrink-0 stroke-[2.75]"
                  aria-hidden="true"
                />
              )}
              <span>{statusText}</span>
            </span>
          </div>
        )}

        {/* Gêneros / Categorias: Vidro fosco translúcido esbranquiçado com desfoque e texto escuro */}
        {anime.genres.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5 max-w-lg">
            {anime.genres.slice(0, 4).map((genre) => (
              <span
                key={genre}
                className="hero-genre-capsule inline-flex items-center rounded-full border border-white/30 bg-white/40 px-2.5 py-0.5 text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-wider text-zinc-900"
              >
                <span>{genreLabel(genre)}</span>
              </span>
            ))}
          </div>
        )}

        {/* Controles de Ação */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-2.5 flex items-center justify-center gap-2.5 sm:gap-3 w-auto pt-0.5"
        >
          {/* Botão Assistir: Inspirado na referência com acabamento vibrante e identidade Hikari */}
          <Link
            to="/watch/$id/$ep"
            params={{ id: anime.id, ep: "ep-1" }}
            preload="intent"
            style={{ touchAction: "manipulation" }}
            className="inline-flex items-center justify-center gap-2 h-9 sm:h-10 px-4.5 sm:px-5.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-fuchsia-600 hover:from-purple-500 hover:via-purple-400 hover:to-fuchsia-500 text-white font-bold text-xs sm:text-sm tracking-wide border border-white/20 shadow-[0_4px_20px_rgba(168,85,247,0.38)] hover:shadow-[0_4px_26px_rgba(168,85,247,0.55)] cursor-pointer select-none transition-[box-shadow,background-color,opacity] duration-140 ease-out"
          >
            <Play className="size-3.5 sm:size-4 fill-white text-white shrink-0" />
            <span>Assistir</span>
          </Link>

          {/* Controle Detalhes: Ação secundária combinando estilo e acabamento em vidro translúcido */}
          <Link
            to="/anime/$id"
            params={{ id: anime.id }}
            className="hero-btn-action group inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3.5 sm:px-4.5 rounded-xl sm:rounded-2xl bg-black/75 md:bg-black/60 hover:bg-black/80 border border-white/25 hover:border-white/40 text-white font-semibold text-xs sm:text-sm tracking-wide md:backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.5)] cursor-pointer select-none"
          >
            <Info className="size-3.5 sm:size-4 text-purple-200 group-hover:text-white shrink-0 transition-colors" />
            <span className="[text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">Detalhes</span>
            <ChevronRight className="size-3.5 sm:size-4 text-zinc-300 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  );
});


export function Hero({
  anime,
  animes = [anime],
}: {
  anime: SlimAnime;
  animes?: SlimAnime[];
}) {
  const items = useMemo(
    () => (animes.length > 0 ? animes : [anime]).slice(0, 8),
    [animes, anime],
  );
  const total = items.length;

  const [index, setIndex] = useState(0);
  const [transitioning, setTransitioning] = useState<{
    fromIndex: number;
    toIndex: number;
    direction: "next" | "prev";
  } | null>(null);

  const transitioningRef = useRef<{
    fromIndex: number;
    toIndex: number;
    direction: "next" | "prev";
  } | null>(null);
  transitioningRef.current = transitioning;

  const containerRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | null>(null);
  const preloadedUrlsRef = useRef<Set<string>>(new Set());
  const idleHandleRef = useRef<{
    timerId: number | null;
    idleId: number | null;
  } | null>(null);

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

  // Executa tarefas em momentos ociosos com fallback seguro e postergação
  const scheduleIdleTask = useCallback(
    (
      callback: () => void,
      delayMs = 2500,
      idleTimeout = 3000
    ): { timerId: number | null; idleId: number | null } => {
      if (typeof window === "undefined") {
        return { timerId: null, idleId: null };
      }
      const win = window as any;
      const handle: { timerId: number | null; idleId: number | null } = {
        timerId: null,
        idleId: null,
      };

      handle.timerId = win.setTimeout(() => {
        handle.timerId = null;
        if (typeof win.requestIdleCallback === "function") {
          handle.idleId = win.requestIdleCallback(
            () => {
              handle.idleId = null;
              callback();
            },
            { timeout: idleTimeout }
          );
        } else {
          callback();
        }
      }, delayMs);

      return handle;
    },
    []
  );

  const cancelIdleTask = useCallback(
    (handle: { timerId: number | null; idleId: number | null } | null) => {
      if (!handle || typeof window === "undefined") return;
      const win = window as any;
      if (handle.timerId !== null) {
        win.clearTimeout(handle.timerId);
        handle.timerId = null;
      }
      if (handle.idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(handle.idleId);
        handle.idleId = null;
      }
    },
    []
  );

  // Pré-carrega e pré-decodifica as imagens e logotipos de um slide alvo
  const preloadSlide = useCallback((targetItem?: SlimAnime) => {
    if (!targetItem || typeof window === "undefined") return;

    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    const rawBackdropUrl = withCatalogImageVersion(
      isDesktop
        ? targetItem.banner || targetItem.cover
        : targetItem.cover || targetItem.banner,
      targetItem.catalogUpdatedAt,
    );
    const backdropUrl = anilistImage(rawBackdropUrl, isDesktop ? 1600 : 768);

    if (backdropUrl && !preloadedUrlsRef.current.has(backdropUrl)) {
      preloadedUrlsRef.current.add(backdropUrl);
      const img = new Image();
      img.src = backdropUrl;
      img.decode?.().catch(() => {});
    }

    const logo = getAnimeLogo(targetItem);
    if (logo && !preloadedUrlsRef.current.has(logo.src)) {
      preloadedUrlsRef.current.add(logo.src);
      const logoImg = new Image();
      if (logo.webpSrcSet) {
        logoImg.sizes = logo.sizes || "160px";
        logoImg.srcset = logo.webpSrcSet;
      }
      logoImg.src = logo.src;
      logoImg.decode?.().catch(() => {});
    }
  }, []);

  // Garante o pré-carregamento imediato do slide necessário se o usuário interagir
  const ensureSlidePreloaded = useCallback(
    (direction: "next" | "prev") => {
      if (items.length < 2) return;
      const targetIndex =
        direction === "next"
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length;

      // Se houver agendamento ocioso pendente para o slide reverso, cancela para evitar trabalho redundante
      if (direction === "prev" && idleHandleRef.current !== null) {
        cancelIdleTask(idleHandleRef.current);
        idleHandleRef.current = null;
      }

      preloadSlide(items[targetIndex]);
    },
    [items, index, cancelIdleTask, preloadSlide]
  );

  // Pré-carregamento otimizado: prioriza o próximo slide inicialmente e adia o reverso para oportunidade ociosa
  useEffect(() => {
    if (typeof window === "undefined" || items.length < 2) return;

    let cancelled = false;
    let delayTimer: number | null = null;

    const nextIndex = (index + 1) % items.length;
    const prevIndex = (index - 1 + items.length) % items.length;

    const schedulePreload = () => {
      delayTimer = window.setTimeout(() => {
        if (cancelled) return;
        // Prioriza exclusivamente o próximo slide no carregamento inicial
        preloadSlide(items[nextIndex]);

        // Adia o pré-carregamento do slide anterior para momento ocioso do navegador se não for o mesmo slide
        if (prevIndex !== nextIndex) {
          if (idleHandleRef.current !== null) {
            cancelIdleTask(idleHandleRef.current);
          }
          idleHandleRef.current = scheduleIdleTask(() => {
            idleHandleRef.current = null;
            if (cancelled) return;
            preloadSlide(items[prevIndex]);
          }, 2500, 3000);
        }
      }, 250);
    };

    if (document.readyState === "complete") {
      schedulePreload();
    } else {
      window.addEventListener("load", schedulePreload, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedulePreload);
      if (delayTimer !== null) {
        window.clearTimeout(delayTimer);
      }
      if (idleHandleRef.current !== null) {
        cancelIdleTask(idleHandleRef.current);
        idleHandleRef.current = null;
      }
    };
  }, [items, index, cancelIdleTask, preloadSlide, scheduleIdleTask]);

  // Disparo da transição suave com crossfade e sobreposição
  const triggerTransition = useCallback(
    (direction: "next" | "prev") => {
      if (total < 2 || transitioningRef.current !== null) return;

      ensureSlidePreloaded(direction);

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
    [total, index, ensureSlidePreloaded]
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
        transitioningRef.current !== null
      ) {
        return;
      }
      triggerTransition("next");
    }, 8000);
  }, [total, triggerTransition]);

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

  // Conclui a animação após exatamente 1800ms com aceleração e desaceleração naturais
  useEffect(() => {
    if (!transitioning) return;

    const timeout = window.setTimeout(() => {
      setIndex(transitioning.toIndex);
      setTransitioning(null);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [transitioning]);

  // Manipulação de gestos de toque/ponteiro
  // A imagem permanece visualmente estática durante o arrasto, acionando a transição suave de escurecimento ao soltar
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (total < 2 || e.button !== 0) return;

    // Se houver uma transição em andamento, conclui-a imediatamente para liberar o novo gesto sem travamento
    if (transitioningRef.current !== null) {
      setIndex(transitioningRef.current.toIndex);
      setTransitioning(null);
    }

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
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const state = pointerState.current;
    if (!state.active || state.pointerId !== e.pointerId || state.isLockedVertical) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (!state.isLockedHorizontal) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX > 7 || absY > 7) {
        if (absY >= absX) {
          state.isLockedVertical = true;
          state.active = false;
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
      const currentDx = state.currentX - state.startX;
      if (currentDx > 0) {
        ensureSlidePreloaded("prev");
      } else if (currentDx < 0) {
        ensureSlidePreloaded("next");
      }
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
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 390;
      const threshold = Math.max(35, Math.min(viewportWidth, 600) * 0.12);
      const dx = state.currentX - state.startX;
      const elapsed = Date.now() - state.startTime;
      const isQuickSwipe = elapsed < 350 && Math.abs(dx) > 25;

      const shouldAdvance = dx < -threshold || (isQuickSwipe && dx < 0);
      const shouldReturn = dx > threshold || (isQuickSwipe && dx > 0);

      if (shouldAdvance) {
        triggerTransition("next");
      } else if (shouldReturn) {
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
        className="relative -mx-4 overflow-hidden bg-black border-b border-white/5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] sm:-mx-6 md:mx-0 md:rounded-3xl md:border md:border-white/10 md:shadow-[0_20px_50px_rgba(0,0,0,0.7)] min-h-[560px] sm:min-h-[620px] md:min-h-[560px] lg:min-h-[600px] flex flex-col justify-end [contain:layout_style]"
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
      className="relative -mx-4 overflow-hidden bg-black border-b border-white/5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] sm:-mx-6 md:mx-0 md:rounded-3xl md:border md:border-white/10 md:shadow-[0_20px_50px_rgba(0,0,0,0.7)] min-h-[560px] sm:min-h-[620px] md:min-h-[560px] lg:min-h-[600px] flex flex-col justify-end select-none touch-pan-y cursor-default [contain:layout_style]"
    >
      {/* Camadas da transição ou anime ativo */}
      {transitioning ? (
        <div className="relative size-full min-h-[560px] sm:min-h-[620px] md:min-h-[560px] lg:min-h-[600px] flex flex-col justify-end">
          {/* Camada inferior: Anime saindo com escurecimento perceptível, gradual e desvanecimento suave */}
          <div
            key={`outgoing-${transitioning.fromIndex}-${items[transitioning.fromIndex].id}`}
            className="absolute inset-0 size-full pointer-events-none overflow-hidden z-10 will-change-[opacity] [contain:paint] [transform:translateZ(0)]"
            style={{
              animation: "heroCrossfadeOut 1800ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
              backfaceVisibility: "hidden",
            }}
          >
            <HeroSlide anime={items[transitioning.fromIndex]} />
            <div
              className="absolute inset-0 size-full pointer-events-none bg-black will-change-[opacity] z-30 [transform:translateZ(0)]"
              style={{
                animation: "heroDarkenFade 1800ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
                backfaceVisibility: "hidden",
              }}
              aria-hidden="true"
            />
          </div>

          {/* Camada superior: Próximo anime surgindo suavemente sobre a imagem escurecida */}
          <div
            key={`incoming-${transitioning.toIndex}-${items[transitioning.toIndex].id}`}
            className="relative size-full overflow-hidden z-20 will-change-[opacity] [contain:paint] [transform:translateZ(0)]"
            style={{
              animation: "heroCrossfadeIn 1800ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
              backfaceVisibility: "hidden",
            }}
          >
            <HeroSlide anime={items[transitioning.toIndex]} priority />
          </div>
        </div>
      ) : (
        <div
          key={`active-${index}-${items[index].id}`}
          className="relative size-full overflow-hidden z-10 [contain:paint]"
        >
          <HeroSlide anime={items[index]} priority />
        </div>
      )}
    </section>
  );
}
