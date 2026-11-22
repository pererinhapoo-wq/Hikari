import React, { memo } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  linkToHome?: boolean;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}

const CONTAINER_SIZE_CLASSES = {
  sm: "h-[54px] sm:h-[64px] aspect-[16/9] min-w-[96px]",
  md: "h-[54px] min-[380px]:h-[60px] sm:h-[68px] md:h-[74px] aspect-[16/9] min-w-[96px]",
  lg: "h-[56px] min-[380px]:h-[64px] sm:h-[74px] md:h-[82px] lg:h-[88px] aspect-[16/9] min-w-[100px]",
} as const;

/**
 * Identidade visual oficial HIKARI (versão definitiva unificada com Elizabeth, placa "TV", faíscas e fundo transparente).
 */
export const Logo = memo(function Logo({
  className,
  size = "md",
  linkToHome = true,
  loading = "eager",
  fetchPriority = "auto",
}: LogoProps) {
  const containerSizeClasses = CONTAINER_SIZE_CLASSES[size];

  const content = (
    <div
      className={cn(
        "hikari-animated-logo-container relative inline-flex items-center justify-center select-none transition-transform duration-200 ease-out group-hover:scale-[1.03]",
        containerSizeClasses,
        className,
      )}
      aria-label="HIKARI"
    >
      <div className="hikari-wordmark-aura" aria-hidden="true" />
      <picture className="relative z-[1] block size-full">
        <source
          srcSet="/assets/hikari-logo-final-transparent.webp"
          type="image/webp"
        />
        <img
          src="/assets/hikari-logo-final-transparent.png"
          alt="HIKARI"
          width={640}
          height={360}
          className="size-full object-contain"
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          draggable={false}
        />
      </picture>
      <div className="hikari-wordmark-neon" aria-hidden="true">
        <span className="hikari-wordmark-pulse" />
        <span className="hikari-wordmark-sweep" />
      </div>
      <div className="hikari-orbital-lines" aria-hidden="true">
        <span className="hikari-orbital-seg hikari-orbital-seg--left-wing" />
        <span className="hikari-orbital-seg hikari-orbital-seg--right-wing" />
        <span className="hikari-orbital-seg hikari-orbital-seg--gap-h" />
        <span className="hikari-orbital-seg hikari-orbital-seg--gap-hi" />
        <span className="hikari-orbital-seg hikari-orbital-seg--gap-ik" />
        <span className="hikari-orbital-seg hikari-orbital-seg--gap-ka" />
        <span className="hikari-orbital-seg hikari-orbital-seg--gap-ar" />
        <span className="hikari-orbital-seg hikari-orbital-seg--gap-ri" />
      </div>
      <div className="hikari-tv-frame" aria-hidden="true">
        <span className="hikari-tv-frame-ring" />
        <span className="hikari-tv-frame-corners" />
      </div>
      <div className="hikari-tv-screen" aria-hidden="true">
        <span className="hikari-tv-board-pulse" />
        <span className="hikari-tv-blackout" />
        <span className="hikari-tv-surge" />
        <span className="hikari-tv-sparks hikari-tv-sparks-t" />
        <span className="hikari-tv-sparks hikari-tv-sparks-v" />
      </div>
    </div>
  );

  if (!linkToHome) {
    return content;
  }

  return (
    <Link
      to="/"
      className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50 rounded-lg group"
      aria-label="HIKARI — Início"
    >
      {content}
    </Link>
  );
});

// Aliases para compatibilidade caso importados em componentes legados
export const HikariWordmark = Logo;
export function HikariSymbol() {
  return null;
}
