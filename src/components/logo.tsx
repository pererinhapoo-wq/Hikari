import React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  linkToHome?: boolean;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}

/**
 * Identidade visual oficial HIKARI com Elizabeth (Gintama) em duas camadas independentes,
 * enriquecida com animação cinematográfica de abertura de anime (energia violeta pulsando,
 * Elizabeth flutuando, reflexo de luz nas letras, pétalas de cerejeira e partículas mágicas).
 */
export function Logo({
  className,
  size = "md",
  linkToHome = true,
  loading = "eager",
  fetchPriority = "auto",
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
        "hikari-animated-logo-container relative inline-flex flex-col items-center justify-end select-none transition-transform duration-200 ease-out group-hover:scale-[1.03]",
        containerSizeClasses,
        className
      )}
      aria-label="HIKARI"
    >
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
              "w-auto object-contain -translate-x-[3.5%] drop-shadow-[0_2px_12px_rgba(168,85,247,0.4)]",
              charSizeClasses
            )}
            loading={loading}
            decoding="async"
            fetchPriority={fetchPriority}
            draggable={false}
          />
        </picture>
      </div>

      {/* Partículas Mágicas e Pétalas de Cerejeira em Camadas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        <span className="hikari-petal" style={{ top: "10%", left: "15%", animationDelay: "0ms", animationDuration: "3.5s" }} />
        <span className="hikari-petal" style={{ top: "60%", left: "75%", animationDelay: "1200ms", animationDuration: "4.2s" }} />
        <span className="hikari-petal" style={{ top: "30%", left: "50%", animationDelay: "2400ms", animationDuration: "3.8s" }} />
        <span className="hikari-particle" style={{ top: "20%", left: "25%", animationDelay: "300ms" }} />
        <span className="hikari-particle" style={{ top: "70%", left: "65%", animationDelay: "900ms" }} />
        <span className="hikari-particle" style={{ top: "45%", left: "85%", animationDelay: "1500ms" }} />
        <span className="hikari-particle" style={{ top: "15%", left: "70%", animationDelay: "2100ms" }} />
      </div>

      {/* Camada Frontal: HIKARI com tipografia estilizada, energia violeta pulsante e reflexo de luz */}
      <div
        className={cn(
          "hikari-energy-aura relative z-10 inline-flex items-center justify-center overflow-hidden rounded filter drop-shadow-[0_2px_18px_rgba(168,85,247,0.7)]",
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
            loading={loading}
            decoding="async"
            fetchPriority={fetchPriority}
            draggable={false}
          />
        </picture>
        {/* Reflexo luminoso cinematográfico percorrendo as letras */}
        <div className="hikari-glint-overlay" />
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
