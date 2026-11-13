import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Film, Mic2, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchCategory = "animes" | "users" | "people" | "characters";

export interface CategoryOption {
  id: SearchCategory;
  label: string;
  icon: typeof Film;
}

export const CATEGORIES: CategoryOption[] = [
  {
    id: "animes",
    label: "Animes",
    icon: Film,
  },
  {
    id: "users",
    label: "Usuários",
    icon: Users,
  },
  {
    id: "people",
    label: "People",
    icon: Mic2,
  },
  {
    id: "characters",
    label: "Personagens",
    icon: Sparkles,
  },
];

interface SearchCategorySelectorProps {
  category: SearchCategory;
  onChange: (category: SearchCategory) => void;
  className?: string;
  align?: "left" | "right" | "auto";
}

export function SearchCategorySelector({
  category,
  onChange,
  className,
  align = "auto",
}: SearchCategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"left" | "right">(
    align === "auto" ? "right" : align,
  );

  const currentOption =
    CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePlacement = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const menuWidth = 160;

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
      {/* Botão de escopo ("Tudo"/"All" / Categoria atual): font-family var(--font-sans), font-size 13px, font-weight 600, fundo rgb(168 85 247 / 0.1), borda rgb(168 85 247 / 0.28), cor var(--violet-200) */}
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
        aria-label={`Categoria: ${currentOption.label}`}
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          fontWeight: 600,
          background: "rgb(168 85 247 / 0.1)",
          borderColor: "rgb(168 85 247 / 0.28)",
          color: "var(--violet-200)",
        }}
        className={cn(
          "group relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-all select-none outline-none focus-visible:ring-1 focus-visible:ring-purple-400 active:scale-[0.98]",
          isOpen && "ring-1 ring-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]",
        )}
      >
        <span className="tracking-normal">{currentOption.label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 opacity-85 transition-transform duration-200",
            isOpen && "rotate-180 opacity-100",
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Selecione a categoria de busca"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--bg-2, #0e0c18)",
            borderColor: "var(--line-2, rgba(255, 255, 255, 0.12))",
            borderRadius: "var(--r-md, 10px)",
          }}
          className={cn(
            "absolute top-full mt-1.5 z-50 min-w-[150px] overflow-hidden border p-1 shadow-[0_16px_36px_rgba(0,0,0,0.9),0_0_20px_rgba(168,85,247,0.18)] md:backdrop-blur-md animate-in fade-in zoom-in-95 duration-150",
            placement === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          )}
        >
          <div className="space-y-0.5">
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
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    fontWeight: isSelected ? 600 : 500,
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors cursor-pointer",
                    isSelected
                      ? "bg-purple-500/15 text-[#e9d5ff]"
                      : "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <OptIcon className="size-3.5 shrink-0 text-purple-400" />
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="size-3.5 shrink-0 text-purple-400" />
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
