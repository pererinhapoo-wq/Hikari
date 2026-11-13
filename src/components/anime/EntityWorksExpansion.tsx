import { Link, useNavigate } from "@tanstack/react-router";
import { memo, useEffect, useRef, useState } from "react";
import {
  getPersonWorks,
  getStudioWorks,
  type DubladorWorkItem,
  type EntityWorksData,
  type StaffWorkItem,
  type StudioWorkAnime,
} from "@/lib/entity-works";
import { ProfileAnimeImage } from "@/components/profile/ProfileAnimeImage";
import { HikariImage } from "@/components/ui/hikari-image";
import { getStudioLogo } from "@/lib/studio-logos";
import { cn } from "@/lib/utils";

export interface SelectedEntityTarget {
  type: "studio" | "dublador" | "staff" | "person";
  id?: string | number | null;
  name: string;
  image?: string | null;
  subtitle?: string | null;
}

/* =========================================================================
   1. CABEÇALHO UNIFICADO DA ENTIDADE (STUDIOS, DUBLADORES, EQUIPE TÉCNICA)
   - Imagem / logo oficial com fallback elegante
   - Nome completo da entidade (sem corte por reticências, permite quebra de linha)
   - Título menor e tipografia harmoniosa
   - Imagem e nome alinhados de maneira equilibrada
   - Espaçamento compacto que não ocupa área excessiva
========================================================================= */

interface EntityHeaderProps {
  type: "studio" | "dublador" | "staff" | "person";
  name: string;
  image?: string | null;
  count?: number;
  loading?: boolean;
  onClear?: () => void;
  clearTooltip?: string;
  subtitle?: string | null;
}

