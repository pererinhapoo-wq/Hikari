import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Film,
  Search as SearchIcon,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { searchCatalog } from "@/lib/api";
import { searchUsers, type SearchUserItem } from "@/lib/profile.functions";
import {
  searchPeople,
  searchCharacters,
  type SearchPersonItem,
  type SearchCharacterItem,
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
import { cn } from "@/lib/utils";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: SearchCategory;
}

function normalizeSearchCategory(value?: string): SearchCategory {
  if (value === "users" || value === "people" || value === "characters") return value;
  return "animes";
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
          <Film className="size-[14px] opacity-75" />
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
    <div className="sr-poster text-[var(--violet-200)] flex items-center justify-center font-bold text-sm bg-[var(--bg-4)]">
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
  const navigate = useNavigate();
  const [animationState, setAnimationState] = useState<"open" | "closed">("open");
  const [isRendered, setIsRendered] = useState(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [category, setCategory] = useState<SearchCategory>(() =>
    normalizeSearchCategory(initialCategory),
  );
  const [query, setQuery] = useState("");
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);

  // Resultados de Animes
  const [animeResults, setAnimeResults] = useState<SlimAnime[]>([]);
  const [animeLoading, setAnimeLoading] = useState(false);
  const [animeLoadingMore, setAnimeLoadingMore] = useState(false);
  const [animePage, setAnimePage] = useState(1);
  const [animeHasNext, setAnimeHasNext] = useState(false);
  const [animeFetchedQuery, setAnimeFetchedQuery] = useState("");

  // Resultados de Usuários
  const [userResults, setUserResults] = useState<SearchUserItem[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userLoadingMore, setUserLoadingMore] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userHasNext, setUserHasNext] = useState(false);
  const [userFetchedQuery, setUserFetchedQuery] = useState("");

  // Resultados de People
  const [peopleResults, setPeopleResults] = useState<SearchPersonItem[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleLoadingMore, setPeopleLoadingMore] = useState(false);
  const [peoplePage, setPeoplePage] = useState(1);
  const [peopleHasNext, setPeopleHasNext] = useState(false);
  const [peopleFetchedQuery, setPeopleFetchedQuery] = useState("");

  // Resultados de Personagens
  const [characterResults, setCharacterResults] = useState<SearchCharacterItem[]>([]);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterLoadingMore, setCharacterLoadingMore] = useState(false);
  const [characterPage, setCharacterPage] = useState(1);
  const [characterHasNext, setCharacterHasNext] = useState(false);
  const [characterFetchedQuery, setCharacterFetchedQuery] = useState("");

  const debounceTimerRef = useRef<number | null>(null);
  const animeReqIdRef = useRef(0);
  const userReqIdRef = useRef(0);
  const peopleReqIdRef = useRef(0);
  const characterReqIdRef = useRef(0);

  const localAnimes = useHikariStore((s) => s.animes);

  // Gerenciamento centralizado de scroll lock com o hook robusto do Hikari
  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setAnimationState("open");

      const initialHeight = window.visualViewport?.height ?? window.innerHeight;
      setLockedHeight(initialHeight);

      const timer = window.setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 40);
      return () => window.clearTimeout(timer);
    } else {
      setAnimationState("closed");
      const timer = window.setTimeout(() => {
        setIsRendered(false);
        setLockedHeight(null);
      }, 160);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    inputRef.current?.blur();
    setAnimationState("closed");
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
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    animeReqIdRef.current += 1;
    userReqIdRef.current += 1;
    peopleReqIdRef.current += 1;
    characterReqIdRef.current += 1;
    setQuery("");
    setAnimeResults([]);
    setUserResults([]);
    setPeopleResults([]);
    setCharacterResults([]);
    setAnimeFetchedQuery("");
    setUserFetchedQuery("");
    setPeopleFetchedQuery("");
    setCharacterFetchedQuery("");
    setAnimePage(1);
    setUserPage(1);
    setPeoplePage(1);
    setCharacterPage(1);
    setAnimeHasNext(false);
    setUserHasNext(false);
    setPeopleHasNext(false);
    setCharacterHasNext(false);
    setAnimeLoading(false);
    setUserLoading(false);
    setPeopleLoading(false);
    setCharacterLoading(false);
    inputRef.current?.focus({ preventScroll: true });
  };

  // Troca de categoria (mantém categorias estritamente isoladas)
  const handleCategoryChange = (nextCategory: SearchCategory) => {
    const normalized = normalizeSearchCategory(nextCategory);
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setCategory(normalized);
    inputRef.current?.focus({ preventScroll: true });
  };

  /* =========================================================
     EXECUTORES DE BUSCA ISOLADOS POR CATEGORIA
  ========================================================== */
  const runAnimeSearch = useCallback(
    async (rawQuery: string) => {
      const trimmed = rawQuery.trim();
      const reqId = ++animeReqIdRef.current;

      if (!trimmed) {
        setAnimeResults([]);
        setAnimeFetchedQuery("");
        setAnimeLoading(false);
        setAnimeHasNext(false);
        setAnimePage(1);
        return;
      }

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

        if (reqId !== animeReqIdRef.current) return;

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

        if (reqId === animeReqIdRef.current) {
          setAnimeResults(merged);
          setAnimeFetchedQuery(trimmed);
          setAnimeHasNext(Boolean(result.hasNext));
        }
      } catch {
        if (reqId === animeReqIdRef.current) {
          setAnimeResults([]);
          setAnimeFetchedQuery(trimmed);
          setAnimeHasNext(false);
        }
      } finally {
        if (reqId === animeReqIdRef.current) {
          setAnimeLoading(false);
        }
      }
    },
    [localAnimes],
  );

  const runUserSearch = useCallback(async (rawQuery: string) => {
    let clean = rawQuery.trim();
    if (clean.startsWith("@")) {
      clean = clean.slice(1).trim();
    }

    const reqId = ++userReqIdRef.current;

    if (clean.length < 2) {
      setUserResults([]);
      setUserFetchedQuery("");
      setUserLoading(false);
      setUserHasNext(false);
      setUserPage(1);
      return;
    }

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

      if (reqId === userReqIdRef.current) {
        setUserResults(users);
        setUserFetchedQuery(clean);
        setUserHasNext(users.length >= 18);
      }
    } catch {
      if (reqId === userReqIdRef.current) {
        setUserResults([]);
        setUserFetchedQuery(clean);
        setUserHasNext(false);
      }
    } finally {
      if (reqId === userReqIdRef.current) {
        setUserLoading(false);
      }
    }
  }, []);

  const runPeopleSearch = useCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    const reqId = ++peopleReqIdRef.current;

    if (!trimmed) {
      setPeopleResults([]);
      setPeopleFetchedQuery("");
      setPeopleLoading(false);
      setPeopleHasNext(false);
      setPeoplePage(1);
      return;
    }

    setPeopleLoading(true);
    setPeoplePage(1);

    try {
      const result = await searchPeople(trimmed, 1, 18);
      if (reqId === peopleReqIdRef.current) {
        setPeopleResults(result.items);
        setPeopleFetchedQuery(trimmed);
        setPeopleHasNext(result.hasNext);
      }
    } catch {
      if (reqId === peopleReqIdRef.current) {
        setPeopleResults([]);
        setPeopleFetchedQuery(trimmed);
        setPeopleHasNext(false);
      }
    } finally {
      if (reqId === peopleReqIdRef.current) {
        setPeopleLoading(false);
      }
    }
  }, []);

  const runCharacterSearch = useCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    const reqId = ++characterReqIdRef.current;

    if (!trimmed) {
      setCharacterResults([]);
      setCharacterFetchedQuery("");
      setCharacterLoading(false);
      setCharacterHasNext(false);
      setCharacterPage(1);
      return;
    }

    setCharacterLoading(true);
    setCharacterPage(1);

    try {
      const result = await searchCharacters(trimmed, 1, 18);
      if (reqId === characterReqIdRef.current) {
        setCharacterResults(result.items);
        setCharacterFetchedQuery(trimmed);
        setCharacterHasNext(result.hasNext);
      }
    } catch {
      if (reqId === characterReqIdRef.current) {
        setCharacterResults([]);
        setCharacterFetchedQuery(trimmed);
        setCharacterHasNext(false);
      }
    } finally {
      if (reqId === characterReqIdRef.current) {
        setCharacterLoading(false);
      }
    }
  }, []);

  /* =========================================================
     DISPARO INSTANTÂNEO (DEBOUNCE AO DIGITAR)
  ========================================================== */
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const trimmed = query.trim();

    if (!trimmed) {
      if (category === "animes") {
        animeReqIdRef.current += 1;
        setAnimeResults([]);
        setAnimeFetchedQuery("");
        setAnimeLoading(false);
        setAnimeHasNext(false);
        setAnimePage(1);
      } else if (category === "users") {
        userReqIdRef.current += 1;
        setUserResults([]);
        setUserFetchedQuery("");
        setUserLoading(false);
        setUserHasNext(false);
        setUserPage(1);
      } else if (category === "people") {
        peopleReqIdRef.current += 1;
        setPeopleResults([]);
        setPeopleFetchedQuery("");
        setPeopleLoading(false);
        setPeopleHasNext(false);
        setPeoplePage(1);
      } else {
        characterReqIdRef.current += 1;
        setCharacterResults([]);
        setCharacterFetchedQuery("");
        setCharacterLoading(false);
        setCharacterHasNext(false);
        setCharacterPage(1);
      }
      return;
    }

    if (category === "users") {
      const clean = trimmed.replace(/^@/, "").trim();
      if (clean.length < 2) {
        userReqIdRef.current += 1;
        setUserResults([]);
        setUserFetchedQuery("");
        setUserLoading(false);
        setUserHasNext(false);
        setUserPage(1);
        return;
      }
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      if (category === "animes") {
        void runAnimeSearch(query);
      } else if (category === "users") {
        void runUserSearch(query);
      } else if (category === "people") {
        void runPeopleSearch(query);
      } else {
        void runCharacterSearch(query);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [isOpen, category, query, runAnimeSearch, runUserSearch, runPeopleSearch, runCharacterSearch]);

  /* =========================================================
     ENVIO POR TECLADO (ENTER / IR) — SEM NAVEGAR E SEM FLASH
  ========================================================== */
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (typeof window !== "undefined" && window.innerWidth <= 640) {
      inputRef.current?.blur();
    }

    const trimmed = query.trim();
    if (!trimmed) return;

    handleClose();
    void navigate({
      to: "/search",
      search: {
        q: trimmed,
        ...(category !== "animes" ? { tab: category } : {}),
        ...(isAdultArea ? { adult: true } : {}),
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.keyCode === 13) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      } else {
        handleFormSubmit({
          preventDefault: () => {},
          currentTarget: { form: null },
        } as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  /* =========================================================
     PAGINAÇÃO (SCROLL INFINITO)
  ========================================================== */
  const loadMoreAnimes = useCallback(async () => {
    if (animeLoading || animeLoadingMore || !animeHasNext) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    const reqId = animeReqIdRef.current;
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

      if (reqId !== animeReqIdRef.current) return;

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
      setAnimeHasNext(Boolean(result.hasNext));
    } catch {
      if (reqId === animeReqIdRef.current) {
        setAnimeHasNext(false);
      }
    } finally {
      if (reqId === animeReqIdRef.current) {
        setAnimeLoadingMore(false);
      }
    }
  }, [animeLoading, animeLoadingMore, animeHasNext, query, animePage, localAnimes]);

  const loadMoreUsers = useCallback(async () => {
    if (userLoading || userLoadingMore || !userHasNext) return;
    let clean = query.trim();
    if (clean.startsWith("@")) clean = clean.slice(1).trim();
    if (clean.length < 2) return;

    const reqId = userReqIdRef.current;
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

      if (reqId !== userReqIdRef.current) return;

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
      if (reqId === userReqIdRef.current) {
        setUserHasNext(false);
      }
    } finally {
      if (reqId === userReqIdRef.current) {
        setUserLoadingMore(false);
      }
    }
  }, [userLoading, userLoadingMore, userHasNext, query, userPage]);

  const loadMorePeople = useCallback(async () => {
    if (peopleLoading || peopleLoadingMore || !peopleHasNext) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    const reqId = peopleReqIdRef.current;
    setPeopleLoadingMore(true);
    const nextPage = peoplePage + 1;

    try {
      const result = await searchPeople(trimmed, nextPage, 18);
      if (reqId !== peopleReqIdRef.current) return;

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
      if (reqId === peopleReqIdRef.current) {
        setPeopleHasNext(false);
      }
    } finally {
      if (reqId === peopleReqIdRef.current) {
        setPeopleLoadingMore(false);
      }
    }
  }, [peopleLoading, peopleLoadingMore, peopleHasNext, query, peoplePage]);

  const loadMoreCharacters = useCallback(async () => {
    if (characterLoading || characterLoadingMore || !characterHasNext) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    const reqId = characterReqIdRef.current;
    setCharacterLoadingMore(true);
    const nextPage = characterPage + 1;

    try {
      const result = await searchCharacters(trimmed, nextPage, 18);
      if (reqId !== characterReqIdRef.current) return;

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
      if (reqId === characterReqIdRef.current) {
        setCharacterHasNext(false);
      }
    } finally {
      if (reqId === characterReqIdRef.current) {
        setCharacterLoadingMore(false);
      }
    }
  }, [characterLoading, characterLoadingMore, characterHasNext, query, characterPage]);

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
          } else if (category === "people" && peopleHasNext && !peopleLoading && !peopleLoadingMore) {
            void loadMorePeople();
          } else if (category === "characters" && characterHasNext && !characterLoading && !characterLoadingMore) {
            void loadMoreCharacters();
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
    peopleHasNext,
    peopleLoading,
    peopleLoadingMore,
    loadMorePeople,
    characterHasNext,
    characterLoading,
    characterLoadingMore,
    loadMoreCharacters,
  ]);

  if (!isRendered) return null;

  const trimmedQuery = query.trim();
  const userQueryClean = trimmedQuery.replace(/^@/, "").trim();
  const isAdultArea =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/adult");

  const isCurrentLoading =
    category === "animes"
      ? animeLoading
      : category === "users"
        ? userLoading
        : category === "people"
          ? peopleLoading
          : characterLoading;

  const isCurrentLoadingMore =
    category === "animes"
      ? animeLoadingMore
      : category === "users"
        ? userLoadingMore
        : category === "people"
          ? peopleLoadingMore
          : characterLoadingMore;

  const currentCount =
    category === "animes"
      ? animeResults.length
      : category === "users"
        ? userResults.length
        : category === "people"
          ? peopleResults.length
          : characterResults.length;

  const currentHasMore =
    category === "animes"
      ? animeHasNext
      : category === "users"
        ? userHasNext
        : category === "people"
          ? peopleHasNext
          : characterHasNext;

  const _placeholderText =
    category === "animes"
      ? "Buscar no Hikari..."
      : category === "users"
        ? "Buscar usuários por @username..."
        : category === "people"
          ? "Buscar profissionais (People)..."
          : "Buscar personagens de animes...";

  const hasQuery = trimmedQuery.length > 0;
  const isWaitingFirstAnimeFetch =
    category === "animes" &&
    hasQuery &&
    animeResults.length === 0 &&
    animeFetchedQuery !== trimmedQuery;
  const isWaitingFirstUserFetch =
    category === "users" &&
    userQueryClean.length >= 2 &&
    userResults.length === 0 &&
    userFetchedQuery !== userQueryClean;
  const isWaitingFirstPeopleFetch =
    category === "people" &&
    hasQuery &&
    peopleResults.length === 0 &&
    peopleFetchedQuery !== trimmedQuery;
  const isWaitingFirstCharacterFetch =
    category === "characters" &&
    hasQuery &&
    characterResults.length === 0 &&
    characterFetchedQuery !== trimmedQuery;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Caixa de busca do Hikari"
      data-state={animationState}
      className="sr-overlay"
      style={
        lockedHeight && typeof window !== "undefined" && window.innerWidth <= 560
          ? { height: `${lockedHeight}px`, maxHeight: `${lockedHeight}px` }
          : undefined
      }
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
            BARRA DE BUSCA SUPERIOR (FORMULÁRIO NATIVO ENTER / IR)
        ========================================================== */}
        <form
          onSubmit={handleFormSubmit}
          className="relative border-b shrink-0 flex items-center [&>*+*]:ml-[12px]"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 16px",
            flexShrink: 0,
            borderColor: "var(--line)",
          }}
        >
          <SearchIcon
            style={{
              width: "20px",
              height: "20px",
              color: "var(--text-3)",
              strokeWidth: 1.5,
              flexShrink: 0,
            }}
            aria-hidden="true"
          />

          <input
            ref={inputRef}
            type="search"
            enterKeyHint="go"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder=""
            className="flex-1 min-w-0 bg-transparent border-0 outline-none shadow-none focus:outline-[2px] focus:outline-[var(--violet-400)] focus:outline-offset-[-2px] placeholder:text-[var(--text-4)] placeholder:font-normal [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: 0,
              outline: 0,
              color: "#fff",
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: "17px",
              letterSpacing: "-0.005em",
              padding: "4px 0",
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
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                border: 0,
                background: "rgba(255,255,255,.06)",
                color: "var(--text-3)",
                flexShrink: 0,
              }}
              className="flex items-center justify-center hover:bg-white/12 hover:text-[#fff] transition-colors cursor-pointer"
              aria-label="Limpar pesquisa"
              title="Limpar pesquisa"
            >
              <X className="size-3.5" />
            </button>
          )}

          <SearchCategorySelector
            category={category}
            onChange={handleCategoryChange}
          />

          {/* Chip ESC */}
          <button
            type="button"
            onClick={handleClose}
            className="hidden min-[561px]:inline-flex items-center justify-center transition-colors cursor-pointer"
            style={{
              fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "10px",
              letterSpacing: ".08em",
              color: "var(--text-4)",
              border: "1px solid var(--line-2)",
              borderRadius: "4px",
              padding: "3px 7px",
              lineHeight: 1,
              flexShrink: 0,
            }}
            title="ESC para fechar"
          >
            ESC
          </button>
        </form>

        {/* =========================================================
            HEADER DE RÓTULO E CONTAGEM (Apenas com consulta)
        ========================================================== */}
        {hasQuery && (
          <div className="sr-section-label">
            <div className="flex items-center justify-between">
              <span>
                {category === "animes"
                  ? "ANIMES"
                  : category === "users"
                    ? "USUÁRIOS"
                    : category === "people"
                      ? "PEOPLE"
                      : "PERSONAGENS"}
              </span>
              <span style={{ color: "var(--violet-200)" }}>
                {isCurrentLoading
                  ? currentCount > 0
                    ? `${currentCount} ${currentCount === 1 ? "resultado" : "resultados"} · atualizando`
                    : "..."
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
          className="flex-1 overflow-y-auto overscroll-contain px-2 py-1 space-y-0.5"
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
                    : category === "people"
                      ? "Pesquise dubladores, diretores e profissionais de produção."
                      : "Pesquise personagens por nome original ou em inglês."}
              </p>
            </div>
          )}

          {/* =========================================================
              1. RESULTADOS DE ANIMES (Estritamente isolado)
          ========================================================== */}
          {category === "animes" && hasQuery && (
            <div>
              {(animeLoading || isWaitingFirstAnimeFetch) && animeResults.length === 0 ? (
                <div className="space-y-1 p-0.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="sr-item skeleton">
                      <div className="sr-poster" />
                      <div className="min-w-0 space-y-2 py-1">
                        <p className="sr-title" />
                        <div className="sr-sub" />
                      </div>
                    </div>
                  ))}
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
                    Não encontramos resultados para &quot;{trimmedQuery}&quot;. Tente outro título.
                  </p>
                </div>
              ) : (
                <div className={cn("space-y-0.5 transition-opacity duration-150", animeLoading && "opacity-75")}>
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
                          alt={title}
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
              2. RESULTADOS DE USUÁRIOS (Estritamente isolado -> /profile/$nick)
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
              ) : (userLoading || isWaitingFirstUserFetch) && userResults.length === 0 ? (
                <div className="space-y-1 p-0.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="sr-item skeleton">
                      <div className="sr-poster" />
                      <div className="min-w-0 space-y-2 py-1">
                        <p className="sr-title" />
                        <div className="sr-sub" />
                      </div>
                    </div>
                  ))}
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
                    Não encontramos membros com &quot;{trimmedQuery}&quot;. Tente outro username ou nome.
                  </p>
                </div>
              ) : (
                <div className={cn("space-y-0.5 transition-opacity duration-150", userLoading && "opacity-75")}>
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
                          <span className="sr-type person">USUÁRIO</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              3. RESULTADOS DE PEOPLE (Estritamente isolado)
          ========================================================== */}
          {category === "people" && hasQuery && (
            <div>
              {(peopleLoading || isWaitingFirstPeopleFetch) && peopleResults.length === 0 ? (
                <div className="space-y-1 p-0.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="sr-item skeleton">
                      <div className="sr-poster" />
                      <div className="min-w-0 space-y-2 py-1">
                        <p className="sr-title" />
                        <div className="sr-sub" />
                      </div>
                    </div>
                  ))}
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
                    Não encontramos profissionais para &quot;{trimmedQuery}&quot;.
                  </p>
                </div>
              ) : (
                <div className={cn("space-y-0.5 transition-opacity duration-150", peopleLoading && "opacity-75")}>
                  {peopleResults.map((person) => {
                    const imageSrc = person.image?.large || person.image?.medium || "";
                    const animeId = person.anime?.id;
                    const roleText = person.role || person.primaryOccupations?.[0] || "Staff";

                    const itemContent = (
                      <>
                        <SearchPoster src={imageSrc} alt={person.name.full} />

                        <div className="min-w-0 flex-1">
                          <p className="sr-title">
                            {person.name.full}
                          </p>

                          <p className="sr-sub truncate">
                            {roleText}
                            {person.anime?.title ? ` · ${person.anime.title}` : ""}
                          </p>

                          <div>
                            <span className="sr-type person">PEOPLE</span>
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
              4. RESULTADOS DE PERSONAGENS (Estritamente isolado)
          ========================================================== */}
          {category === "characters" && hasQuery && (
            <div>
              {(characterLoading || isWaitingFirstCharacterFetch) && characterResults.length === 0 ? (
                <div className="space-y-1 p-0.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="sr-item skeleton">
                      <div className="sr-poster" />
                      <div className="min-w-0 space-y-2 py-1">
                        <p className="sr-title" />
                        <div className="sr-sub" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : characterResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-[var(--line)] text-[var(--text-4)] mb-3">
                    <Sparkles className="size-6" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-[var(--text-1)]" style={{ fontFamily: "var(--font-sans)" }}>
                    Nenhum personagem encontrado
                  </h2>
                  <p className="mt-1 text-[13px] text-[var(--text-3)] max-w-sm" style={{ fontFamily: "var(--font-sans)" }}>
                    Não encontramos personagens para &quot;{trimmedQuery}&quot;.
                  </p>
                </div>
              ) : (
                <div className={cn("space-y-0.5 transition-opacity duration-150", characterLoading && "opacity-75")}>
                  {characterResults.map((character) => {
                    const imageSrc = character.image?.large || character.image?.medium || "";
                    const animeId = character.anime?.id;
                    const roleText = character.role || (character.name?.native ? character.name.native : "Personagem");

                    const itemContent = (
                      <>
                        <SearchPoster src={imageSrc} alt={character.name.full} />

                        <div className="min-w-0 flex-1">
                          <p className="sr-title">
                            {character.name.full}
                          </p>

                          <p className="sr-sub truncate">
                            {roleText}
                            {character.anime?.title ? ` · ${character.anime.title}` : ""}
                          </p>

                          <div>
                            <span className="sr-type person">PERSONAGEM</span>
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
      </div>
    </div>
  );
}
