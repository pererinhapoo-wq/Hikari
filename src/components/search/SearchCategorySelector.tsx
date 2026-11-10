import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Film, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchCategory = "animes" | "users";

interface SearchCategorySelectorProps {
  category: SearchCategory;
  onChange: (category: SearchCategory) => void;
  className?: string;
  size?: "sm" | "md";
  align?: "left" | "right" | "auto";
}

export function SearchCategorySelector({
  category,
  onChange,
  className,
  size = "md",
  align = "auto",
}: SearchCategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"left" | "right">(
    align === "auto" ? "right" : align,
  );

  // Calcula o posicionamento para nunca vazar os limites da tela
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePlacement = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const menuWidth = 176; // w-44 = 176px

      if (align === "left") {
        if (rect.left + menuWidth > screenWidth - 8 && rect.right - menuWidth >= 8) {
          setPlacement("right");
        } else {
          setPlacement("left");
        }
      } else if (align === "right") {
        if (rect.right - menuWidth < 8 && rect.left + menuWidth <= screenWidth - 8) {
          setPlacement("left");
        } else {
          setPlacement("right");
        }
      } else {
        // Modo auto: alinha à esquerda se estiver na metade esquerda da tela, senão à direita
        if (rect.left < screenWidth / 2) {
          setPlacement("left");
        } else {
          setPlacement("right");
        }
      }
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    return () => window.removeEventListener("resize", updatePlacement);
  }, [isOpen, align]);

  // Fecha o dropdown ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("touchstart", handlePointerDownOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("touchstart", handlePointerDownOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectCategory = (next: SearchCategory) => {
    onChange(next);
    setIsOpen(false);
  };

  const isAnimes = category === "animes";

  return (
    <div ref={containerRef} className={cn("relative shrink-0", className)}>
      {/* Botão seletor compacto e moderno inspirado na referência BingeBang */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Categoria de busca: ${isAnimes ? "Animes" : "Usuários"}`}
        className={cn(
          "group relative flex items-center gap-1.5 rounded-lg font-medium transition-all select-none outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50 active:scale-[0.98]",
          size === "sm"
            ? "h-7 sm:h-7.5 px-2 sm:px-2.5 text-xs"
            : "h-8 sm:h-8.5 px-2.5 sm:px-3 text-xs sm:text-[13px]",
          isOpen
            ? "border border-purple-500/40 bg-[#1d1932] text-fg shadow-[0_0_12px_rgba(168,85,247,0.18)]"
            : "border border-white/10 bg-white/[0.05] text-zinc-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-fg",
        )}
      >
        {/* Ícone discreto */}
        <span
          className={cn(
            "flex items-center justify-center transition-colors",
            isAnimes ? "text-[#c084fc]" : "text-blue-400",
          )}
        >
          {isAnimes ? (
            <Film className="size-3.5" />
          ) : (
            <Users className="size-3.5" />
          )}
        </span>

        {/* Nome da categoria */}
        <span className="font-semibold text-fg tracking-tight text-[11px] sm:text-xs">
          {isAnimes ? "Animes" : "Usuários"}
        </span>

        {/* Seta discreta com rotação suave */}
        <ChevronDown
          className={cn(
            "size-3 text-zinc-400 transition-transform duration-200",
            isOpen && "rotate-180 text-[#c084fc]",
          )}
        />
      </button>

      {/* Menu dropdown compacto e posicionado abaixo do botão sem vazar a tela */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Selecione a categoria de busca"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-full mt-1.5 z-50 w-40 sm:w-44 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-white/10 bg-[#131020]/98 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.85),0_0_16px_rgba(168,85,247,0.12)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150",
            placement === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          )}
        >
          <div className="space-y-0.5">
            {/* Opção 1: Animes */}
            <button
              type="button"
              role="option"
              aria-selected={isAnimes}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectCategory("animes");
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                isAnimes
                  ? "bg-purple-500/15 font-semibold text-[#d8b4fe]"
                  : "text-zinc-300 hover:bg-white/[0.06] hover:text-fg",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Film className={cn("size-3.5 shrink-0", isAnimes ? "text-[#c084fc]" : "text-zinc-400")} />
                <span className="truncate">Animes</span>
              </div>
              {isAnimes && <Check className="size-3.5 shrink-0 text-[#c084fc]" />}
            </button>

            {/* Opção 2: Usuários */}
            <button
              type="button"
              role="option"
              aria-selected={!isAnimes}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectCategory("users");
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                !isAnimes
                  ? "bg-purple-500/15 font-semibold text-[#d8b4fe]"
                  : "text-zinc-300 hover:bg-white/[0.06] hover:text-fg",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Users className={cn("size-3.5 shrink-0", !isAnimes ? "text-[#c084fc]" : "text-zinc-400")} />
                <span className="truncate">Usuários</span>
              </div>
              {!isAnimes && <Check className="size-3.5 shrink-0 text-[#c084fc]" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