export const EntityHeader = memo(function EntityHeader({
  type,
  name,
  image,
  count,
  loading = false,
  onClear,
  clearTooltip,
  subtitle,
}: EntityHeaderProps) {
  const isStudio = type === "studio";
  const isDublador = type === "dublador";

  const categoryPrefix = isStudio
    ? "Produções"
    : isDublador
      ? "Dublagens"
      : "Trabalhos";

  // Para Studios: usar exclusivamente logo oficial de getStudioLogo (nunca capa de anime)
  const studioLogo = isStudio ? getStudioLogo(name) : null;

  return (
    <header className="relative flex items-center justify-between gap-3 sm:gap-4 border-b border-white/[0.08] pb-3.5 sm:pb-4">
      <div
        onClick={() => onClear?.()}
        className={cn(
          "flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1",
          onClear && "cursor-pointer group select-none",
        )}
        title={clearTooltip || (onClear ? "Voltar à visualização anterior" : undefined)}
      >
        {/* Imagem ou Logotipo Oficial da Entidade */}
        <div
          className={cn(
            "relative shrink-0 overflow-hidden shadow-md flex items-center justify-center transition-transform",
            onClear && "group-hover:scale-105",
            isStudio
              ? "h-11 w-16 sm:h-12 sm:w-20 md:h-13 md:w-24 rounded-xl bg-[#0c0a16] border border-indigo-500/30 p-1"
              : "size-11 sm:size-12 md:size-13 rounded-full bg-[#130f24] border border-purple-500/30",
          )}
        >
          <HikariImage
            src={isStudio ? studioLogo : image}
            alt={isStudio ? `Logo oficial de ${name}` : `Fotografia de ${name}`}
            loading="eager"
            decoding="async"
            fallbackClassName={isStudio ? "bg-[#0c0a16]" : "bg-[#130f24]"}
            className={
              isStudio
                ? "size-full object-contain"
                : "size-full object-cover object-top"
            }
          />
        </div>

        {/* Textos: Nome completo sem reticências, título proporcional e equilibrado */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-base sm:text-lg md:text-xl font-bold tracking-tight text-white leading-snug break-words">
              {categoryPrefix} — {name}
            </h1>

            {!loading && typeof count === "number" && (
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] sm:text-xs font-semibold tabular-nums text-zinc-300 border border-white/[0.08]">
                {count}
              </span>
            )}
          </div>

          {subtitle && (
            <p className="mt-0.5 text-[11px] sm:text-xs text-zinc-400 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
});

/* =========================================================================
   2. CARDS DE ANIMES EM GRADE RESPONSIVA (3 ANIMES POR LINHA NO MOBILE)
   - Mantém capas, títulos, avaliações e informações
   - Dimensões e espaçamentos calculados para mobile (gap-2) sem sobreposição
   - Escalonamento fluido em telas maiores
========================================================================= */

export const StudioAnimeCard = memo(function StudioAnimeCard({
  anime,
}: {
  anime: StudioWorkAnime;
}) {
  const metaText = [anime.format || "Anime", anime.year ? String(anime.year) : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group flex flex-col min-w-0">
      <Link
        to="/anime/$id"
        params={{ id: anime.id }}
        className="
          block
          outline-none
          focus-visible:ring-2
          focus-visible:ring-purple-400
          transition-transform
          duration-150
          ease-out
          active:scale-[0.96]
          active:brightness-110
          [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-105
          motion-reduce:transition-none
          motion-reduce:transform-none
          -webkit-tap-highlight-color-transparent
        "
      >
        <div className="
          relative
          aspect-[2/3]
          w-full
          overflow-hidden
          rounded-none
          bg-[#0d0c16]
          border
          border-white/10
          shadow-sm
          transition-colors
          duration-200
          ease-out
          [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-purple-500/50
          group-active:border-purple-400
        ">
          <ProfileAnimeImage
            src={anime.cover}
            alt={anime.title}
            loading="lazy"
            decoding="async"
            fallbackClassName="bg-[#0d0c16]"
            className="
              size-full
              object-cover
              [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03]
              group-active:scale-[1.01]
              motion-reduce:transform-none
            "
          />

          {/* Camada de sombra/glow acelerada por GPU */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-none shadow-[0_0_20px_rgba(168,85,247,0.35)] opacity-0 transition-opacity duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-active:opacity-100"
          />
        </div>

        <div className="mt-2 flex flex-col px-0.5 min-w-0">
          <h3
            className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-purple-300 group-active:text-purple-200"
            title={anime.title}
          >
            {anime.title}
          </h3>
          {metaText && (
            <p className="mt-0.5 truncate text-[10.5px] sm:text-xs text-zinc-400">
              {metaText}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
});

export const DubladorAnimeCard = memo(function DubladorAnimeCard({
  work,
}: {
  work: DubladorWorkItem;
}) {
  const isMainRole = (work.character.role || "").toUpperCase() === "MAIN";
  const roleLabel = isMainRole ? "Protagonista" : "Secundário";

  return (
    <article className="group flex flex-col min-w-0">
      <Link
        to="/anime/$id"
        params={{ id: work.anime.id }}
        className="
          block
          outline-none
          focus-visible:ring-2
          focus-visible:ring-purple-400
          transition-transform
          duration-150
          ease-out
          active:scale-[0.96]
          active:brightness-110
          [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-105
          motion-reduce:transition-none
          motion-reduce:transform-none
          -webkit-tap-highlight-color-transparent
        "
      >
        <div className="
          relative
          aspect-[2/3]
          w-full
          overflow-hidden
          rounded-none
          bg-[#0d0c16]
          border
          border-white/10
          shadow-sm
          transition-colors
          duration-200
          ease-out
          [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-purple-500/50
          group-active:border-purple-400
        ">
          <ProfileAnimeImage
            src={work.anime.cover}
            alt={work.anime.title}
            loading="lazy"
            decoding="async"
            fallbackClassName="bg-[#0d0c16]"
            className="
              size-full
              object-cover
              [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03]
              group-active:scale-[1.01]
              motion-reduce:transform-none
            "
          />

          {/* Camada de sombra/glow acelerada por GPU */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-none shadow-[0_0_20px_rgba(168,85,247,0.35)] opacity-0 transition-opacity duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-active:opacity-100"
          />
        </div>

        <div className="mt-2 flex flex-col px-0.5 min-w-0">
          <h3
            className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-purple-300 group-active:text-purple-200"
            title={work.anime.title}
          >
            {work.anime.title}
          </h3>
          <p className="mt-0.5 truncate text-[10.5px] sm:text-xs text-zinc-400">
            {work.character.name} · {roleLabel}
          </p>
        </div>
      </Link>
    </article>
  );
});

export const StaffAnimeCard = memo(function StaffAnimeCard({
  work,
}: {
  work: StaffWorkItem;
}) {
  return (
    <article className="group flex flex-col min-w-0">
      <Link
        to="/anime/$id"
        params={{ id: work.anime.id }}
        className="
          block
          outline-none
          focus-visible:ring-2
          focus-visible:ring-purple-400
          transition-transform
          duration-150
          ease-out
          active:scale-[0.96]
          active:brightness-110
          [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-105
          motion-reduce:transition-none
          motion-reduce:transform-none
          -webkit-tap-highlight-color-transparent
        "
      >
        <div className="
          relative
          aspect-[2/3]
          w-full
          overflow-hidden
          rounded-none
          bg-[#0d0c16]
          border
          border-white/10
          shadow-sm
          transition-colors
          duration-200
          ease-out
          [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-purple-500/50
          group-active:border-purple-400
        ">
          <ProfileAnimeImage
            src={work.anime.cover}
            alt={work.anime.title}
            loading="lazy"
            decoding="async"
            fallbackClassName="bg-[#0d0c16]"
            className="
              size-full
              object-cover
              [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03]
              group-active:scale-[1.01]
              motion-reduce:transform-none
            "
          />

          {/* Camada de sombra/glow acelerada por GPU */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-none shadow-[0_0_20px_rgba(168,85,247,0.35)] opacity-0 transition-opacity duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-active:opacity-100"
          />
        </div>

        <div className="mt-2 flex flex-col px-0.5 min-w-0">
          <h3
            className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-purple-300 group-active:text-purple-200"
            title={work.anime.title}
          >
            {work.anime.title}
          </h3>
          <p className="mt-0.5 truncate text-[10.5px] sm:text-xs text-zinc-400">
            {work.roleLabel}
            {work.anime.year ? ` · ${work.anime.year}` : ""}
          </p>
        </div>
      </Link>
    </article>
  );
});

function AnimeGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="aspect-[2/3] animate-pulse rounded-xl bg-white/[0.04] border border-white/[0.05]"
        />
      ))}
    </div>
  );
}

function EmptyNotice({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <p className="text-xs sm:text-sm text-zinc-400">{message}</p>
    </div>
  );
}

/* =========================================================================
   3. COMPONENTE DE EXPANSÃO LOCAL (ENTITY WORKS EXPANSION)
========================================================================= */

interface EntityWorksExpansionProps {
  entity: SelectedEntityTarget;
  onClear?: () => void;
  accentColor?: "purple" | "violet" | "indigo" | "pink" | "sky";
  className?: string;
  autoScroll?: boolean;
}

export const EntityWorksExpansion = memo(function EntityWorksExpansion({
  entity,
  onClear,
  className,
  autoScroll = true,
}: EntityWorksExpansionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<EntityWorksData | null>(null);
  const [loading, setLoading] = useState(true);

  const isStudio = entity.type === "studio";
  const isDublador = entity.type === "dublador";

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setData(null);

    const load = async () => {
      try {
        let result: EntityWorksData;
        if (entity.type === "studio") {
          result = await getStudioWorks(entity.name, entity.id);
        } else {
          const prefer = isDublador ? "dublador" : ("staff" as const);
          result = await getPersonWorks(entity.name, entity.id, prefer);
        }

        if (!isCancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("[EntityWorksExpansion] Erro ao carregar trabalhos:", err);
          setData({
            kind: entity.type === "studio" ? "studio" : "staff",
            name: entity.name,
            error: "Falha ao carregar as produções associadas.",
          });
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [entity.name, entity.id, entity.type, isDublador]);

  const isFirstMountRef = useRef(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        if (rect.top > window.innerHeight - 100 || rect.top < 60) {
          containerRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }
    }
  }, [entity.name, autoScroll]);

  const totalWorksCount = isStudio
    ? data?.studioAnimes?.length ?? 0
    : isDublador
      ? data?.dubladorWorks?.length ?? 0
      : data?.staffWorks?.length ?? 0;

  return (
    <div
      ref={containerRef}
      aria-label={`Trabalhos e Produções de ${entity.name}`}
      className={cn(
        "relative w-full space-y-4 sm:space-y-5 transition-all duration-300 animate-in fade-in",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -left-16 -top-10 size-72 rounded-full bg-violet-600/10 blur-[100px]"
        aria-hidden="true"
      />

      <EntityHeader
        type={entity.type}
        name={entity.name}
        image={data?.image || entity.image}
        count={totalWorksCount}
        loading={loading}
        onClear={onClear}
        clearTooltip="Toque no título para voltar à visualização original"
        subtitle={
          isStudio
            ? data?.subtitle || "Estúdio de animação"
            : isDublador
              ? "Dublador(a) / Ator de voz"
              : "Direção e equipe técnica"
        }
      />

      <div className="relative">
        {loading ? (
          <AnimeGridSkeleton count={6} />
        ) : isStudio ? (
          (data?.studioAnimes?.length ?? 0) === 0 ? (
            <EmptyNotice message="Nenhuma produção registrada para este estúdio no catálogo." />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
              {data!.studioAnimes!.map((anime) => (
                <StudioAnimeCard key={anime.id} anime={anime} />
              ))}
            </div>
          )
        ) : isDublador ? (
          (data?.dubladorWorks?.length ?? 0) === 0 ? (
            <EmptyNotice message="Nenhum papel de dublagem encontrado para este profissional." />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
              {data!.dubladorWorks!.map((work) => (
                <DubladorAnimeCard key={work.id} work={work} />
              ))}
            </div>
          )
        ) : (
          (data?.staffWorks?.length ?? 0) === 0 ? (
            <EmptyNotice message="Nenhum trabalho técnico encontrado para este profissional." />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
              {data!.staffWorks!.map((work) => (
                <StaffAnimeCard key={work.id} work={work} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
});

/* =========================================================================
   4. VISUALIZAÇÃO DE DUBLADORES (DUBLADOR WORKS VIEW)
========================================================================= */

export const DubladorWorksView = memo(function DubladorWorksView({
  dubladorName,
  dubladorId,
  animeId,
  onClear,
}: {
  dubladorName: string;
  dubladorId?: string | number | null;
  animeId?: string;
  onClear?: () => void;
}) {
  const navigate = useNavigate();
  const [works, setWorks] = useState<DubladorWorkItem[]>([]);
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getPersonWorks(dubladorName, dubladorId, "dublador")
      .then((res) => {
        if (!active) return;
        setWorks(res.dubladorWorks ?? []);
        setPersonImage(res.image ?? null);
      })
      .catch((err) => {
        console.warn("Erro ao buscar trabalhos de dublagem:", err);
        if (!active) return;
        setWorks([]);
        setPersonImage(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dubladorName, dubladorId]);

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    if (animeId) {
      void navigate({
        to: "/anime/$id",
        params: { id: animeId },
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev };
          delete next.dublador;
          delete next.dubladorId;
          return next;
        },
      });
    } else {
      void navigate({
        search: (prev) => {
          const next: Record<string, unknown> = { ...prev };
          delete next.dublador;
          delete next.dubladorId;
          return next as never;
        },
      });
    }
  };

  return (
    <div className="relative min-h-[80vh] w-full pb-16 pt-16 sm:pt-20 animate-in fade-in duration-300">
      <div
        className="pointer-events-none absolute -left-20 top-0 size-96 rounded-full bg-pink-600/10 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        <EntityHeader
          type="dublador"
          name={dubladorName}
          image={personImage}
          count={works.length}
          loading={loading}
          onClear={handleClear}
          clearTooltip="Voltar à visualização anterior"
          subtitle="Dublador(a) / Ator de voz"
        />

        {loading ? (
          <AnimeGridSkeleton count={9} />
        ) : works.length === 0 ? (
          <EmptyNotice message="Nenhum papel de dublagem encontrado para este profissional." />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {works.map((work) => (
              <DubladorAnimeCard key={work.id} work={work} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

/* =========================================================================
   5. VISUALIZAÇÃO DE EQUIPE TÉCNICA (STAFF WORKS VIEW)
========================================================================= */

export const StaffWorksView = memo(function StaffWorksView({
  staffName,
  staffId,
  animeId,
  onClear,
}: {
  staffName: string;
  staffId?: string | number | null;
  animeId?: string;
  onClear?: () => void;
}) {
  const navigate = useNavigate();
  const [works, setWorks] = useState<StaffWorkItem[]>([]);
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getPersonWorks(staffName, staffId, "staff")
      .then((res) => {
        if (!active) return;
        setWorks(res.staffWorks ?? []);
        setPersonImage(res.image ?? null);
      })
      .catch((err) => {
        console.warn("Erro ao buscar trabalhos técnicos:", err);
        if (!active) return;
        setWorks([]);
        setPersonImage(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [staffName, staffId]);

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    if (animeId) {
      void navigate({
        to: "/anime/$id",
        params: { id: animeId },
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev };
          delete next.staff;
          delete next.staffId;
          delete next.person;
          delete next.personId;
          return next;
        },
      });
    } else {
      void navigate({
        search: (prev) => {
          const next: Record<string, unknown> = { ...prev };
          delete next.staff;
          delete next.staffId;
          delete next.person;
          delete next.personId;
          return next as never;
        },
      });
    }
  };

  return (
    <div className="relative min-h-[80vh] w-full pb-16 pt-16 sm:pt-20 animate-in fade-in duration-300">
      <div
        className="pointer-events-none absolute -left-20 top-0 size-96 rounded-full bg-purple-600/10 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        <EntityHeader
          type="staff"
          name={staffName}
          image={personImage}
          count={works.length}
          loading={loading}
          onClear={handleClear}
          clearTooltip="Voltar à visualização anterior"
          subtitle="Direção e equipe técnica"
        />

        {loading ? (
          <AnimeGridSkeleton count={9} />
        ) : works.length === 0 ? (
          <EmptyNotice message="Nenhum trabalho técnico encontrado para este profissional." />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {works.map((work) => (
              <StaffAnimeCard key={work.id} work={work} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

/* =========================================================================
   6. VISUALIZAÇÃO DE PRODUÇÕES DE ESTÚDIO (STUDIO WORKS VIEW)
========================================================================= */

export const ProfileStudioWorksView = memo(function ProfileStudioWorksView({
  studioName,
  studioId,
  onClear,
}: {
  studioName: string;
  studioId?: string | number | null;
  onClear: () => void;
}) {
  const [works, setWorks] = useState<StudioWorkAnime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getStudioWorks(studioName, studioId)
      .then((res) => {
        if (!active) return;
        setWorks(res.studioAnimes ?? []);
      })
      .catch((err) => {
        console.warn("Erro ao buscar produções do estúdio:", err);
        if (!active) return;
        setWorks([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [studioName, studioId]);

  return (
    <div className="relative min-h-[80vh] w-full pb-16 pt-16 sm:pt-20 animate-in fade-in duration-300">
      <div
        className="pointer-events-none absolute -left-20 top-0 size-96 rounded-full bg-indigo-600/10 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        <EntityHeader
          type="studio"
          name={studioName}
          count={works.length}
          loading={loading}
          onClear={onClear}
          clearTooltip="Voltar à visualização anterior"
          subtitle="Estúdio de animação"
        />

        {loading ? (
          <AnimeGridSkeleton count={9} />
        ) : works.length === 0 ? (
          <EmptyNotice message="Nenhuma produção registrada para este estúdio no catálogo." />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {works.map((item) => (
              <StudioAnimeCard key={item.id} anime={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export const StudioProductionsView = memo(function StudioProductionsView({
  studioName,
  animeId,
  onClear,
}: {
  studioName: string;
  animeId?: string;
  onClear?: () => void;
}) {
  const navigate = useNavigate();
  const [works, setWorks] = useState<StudioWorkAnime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getStudioWorks(studioName)
      .then((res) => {
        if (!active) return;
        setWorks(res.studioAnimes ?? []);
      })
      .catch((err) => {
        console.warn("Erro ao buscar produções do estúdio:", err);
        if (!active) return;
        setWorks([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [studioName]);

  const handleClearStudio = () => {
    if (onClear) {
      onClear();
      return;
    }
    if (animeId) {
      void navigate({
        to: "/anime/$id",
        params: { id: animeId },
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev };
          delete next.studio;
          return next;
        },
      });
    } else {
      void navigate({
        search: (prev) => {
          const next: Record<string, unknown> = { ...prev };
          delete next.studio;
          return next as never;
        },
      });
    }
  };

  return (
    <div className="relative min-h-[80vh] w-full pb-16 pt-16 sm:pt-20 animate-in fade-in duration-300">
      <div
        className="pointer-events-none absolute -left-20 top-0 size-96 rounded-full bg-indigo-600/10 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        <EntityHeader
          type="studio"
          name={studioName}
          count={works.length}
          loading={loading}
          onClear={handleClearStudio}
          clearTooltip="Voltar aos detalhes do anime"
          subtitle="Estúdio de animação"
        />

        {loading ? (
          <AnimeGridSkeleton count={9} />
        ) : works.length === 0 ? (
          <EmptyNotice message="Nenhuma produção registrada para este estúdio no catálogo." />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {works.map((item) => (
              <StudioAnimeCard key={item.id} anime={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
