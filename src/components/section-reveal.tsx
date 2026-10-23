import { useEffect, useRef, useState, type ReactNode } from "react";

export function SectionReveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Se o ambiente não tiver IntersectionObserver (SSR/testes), exibe imediatamente
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setRevealed(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    // Dispara a entrada suave assim que a seção começar a entrar no viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delayMs > 0) {
            const timer = setTimeout(() => setRevealed(true), delayMs);
            observer.disconnect();
            return () => clearTimeout(timer);
          } else {
            setRevealed(true);
            // Executa apenas uma vez e desconecta o observer (nunca desfaz ao rolar para cima)
            observer.disconnect();
          }
        }
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -20px 0px",
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [delayMs]);

  return (
    <div
      ref={ref}
      className={`
        transition-all
        duration-700
        ease-[cubic-bezier(0.16,1,0.3,1)]
        will-change-[opacity,transform]
        ${
          revealed
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4"
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
}
