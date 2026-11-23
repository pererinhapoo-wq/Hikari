import { useMemo } from "react";

import { genreLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

type GenreTone = "violet" | "magenta";

const GENRE_TONES: Record<string, GenreTone> = {
  Action: "violet",
  Adventure: "magenta",
  Comedy: "violet",
  Drama: "magenta",
  Ecchi: "magenta",
  Fantasy: "violet",
  Horror: "magenta",
  "Mahou Shoujo": "magenta",
  MahouShoujo: "magenta",
  Mecha: "violet",
  Music: "magenta",
  Mystery: "violet",
  Psychological: "magenta",
  Romance: "magenta",
  "Sci-Fi": "violet",
  "Slice of Life": "violet",
  Sports: "violet",
  Supernatural: "magenta",
  Thriller: "violet",
};

function getGenreTone(genre: string, index: number): GenreTone {
  return GENRE_TONES[genre] ?? (index % 2 === 0 ? "violet" : "magenta");
}

interface GenresCatalogViewProps {
  genres: string[];
  onSelectGenre: (genre: string) => void;
}

export function GenresCatalogView({
  genres,
  onSelectGenre,
}: GenresCatalogViewProps) {
  const orderedGenres = useMemo(() => {
    return [...genres]
      .map((raw) => ({
        raw,
        label: genreLabel(raw),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [genres]);

  return (
    <div className="space-y-4 pt-3 pb-6 sm:space-y-5 sm:pt-5 sm:pb-10">
      {/* Cabeçalho editorial compacto da página Gêneros */}
      <header className="relative overflow-hidden rounded-lg border border-border bg-surface/85 px-4 py-4 sm:px-6 sm:py-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="h-px w-full bg-gradient-to-r from-purple-500/55 via-fuchsia-500/35 to-transparent" />
          <div className="absolute -top-20 -left-10 h-44 w-60 rounded-full bg-purple-600/12 blur-3xl" />
          <div className="absolute -right-10 -bottom-20 h-40 w-56 rounded-full bg-fuchsia-600/10 blur-3xl" />
        </div>

        <div className="relative">
          <p className="text-xs font-medium tracking-wide text-purple-300/90 tabular-nums">
            Catálogo Hikari · {orderedGenres.length}{" "}
            {orderedGenres.length === 1 ? "gênero" : "gêneros"}
          </p>

          <h1 className="mt-1 font-section text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-balance text-fg sm:text-[2.25rem]">
            Gêneros
          </h1>
        </div>
      </header>

      {/* Área principal — Grade em duas colunas com os nomes dos gêneros */}
      {orderedGenres.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface/70 px-6 py-14 text-center">
          <p className="text-sm text-muted">
            Nenhum gênero disponível no momento.
          </p>
        </div>
      ) : (
        <section aria-label="Explorar gêneros disponíveis">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {orderedGenres.map(({ raw, label }, index) => {
              const isMagenta = getGenreTone(raw, index) === "magenta";

              return (
                <button
                  key={raw}
                  type="button"
                  onClick={() => onSelectGenre(raw)}
                  aria-label={`Explorar gênero ${label}`}
                  className={cn(
                    "group relative flex min-h-[54px] w-full items-center overflow-hidden rounded-lg border border-border bg-surface/90 px-3.5 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:min-h-[60px] sm:px-5 sm:py-3.5",
                    isMagenta
                      ? "hover:border-fuchsia-400/40 hover:bg-elevated/95 active:border-fuchsia-400/50 active:bg-elevated"
                      : "hover:border-purple-400/40 hover:bg-elevated/95 active:border-purple-400/50 active:bg-elevated",
                  )}
                >
                  {/* Brilho atmosférico discreto no canto */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-0 opacity-65 transition-opacity duration-200 group-hover:opacity-100",
                      isMagenta
                        ? "bg-[radial-gradient(120%_90%_at_0%_0%,rgba(217,70,239,0.09),transparent_65%)]"
                        : "bg-[radial-gradient(120%_90%_at_0%_0%,rgba(168,85,247,0.10),transparent_65%)]",
                    )}
                  />

                  {/* Filete luminoso superior ao interagir */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-x-4 top-0 h-px opacity-0 transition-opacity duration-200 group-hover:opacity-100",
                      isMagenta
                        ? "bg-gradient-to-r from-transparent via-fuchsia-400/55 to-transparent"
                        : "bg-gradient-to-r from-transparent via-purple-400/55 to-transparent",
                    )}
                  />

                  <span className="relative z-10 block w-full font-section text-[15.5px] font-semibold leading-snug tracking-tight text-fg sm:text-[17.5px]">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
