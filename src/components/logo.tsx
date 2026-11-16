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
  sm: "h-[42px] sm:h-[46px] min-w-[77px] sm:min-w-[89px]",
  md: "h-[52px] sm:h-[58px] min-w-[100px] sm:min-w-[118px]",
  lg: "h-[58px] sm:h-[66px] min-w-[112px] sm:min-w-[130px]",
} as const;

const CHAR_SIZE_CLASSES = {
  sm: "h-[32px] sm:h-[36px]",
  md: "h-[40px] sm:h-[46px]",
  lg: "h-[46px] sm:h-[52px]",
} as const;

const WORDMARK_SIZE_CLASSES = {
  sm: "h-[26px] sm:h-[30px]",
  md: "h-[34px] sm:h-[40px]",
  lg: "h-[38px] sm:h-[44px]",
} as const;

const CHAR_SIZES_ATTR = {
  sm: "(min-width: 640px) 75px, 66px",
  md: "(min-width: 640px) 96px, 83px",
  lg: "(min-width: 640px) 108px, 96px",
} as const;

const WORDMARK_SIZES_ATTR = {
  sm: "(min-width: 640px) 88px, 76px",
  md: "(min-width: 640px) 118px, 100px",
  lg: "(min-width: 640px) 129px, 112px",
} as const;

/**
 * Identidade visual oficial HIKARI com Elizabeth (Gintama) em duas camadas independentes,
 * enriquecida com animação cinematográfica de abertura de anime (energia violeta pulsando,
 * Elizabeth flutuando, reflexo de luz nas letras, pétalas de cerejeira e partículas mágicas).
 */
export const Logo = memo(function Logo({
  className,
  size = "md",
  linkToHome = true,
  loading = "eager",
  fetchPriority = "auto",
}: LogoProps) {
  const containerSizeClasses = CONTAINER_SIZE_CLASSES[size];
  const charSizeClasses = CHAR_SIZE_CLASSES[size];
  const wordmarkSizeClasses = WORDMARK_SIZE_CLASSES[size];
  const charSizesAttr = CHAR_SIZES_ATTR[size];
  const wordmarkSizesAttr = WORDMARK_SIZES_ATTR[size];
  const decodingMode = loading === "eager" ? "sync" : "async";

  const content = (
    <div
      className={cn(
        "hikari-animated-logo-container relative inline-flex flex-col items-center justify-end select-none transition-transform duration-200 ease-out group-hover:scale-[1.03]",
        containerSizeClasses,
        className,
      )}
      aria-label="HIKARI"
    >
      {/* Halo de energia violeta animado exclusivamente via transform + opacity na GPU */}
      <div className="hikari-energy-aura-glow" aria-hidden="true" />

      {/* Camada Traseira: Elizabeth com a placa levantada (flutuando suavemente) */}
      <div className="hikari-elizabeth-animated absolute top-0 inset-x-0 flex justify-center pointer-events-none z-0">
        <picture className="contents">
          <source
            type="image/webp"
            srcSet="/assets/hikari-elizabeth-character-sm.webp 186w, /assets/hikari-elizabeth-character.webp 290w"
            sizes={charSizesAttr}
          />
          <img
            src="/assets/hikari-elizabeth-character.png"
            alt=""
            aria-hidden="true"
            width={290}
            height={140}
            className={cn(
              "w-auto aspect-[290/140] object-contain -translate-x-[3.5%] drop-shadow-[0_2px_10px_rgba(168,85,247,0.42)]",
              charSizeClasses,
            )}
            loading={loading}
            decoding={decodingMode}
            fetchPriority={fetchPriority}
            draggable={false}
          />
        </picture>
      </div>

      {/* Partículas Mágicas e Pétalas de Cerejeira em Camadas (isoladas em containment próprio) */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden z-20 [contain:layout_style_paint]"
        aria-hidden="true"
      >
        <span className="hikari-petal hikari-petal-1" />
        <span className="hikari-petal hikari-petal-2" />
        <span className="hikari-petal hikari-petal-3" />
        <span className="hikari-particle hikari-particle-1" />
        <span className="hikari-particle hikari-particle-2" />
        <span className="hikari-particle hikari-particle-3" />
        <span className="hikari-particle hikari-particle-4" />
      </div>

      {/* Camada Frontal: HIKARI com tipografia estilizada, brilho estático leve e reflexo de luz */}
      <div
        className={cn(
          "hikari-energy-aura relative z-10 inline-flex aspect-[329/112] items-center justify-center overflow-hidden rounded drop-shadow-[0_2px_10px_rgba(168,85,247,0.5)]",
          wordmarkSizeClasses,
        )}
      >
        <picture className="contents">
          <source
            type="image/webp"
            srcSet="/assets/hikari-wordmark-sm.webp 200w, /assets/hikari-wordmark.webp 329w"
            sizes={wordmarkSizesAttr}
          />
          <img
            src="/assets/hikari-wordmark.png"
            alt="HIKARI — Elizabeth"
            width={329}
            height={112}
            className="h-full w-auto aspect-[329/112] object-contain [clip-path:polygon(0%_0%,14%_0%,14%_25%,78%_25%,78%_0%,100%_0%,100%_100%,74%_100%,74%_87%,26%_87%,26%_100%,0%_100%)]"
            loading={loading}
            decoding={decodingMode}
            fetchPriority={fetchPriority}
            draggable={false}
          />
        </picture>
        {/* Reflexo luminoso cinematográfico percorrendo as letras */}
        <div className="hikari-glint-overlay" aria-hidden="true" />
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
