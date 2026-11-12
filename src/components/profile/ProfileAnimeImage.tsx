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

type CoverLoadStatus = "loading" | "loaded" | "error";

export interface ProfileAnimeImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  loaderClassName?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  fallback?: ReactNode;
}

/**
 * Imagem de anime para o perfil com estado de carregamento isolado por cartão,
 * verificação síncrona de cache (`complete`), fallback imediato em erro
 * e ausência total de textos/placeholders intrusivos.
 */
export const ProfileAnimeImage = React.memo(function ProfileAnimeImage({
  src,
  alt = "",
  className,
  loaderClassName,
  loading = "lazy",
  decoding = "async",
  fallback = null,
}: ProfileAnimeImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<CoverLoadStatus>(src ? "loading" : "error");

  useIsomorphicLayoutEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }

    const img = imgRef.current;
    if (img && img.complete) {
      setStatus(img.naturalWidth > 0 ? "loaded" : "error");
      return;
    }

    setStatus("loading");
  }, [src]);

  if (!src || status === "error") {
    return <>{fallback}</>;
  }

  return (
    <>
      {status === "loading" && (
        <div
          aria-hidden="true"
          data-profile-anime-loader="true"
          className={cn(
            "hikari-anime-cover-loader pointer-events-none absolute inset-0 z-[1]",
            loaderClassName,
          )}
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onLoad={(e) => {
          setStatus(e.currentTarget.naturalWidth > 0 ? "loaded" : "error");
        }}
        onError={() => {
          setStatus("error");
        }}
        className={cn(
          className,
          "motion-safe:transition-[opacity,transform] motion-safe:duration-200",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
      />
    </>
  );
});
