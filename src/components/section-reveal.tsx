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
      // No topo exato da página (scrollY === 0), aguarda a primeira ação de rolagem ou interação do usuário
      // para garantir que somente o Banner e "Episódios de Hoje" fiquem montados na abertura
      const onFirstInteraction = () => {
        window.removeEventListener("scroll", onFirstInteraction);
        window.removeEventListener("wheel", onFirstInteraction);
        window.removeEventListener("touchmove", onFirstInteraction);
        window.removeEventListener("keydown", onFirstInteraction);
        window.removeEventListener("pointerdown", onFirstInteraction);
        checkOrObserve();
      };

      window.addEventListener("scroll", onFirstInteraction, { passive: true });
      window.addEventListener("wheel", onFirstInteraction, { passive: true });
      window.addEventListener("touchmove", onFirstInteraction, { passive: true });
      window.addEventListener("keydown", onFirstInteraction, { passive: true });
      window.addEventListener("pointerdown", onFirstInteraction, { passive: true });

      return () => {
        unmounted = true;
        if (timer) clearTimeout(timer);
        window.removeEventListener("scroll", onFirstInteraction);
        window.removeEventListener("wheel", onFirstInteraction);
        window.removeEventListener("touchmove", onFirstInteraction);
        window.removeEventListener("keydown", onFirstInteraction);
        window.removeEventListener("pointerdown", onFirstInteraction);
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
        will-change-[opacity,transform]
        ${
          revealed
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3"
        }
        ${className}
      `}
    >
      {lazy ? (revealed ? children : null) : children}
    </div>
  );
}
