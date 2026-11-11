import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Clapperboard,
  Film,
  Lock,
  Search as SearchIcon,
  Sparkles,
  Star,
  Users,
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
 * Normaliza e formata a nota real do anime de acordo com a escala da fonte de dados:
 * - A API AniList e o catálogo base do Hikari utilizam a escala 0 a 100 (ex: 84 = 8.4)
 * - Avaliações locais ou manuais podem vir na escala 0 a 10 (ex: 8.5)
 * - Converte valores > 10 dividindo por 10 e formata com 1 casa decimal (ex: 8.4)
 */
function formatAnimeScore(score: number | null | undefined): string | null {
  if (score == null || Number.isNaN(score) || score <= 0) return null;
  const normalized = score > 10 ? score / 10 : score;
  return normalized.toFixed(1);
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
     PROTEÇÃO DA PÁGINA QUE ESTÁ ATRÁS DA BUSCA
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

  // Limpeza de texto da busca ao tocar no botão X
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
     1. BUSCA DE ANIMES (Catálogo + Infinite Scroll)
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
     2. BUSCA DE USUÁRIOS (Membros + Infinite Scroll)
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
     3. BUSCA DE PERSONAGENS (Characters + Infinite Scroll)
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
     4. BUSCA DE PEOPLE / STAFF (Profissionais + Infinite Scroll)
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
     CARREGAMENTO AUTOMÁTICO (INFINITE SCROLL VIA OBSERVER)
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

  const categoryLabel =
    category === "animes"
      ? "animes"
      : category === "users"
        ? "usuários"
        : category === "characters"
          ? "personagens"
          : "people";

  const placeholderText =
    category === "animes"
      ? "Buscar animes, filmes, títulos..."
      : category === "users"
        ? "Buscar membros por @username ou nome..."
        : category === "characters"
          ? "Buscar personagens de animes..."
          : "Buscar dubladores, diretores, equipe...";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Caixa de busca do Hikari"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6"
    >
      {/* Backdrop: Escurece suavemente o fundo */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200 cursor-pointer"
        aria-hidden="true"
      />

      {/* Janela modal: dimensões e proporções originais rigorosamente preservadas */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex w-full max-w-lg max-h-[78vh] sm:max-h-[82vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12101e]/98 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(168,85,247,0.12)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* =========================================================
            CAMPO DE PESQUISA COMPACTO
        ========================================================== */}
        <div className="relative border-b border-white/5 bg-white/[0.02] p-2 sm:p-2.5">
          <div className="relative flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-2.5 sm:px-3 h-10 sm:h-10.5 transition-colors focus-within:border-purple-400/40 focus-within:bg-[#181528]">
            <SearchIcon className="pointer-events-none size-4 shrink-0 text-zinc-400 mr-2" />

            <input
              ref={inputRef}
              type="text"
              enterKeyHint="go"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                  const clean = query.trim();
                  if (!clean) return;

                  if (category === "animes") {
                    onClose();
                    void navigate({
                      to: "/search",
                      search: { q: clean },
                    });
                  } else if (category === "users") {
                    if (userResults.length > 0) {
                      onClose();
                      void navigate({
                        to: "/profile/$nick",
                        params: { nick: userResults[0].nick },
                      });
                    } else {
                      onClose();
                      void navigate({
                        to: "/search",
                        search: { q: clean, tab: "users" },
                      });
                    }
                  } else if (category === "characters") {
                    onClose();
                    void navigate({
                      to: "/search",
                      search: { q: clean, tab: "characters" },
                    });
                  } else if (category === "people") {
                    onClose();
                    void navigate({
                      to: "/search",
                      search: { q: clean, tab: "people" },
                    });
                  }
                }
              }}
              placeholder={placeholderText}
              className="h-full w-full flex-1 bg-transparent text-xs sm:text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />

            {/* Controles da direita: [X] + [Seletor com as 4 categorias] */}
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {query.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleClear}
                  className="flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Limpar pesquisa"
                  title="Limpar pesquisa"
                >
                  <X className="size-3.5" />
                </button>
              )}

              {/* Seletor dropdown com setinha exibindo as 4 categorias (Animes, Usuários, Personagens, People) */}
              <SearchCategorySelector
                category={category}
                onChange={handleCategoryChange}
                align="right"
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* =========================================================
            HEADER DE CONTAGEM DE RESULTADOS
        ========================================================== */}
        {query.trim().length > 0 && (
          <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.015] px-3.5 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>Resultados de {categoryLabel}</span>

            <span className="text-[#c084fc] font-bold">
              {isCurrentLoading
                ? "Buscando..."
                : `${currentCount} ${currentCount === 1 ? "resultado" : "resultados"}`}
            </span>
          </div>
        )}

        {/* =========================================================
            ÁREA DE RESULTADOS COMPACTA COM CARREGAMENTO AUTOMÁTICO
        ========================================================== */}
        <div
          ref={scrollContainerRef}
          data-search-scroll-container
          className="flex-1 overflow-y-auto overscroll-contain p-1.5 sm:p-2"
        >
          {/* ESTADO INICIAL VAZIO */}
          {!query.trim() && (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-[#c084fc] ring-1 ring-purple-500/20">
                {category === "animes" ? (
                  <Film className="size-4.5" />
                ) : category === "users" ? (
                  <Users className="size-4.5" />
                ) : category === "characters" ? (
                  <Sparkles className="size-4.5" />
                ) : (
                  <Clapperboard className="size-4.5" />
                )}
              </div>
              <p className="mt-2.5 text-xs sm:text-sm font-semibold text-zinc-200">
                {category === "animes"
                  ? "Pesquise por qualquer anime do catálogo"
                  : category === "users"
                    ? "Encontre usuários e amigos na comunidade"
                    : category === "characters"
                      ? "Pesquise personagens de animes"
                      : "Pesquise dubladores e equipe de produção"}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400 max-w-xs mx-auto leading-normal">
                {category === "animes"
                  ? "Digite títulos em português, inglês ou japonês para ver notas e detalhes."
                  : category === "users"
                    ? "Digite o @username ou nome de exibição para acessar o perfil."
                    : category === "characters"
                      ? "Digite o nome do personagem em romaji ou kanji."
                      : "Digite o nome do dublador ou profissional."}
              </p>
            </div>
          )}

          {/* 1. RESULTADOS DE ANIMES — Com notas corrigidas e animação suave ao clicar */}
          {category === "animes" && query.trim().length > 0 && (
            <div>
              {animeLoading ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2 animate-pulse"
                    >
                      <div className="h-13 w-9 shrink-0 rounded-md bg-white/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-40 rounded bg-white/10" />
                        <div className="h-2.5 w-24 rounded bg-white/5" />
                        <div className="h-2.5 w-32 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : animeResults.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Clapperboard className="mx-auto size-7 text-zinc-500" />
                  <p className="mt-2 text-xs sm:text-sm font-semibold text-zinc-200">
                    Nenhum anime encontrado
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
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
                        className="
                          group
                          flex
                          items-center
                          gap-2.5
                          sm:gap-3
                          rounded-xl
                          p-1.5
                          sm:p-2
                          transition-all
                          duration-150
                          ease-out
                          hover:bg-white/[0.04]
                          active:scale-[0.98]
                          active:bg-purple-500/15
                          active:brightness-105
                          motion-reduce:transition-none
                          motion-reduce:transform-none
                          select-none
                        "
                      >
                        {/* Capa compacta */}
                        {coverAttrs ? (
                          <img
                            src={coverAttrs.src}
                            srcSet={coverAttrs.srcSet}
                            sizes="40px"
                            alt=""
                            width={40}
                            height={56}
                            loading="lazy"
                            decoding="async"
                            className="h-13 w-9 sm:h-14 sm:w-10 shrink-0 rounded-md object-cover ring-1 ring-white/10 transition-transform duration-150 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-13 w-9 sm:h-14 sm:w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-zinc-500 ring-1 ring-white/10">
                            <Clapperboard className="size-3.5" />
                          </div>
                        )}

                        {/* Metadados alinhados e elegantes */}
                        <div className="min-w-0 flex-1">
                          {/* Título */}
                          <p className="text-xs sm:text-[13px] font-semibold text-zinc-100 group-hover:text-[#c084fc] transition-colors line-clamp-1">
                            {title}
                          </p>

                          {/* Linha de info: Estrela + Nota Real Corrigida · Ano · Gêneros */}
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-zinc-400">
                            {scoreFormatted && (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                                <Star className="size-2.5 sm:size-3 fill-amber-400 text-amber-400" />
                                {scoreFormatted}
                              </span>
                            )}

                            {scoreFormatted && anime.year && (
                              <span className="text-zinc-600">·</span>
                            )}

                            {anime.year && (
                              <span className="text-zinc-400 font-medium">
                                {anime.year}
                              </span>
                            )}

                            {anime.genres && anime.genres.length > 0 && (
                              <>
                                <span className="text-zinc-600">·</span>
                                <span className="text-zinc-400 truncate max-w-[130px] sm:max-w-xs">
                                  {anime.genres.slice(0, 2).join(", ")}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Badges de formato e episódios */}
                          <div className="mt-1 flex items-center gap-1.5">
                            {anime.format && (
                              <span className="rounded bg-purple-500/15 border border-purple-500/25 px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-purple-300">
                                {anime.format === "TV"
                                  ? "Série"
                                  : anime.format === "MOVIE"
                                    ? "Filme"
                                    : anime.format}
                              </span>
                            )}

                            {anime.episodes && (
                              <span className="text-zinc-500 text-[9px]">
                                {anime.episodes} eps
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. RESULTADOS DE USUÁRIOS */}
          {category === "users" && query.trim().length > 0 && (
            <div>
              {userQueryClean.length < 2 && (
                <div className="px-4 py-8 text-center">
                  <Users className="mx-auto size-7 text-zinc-500" />
                  <p className="mt-2 text-xs sm:text-sm font-semibold text-zinc-200">
                    Digite pelo menos 2 caracteres
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400 max-w-xs mx-auto">
                    Pesquise por @username ou nome de exibição para encontrar membros.
                  </p>
                </div>
              )}

              {userQueryClean.length >= 2 && userLoading && (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2 animate-pulse"
                    >
                      <div className="size-9 shrink-0 rounded-xl bg-white/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-32 rounded bg-white/10" />
                        <div className="h-2.5 w-18 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {userQueryClean.length >= 2 &&
                !userLoading &&
                userResults.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <Users className="mx-auto size-7 text-zinc-500" />
                    <p className="mt-2 text-xs sm:text-sm font-semibold text-zinc-200">
                      Nenhum usuário encontrado
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      Não encontramos membros com &quot;{query.trim()}&quot;. Tente outro username ou nome.
                    </p>
                  </div>
                )}

              {userQueryClean.length >= 2 &&
                !userLoading &&
                userResults.length > 0 && (
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
                          className="
                            group
                            flex
                            items-center
                            justify-between
                            gap-2.5
                            rounded-xl
                            p-1.5
                            sm:p-2
                            transition-all
                            duration-150
                            ease-out
                            hover:bg-white/[0.04]
                            active:scale-[0.98]
                            active:bg-purple-500/15
                            active:brightness-105
                            motion-reduce:transition-none
                            motion-reduce:transform-none
                            select-none
                          "
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#161424] font-semibold text-xs sm:text-sm text-[#c084fc] ring-1 ring-purple-500/20 group-hover:ring-purple-500/40 transition-all">
                              {person.avatarUrl ? (
                                <img
                                  src={person.avatarUrl}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                <span>{avatarLetter}</span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="truncate text-xs sm:text-[13px] font-semibold text-zinc-100 group-hover:text-[#c084fc] transition-colors">
                                  {person.displayName || person.nick}
                                </p>

                                {person.accountType === "private" && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded bg-white/[0.06] px-1 py-0.2 text-[9px] font-medium text-zinc-400 border border-white/[0.08]"
                                    title="Conta privada"
                                  >
                                    <Lock className="size-2 text-zinc-400" />
                                    <span>Privada</span>
                                  </span>
                                )}

                                {person.isFollowing && (
                                  <span className="inline-flex items-center rounded bg-[#a855f7]/15 px-1 py-0.2 text-[9px] font-semibold text-[#c084fc] border border-purple-500/20">
                                    Seguindo
                                  </span>
                                )}

                                {person.isOwner && (
                                  <span className="inline-flex items-center rounded bg-white/10 px-1 py-0.2 text-[9px] font-semibold text-zinc-300">
                                    Você
                                  </span>
                                )}
                              </div>

                              <p className="truncate text-[10px] sm:text-[11px] text-zinc-400">
                                @{person.nick}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-lg border border-purple-500/25 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-[#c084fc] group-hover:bg-[#a855f7] group-hover:text-white transition-all">
                            Ver Perfil
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
            </div>
          )}

          {/* 3. RESULTADOS DE PERSONAGENS */}
          {category === "characters" && query.trim().length > 0 && (
            <div>
              {characterLoading ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2 animate-pulse"
                    >
                      <div className="h-13 w-9 shrink-0 rounded-md bg-white/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-40 rounded bg-white/10" />
                        <div className="h-2.5 w-24 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : characterResults.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Sparkles className="mx-auto size-7 text-zinc-500" />
                  <p className="mt-2 text-xs sm:text-sm font-semibold text-zinc-200">
                    Nenhum personagem encontrado
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Não encontramos personagens para &quot;{query.trim()}&quot;.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {characterResults.map((character) => {
                    const imageSrc =
                      character.image?.large || character.image?.medium || "";
                    const animeId = character.anime?.id;

                    const itemContent = (
                      <>
                        <div className="h-13 w-9 sm:h-14 sm:w-10 shrink-0 overflow-hidden rounded-md bg-[#161424] ring-1 ring-white/10">
                          {imageSrc ? (
                            <img
                              src={imageSrc}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover transition-transform duration-150 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-zinc-500">
                              <Sparkles className="size-4 text-amber-400" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-[13px] font-semibold text-zinc-100 group-hover:text-[#c084fc] transition-colors line-clamp-1">
                            {character.name.full}
                          </p>

                          <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-400 truncate">
                            {character.role || "Personagem"}
                            {character.anime?.title ? ` · ${character.anime.title}` : ""}
                          </p>

                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="rounded bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                              Personagem
                            </span>
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
                        className="
                          group
                          flex
                          items-center
                          gap-2.5
                          sm:gap-3
                          rounded-xl
                          p-1.5
                          sm:p-2
                          transition-all
                          duration-150
                          ease-out
                          hover:bg-white/[0.04]
                          active:scale-[0.98]
                          active:bg-purple-500/15
                          active:brightness-105
                          motion-reduce:transition-none
                          motion-reduce:transform-none
                          select-none
                        "
                      >
                        {itemContent}
                      </Link>
                    ) : (
                      <div
                        key={character.id}
                        className="group flex items-center gap-2.5 sm:gap-3 rounded-xl p-1.5 sm:p-2"
                      >
                        {itemContent}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. RESULTADOS DE PEOPLE */}
          {category === "people" && query.trim().length > 0 && (
            <div>
              {peopleLoading ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2 animate-pulse"
                    >
                      <div className="h-13 w-9 shrink-0 rounded-md bg-white/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-40 rounded bg-white/10" />
                        <div className="h-2.5 w-24 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : peopleResults.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Clapperboard className="mx-auto size-7 text-zinc-500" />
                  <p className="mt-2 text-xs sm:text-sm font-semibold text-zinc-200">
                    Nenhum profissional encontrado
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Não encontramos dubladores ou equipe para &quot;{query.trim()}&quot;.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {peopleResults.map((person) => {
                    const imageSrc =
                      person.image?.large || person.image?.medium || "";
                    const animeId = person.anime?.id;
                    const occupation =
                      person.primaryOccupations?.[0] || person.role || "Staff";

                    const itemContent = (
                      <>
                        <div className="h-13 w-9 sm:h-14 sm:w-10 shrink-0 overflow-hidden rounded-md bg-[#161424] ring-1 ring-white/10">
                          {imageSrc ? (
                            <img
                              src={imageSrc}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover transition-transform duration-150 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-zinc-500">
                              <Clapperboard className="size-4 text-rose-400" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-[13px] font-semibold text-zinc-100 group-hover:text-[#c084fc] transition-colors line-clamp-1">
                            {person.name.full}
                          </p>

                          <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-400 truncate">
                            {occupation}
                            {person.anime?.title ? ` · ${person.anime.title}` : ""}
                          </p>

                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="rounded bg-rose-500/15 border border-rose-500/25 px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-rose-300">
                              Staff
                            </span>
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
                        className="
                          group
                          flex
                          items-center
                          gap-2.5
                          sm:gap-3
                          rounded-xl
                          p-1.5
                          sm:p-2
                          transition-all
                          duration-150
                          ease-out
                          hover:bg-white/[0.04]
                          active:scale-[0.98]
                          active:bg-purple-500/15
                          active:brightness-105
                          motion-reduce:transition-none
                          motion-reduce:transform-none
                          select-none
                        "
                      >
                        {itemContent}
                      </Link>
                    ) : (
                      <div
                        key={person.id}
                        className="group flex items-center gap-2.5 sm:gap-3 rounded-xl p-1.5 sm:p-2"
                      >
                        {itemContent}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sentinel do carregamento automático (sem botão nem texto "Carregar mais") */}
          {query.trim().length > 0 && currentHasMore && (
            <div
              ref={sentinelRef}
              className="py-3 flex items-center justify-center"
            >
              {isCurrentLoadingMore && (
                <div className="size-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              )}
            </div>
          )}
        </div>

        {/* Rodapé minimalista */}
        <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.01] px-3.5 py-1.5 text-[10px] text-zinc-500">
          <span>Hikari Search</span>
          <span className="hidden sm:inline">ESC para fechar</span>
        </div>
      </div>
    </div>
  );
}
