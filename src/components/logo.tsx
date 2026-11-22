import React, { memo, useCallback, useEffect, useRef } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  linkToHome?: boolean;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  pauseWhenOffscreen?: boolean;
}

const CONTAINER_SIZE_CLASSES = {
  sm: "h-[54px] sm:h-[64px] aspect-[16/9] min-w-[96px]",
  md: "h-[54px] min-[380px]:h-[60px] sm:h-[68px] md:h-[74px] aspect-[16/9] min-w-[96px]",
  lg: "h-[56px] min-[380px]:h-[64px] sm:h-[74px] md:h-[82px] lg:h-[88px] aspect-[16/9] min-w-[100px]",
} as const;

const offscreenCallbacks = new WeakMap<Element, (paused: boolean) => void>();
let sharedOffscreenObserver: IntersectionObserver | null = null;
let observedLogoCount = 0;

function observeLogoOffscreen(
  el: Element,
  onPausedChange: (paused: boolean) => void,
): () => void {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
    return () => {};
  }

  if (!sharedOffscreenObserver) {
    sharedOffscreenObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = offscreenCallbacks.get(entry.target);
          cb?.(!entry.isIntersecting);
        }
      },
      {
        root: null,
        rootMargin: "50px 0px",
        threshold: 0,
      },
    );
  }

  offscreenCallbacks.set(el, onPausedChange);
  sharedOffscreenObserver.observe(el);
  observedLogoCount += 1;

  return () => {
    offscreenCallbacks.delete(el);
    sharedOffscreenObserver?.unobserve(el);
    observedLogoCount = Math.max(0, observedLogoCount - 1);
    if (observedLogoCount === 0 && sharedOffscreenObserver) {
      sharedOffscreenObserver.disconnect();
      sharedOffscreenObserver = null;
    }
  };
}

/**
 * Identidade visual oficial HIKARI (versão definitiva unificada com Elizabeth, placa "TV", faíscas e fundo transparente).
 */
export const Logo = memo(function Logo({
  className,
  size = "md",
  linkToHome = true,
  loading = "eager",
  fetchPriority = "auto",
  pauseWhenOffscreen = true,
}: LogoProps) {
  const containerSizeClasses = CONTAINER_SIZE_CLASSES[size];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pauseWhenOffscreen) {
      const el = containerRef.current;
      if (el) {
        el.setAttribute("data-paused", "false");
      }
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    return observeLogoOffscreen(el, (paused) => {
      el.setAttribute("data-paused", paused ? "true" : "false");
    });
  }, [pauseWhenOffscreen]);

  const content = (
    <div
      ref={containerRef}
      data-paused="false"
      className={cn(
        "hikari-animated-logo-container relative inline-flex items-center justify-center select-none",
        containerSizeClasses,
        className,
      )}
      aria-label="HIKARI"
    >
      <div className="hikari-wordmark-aura" aria-hidden="true" />
      <picture className="relative z-[1] block size-full">
        <source
          srcSet="/assets/hikari-logo-final-transparent.webp"
          type="image/webp"
        />
        <img
          src="/assets/hikari-logo-final-transparent.png"
          alt="HIKARI"
          width={640}
          height={360}
          className="size-full object-contain"
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          draggable={false}
        />
      </picture>
      <div className="hikari-logo-masked-effects" aria-hidden="true">
        <div className="hikari-wordmark-neon">
          <span className="hikari-wordmark-pulse" />
          <span className="hikari-wordmark-sweep" />
        </div>
        <div className="hikari-orbital-lines" />
      </div>
      <div className="hikari-tv-frame" aria-hidden="true">
        <span className="hikari-tv-frame-ring" />
        <span className="hikari-tv-frame-corners" />
      </div>
      <div className="hikari-tv-screen" aria-hidden="true">
        <span className="hikari-tv-board-pulse" />
        <span className="hikari-tv-blackout" />
        <span className="hikari-tv-surge" />
        <span className="hikari-tv-sparks hikari-tv-sparks-t" />
        <span className="hikari-tv-sparks hikari-tv-sparks-v" />
      </div>
    </div>
  );

  if (!linkToHome) {
    return content;
  }

  return <LogoHomeLink>{content}</LogoHomeLink>;
});

function LogoHomeLink({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const lastPreloadAtRef = useRef(0);

  const preloadHomeOnIntent = useCallback(() => {
    if (router.state.location.pathname === "/") return;
    const now = Date.now();
    if (now - lastPreloadAtRef.current < 500) return;
    lastPreloadAtRef.current = now;
    void router.preloadRoute({ to: "/" }).catch(() => {});
  }, [router]);

  return (
    <Link
      to="/"
      preload={false}
      onFocus={preloadHomeOnIntent}
      onPointerDown={(e) => {
        if (e.button === 0) {
          preloadHomeOnIntent();
        }
      }}
      className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50 rounded-lg"
      aria-label="HIKARI — Início"
    >
      {children}
    </Link>
  );
}

// Aliases para compatibilidade caso importados em componentes legados
export const HikariWordmark = Logo;
export function HikariSymbol() {
  return null;
}
