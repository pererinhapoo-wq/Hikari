import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ImgHTMLAttributes,
} from "react";
import {
  beginCriticalImageToken,
  finishCriticalImageToken,
} from "@/lib/presentation-sync";
import { cn } from "@/lib/utils";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface NewsSyncImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  /**
   * Quando true, registra esta imagem como recurso de apresentação inicial
   * (acima da dobra ou ao lado da notícia) para sincronizar com as notificações.
   * Nunca deve ser usado em imagens ocultas por CSS ou secundárias abaixo da dobra.
   */
  syncCritical?: boolean;
}

type ImageReadyState = "loading" | "loaded" | "error";

export function NewsSyncImage({
  src,
  alt = "",
  className,
  syncCritical = false,
  onLoad,
  onError,
  decoding = "async",
  ...rest
}: NewsSyncImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<ImageReadyState>("loading");

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

    if (!syncCritical || !img) {
      return;
    }

    const token = beginCriticalImageToken();
    let cancelled = false;

    const handleSettled = () => {
      if (!cancelled) {
        finishCriticalImageToken(token);
      }
    };

    const handleNativeLoad = () => {
      if (typeof img.decode === "function") {
        void img.decode().catch(() => undefined).finally(handleSettled);
      } else {
        handleSettled();
      }
    };

    img.addEventListener("load", handleNativeLoad, { once: true });
    img.addEventListener("error", handleSettled, { once: true });

    return () => {
      cancelled = true;
      img.removeEventListener("load", handleNativeLoad);
      img.removeEventListener("error", handleSettled);
      finishCriticalImageToken(token);
    };
  }, [src, syncCritical]);

  if (!src) {
    return null;
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      decoding={decoding}
      onLoad={(e) => {
        const target = e.currentTarget;
        if (target.naturalWidth === 0) {
          setStatus("error");
        } else {
          setStatus("loaded");
        }
        onLoad?.(e);
      }}
      onError={(e) => {
        setStatus("error");
        onError?.(e);
      }}
      className={cn(
        "motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none",
        status === "loaded" ? "opacity-100" : "opacity-0",
        className,
      )}
      {...rest}
    />
  );
}
