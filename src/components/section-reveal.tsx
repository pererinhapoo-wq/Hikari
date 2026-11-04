import { useEffect, useRef, useState, type ReactNode } from "react";

export function SectionReveal({
  children,
  className = "",
  delayMs = 0,
  minHeight = "260px",
  rootMargin = "300px 0px",
  lazy = true,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  minHeight?: string | number;
  rootMargin?: string;
  lazy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Se o ambiente não tiver IntersectionObserver (SSR/testes sem DOM), exibe imediatamente
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setRevealed(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    let unmounted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Dispara a montagem assim que a seção se aproximar do viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !unmounted) {
          if (delayMs > 0) {
            timer = setTimeout(() => {
              if (!unmounted) {
                setRevealed(true);
              }
            }, delayMs);
            observer.disconnect();
          } else {
            setRevealed(true);
            // Executa apenas uma vez e desconecta o observer (nunca desmonta ao retornar ao topo)
            observer.disconnect();
          }
        }
      },
      {
        threshold: 0,
        rootMargin,
      },
    );

    const checkOrObserve = () => {
      if (unmounted || !node) return;
      observer.observe(node);
    };

    // Se o usuário já tiver rolagem ativa (ex.: restauração de histórico ou reload no meio da página)
    if (window.scrollY > 0) {
      checkOrObserve();
    } else {
      // No topo exato da página (scrollY === 0), prioriza somente Banner e Episódios de Hoje na abertura.
      // Observa assim que o usuário iniciar rolagem/interação ou em momento ocioso do navegador.
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      let idleCallbackId: number | null = null;

      const triggerObserve = () => {
        cleanup();
        checkOrObserve();
      };

      const cleanup = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (idleCallbackId !== null && typeof cancelIdleCallback === "function") {
          cancelIdleCallback(idleCallbackId);
          idleCallbackId = null;
        }
        window.removeEventListener("scroll", triggerObserve);
        window.removeEventListener("wheel", triggerObserve);
        window.removeEventListener("touchmove", triggerObserve);
        window.removeEventListener("keydown", triggerObserve);
        window.removeEventListener("pointerdown", triggerObserve);
      };

      if (typeof requestIdleCallback === "function") {
        idleCallbackId = requestIdleCallback(triggerObserve, { timeout: 2500 });
      } else {
        idleTimer = setTimeout(triggerObserve, 2500);
      }

      window.addEventListener("scroll", triggerObserve, { passive: true });
      window.addEventListener("wheel", triggerObserve, { passive: true });
      window.addEventListener("touchmove", triggerObserve, { passive: true });
      window.addEventListener("keydown", triggerObserve, { passive: true });
      window.addEventListener("pointerdown", triggerObserve, { passive: true });

      return () => {
        unmounted = true;
        if (timer) clearTimeout(timer);
        cleanup();
        observer.disconnect();
      };
    }

    return () => {
      unmounted = true;
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [delayMs, rootMargin]);

  return (
    <div
      ref={ref}
      style={revealed ? undefined : { minHeight }}
      className={`
        transition-all
        duration-500
        ease-[cubic-bezier(0.16,1,0.3,1)]
        ${
          revealed
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3 will-change-[opacity,transform]"
        }
        ${className}
      `}
    >
      {lazy ? (revealed ? children : null) : children}
    </div>
  );
}
