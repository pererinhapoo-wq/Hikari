import React, { type ReactNode } from "react";
import { HikariImage } from "@/components/ui/hikari-image";

export interface ProfileAnimeImageProps {
  src?: string | null;
  srcSet?: string;
  sizes?: string;
  fallbackSrc?: string | null;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  loaderClassName?: string;
  fallbackClassName?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  fetchPriority?: "high" | "low" | "auto";
  deferred?: boolean;
  fallback?: ReactNode;
}

/**
 * Wrapper de compatibilidade para áreas de perfil reutilizando o componente
 * compartilhado HikariImage (Shimmer 1,4s + Fade-in 200ms + fundo chapado).
 */
export const ProfileAnimeImage = React.memo(function ProfileAnimeImage({
  loaderClassName,
  fallback,
  ...rest
}: ProfileAnimeImageProps) {
  return (
    <HikariImage
      {...rest}
      shimmerClassName={loaderClassName}
      fallback={fallback}
    />
  );
});
