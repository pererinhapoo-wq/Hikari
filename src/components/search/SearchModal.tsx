import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Film,
  Search as SearchIcon,
  Star,
  X,
} from "lucide-react";
import { searchCatalog } from "@/lib/api";
import { searchUsers, type SearchUserItem } from "@/lib/profile.functions";
import {
  searchCharacters,
  searchPeople,
  type SearchCharacterItem,
  type SearchPersonItem,
} from "@/lib/search-entities";
import { displayTitle, type SlimAnime } from "@/lib/types";
import { overlayList } from "@/lib/overlay";
import { getResponsiveCoverAttrs } from "@/lib/image-utils";
import { useHikariStore } from "@/lib/store";
import {
  SearchCategorySelector,
  type SearchCategory,
} from "@/components/search/SearchCategorySelector";
import { cn } from "@/lib/utils";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: SearchCategory;
}

/**
 * Normaliza e formata a nota real do anime de acordo com a escala:
 * - AniList e catálogo base: 0 a 100 (ex: 84 = 8.4)
 * - Avaliações locais: 0 a 10 (ex: 8.5)
 */
function formatAnimeScore(score: number | null | undefined): string | null {
  if (score == null || Number.isNaN(score) || score <= 0) return null;
  const normalized = score > 10 ? score / 10 : score;
  return normalized.toFixed(1);
}

/**
 * Pôster vertical com proporção 2:3, fade-in, shimmer e fallback
 */
function SearchPoster({
  src,
  srcSet,
  alt = "",
}: {
  src?: string | null;
  srcSet?: string;
  alt?: string;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
  }, [src]);

  return (
    <div className={cn("sr-poster", status !== "loaded" && "hikari-image-shimmer")}>
      {status === "error" || !src ? (
        <div className="flex size-full items-center justify-center bg-[var(--bg-4)] text-[var(--text-4)]">
          <Film className="size-[16px] opacity-75" />
        </div>
      ) : (
        <img
          src={src}
          srcSet={srcSet}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={`sr-poster-img ${status === "loaded" ? "loaded" : ""}`}
        />
      )}
    </div>
  );
}

/**
 * Avatar de usuário ou entidade
 */
function SearchAvatar({
  src,
  letter,
}: {
  src?: string | null;
  letter: string;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
  }, [src]);

  return (
    <div className="sr-poster text-[var(--violet-200)] flex items-center justify-center font-bold text-lg bg-[var(--bg-4)]">
      {src && status !== "error" ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={`sr-poster-img ${status === "loaded" ? "loaded" : ""}`}
        />
      ) : (
        <span>{letter}</span>
      )}
    </div>
  );
}

