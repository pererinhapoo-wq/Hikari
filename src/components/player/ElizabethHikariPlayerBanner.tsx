import { useState } from "react";
import { Info } from "lucide-react";
import { buildHikariPlayerEpisodeUrl } from "@/lib/hikari-player";
import { cn } from "@/lib/utils";

export const ELIZABETH_PLAYER_BANNER_IMAGE =
  "/assets/aistudio/file_000000006650820e9806dd0a131836b5_fa589477.png" as const;
export const ELIZABETH_PLAYER_BANNER_WEBP_SRCSET =
  "/assets/elizabeth-hikari-player-banner-640.webp 640w, /assets/elizabeth-hikari-player-banner-1112.webp 1112w, /assets/elizabeth-hikari-player-banner-1672.webp 1672w" as const;

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

  const episodeLabel = episodeTitle?.trim()
    ? `Episódio ${episodeNumber} — ${episodeTitle.trim()}`
    : `Episódio ${episodeNumber}`;

  const altText = isClickable
    ? `Banner promocional da Elizabeth convidando para assistir ${animeTitle} (${episodeLabel}) no Hikari Player`
    : `Banner promocional da Elizabeth para ${animeTitle} (${episodeLabel}) — episódio ainda não disponível no Hikari Player`;

  const bannerStage = (
    <div className="relative aspect-[1672/941] w-full overflow-hidden bg-[#08070d]">
      {!imageFailed ? (
        <picture>
          {imageWebpSrcSet ? (
            <source
              srcSet={imageWebpSrcSet}
              sizes="(max-width: 640px) 100vw, (max-width: 1152px) 100vw, 1112px"
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
      data-hikari-player-available={isClickable ? "true" : "false"}
      className={cn(
        "overflow-hidden rounded-2xl border bg-[#08070d] shadow-md sm:shadow-[0_20px_70px_rgba(0,0,0,0.45)]",
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
