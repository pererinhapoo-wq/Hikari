import React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  linkToHome?: boolean;
}

/**
 * Identidade visual oficial HIKARI com Elizabeth (Gintama) em duas camadas independentes.
 * Camada traseira: Elizabeth segurando a placa ("エリザベス"), posicionada acima das letras.
 * Camada frontal: Logotipo HIKARI em destaque com tipografia estilizada e brilho violeta,
 * cobrindo parcialmente a parte inferior da personagem para criar profundidade e manter
 * a marca perfeitamente contida dentro do cabeçalho sem invadir o banner.
 */
export function Logo({
  className,
  size = "md",
  linkToHome = true,
}: LogoProps) {
  const containerSizeClasses = {
    sm: "h-[42px] sm:h-[46px]",
    md: "h-[52px] sm:h-[58px]",
    lg: "h-[58px] sm:h-[66px]",
  }[size];

  const charSizeClasses = {
    sm: "h-[32px] sm:h-[36px]",
    md: "h-[40px] sm:h-[46px]",
    lg: "h-[46px] sm:h-[52px]",
  }[size];

  const wordmarkSizeClasses = {
    sm: "h-[26px] sm:h-[30px]",
    md: "h-[34px] sm:h-[40px]",
    lg: "h-[38px] sm:h-[44px]",
  }[size];

  const charSizesAttr = {
    sm: "(min-width: 640px) 75px, 66px",
    md: "(min-width: 640px) 96px, 83px",
    lg: "(min-width: 640px) 108px, 96px",
  }[size];

  const wordmarkSizesAttr = {
    sm: "(min-width: 640px) 88px, 76px",
    md: "(min-width: 640px) 118px, 100px",
    lg: "(min-width: 640px) 129px, 112px",
  }[size];

  const content = (
    <div
      className={cn(
        "relative inline-flex flex-col items-center justify-end select-none transition-transform duration-200 ease-out will-change-transform group-hover:scale-[1.02]",
        containerSizeClasses,
        className
      )}
      aria-label="HIKARI"
    >
      {/* Camada Traseira: Elizabeth com a placa levantada (posicionada acima das letras com alinhamento simétrico) */}
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
            "absolute top-0 z-0 w-auto object-contain pointer-events-none -translate-x-[3.5%] drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]",
            charSizeClasses
          )}
          loading="eager"
          decoding="async"
          draggable={false}
        />
      </picture>

      {/* Camada Frontal: HIKARI com tipografia estilizada e brilho violeta (com corte preciso do topo e do texto inferior 「ヒカリ」) */}
      <div
        className={cn(
          "relative z-10 inline-flex items-center justify-center filter drop-shadow-[0_2px_14px_rgba(168,85,247,0.55)]",
          wordmarkSizeClasses
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
            className="h-full w-auto object-contain [clip-path:polygon(0%_0%,14%_0%,14%_25%,78%_25%,78%_0%,100%_0%,100%_100%,74%_100%,74%_87%,26%_87%,26%_100%,0%_100%)]"
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </picture>
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
}

// Aliases para compatibilidade caso importados em componentes legados
export const HikariWordmark = Logo;
export function HikariSymbol() {
  return null;
}

