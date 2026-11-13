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
import { useScrollLock } from "@/lib/scroll-lock";

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
 * Pôster vertical com proporção 2:3, fade-in e fallback de 18px
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
    <div
      className="sr-poster shrink-0 w-[5.8rem] h-[8.7rem] max-[560px]:w-[6.0rem] max-[560px]:h-[9.0rem] overflow-hidden bg-[var(--bg-4)]"
      style={{ borderRadius: "var(--r-sm)" }}
    >
      {status === "error" || !src ? (
        <div className="flex size-full items-center justify-center bg-[var(--bg-4)] text-[var(--text-4)]">
          <Film className="size-[18px] opacity-75" />
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
    <div
      className="relative shrink-0 overflow-hidden w-[5.8rem] h-[8.7rem] max-[560px]:w-[6.0rem] max-[560px]:h-[9.0rem] bg-[var(--bg-4)] text-[var(--violet-200)] flex items-center justify-center font-bold text-lg"
      style={{ borderRadius: "var(--r-sm)" }}
    >
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
  useScrollLock(isOpen);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const savedScrollYRef = useRef<number>(0);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

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
     PROTEÇÃO DO SCROLL E FOCO DA PÁGINA
  ========================================================== */
  useEffect(() => {
    if (!isOpen) return;

    const currentScrollY =
      window.scrollY || document.documentElement.scrollTop || 0;
    savedScrollYRef.current = currentScrollY;
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 40);

    return () => {
      window.clearTimeout(timer);
      const targetScroll = savedScrollYRef.current;

      window.scrollTo({
        top: targetScroll,
        behavior: "instant" as ScrollBehavior,
      });

      requestAnimationFrame(() => {
        window.scrollTo({
          top: targetScroll,
          behavior: "instant" as ScrollBehavior,
        });
      });

      try {
        previousActiveElementRef.current?.focus({ preventScroll: true });
      } catch {
        // no-op
      }
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    inputRef.current?.blur();
    onClose();
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

  if (!isOpen) return null;

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

  const categoryName =
    category === "animes"
      ? "ANIMES"
      : category === "users"
        ? "USUÁRIOS"
        : category === "characters"
          ? "PERSONAGENS"
          : "PEOPLE";

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
      className="fixed inset-0 z-50 flex justify-center sr-overlay pt-[10vh] sm:pt-[12vh] px-3 sm:px-4 pb-4"
      style={{ background: "rgba(4,2,9,.86)" }}
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 cursor-pointer"
        aria-hidden="true"
      />

      {/* Janela modal centralizada com altura máxima estável */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex w-full max-w-[56rem] max-h-[78dvh] sm:max-h-[72vh] flex-col overflow-hidden sr-modal-window"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* =========================================================
            BARRA DE BUSCA SUPERIOR (Permanente em ambos os estados)
        ========================================================== */}
        <div
          className="relative border-b shrink-0"
          style={{
            borderColor: "var(--line)",
            padding: "1.2rem 1.6rem",
          }}
        >
          {/* Layout da barra */}
          <div className="flex items-center gap-3 w-full">
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
              className="h-full flex-1 bg-transparent outline-none placeholder:text-[var(--text-4)] placeholder:font-normal"
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: "16px",
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
          </div>
        </div>

        {/* =========================================================
            HEADER DE RÓTULO E CONTAGEM (Apenas com consulta)
        ========================================================== */}
        {hasQuery && (
          <div
            className="flex items-center justify-between border-b px-4 py-2 font-mono text-[10px] uppercase shrink-0"
            style={{
              borderColor: "var(--line)",
              letterSpacing: ".16em",
              color: "var(--text-4)",
              background: "rgba(255,255,255,0.01)",
            }}
          >
            <span>{categoryName}</span>

            <span
              className="font-mono text-[10px] uppercase font-semibold"
              style={{ color: "var(--violet-200)", letterSpacing: ".1em" }}
            >
              {isCurrentLoading
                ? "..."
                : `${currentCount} ${currentCount === 1 ? "resultado" : "resultados"}`}
            </span>
          </div>
        )}

        {/* =========================================================
            ÁREA DE CONTEÚDO (Scroll Container)
        ========================================================== */}
        <div
          ref={scrollContainerRef}
          data-search-scroll-container
          className="flex-1 overflow-y-auto overscroll-contain p-2 min-[561px]:p-3 space-y-1"
        >
          {/* =========================================================
              ESTADO VAZIO (Primeira referência visual)
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
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Find something to watch
              </h2>
              <p
                className="mt-1.5 text-[13px] sm:text-[14px] text-[var(--text-3)] max-w-sm leading-relaxed"
                style={{ fontFamily: "'Manrope', sans-serif" }}
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
              {animeLoading ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[var(--r-md)] border border-white/5 bg-white/[0.02]"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "3.6rem 1fr",
                        gap: "1.2rem",
                        alignItems: "center",
                        padding: "0.8rem 1rem",
                      }}
                    >
                      <div
                        className="w-[3.6rem] h-[5.4rem] shrink-0 bg-[var(--bg-4)] animate-pulse"
                        style={{ borderRadius: "var(--r-sm)" }}
                      />
                      <div className="min-w-0 space-y-2 py-1">
                        <div className="h-4 w-44 rounded bg-white/5 animate-pulse" />
                        <div className="h-3 w-28 rounded bg-white/5 animate-pulse" />
                        <div className="h-3 w-36 rounded bg-white/5 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : animeResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-[var(--line)] text-[var(--text-4)] mb-3">
                    <Film className="size-6" />
                  </div>
                  <h2
                    className="text-[16px] font-semibold text-[var(--text-1)]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Nenhum anime encontrado
                  </h2>
                  <p
                    className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
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
                        className="sr-item group block select-none transition-colors"
                        style={{
                          borderRadius: "var(--r-md)",
                          display: "grid",
                          gridTemplateColumns: "3.6rem 1fr",
                          gap: "1.2rem",
                          alignItems: "center",
                          padding: "0.8rem 1rem",
                        }}
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

                          <div className="sr-sub mt-1">
                            {scoreFormatted && (
                              <span className="inline-flex items-center gap-1 font-bold text-[#f5c518]">
                                <Star className="size-[13px] fill-[#f5c518] text-[#f5c518]" />
                                {scoreFormatted}
                              </span>
                            )}

                            {scoreFormatted && anime.year && (
                              <span style={{ color: "var(--text-4)" }}>·</span>
                            )}

                            {anime.year && (
                              <span>{anime.year}</span>
                            )}

                            {anime.genres && anime.genres.length > 0 && (
                              <>
                                <span style={{ color: "var(--text-4)" }}>·</span>
                                <span className="truncate max-w-[140px] sm:max-w-xs">
                                  {anime.genres.slice(0, 2).join(", ")}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            {anime.format === "TV" ? (
                              <span
                                className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-[var(--r-sm)] font-semibold"
                                style={{
                                  letterSpacing: ".1em",
                                  background: "rgba(168,85,247,.14)",
                                  color: "var(--violet-200)",
                                  border: "1px solid rgba(168,85,247,.3)",
                                }}
                              >
                                TV
                              </span>
                            ) : anime.format ? (
                              <span
                                className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-[var(--r-sm)] font-semibold"
                                style={{
                                  letterSpacing: ".1em",
                                  background: "rgba(255,255,255,0.06)",
                                  color: "var(--text-2)",
                                  border: "1px solid var(--line)",
                                }}
                              >
                                {anime.format === "MOVIE" ? "Filme" : anime.format}
                              </span>
                            ) : null}

                            {anime.episodes && (
                              <span
                                className="font-mono text-[9px] uppercase"
                                style={{
                                  letterSpacing: ".08em",
                                  color: "var(--text-4)",
                                }}
                              >
                                {anime.episodes} EPS
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="hidden sm:block" />
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
                  <h2
                    className="text-[16px] font-semibold text-[var(--text-1)]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Digite pelo menos 2 caracteres
                  </h2>
                  <p
                    className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Pesquise por @username ou nome de exibição para encontrar membros.
                  </p>
                </div>
              ) : userLoading ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[var(--r-md)] border border-white/5 bg-white/[0.02]"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "5.8rem 1fr auto",
                        gap: "1.4rem",
                        alignItems: "center",
                        padding: "1rem 1.1rem",
                      }}
                    >
                      <div
                        className="w-[5.8rem] h-[8.7rem] max-[560px]:w-[6.0rem] max-[560px]:h-[9.0rem] shrink-0 bg-[var(--bg-4)] animate-pulse"
                        style={{ borderRadius: "var(--r-sm)" }}
                      />
                      <div className="min-w-0 space-y-2 py-1">
                        <div className="h-4 w-36 rounded bg-white/5 animate-pulse" />
                        <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : userResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-[var(--line)] text-[var(--text-4)] mb-3">
                    <SearchIcon className="size-6" />
                  </div>
                  <h2
                    className="text-[16px] font-semibold text-[var(--text-1)]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Nenhum usuário encontrado
                  </h2>
                  <p
                    className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
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
                        className="sr-item group block select-none transition-colors"
                        style={{
                          borderRadius: "var(--r-md)",
                          display: "grid",
                          gridTemplateColumns: "5.8rem 1fr auto",
                          gap: "1.4rem",
                          alignItems: "center",
                          padding: "1rem 1.1rem",
                        }}
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

                        <div className="shrink-0 flex items-center">
                          <span
                            className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-[var(--r-sm)] font-semibold"
                            style={{
                              letterSpacing: ".1em",
                              background: "rgba(217,70,239,.13)",
                              color: "#f0abfc",
                              border: "1px solid rgba(217,70,239,.3)",
                            }}
                          >
                            PESSOA
                          </span>
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
              {peopleLoading ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[var(--r-md)] border border-white/5 bg-white/[0.02]"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "5.8rem 1fr auto",
                        gap: "1.4rem",
                        alignItems: "start",
                        padding: "1rem 1.1rem",
                      }}
                    >
                      <div
                        className="w-[5.8rem] h-[8.7rem] max-[560px]:w-[6.0rem] max-[560px]:h-[9.0rem] shrink-0 bg-[var(--bg-4)] animate-pulse"
                        style={{ borderRadius: "var(--r-sm)" }}
                      />
                      <div className="min-w-0 space-y-2 py-1">
                        <div className="h-4 w-40 rounded bg-white/5 animate-pulse" />
                        <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : peopleResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-[var(--line)] text-[var(--text-4)] mb-3">
                    <SearchIcon className="size-6" />
                  </div>
                  <h2
                    className="text-[16px] font-semibold text-[var(--text-1)]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Nenhum profissional encontrado
                  </h2>
                  <p
                    className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
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

                          <p className="sr-sub mt-1 truncate">
                            {roleText}
                            {person.anime?.title ? ` · ${person.anime.title}` : ""}
                          </p>

                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span
                              className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-[var(--r-sm)] font-semibold"
                              style={{
                                letterSpacing: ".1em",
                                background: "rgba(244,63,94,.14)",
                                color: "#fda4af",
                                border: "1px solid rgba(244,63,94,.3)",
                              }}
                            >
                              STAFF
                            </span>
                          </div>
                        </div>

                        <div className="hidden sm:block" />
                      </>
                    );

                    return animeId ? (
                      <Link
                        key={person.id}
                        to="/anime/$id"
                        params={{ id: String(animeId) }}
                        onClick={handleClose}
                        className="sr-item group block select-none transition-colors"
                        style={{
                          borderRadius: "var(--r-md)",
                          display: "grid",
                          gridTemplateColumns: "5.8rem 1fr auto",
                          gap: "1.4rem",
                          alignItems: "start",
                          padding: "1rem 1.1rem",
                        }}
                      >
                        {itemContent}
                      </Link>
                    ) : (
                      <div
                        key={person.id}
                        className="sr-item group block select-none"
                        style={{
                          borderRadius: "var(--r-md)",
                          display: "grid",
                          gridTemplateColumns: "5.8rem 1fr auto",
                          gap: "1.4rem",
                          alignItems: "start",
                          padding: "1rem 1.1rem",
                        }}
                      >
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
              {characterLoading ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[var(--r-md)] border border-white/5 bg-white/[0.02]"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "5.8rem 1fr auto",
                        gap: "1.4rem",
                        alignItems: "start",
                        padding: "1rem 1.1rem",
                      }}
                    >
                      <div
                        className="w-[5.8rem] h-[8.7rem] max-[560px]:w-[6.0rem] max-[560px]:h-[9.0rem] shrink-0 bg-[var(--bg-4)] animate-pulse"
                        style={{ borderRadius: "var(--r-sm)" }}
                      />
                      <div className="min-w-0 space-y-2 py-1">
                        <div className="h-4 w-40 rounded bg-white/5 animate-pulse" />
                        <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : characterResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-[var(--line)] text-[var(--text-4)] mb-3">
                    <SearchIcon className="size-6" />
                  </div>
                  <h2
                    className="text-[16px] font-semibold text-[var(--text-1)]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Nenhum personagem encontrado
                  </h2>
                  <p
                    className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
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

                          <p className="sr-sub mt-1 truncate">
                            {character.role || "Personagem"}
                            {character.anime?.title ? ` · ${character.anime.title}` : ""}
                          </p>

                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span
                              className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-[var(--r-sm)] font-semibold"
                              style={{
                                letterSpacing: ".1em",
                                background: "rgba(59,130,246,.14)",
                                color: "#93c5fd",
                                border: "1px solid rgba(59,130,246,.3)",
                              }}
                            >
                              PERSONAGEM
                            </span>
                          </div>
                        </div>

                        <div className="hidden sm:block" />
                      </>
                    );

                    return animeId ? (
                      <Link
                        key={character.id}
                        to="/anime/$id"
                        params={{ id: String(animeId) }}
                        onClick={handleClose}
                        className="sr-item group block select-none transition-colors"
                        style={{
                          borderRadius: "var(--r-md)",
                          display: "grid",
                          gridTemplateColumns: "5.8rem 1fr auto",
                          gap: "1.4rem",
                          alignItems: "start",
                          padding: "1rem 1.1rem",
                        }}
                      >
                        {itemContent}
                      </Link>
                    ) : (
                      <div
                        key={character.id}
                        className="sr-item group block select-none"
                        style={{
                          borderRadius: "var(--r-md)",
                          display: "grid",
                          gridTemplateColumns: "5.8rem 1fr auto",
                          gap: "1.4rem",
                          alignItems: "start",
                          padding: "1rem 1.1rem",
                        }}
                      >
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
