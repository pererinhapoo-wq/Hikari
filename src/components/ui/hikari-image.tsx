import React, {
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type HikariImageStatus = "loading" | "loaded" | "error";

export interface HikariImageProps {
  src?: string | null;
  srcSet?: string;
  sizes?: string;
  fallbackSrc?: string | null;
  alt?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  fetchPriority?: "high" | "low" | "auto";
  className?: string;
  shimmerClassName?: string;
  fallbackClassName?: string;
  fallback?: ReactNode;
  defer?: boolean;
  deferred?: boolean;
  priority?: boolean;
  loadedOpacityClass?: string;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  [key: string]: any;
}

/**
 * Componente compartilhado de carregamento de imagem do Hikari:
 * - Emite <img> diretamente no SSR e primeiro render sempre que src existir.
 * - defer controla apenas o loading="lazy".
 * - src nulo/indefinido renderiza o placeholder div.
 */
export const HikariImage = React.memo(function HikariImage({
  src,
  srcSet,
  sizes,
  fallbackSrc,
  alt = "",
  width,
  height,
  loading: _loadingProp,
  decoding = "async",
  fetchPriority: _fetchPriorityProp,
  className,
  shimmerClassName: _shimmerClassName,
  fallbackClassName,
  fallback,
  defer = false,
  deferred = false,
  priority = false,
  loadedOpacityClass = "opacity-100",
  onLoad,
  onError,
  ...rest
}: HikariImageProps) {
  const [usingFallback, setUsingFallback] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const activeSrc = usingFallback ? fallbackSrc : src;
  const activeSrcSet = usingFallback ? undefined : srcSet;
  const activeSizes = usingFallback ? undefined : sizes;

  if (!activeSrc) {
    if (fallback !== undefined && fallback !== null) {
      return <>{fallback}</>;
    }
    return (
      <div
        aria-hidden="true"
        className={cn("size-full bg-[#0d0c16]", fallbackClassName, className)}
        {...rest}
      />
    );
  }

  const isLazy = !priority || Boolean(defer || deferred && !priority);
  const loading: "eager" | "lazy" = priority ? "eager" : isLazy ? "lazy" : "lazy";
  const fetchPriority: "high" | "low" = priority ? "high" : "low";

  return (
    <img
      src={activeSrc}
      srcSet={activeSrcSet}
      sizes={activeSizes}
      alt={alt ?? ""}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      draggable={false}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        if (!usingFallback && fallbackSrc && fallbackSrc !== activeSrc) {
          setUsingFallback(true);
          return;
        }
        onError?.(e);
      }}
      className={cn(
        "size-full object-cover hikari-image-fade opacity-100",
        loaded && loadedOpacityClass,
        className,
      )}
      {...rest}
    />
  );
});
