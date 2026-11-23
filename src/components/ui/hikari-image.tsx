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
  loading: loadingProp,
  decoding = "async",
  fetchPriority: fetchPriorityProp,
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
  const [prevSrc, setPrevSrc] = useState(src);
  const [usingFallback, setUsingFallback] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setUsingFallback(false);
    setHasError(false);
  }

  const activeSrc = usingFallback ? fallbackSrc : src;
  const activeSrcSet = usingFallback ? undefined : srcSet;
  const activeSizes = usingFallback ? undefined : sizes;

  if (!activeSrc || hasError) {
    if (fallback !== undefined && fallback !== null) {
      return <>{fallback}</>;
    }
    return (
      <div
        key="hikari-img-placeholder"
        aria-hidden="true"
        className={cn("size-full bg-[#0d0c16]", fallbackClassName, className)}
        {...rest}
      />
    );
  }

  const isLazy = !priority || Boolean(defer || (deferred && !priority));
  const loading: "eager" | "lazy" = loadingProp ?? (priority ? "eager" : isLazy ? "lazy" : "lazy");
  const fetchPriority: "high" | "low" | "auto" =
    fetchPriorityProp ?? (priority ? "high" : "low");
  const hasCustomOpacity =
    Boolean(loadedOpacityClass) && loadedOpacityClass !== "opacity-100";

  return (
    <img
      key={activeSrc}
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
      onLoad={onLoad}
      onError={(e) => {
        if (!usingFallback && fallbackSrc && fallbackSrc !== activeSrc) {
          setUsingFallback(true);
          return;
        }
        setHasError(true);
        onError?.(e);
      }}
      className={cn(
        "size-full object-cover hikari-image-fade opacity-100",
        hasCustomOpacity && loadedOpacityClass,
        className,
      )}
      {...rest}
    />
  );
});