export function SearchModal({
  isOpen,
  onClose,
  initialCategory = "animes",
}: SearchModalProps) {
  const [animationState, setAnimationState] = useState<"open" | "closed">("open");
  const [isRendered, setIsRendered] = useState(isOpen);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [category, setCategory] = useState<SearchCategory>(initialCategory);
  const [query, setQuery] = useState("");

  // Resultados de Animes
  const [animeResults, setAnimeResults] = useState<SlimAnime[]>([]);
  const [animeLoading, setAnimeLoading] = useState(false);
  const [animeLoadingMore, setAnimeLoadingMore] = useState(false);
  const [animePage, setAnimePage] = useState(1);
  const [animeHasNext, setAnimeHasNext] = useState(false);

  // Resultados de Usuários
  const [userResults, setUserResults] = useState<SearchUserItem[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userLoadingMore, setUserLoadingMore] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userHasNext, setUserHasNext] = useState(false);

  // Resultados de Personagens
  const [characterResults, setCharacterResults] = useState<SearchCharacterItem[]>([]);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterLoadingMore, setCharacterLoadingMore] = useState(false);
  const [characterPage, setCharacterPage] = useState(1);
  const [characterHasNext, setCharacterHasNext] = useState(false);

  // Resultados de People
  const [peopleResults, setPeopleResults] = useState<SearchPersonItem[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleLoadingMore, setPeopleLoadingMore] = useState(false);
  const [peoplePage, setPeoplePage] = useState(1);
  const [peopleHasNext, setPeopleHasNext] = useState(false);

  const localAnimes = useHikariStore((s) => s.animes);

  /* =========================================================
     GERENCIAMENTO DE MONTAGEM, ANIMAÇÃO E SCROLL LOCK
  ========================================================== */
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setAnimationState("open");
      document.body.style.overflow = "hidden";
      const timer = window.setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 40);
      return () => window.clearTimeout(timer);
    } else {
      setAnimationState("closed");
      const timer = window.setTimeout(() => {
        setIsRendered(false);
        document.body.style.overflow = "";
      }, 160);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    inputRef.current?.blur();
    setAnimationState("closed");
    setTimeout(() => {
      onClose();
    }, 160);
  }, [onClose]);

  // Tecla Escape para fechar a busca
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Limpeza de texto da busca
  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setQuery("");
    setAnimeResults([]);
    setUserResults([]);
    setCharacterResults([]);
    setPeopleResults([]);
    setAnimePage(1);
    setUserPage(1);
    setCharacterPage(1);
    setPeoplePage(1);
    setAnimeHasNext(false);
    setUserHasNext(false);
    setCharacterHasNext(false);
    setPeopleHasNext(false);
    inputRef.current?.focus({ preventScroll: true });
  };

  // Troca de categoria
  const handleCategoryChange = (nextCategory: SearchCategory) => {
    setCategory(nextCategory);
    inputRef.current?.focus({ preventScroll: true });
  };

  /* =========================================================
     1. BUSCA DE ANIMES
  ========================================================== */
  useEffect(() => {
    if (!isOpen || category !== "animes") {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setAnimeResults([]);
      setAnimeLoading(false);
      setAnimeHasNext(false);
      setAnimePage(1);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setAnimeLoading(true);
      setAnimePage(1);

      try {
        const isAdultArea =
          typeof window !== "undefined" &&
          window.location.pathname.startsWith("/adult");

        const result = await searchCatalog({
          data: {
            q: trimmed,
            page: 1,
            adult: isAdultArea,
          },
        });

        if (cancelled) return;

        const normalized = trimmed
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

        const localHits = overlayList([], localAnimes).filter((anime) => {
          const isHentai =
            anime.genres?.some(
              (genre) => genre.trim().toLowerCase() === "hentai",
            ) ?? false;

          if (isAdultArea ? !isHentai : isHentai) {
            return false;
          }

          const title =
            `${anime.titles?.romaji || ""} ${anime.titles?.english || ""} ${anime.titles?.native || ""}`
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();

          return (
            title.includes(normalized) ||
            normalized.split(/\s+/).every((w) => title.includes(w))
          );
        });

        const remote = overlayList(result.items ?? [], localAnimes);
        const seen = new Set<string>();
        const merged: SlimAnime[] = [];

        for (const anime of [...localHits, ...remote]) {
          if (seen.has(anime.id)) continue;
          seen.add(anime.id);
          merged.push(anime);
        }

        if (!cancelled) {
          setAnimeResults(merged);
          setAnimeHasNext(result.page < result.totalPages);
        }
      } catch {
        if (!cancelled) {
          setAnimeResults([]);
          setAnimeHasNext(false);
        }
      } finally {
        if (!cancelled) {
          setAnimeLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, category, query, localAnimes]);

  const loadMoreAnimes = useCallback(async () => {
    if (animeLoading || animeLoadingMore || !animeHasNext) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    setAnimeLoadingMore(true);
    const nextPage = animePage + 1;

    try {
      const isAdultArea =
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/adult");

      const result = await searchCatalog({
        data: {
          q: trimmed,
          page: nextPage,
          adult: isAdultArea,
        },
      });

      const remote = overlayList(result.items ?? [], localAnimes);
      setAnimeResults((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        const additions: SlimAnime[] = [];
        for (const item of remote) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            additions.push(item);
          }
        }
        return [...prev, ...additions];
      });

      setAnimePage(nextPage);
      setAnimeHasNext(result.page < result.totalPages);
    } catch {
      setAnimeHasNext(false);
    } finally {
      setAnimeLoadingMore(false);
    }
  }, [animeLoading, animeLoadingMore, animeHasNext, query, animePage, localAnimes]);

  /* =========================================================
     2. BUSCA DE USUÁRIOS
  ========================================================== */
  useEffect(() => {
    if (!isOpen || category !== "users") {
      return;
    }

    let clean = query.trim();
    if (clean.startsWith("@")) {
      clean = clean.slice(1).trim();
    }

    if (clean.length < 2) {
      setUserResults([]);
      setUserLoading(false);
      setUserHasNext(false);
      setUserPage(1);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setUserLoading(true);
      setUserPage(1);

      try {
        const users = await searchUsers({
          data: {
            query: clean,
            page: 1,
            limit: 18,
          },
        });

        if (!cancelled) {
          setUserResults(users);
          setUserHasNext(users.length >= 18);
        }
      } catch {
        if (!cancelled) {
          setUserResults([]);
          setUserHasNext(false);
        }
      } finally {
        if (!cancelled) {
          setUserLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, category, query]);

  const loadMoreUsers = useCallback(async () => {
    if (userLoading || userLoadingMore || !userHasNext) return;
    let clean = query.trim();
    if (clean.startsWith("@")) clean = clean.slice(1).trim();
    if (clean.length < 2) return;

    setUserLoadingMore(true);
    const nextPage = userPage + 1;

    try {
      const users = await searchUsers({
        data: {
          query: clean,
          page: nextPage,
          limit: 18,
        },
      });

      setUserResults((prev) => {
        const seen = new Set(prev.map((u) => u.userId));
        const additions: SearchUserItem[] = [];
        for (const u of users) {
          if (!seen.has(u.userId)) {
            seen.add(u.userId);
            additions.push(u);
          }
        }
        return [...prev, ...additions];
      });

      setUserPage(nextPage);
      setUserHasNext(users.length >= 18);
    } catch {
      setUserHasNext(false);
    } finally {
      setUserLoadingMore(false);
    }
  }, [userLoading, userLoadingMore, userHasNext, query, userPage]);

  /* =========================================================
     3. BUSCA DE PERSONAGENS
  ========================================================== */
  useEffect(() => {
    if (!isOpen || category !== "characters") {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setCharacterResults([]);
      setCharacterLoading(false);
      setCharacterHasNext(false);
      setCharacterPage(1);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setCharacterLoading(true);
      setCharacterPage(1);

      try {
        const result = await searchCharacters(trimmed, 1, 18);
        if (!cancelled) {
          setCharacterResults(result.items);
          setCharacterHasNext(result.hasNext);
        }
      } catch {
        if (!cancelled) {
          setCharacterResults([]);
          setCharacterHasNext(false);
        }
      } finally {
        if (!cancelled) {
          setCharacterLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, category, query]);

  const loadMoreCharacters = useCallback(async () => {
    if (characterLoading || characterLoadingMore || !characterHasNext) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    setCharacterLoadingMore(true);
    const nextPage = characterPage + 1;

    try {
      const result = await searchCharacters(trimmed, nextPage, 18);
      setCharacterResults((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        const additions: SearchCharacterItem[] = [];
        for (const item of result.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            additions.push(item);
          }
        }
        return [...prev, ...additions];
      });
      setCharacterPage(nextPage);
      setCharacterHasNext(result.hasNext);
    } catch {
      setCharacterHasNext(false);
    } finally {
      setCharacterLoadingMore(false);
    }
  }, [characterLoading, characterLoadingMore, characterHasNext, query, characterPage]);

  /* =========================================================
     4. BUSCA DE PEOPLE
  ========================================================== */
  useEffect(() => {
    if (!isOpen || category !== "people") {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setPeopleResults([]);
      setPeopleLoading(false);
      setPeopleHasNext(false);
      setPeoplePage(1);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setPeopleLoading(true);
      setPeoplePage(1);

      try {
        const result = await searchPeople(trimmed, 1, 18);
        if (!cancelled) {
          setPeopleResults(result.items);
          setPeopleHasNext(result.hasNext);
        }
      } catch {
        if (!cancelled) {
          setPeopleResults([]);
          setPeopleHasNext(false);
        }
      } finally {
        if (!cancelled) {
          setPeopleLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, category, query]);

  const loadMorePeople = useCallback(async () => {
    if (peopleLoading || peopleLoadingMore || !peopleHasNext) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    setPeopleLoadingMore(true);
    const nextPage = peoplePage + 1;

    try {
      const result = await searchPeople(trimmed, nextPage, 18);
      setPeopleResults((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const additions: SearchPersonItem[] = [];
        for (const item of result.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            additions.push(item);
          }
        }
        return [...prev, ...additions];
      });
      setPeoplePage(nextPage);
      setPeopleHasNext(result.hasNext);
    } catch {
      setPeopleHasNext(false);
    } finally {
      setPeopleLoadingMore(false);
    }
  }, [peopleLoading, peopleLoadingMore, peopleHasNext, query, peoplePage]);

  /* =========================================================
     OBSERVER DE SCROLL INFINITO
  ========================================================== */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          if (category === "animes" && animeHasNext && !animeLoading && !animeLoadingMore) {
            void loadMoreAnimes();
          } else if (category === "users" && userHasNext && !userLoading && !userLoadingMore) {
            void loadMoreUsers();
          } else if (category === "characters" && characterHasNext && !characterLoading && !characterLoadingMore) {
            void loadMoreCharacters();
          } else if (category === "people" && peopleHasNext && !peopleLoading && !peopleLoadingMore) {
            void loadMorePeople();
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "300px 0px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    category,
    animeHasNext,
    animeLoading,
    animeLoadingMore,
    loadMoreAnimes,
    userHasNext,
    userLoading,
    userLoadingMore,
    loadMoreUsers,
    characterHasNext,
    characterLoading,
    characterLoadingMore,
    loadMoreCharacters,
    peopleHasNext,
    peopleLoading,
    peopleLoadingMore,
    loadMorePeople,
  ]);

  if (!isRendered) return null;

  const userQueryClean = query.trim().replace(/^@/, "").trim();

  const isCurrentLoading =
    category === "animes"
      ? animeLoading
      : category === "users"
        ? userLoading
        : category === "characters"
          ? characterLoading
          : peopleLoading;

  const isCurrentLoadingMore =
    category === "animes"
      ? animeLoadingMore
      : category === "users"
        ? userLoadingMore
        : category === "characters"
          ? characterLoadingMore
          : peopleLoadingMore;

  const currentCount =
    category === "animes"
      ? animeResults.length
      : category === "users"
        ? userResults.length
        : category === "characters"
          ? characterResults.length
          : peopleResults.length;

  const currentHasMore =
    category === "animes"
      ? animeHasNext
      : category === "users"
        ? userHasNext
        : category === "characters"
          ? characterHasNext
          : peopleHasNext;

  const placeholderText =
    category === "animes"
      ? "Buscar no Hikari..."
      : category === "users"
        ? "Buscar usuários por @username..."
        : category === "characters"
          ? "Buscar personagens..."
          : "Buscar profissionais (People)...";

  const handleEnterNavigation = () => {
    const clean = query.trim();
    if (!clean) return;

    if (category === "animes") {
      handleClose();
      void navigate({
        to: "/search",
        search: { q: clean },
      });
    } else if (category === "users") {
      if (userResults.length > 0) {
        handleClose();
        void navigate({
          to: "/profile/$nick",
          params: { nick: userResults[0].nick },
        });
      } else {
        handleClose();
        void navigate({
          to: "/search",
          search: { q: clean, tab: "users" },
        });
      }
    } else {
      handleClose();
      void navigate({
        to: "/search",
        search: { q: clean, tab: category },
      });
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Caixa de busca do Hikari"
      data-state={animationState}
      className="sr-overlay"
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 cursor-pointer"
        aria-hidden="true"
      />

      {/* Janela modal centralizada com animação */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="sr-modal-window relative z-10"
      >
        {/* =========================================================
            BARRA DE BUSCA SUPERIOR
        ========================================================== */}
        <div
          className="relative border-b shrink-0 flex items-center"
          style={{
            borderColor: "var(--line)",
            padding: "14px 16px",
            gap: "10px",
          }}
        >
          <SearchIcon
            className="size-5 shrink-0 text-[var(--text-4)]"
            aria-hidden="true"
          />

          <input
            ref={inputRef}
            type="text"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).blur();
                handleEnterNavigation();
              }
            }}
            placeholder={placeholderText}
            className="h-full flex-1 bg-transparent outline-none border-none shadow-none focus:outline-none focus:ring-0 placeholder:font-normal"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              fontWeight: 500,
              letterSpacing: "-0.005em",
              color: "var(--text-1)",
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />

          {query.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[var(--text-3)] hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Limpar pesquisa"
              title="Limpar pesquisa"
            >
              <X className="size-3.5" />
            </button>
          )}

          <SearchCategorySelector
            category={category}
            onChange={handleCategoryChange}
            size="sm"
          />

          {/* Chip ESC */}
          <button
            type="button"
            onClick={handleClose}
            className="hidden min-[561px]:inline-flex shrink-0 items-center justify-center px-2 py-0.5 rounded-[var(--r-sm)] border bg-white/[0.06] text-[var(--text-4)] hover:text-[var(--text-1)] text-[10px] tracking-[.08em] uppercase transition-colors cursor-pointer"
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              borderColor: "var(--line-2)",
            }}
            title="ESC para fechar"
          >
            ESC
          </button>
        </div>

        {/* =========================================================
            HEADER DE RÓTULO E CONTAGEM (Apenas com consulta)
        ========================================================== */}
        {hasQuery && (
          <div className="sr-section-label">
            <div className="flex items-center justify-between">
              <span>{category === "animes" ? "ANIMES" : category === "users" ? "USUÁRIOS" : category === "people" ? "PEOPLE" : "PERSONAGENS"}</span>
              <span style={{ color: "var(--violet-200)" }}>
                {isCurrentLoading
                  ? "..."
                  : `${currentCount} ${currentCount === 1 ? "resultado" : "resultados"}`}
              </span>
            </div>
          </div>
        )}

        {/* =========================================================
            ÁREA DE CONTEÚDO (Scroll Container)
        ========================================================== */}
        <div
          ref={scrollContainerRef}
          data-search-scroll-container
          className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1"
        >
          {/* =========================================================
              ESTADO VAZIO (Sem consulta)
          ========================================================== */}
          {!hasQuery && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4 text-center">
              <div
                className="flex size-14 items-center justify-center rounded-2xl mb-4 text-[var(--violet-200)] shadow-[0_0_24px_rgba(168,85,247,0.15)]"
                style={{
                  background: "rgba(168,85,247,.1)",
                  border: "1px solid rgba(168,85,247,.28)",
                }}
              >
                <SearchIcon className="size-7" />
              </div>
              <h2
                className="text-[18px] sm:text-[20px] font-semibold text-[var(--text-1)] tracking-tight"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Find something to watch
              </h2>
              <p
                className="mt-1.5 text-[13px] sm:text-[14px] text-[var(--text-3)] max-w-sm leading-relaxed"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {category === "animes"
                  ? "Pesquise animes por título original, romaji ou em português."
                  : category === "users"
                    ? "Encontre amigos e membros da comunidade pelo @username."
                    : category === "characters"
                      ? "Pesquise personagens favoritos de suas obras."
                      : "Pesquise dubladores, diretores e profissionais de produção."}
              </p>
            </div>
          )}

          {/* =========================================================
              1. RESULTADOS DE ANIMES
          ========================================================== */}
          {category === "animes" && hasQuery && (
            <div>
              {animeLoading && animeResults.length === 0 ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="sr-item skeleton">
                      <div className="sr-poster" />
                      <div className="min-w-0 space-y-2 py-1">
                        <p className="sr-title" />
                        <div className="sr-sub" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : animeLoading && animeResults.length > 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="sr-spinner" />
                </div>
              ) : animeResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-[var(--line)] text-[var(--text-4)] mb-3">
                    <Film className="size-6" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-[var(--text-1)]" style={{ fontFamily: "var(--font-sans)" }}>
                    Nenhum anime encontrado
                  </h2>
                  <p className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm" style={{ fontFamily: "var(--font-sans)" }}>
                    Não encontramos resultados para &quot;{query.trim()}&quot;. Tente outro título.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {animeResults.map((anime) => {
                    const coverAttrs = anime.cover
                      ? getResponsiveCoverAttrs(anime.cover, "thumb")
                      : null;
                    const scoreFormatted = formatAnimeScore(anime.score);
                    const title = displayTitle(anime);

                    return (
                      <Link
                        key={anime.id}
                        to="/anime/$id"
                        params={{ id: anime.id }}
                        onClick={handleClose}
                        className="sr-item group"
                      >
                        <SearchPoster
                          src={coverAttrs?.src}
                          srcSet={coverAttrs?.srcSet}
                          alt=""
                        />

                        <div className="min-w-0 flex-1">
                          <p className="sr-title">
                            {title}
                          </p>

                          <div className="sr-sub">
                            {scoreFormatted && (
                              <span className="sr-rating">
                                <Star />
                                {scoreFormatted}
                              </span>
                            )}

                            {scoreFormatted && anime.year && (
                              <span className="sr-sep">·</span>
                            )}

                            {anime.year && (
                              <span>{anime.year}</span>
                            )}

                            {anime.genres && anime.genres.length > 0 && (
                              <>
                                <span className="sr-sep">·</span>
                                <span className="sr-genres">
                                  {anime.genres.slice(0, 2).join(", ")}
                                </span>
                              </>
                            )}
                          </div>

                          <div>
                            {anime.format === "TV" ? (
                              <span className="sr-type tv">TV</span>
                            ) : anime.format ? (
                              <span className="sr-type">
                                {anime.format === "MOVIE" ? "Filme" : anime.format}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              2. RESULTADOS DE USUÁRIOS
          ========================================================== */}
          {category === "users" && hasQuery && (
            <div>
              {userQueryClean.length < 2 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <h2 className="text-[16px] font-semibold text-[var(--text-1)]" style={{ fontFamily: "var(--font-sans)" }}>
                    Digite pelo menos 2 caracteres
                  </h2>
                  <p className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm" style={{ fontFamily: "var(--font-sans)" }}>
                    Pesquise por @username ou nome de exibição para encontrar membros.
                  </p>
                </div>
              ) : userLoading && userResults.length === 0 ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="sr-item skeleton">
                      <div className="sr-poster" />
                      <div className="min-w-0 space-y-2 py-1">
                        <p className="sr-title" />
                        <div className="sr-sub" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : userLoading && userResults.length > 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="sr-spinner" />
                </div>
              ) : userResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-[var(--line)] text-[var(--text-4)] mb-3">
                    <SearchIcon className="size-6" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-[var(--text-1)]" style={{ fontFamily: "var(--font-sans)" }}>
                    Nenhum usuário encontrado
                  </h2>
                  <p className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm" style={{ fontFamily: "var(--font-sans)" }}>
                    Não encontramos membros com &quot;{query.trim()}&quot;. Tente outro username ou nome.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {userResults.map((person) => {
                    const avatarLetter = (
                      person.displayName ||
                      person.nick ||
                      "U"
                    )
                      .charAt(0)
                      .toUpperCase();

                    return (
                      <Link
                        key={person.userId}
                        to="/profile/$nick"
                        params={{ nick: person.nick }}
                        onClick={handleClose}
                        className="sr-item group"
                      >
                        <SearchAvatar
                          src={person.avatarUrl}
                          letter={avatarLetter}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="sr-title">
                            {person.displayName || person.nick}
                          </p>

                          <p
                            className="truncate text-[13px] max-[560px]:text-[12px] mt-0.5"
                            style={{ color: "var(--text-3)" }}
                          >
                            @{person.nick}
                          </p>
                        </div>

                        <div>
                          <span className="sr-type person">PESSOA</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              3. RESULTADOS DE PEOPLE
          ========================================================== */}
          {category === "people" && hasQuery && (
            <div>
              {peopleLoading && peopleResults.length === 0 ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="sr-item skeleton">
                      <div className="sr-poster" />
                      <div className="min-w-0 space-y-2 py-1">
                        <p className="sr-title" />
                        <div className="sr-sub" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : peopleLoading && peopleResults.length > 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="sr-spinner" />
                </div>
              ) : peopleResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-[var(--line)] text-[var(--text-4)] mb-3">
                    <SearchIcon className="size-6" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-[var(--text-1)]" style={{ fontFamily: "var(--font-sans)" }}>
                    Nenhum profissional encontrado
                  </h2>
                  <p className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm" style={{ fontFamily: "var(--font-sans)" }}>
                    Não encontramos profissionais para &quot;{query.trim()}&quot;.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {peopleResults.map((person) => {
                    const imageSrc = person.image?.large || person.image?.medium || "";
                    const animeId = person.anime?.id;
                    const roleText = person.role || person.primaryOccupations?.[0] || "Staff";

                    const itemContent = (
                      <>
                        <SearchPoster src={imageSrc} alt="" />

                        <div className="min-w-0 flex-1">
                          <p className="sr-title">
                            {person.name.full}
                          </p>

                          <p className="sr-sub truncate">
                            {roleText}
                            {person.anime?.title ? ` · ${person.anime.title}` : ""}
                          </p>

                          <div>
                            <span className="sr-type person">STAFF</span>
                          </div>
                        </div>
                      </>
                    );

                    return animeId ? (
                      <Link
                        key={person.id}
                        to="/anime/$id"
                        params={{ id: String(animeId) }}
                        onClick={handleClose}
                        className="sr-item group"
                      >
                        {itemContent}
                      </Link>
                    ) : (
                      <div key={person.id} className="sr-item group">
                        {itemContent}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              4. RESULTADOS DE PERSONAGENS
          ========================================================== */}
          {category === "characters" && hasQuery && (
            <div>
              {characterLoading && characterResults.length === 0 ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="sr-item skeleton">
                      <div className="sr-poster" />
                      <div className="min-w-0 space-y-2 py-1">
                        <p className="sr-title" />
                        <div className="sr-sub" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : characterLoading && characterResults.length > 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="sr-spinner" />
                </div>
              ) : characterResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-[var(--line)] text-[var(--text-4)] mb-3">
                    <SearchIcon className="size-6" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-[var(--text-1)]" style={{ fontFamily: "var(--font-sans)" }}>
                    Nenhum personagem encontrado
                  </h2>
                  <p className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm" style={{ fontFamily: "var(--font-sans)" }}>
                    Não encontramos personagens para &quot;{query.trim()}&quot;.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {characterResults.map((character) => {
                    const imageSrc = character.image?.large || character.image?.medium || "";
                    const animeId = character.anime?.id;

                    const itemContent = (
                      <>
                        <SearchPoster src={imageSrc} alt="" />

                        <div className="min-w-0 flex-1">
                          <p className="sr-title">
                            {character.name.full}
                          </p>

                          <p className="sr-sub truncate">
                            {character.role || "Personagem"}
                            {character.anime?.title ? ` · ${character.anime.title}` : ""}
                          </p>

                          <div>
                            <span className="sr-type">PERSONAGEM</span>
                          </div>
                        </div>
                      </>
                    );

                    return animeId ? (
                      <Link
                        key={character.id}
                        to="/anime/$id"
                        params={{ id: String(animeId) }}
                        onClick={handleClose}
                        className="sr-item group"
                      >
                        {itemContent}
                      </Link>
                    ) : (
                      <div key={character.id} className="sr-item group">
                        {itemContent}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sentinel de scroll infinito */}
          {hasQuery && currentHasMore && (
            <div
              ref={sentinelRef}
              className="py-3 flex items-center justify-center"
            >
              {isCurrentLoadingMore && (
                <div
                  className="size-4 animate-spin rounded-full border-2 border-t-transparent"
                  style={{
                    borderColor: "var(--violet-200)",
                    borderTopColor: "transparent",
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* =========================================================
            RODAPÉ DO MODAL
        ========================================================== */}
        <div
          className="flex items-center justify-between border-t px-4 py-2.5 text-[11px] shrink-0"
          style={{
            borderColor: "var(--line)",
            background: "var(--bg-2)",
          }}
        >
          <Link
            to="/search"
            search={{
              q: query.trim() || undefined,
              tab: category === "animes" ? undefined : category,
            }}
            onClick={handleClose}
            className="font-mono text-[11px] tracking-wide transition-colors hover:underline"
            style={{ color: "var(--violet-200)" }}
          >
            Ver todos os resultados →
          </Link>

          <span
            className="hidden sm:inline font-mono text-[10px] uppercase"
            style={{
              letterSpacing: ".08em",
              color: "var(--text-4)",
            }}
          >
            ESC para fechar
          </span>
        </div>
      </div>
    </div>
  );
}
