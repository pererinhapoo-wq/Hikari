import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clapperboard, Film, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchCategory = "animes" | "users" | "characters" | "people";

export interface CategoryOption {
  id: SearchCategory;
  label: string;
  icon: typeof Film;
  iconColor: string;
  badgeColor: string;
  description: string;
}

export const CATEGORIES: CategoryOption[] = [
  {
    id: "animes",
    label: "Animes",
    icon: Film,
    iconColor: "text-[#c084fc]",
    badgeColor: "bg-purple-500/15 text-[#d8b4fe]",
    description: "Pesquisa de animes e filmes",
  },
  {
    id: "users",
    label: "Usuários",
    icon: Users,
    iconColor: "text-sky-400",
    badgeColor: "bg-sky-500/15 text-sky-300",
    description: "Membros cadastrados",
  },
  {
    id: "characters",
    label: "Personagens",
    icon: Sparkles,
    iconColor: "text-amber-400",
    badgeColor: "bg-amber-500/15 text-amber-300",
    description: "Personagens de animes",
  },
  {
    id: "people",
    label: "People",
    icon: Clapperboard,
    iconColor: "text-rose-400",
    badgeColor: "bg-rose-500/15 text-rose-300",
    description: "Dubladores, diretores e equipe",
  },
];

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

  const currentOption =
    CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
  const CurrentIcon = currentOption.icon;

  // Calcula o posicionamento para nunca vazar os limites da tela
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePlacement = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const menuWidth = 200; // w-48 a w-52

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
        aria-label={`Categoria de busca: ${currentOption.label}`}
        className={cn(
          "group relative flex items-center gap-1.5 rounded-lg font-medium transition-all select-none outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50 active:scale-[0.98]",
          size === "sm"
            ? "h-7 sm:h-7.5 px-2 sm:px-2.5 text-xs"
            : "h-8 sm:h-8.5 px-2.5 sm:px-3 text-xs sm:text-[13px]",
          isOpen
            ? "border border-purple-500/40 bg-[#1d1932] text-zinc-100 shadow-[0_0_12px_rgba(168,85,247,0.18)]"
            : "border border-white/10 bg-white/[0.05] text-zinc-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
        )}
      >
        {/* Ícone discreto */}
        <span className={cn("flex items-center justify-center transition-colors", currentOption.iconColor)}>
          <CurrentIcon className="size-3.5" />
        </span>

        {/* Nome da categoria selecionada */}
        <span className="font-semibold text-zinc-100 tracking-tight text-[11px] sm:text-xs">
          {currentOption.label}
        </span>

        {/* Seta discreta com rotação suave */}
        <ChevronDown
          className={cn(
            "size-3 text-zinc-400 transition-transform duration-200",
            isOpen && "rotate-180 text-[#c084fc]",
          )}
        />
      </button>

      {/* Menu dropdown compacto com as 4 categorias */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Selecione a categoria de busca"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-full mt-1.5 z-50 w-48 sm:w-52 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-white/10 bg-[#131020]/98 p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.9),0_0_20px_rgba(168,85,247,0.14)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150",
            placement === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          )}
        >
          <div className="space-y-1">
            {CATEGORIES.map((opt) => {
              const isSelected = opt.id === category;
              const OptIcon = opt.icon;

              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectCategory(opt.id);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                    isSelected
                      ? "bg-purple-500/15 font-semibold text-[#d8b4fe]"
                      : "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <OptIcon
                      className={cn(
                        "size-3.5 shrink-0 transition-colors",
                        isSelected ? opt.iconColor : "text-zinc-400",
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="size-3.5 shrink-0 text-[#c084fc]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
