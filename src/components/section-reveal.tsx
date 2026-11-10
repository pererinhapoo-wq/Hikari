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

    // Observa o elemento imediatamente para que conteúdos na viewport inicial apareçam sem atraso,
    // enquanto seções abaixo da dobra permanecem com lazy loading progressivo via rootMargin.
    observer.observe(node);

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
        transition-opacity
        duration-300
        motion-reduce:transition-none
        ${revealed ? "opacity-100" : "opacity-0"}
        ${className}
      `}
    >
      {lazy ? (revealed ? children : null) : children}
    </div>
  );
}
