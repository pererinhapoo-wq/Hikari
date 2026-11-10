import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Film, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchCategory = "animes" | "users";

interface SearchCategorySelectorProps {
  category: SearchCategory;
  onChange: (category: SearchCategory) => void;
  className?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
}

export function SearchCategorySelector({
  category,
  onChange,
  className,
  size = "md",
  align = "right",
}: SearchCategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora
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
      {/* Botão seletor com a seta para baixo integrada */}
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
        aria-label={`Categoria de busca: ${isAnimes ? "Animes" : "Usuários"}. Clique na seta para alterar.`}
        className={cn(
          "group relative flex items-center gap-1.5 sm:gap-2 rounded-xl font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]",
          size === "sm"
            ? "h-9 px-2.5 text-xs"
            : "h-9 sm:h-10 px-2.5 sm:px-3 text-xs sm:text-sm",
          isOpen
            ? "border-purple-500/50 bg-[#1e1b30] text-fg shadow-[0_0_15px_rgba(168,85,247,0.25)]"
            : "border border-purple-500/20 bg-elevated/90 text-zinc-200 hover:border-purple-500/40 hover:bg-elevated hover:text-fg shadow-sm",
        )}
      >
        {/* Ícone da categoria ativa */}
        <span
          className={cn(
            "flex size-4.5 sm:size-5 items-center justify-center rounded-lg transition-colors",
            isAnimes
              ? "bg-purple-500/15 text-[#c084fc] group-hover:bg-purple-500/25"
              : "bg-blue-500/15 text-blue-400 group-hover:bg-blue-500/25",
          )}
        >
          {isAnimes ? (
            <Film className="size-3.5 sm:size-4" />
          ) : (
            <Users className="size-3.5 sm:size-4" />
          )}
        </span>

        {/* Nome da categoria identificada visualmente no campo */}
        <span className="font-semibold text-fg tracking-tight">
          {isAnimes ? "Animes" : "Usuários"}
        </span>

        {/* Seta para baixo com rotação suave ao abrir */}
        <ChevronDown
          className={cn(
            "size-3.5 sm:size-4 text-muted transition-transform duration-200",
            isOpen && "rotate-180 text-[#c084fc]",
          )}
        />
      </button>

      {/* Menu dropdown aberto ao clicar na seta */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Selecione a categoria de busca"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-full mt-2 z-50 w-56 sm:w-60 overflow-hidden rounded-2xl border border-purple-500/25 bg-[#0e0d19]/98 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_24px_rgba(168,85,247,0.18)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150",
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          )}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtle">
            Categoria da busca
          </div>

          <div className="space-y-1">
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
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                isAnimes
                  ? "bg-purple-500/15 text-fg shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                  : "text-muted hover:bg-elevated hover:text-fg",
              )}
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  isAnimes
                    ? "bg-[#a855f7] text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                    : "bg-surface text-muted",
                )}
              >
                <Film className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-fg">
                  Animes
                </p>
                <p className="text-[11px] text-muted truncate">
                  Catálogo, filmes e séries
                </p>
              </div>

              {isAnimes && (
                <Check className="size-4 shrink-0 text-[#c084fc]" />
              )}
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
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                !isAnimes
                  ? "bg-purple-500/15 text-fg shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                  : "text-muted hover:bg-elevated hover:text-fg",
              )}
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  !isAnimes
                    ? "bg-[#a855f7] text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                    : "bg-surface text-muted",
                )}
              >
                <Users className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-fg">
                  Usuários
                </p>
                <p className="text-[11px] text-muted truncate">
                  Perfis da comunidade Hikari
                </p>
              </div>

              {!isAnimes && (
                <Check className="size-4 shrink-0 text-[#c084fc]" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
