import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CardFavoriteButtonProps {
  isFavorite: boolean;
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  loading?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function CardFavoriteButton({
  isFavorite,
  onToggle,
  loading = false,
  ariaLabel,
  className,
}: CardFavoriteButtonProps) {
  const [animatingDepop, setAnimatingDepop] = useState(false);
  const prevFavoriteRef = useRef(isFavorite);

  useEffect(() => {
    // Detecta transição de favoritado para desfavoritado para executar bookmarkDepop
    if (prevFavoriteRef.current && !isFavorite) {
      setAnimatingDepop(true);
      const timer = window.setTimeout(() => setAnimatingDepop(false), 350);
      prevFavoriteRef.current = isFavorite;
      return () => window.clearTimeout(timer);
    }
    prevFavoriteRef.current = isFavorite;
  }, [isFavorite]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    void onToggle(e);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label={
        ariaLabel || (isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos")
      }
      className={cn(
        "group/fav absolute top-1.5 right-1.5 z-20 flex size-7 sm:size-7.5 items-center justify-center rounded-lg border select-none cursor-pointer transition-[color,background-color,border-color,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-90",
        isFavorite
          ? "border-rose-400/80 bg-gradient-to-r from-[#5a0828]/95 via-[#40071c]/95 to-[#250410]/95 text-white shadow-[0_2px_12px_rgba(244,63,94,0.55),0_0_18px_rgba(244,63,94,0.35)] hover:border-rose-300 hover:brightness-110"
          : "border-white/15 bg-black/85 text-zinc-300 shadow-[0_2px_8px_rgba(0,0,0,0.5)] hover:border-rose-400/60 hover:bg-rose-950/40 hover:text-white hover:scale-105",
        loading && "opacity-70 pointer-events-none",
        className,
      )}
    >
      <Heart
        className={cn(
          "size-3.5 transition-[color,transform] duration-200 ease-out",
          isFavorite
            ? "fill-rose-500 text-rose-200 scale-110 drop-shadow-[0_0_8px_rgba(244,63,94,0.9)] motion-safe:animate-[bookmarkPop_350ms_cubic-bezier(0.34,1.56,0.64,1)]"
            : "text-zinc-300 group-hover/fav:text-rose-300 group-hover/fav:scale-110",
          animatingDepop &&
            "motion-safe:animate-[bookmarkDepop_300ms_cubic-bezier(0.34,1.56,0.64,1)]",
        )}
      />
    </button>
  );
}
