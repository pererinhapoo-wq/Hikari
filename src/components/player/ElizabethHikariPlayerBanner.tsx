import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { buildHikariPlayerEpisodeUrl } from "@/lib/hikari-player";
import { cn } from "@/lib/utils";

export const ELIZABETH_PLAYER_BANNER_IMAGE =
  "/assets/aistudio/file_000000006650820e9806dd0a131836b5_fa589477.png" as const;
export const ELIZABETH_PLAYER_BANNER_WEBP_SRCSET = "" as const;

export interface ElizabethHikariPlayerBannerProps {
  animeTitle: string;
  episodeNumber: number;
  episodeTitle?: string | null;
  hikariPlayerEpisodeId?: string | null;
  hikariPlayerEpisodeUrl?: string | null;
  imageSrc?: string;
  imageWebpSrcSet?: string;
  className?: string;
}

export function ElizabethHikariPlayerBanner({
  animeTitle,
  episodeNumber,
  episodeTitle,
  hikariPlayerEpisodeId,
  hikariPlayerEpisodeUrl,
  imageSrc = ELIZABETH_PLAYER_BANNER_IMAGE,
  imageWebpSrcSet = ELIZABETH_PLAYER_BANNER_WEBP_SRCSET,
  className,
}: ElizabethHikariPlayerBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageFailed, setImageFailed] = useState(false);

  // Garante construção/validação exclusivamente pelo helper seguro de src/lib/hikari-player.ts
  const resolvedUrl = hikariPlayerEpisodeId
    ? buildHikariPlayerEpisodeUrl(hikariPlayerEpisodeId)
    : hikariPlayerEpisodeUrl
      ? (() => {
          const match = hikariPlayerEpisodeUrl.match(
            /^https:\/\/hikari-player-2\.vercel\.app\/e\/([^/?#]+)$/,
          );
          return match ? buildHikariPlayerEpisodeUrl(decodeURIComponent(match[1])) : null;
        })()
      : null;

  const isClickable = Boolean(resolvedUrl);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;

    const updatePauseState = (visible: boolean) => {
      el.dataset.bannerPaused =
        visible && document.visibilityState !== "hidden" ? "false" : "true";
    };

    let currentlyVisible = true;
    let observer: IntersectionObserver | null = null;

    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          currentlyVisible = entry.isIntersecting;
          updatePauseState(currentlyVisible);
        },
        { threshold: 0.05 },
      );
      observer.observe(el);
    }

    const handleVisibilityChange = () => {
      updatePauseState(currentlyVisible);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const episodeLabel = episodeTitle?.trim()
    ? `Episódio ${episodeNumber} — ${episodeTitle.trim()}`
    : `Episódio ${episodeNumber}`;

  const altText = isClickable
    ? `Banner promocional da Elizabeth convidando para assistir ${animeTitle} (${episodeLabel}) no Hikari Player`
    : `Banner promocional da Elizabeth para ${animeTitle} (${episodeLabel}) — episódio ainda não disponível no Hikari Player`;

  const bannerStage = (
    <div className="hikari-ep-banner-stage relative aspect-[1672/941] w-full overflow-hidden bg-[#08070d]">
      {!imageFailed ? (
        <picture>
          {imageWebpSrcSet ? (
            <source
              srcSet={imageWebpSrcSet}
              sizes="(max-width: 640px) 100vw, 1112px"
              type="image/webp"
            />
          ) : null}
          <img
            src={imageSrc}
            alt={altText}
            width={1672}
            height={941}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="block size-full object-contain select-none"
          />
        </picture>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#19112b] via-[#0e0a1a] to-[#08070d] px-6 text-center">
          <p className="font-display text-lg sm:text-2xl font-bold text-white">
            {animeTitle}
          </p>
          <p className="text-xs sm:text-sm text-purple-200/85">
            {episodeLabel} · Hikari Player
          </p>
        </div>
      )}

      {/* D. Reflexo luminoso sutil ocasional na logo HIKARI */}
      <div aria-hidden="true" className="hikari-ep-banner-logo-glint">
        <div className="hikari-ep-banner-logo-glint-beam hikari-ep-banner-anim" />
      </div>

      {/* B1. Borda neon roxa animada ao redor da placa "ASSISTIR EPISÓDIO" */}
      <div aria-hidden="true" className="hikari-ep-banner-assistir-mask">
        <div className="hikari-ep-banner-assistir-border hikari-ep-banner-anim">
          <span className="hikari-ep-banner-border-spinner hikari-ep-banner-assistir-spinner hikari-ep-banner-anim" />
        </div>
      </div>

      {/* C. Brilho discreto pulsante no ícone de play (▷) */}
      <div
        aria-hidden="true"
        className="hikari-ep-banner-play-glow hikari-ep-banner-anim"
      />

      {/* B2. Borda neon roxa animada ao redor do botão "Hikari Player" */}
      <div
        aria-hidden="true"
        className="hikari-ep-banner-player-border hikari-ep-banner-anim"
      >
        <span className="hikari-ep-banner-border-spinner hikari-ep-banner-player-spinner hikari-ep-banner-anim" />
      </div>

      {/* A. Pétalas de sakura leves passando por faixas livres do cenário */}
      <span
        aria-hidden="true"
        className="hikari-ep-banner-petal hikari-ep-banner-petal-1 hikari-ep-banner-anim"
      />
      <span
        aria-hidden="true"
        className="hikari-ep-banner-petal hikari-ep-banner-petal-2 hikari-ep-banner-anim"
      />
      <span
        aria-hidden="true"
        className="hikari-ep-banner-petal hikari-ep-banner-petal-3 hikari-ep-banner-anim"
      />
      <span
        aria-hidden="true"
        className="hikari-ep-banner-petal hikari-ep-banner-petal-4 hikari-ep-banner-anim"
      />
      <span
        aria-hidden="true"
        className="hikari-ep-banner-petal hikari-ep-banner-petal-5 hikari-ep-banner-anim"
      />

      {isClickable ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10 transition-opacity duration-150 group-hover:ring-[#c084fc]/55"
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[5] bg-[#08070d]/30"
        />
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      data-banner-paused="false"
      data-hikari-player-available={isClickable ? "true" : "false"}
      className={cn(
        "overflow-hidden rounded-2xl border bg-[#08070d] shadow-[0_20px_70px_rgba(0,0,0,0.45)]",
        isClickable
          ? "border-[#a855f7]/30 transition-colors duration-150 hover:border-[#c084fc]/60"
          : "border-white/10",
        className,
      )}
    >
      {isClickable && resolvedUrl ? (
        <a
          href={resolvedUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Assistir ${animeTitle} (${episodeLabel}) no Hikari Player — abre em uma nova aba`}
          className="group block w-full cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c084fc]"
        >
          {bannerStage}
        </a>
      ) : (
        <div
          role="region"
          aria-label={`${animeTitle} (${episodeLabel}) — episódio ainda não disponível no Hikari Player`}
          className="block w-full select-none"
        >
          {bannerStage}
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 border-t border-white/10 bg-[#0d0b14] px-3.5 py-2.5 sm:px-4 text-xs sm:text-[13px] text-zinc-300"
          >
            <Info
              className="size-4 shrink-0 text-[#c084fc]"
              aria-hidden="true"
            />
            <span>
              Este episódio ainda não está disponível no Hikari Player.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ElizabethHikariPlayerBanner;
