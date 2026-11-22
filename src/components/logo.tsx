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
  sm: "h-[34px] sm:h-[38px] aspect-[16/9] min-w-[60px]",
  md: "h-[44px] sm:h-[50px] aspect-[16/9] min-w-[78px]",
  lg: "h-[52px] sm:h-[60px] aspect-[16/9] min-w-[92px]",
} as const;

/**
 * Identidade visual oficial HIKARI (versão definitiva unificada com Elizabeth, placa "tv", faíscas e fundo cinematográfico).
 */
export const Logo = memo(function Logo({
  className,
  size = "md",
  linkToHome = true,
  loading = "eager",
  fetchPriority = "auto",
}: LogoProps) {
  const containerSizeClasses = CONTAINER_SIZE_CLASSES[size];
  const decodingMode = loading === "eager" ? "sync" : "async";

  const content = (
    <div
      className={cn(
        "hikari-animated-logo-container relative inline-flex items-center justify-center select-none transition-transform duration-200 ease-out group-hover:scale-[1.03]",
        containerSizeClasses,
        className,
      )}
      aria-label="HIKARI"
    >
      <img
        src="/assets/hikari-logo-final.png"
        alt="HIKARI"
        width={1672}
        height={941}
        className="size-full object-contain drop-shadow-[0_2px_12px_rgba(168,85,247,0.45)]"
        loading={loading}
        decoding={decodingMode}
        fetchPriority={fetchPriority}
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
});

// Aliases para compatibilidade caso importados em componentes legados
export const HikariWordmark = Logo;
export function HikariSymbol() {
  return null;
}
