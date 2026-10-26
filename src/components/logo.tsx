import React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  linkToHome?: boolean;
}

/**
 * Identidade visual oficial HIKARI.
 * Apresenta exclusivamente o nome HIKARI em tipografia fina, refinada e sofisticada,
 * iluminada por um reflexo luminoso contínuo em tons de branco e violeta.
 */
export function Logo({
  className,
  size = "md",
  linkToHome = true,
}: LogoProps) {
  const sizeClasses = {
    sm: "text-base tracking-[0.26em]",
    md: "text-lg sm:text-xl tracking-[0.3em]",
    lg: "text-2xl sm:text-3xl tracking-[0.34em]",
  }[size];

  const content = (
    <span
      className={cn(
        "hikari-luminous-text select-none uppercase tracking-[0.3em] font-medium leading-none",
        sizeClasses,
        className
      )}
      aria-label="HIKARI"
    >
      HIKARI
    </span>
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
