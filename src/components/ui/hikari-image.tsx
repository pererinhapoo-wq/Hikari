import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  deferred?: boolean;
  loadedOpacityClass?: string;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

/**
 * Componente compartilhado de carregamento de imagem do Hikari:
 * - Estado A (loading): shimmer horizontal linear de 1,4s apenas no placeholder reservado.
 * - Estado B (loaded): fade-in de 200ms (opacity 0 -> 1) e remoção completa do shimmer.
 * - Estado C (unavailable): fundo chapado sem shimmer infinito nem ícone quebrado.
 */
export const HikariImage = React.memo(function HikariImage({
  src,
  srcSet,
  sizes,
  fallbackSrc,
  alt = "",
  width,
  height,
  loading = "lazy",
  decoding = "async",
  fetchPriority,
  className,
  shimmerClassName,
  fallbackClassName,
  fallback,
  deferred = false,
  loadedOpacityClass = "opacity-100",
  onLoad,
  onError,
}: HikariImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const primaryKey = `${src ?? ""}|${srcSet ?? ""}`;
  const [prevPrimaryKey, setPrevPrimaryKey] = useState(primaryKey);
  if (primaryKey !== prevPrimaryKey) {
    setPrevPrimaryKey(primaryKey);
    setUsingFallback(false);
  }

  const activeSrc = usingFallback ? fallbackSrc : src;
  const activeSrcSet = usingFallback ? undefined : srcSet;
  const activeSizes = usingFallback ? undefined : sizes;

  const activeKey = `${deferred ? "deferred" : "live"}|${activeSrc ?? ""}|${activeSrcSet ?? ""}`;
  const [prevActiveKey, setPrevActiveKey] = useState(activeKey);
  const [status, setStatus] = useState<HikariImageStatus>(() =>
    deferred || !activeSrc ? "error" : "loading",
  );

  if (activeKey !== prevActiveKey) {
    setPrevActiveKey(activeKey);
    setStatus(deferred || !activeSrc ? "error" : "loading");
  }

  useIsomorphicLayoutEffect(() => {
    if (deferred) {
      return;
    }

    if (!activeSrc) {
      setStatus("error");
      return;
    }

    const img = imgRef.current;
    if (img && img.complete) {
      if (img.naturalWidth > 0) {
        setStatus("loaded");
      } else if (!usingFallback && fallbackSrc && fallbackSrc !== activeSrc) {
        setUsingFallback(true);
        setStatus("loading");
      } else {
        setStatus("error");
      }
      return;
    }

    setStatus("loading");
  }, [activeKey, activeSrc, deferred, fallbackSrc, usingFallback]);

  if (deferred) {
    return (
      <div
        aria-hidden="true"
        data-image-deferred="true"
        className={cn("size-full bg-[#131020]", fallbackClassName)}
      />
    );
  }

  if (!activeSrc) {
    if (fallback !== undefined && fallback !== null) {
      return <>{fallback}</>;
    }
    return (
      <div
        aria-hidden="true"
        className={cn("size-full bg-[#131020]", fallbackClassName)}
      />
    );
  }

  return (
    <>
      {status === "loading" && (
        <div
          aria-hidden="true"
          data-hikari-shimmer="true"
          className={cn(
            "hikari-image-shimmer pointer-events-none absolute inset-0 z-[1]",
            shimmerClassName,
          )}
        />
      )}
      <img
        ref={imgRef}
        src={activeSrc}
        srcSet={activeSrcSet}
        sizes={activeSizes}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        onLoad={(e) => {
          setStatus("loaded");
          onLoad?.(e);
        }}
        onError={(e) => {
          if (!usingFallback && fallbackSrc && fallbackSrc !== activeSrc) {
            setUsingFallback(true);
            setStatus("loading");
            return;
          }
          setStatus("error");
          onError?.(e);
        }}
        className={cn(
          className,
          "hikari-image-fade",
          loadedOpacityClass,
        )}
      />
    </>
  );
});
