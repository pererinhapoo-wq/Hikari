import React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  linkToHome?: boolean;
}

/**
 * Identidade visual oficial HIKARI com Elizabeth (Gintama).
 * Apresenta Elizabeth segurando a placa sobre o nome HIKARI em tipografia com brilho violeta,
 * perfeitamente adaptado para o cabeçalho transparente em desktop e celular.
 */
export function Logo({
  className,
  size = "md",
  linkToHome = true,
}: LogoProps) {
  const sizeClasses = {
    sm: "h-9 sm:h-10 max-h-[38px] sm:max-h-[42px]",
    md: "h-11 sm:h-12 max-h-[46px] sm:max-h-[50px]",
    lg: "h-12 sm:h-14 max-h-[50px] sm:max-h-[58px]",
  }[size];

  const content = (
    <div
      className={cn(
        "relative inline-flex items-center justify-center select-none group",
        className
      )}
      aria-label="HIKARI"
    >
      <img
        src="/assets/hikari-elizabeth-logo.png"
        alt="HIKARI — Elizabeth"
        className={cn(
          "w-auto object-contain transition-transform duration-200 ease-out will-change-transform group-hover:scale-[1.03] drop-shadow-[0_2px_10px_rgba(168,85,247,0.35)]",
          sizeClasses
        )}
        loading="eager"
        decoding="async"
        draggable={false}
      />
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
