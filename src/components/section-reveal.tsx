import { useEffect, useRef, useState, type ReactNode } from "react";

export function SectionReveal({
  children,
  className = "",
  delayMs = 0,
  minHeight = "260px",
  rootMargin = "300px 0px",
  lazy = false,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  minHeight?: string | number;
  rootMargin?: string;
  lazy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(!lazy);

  useEffect(() => {
    if (!lazy) {
      setRevealed(true);
      return;
    }
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setRevealed(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    let unmounted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

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
            observer.disconnect();
          }
        }
      },
      {
        threshold: 0,
        rootMargin,
      },
    );

    observer.observe(node);

    return () => {
      unmounted = true;
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [lazy, delayMs, rootMargin]);

  if (!lazy) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      style={revealed ? undefined : { minHeight }}
      className={`transition-opacity duration-300 motion-reduce:transition-none ${revealed ? "opacity-100" : "opacity-0"} ${className}`.replace(/\s+/g, " ").trim()}
    >
      {revealed ? children : null}
    </div>
  );
}
