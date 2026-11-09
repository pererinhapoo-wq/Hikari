import { Link, useNavigate } from "@tanstack/react-router";
import { Film, Layers, Star } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import {
  getPersonWorks,
  getStudioWorks,
  type DubladorWorkItem,
  type EntityWorksData,
  type StaffWorkItem,
  type StudioWorkAnime,
} from "@/lib/entity-works";
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
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [image, name]);

  const categoryPrefix = isStudio
    ? "Produções"
    : isDublador
      ? "Dublagens"
      : "Trabalhos";

  // Para Studios: usar exclusivamente logo oficial de getStudioLogo ou fallback elegante (nunca capa de anime)
  const studioLogo = isStudio ? getStudioLogo(name) : null;
  const initial = (name.trim().charAt(0) || "?").toUpperCase();

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
          {isStudio ? (
            studioLogo && !imgError ? (
              <img
                src={studioLogo}
                alt={`Logo oficial de ${name}`}
                onError={() => setImgError(true)}
                className="size-full object-contain"
                loading="eager"
              />
            ) : (
              <div className="flex size-full items-center justify-center font-display text-sm font-bold text-indigo-300">
                {initial}
              </div>
            )
          ) : image && !imgError ? (
            <img
              src={image}
              alt={`Fotografia de ${name}`}
              onError={() => setImgError(true)}
              className="size-full object-cover object-top"
              loading="eager"
            />
          ) : (
            <div
              className={cn(
                "flex size-full items-center justify-center font-display text-base font-bold shadow-inner",
                isDublador
                  ? "bg-gradient-to-br from-pink-900/60 to-purple-950/80 text-pink-200"
                  : "bg-gradient-to-br from-purple-900/60 to-indigo-950/80 text-purple-200",
              )}
            >
              {initial}
            </div>
          )}
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
  return (
    <Link
      to="/anime/$id"
      params={{ id: anime.id }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#0f0d1a] p-1.5 sm:p-2 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:bg-[#151224] hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)] cursor-pointer"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#141220]">
        {anime.cover ? (
          <img
            src={anime.cover}
            alt={anime.title}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-zinc-600">
            <Film className="size-5 sm:size-6" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

        {(anime.year || anime.format || anime.score) && (
          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[8px] sm:text-[9.5px] font-semibold text-zinc-300 leading-none">
            <span className="truncate">
              {anime.year}
              {anime.year && anime.format ? " • " : ""}
              {anime.format}
            </span>
            {anime.score && (
              <span className="flex items-center gap-0.5 text-amber-400 shrink-0">
                <Star className="size-2 sm:size-2.5 fill-amber-400" />
                {anime.score.toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-1.5 min-w-0">
        <h3
          className="line-clamp-2 min-h-[26px] sm:min-h-[30px] text-[10px] sm:text-xs font-semibold text-zinc-100 transition-colors group-hover:text-purple-300 leading-snug break-words"
          title={anime.title}
        >
          {anime.title}
        </h3>
      </div>
    </Link>
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
    <Link
      to="/anime/$id"
      params={{ id: work.anime.id }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#0f0d1a] p-1.5 sm:p-2 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:bg-[#151224] hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)] cursor-pointer"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#141220]">
        {work.anime.cover ? (
          <img
            src={work.anime.cover}
            alt={work.anime.title}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-zinc-600">
            <Film className="size-5 sm:size-6" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

        {(work.anime.year || work.anime.format || work.anime.score) && (
          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[8px] sm:text-[9.5px] font-semibold text-zinc-300 leading-none">
            <span className="truncate">
              {work.anime.year}
              {work.anime.year && work.anime.format ? " • " : ""}
              {work.anime.format}
            </span>
            {work.anime.score && (
              <span className="flex items-center gap-0.5 text-amber-400 shrink-0">
                <Star className="size-2 sm:size-2.5 fill-amber-400" />
                {work.anime.score.toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-1.5 min-w-0">
        <h3
          className="line-clamp-2 min-h-[26px] sm:min-h-[30px] text-[10px] sm:text-xs font-semibold text-zinc-100 transition-colors group-hover:text-purple-300 leading-snug break-words"
          title={work.anime.title}
        >
          {work.anime.title}
        </h3>
      </div>

      <div className="mt-1 flex items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] p-1 min-w-0">
        <div className="relative size-4 sm:size-5 shrink-0 overflow-hidden rounded-full bg-[#18152b] border border-purple-500/20">
          {work.character.image ? (
            <img
              src={work.character.image}
              alt={work.character.name}
              loading="lazy"
              className="size-full object-cover object-top"
            />
          ) : (
            <div className="flex size-full items-center justify-center font-display text-[7.5px] font-bold text-purple-400">
              {work.character.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[8.5px] sm:text-[10px] font-semibold text-zinc-200 leading-tight"
            title={work.character.name}
          >
            {work.character.name}
          </p>
          <span className="text-[7.5px] sm:text-[8.5px] font-medium text-purple-400 leading-none truncate block">
            {roleLabel}
          </span>
        </div>
      </div>
    </Link>
  );
});

export const StaffAnimeCard = memo(function StaffAnimeCard({
  work,
}: {
  work: StaffWorkItem;
}) {
  return (
    <Link
      to="/anime/$id"
      params={{ id: work.anime.id }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#0f0d1a] p-1.5 sm:p-2 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:bg-[#151224] hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)] cursor-pointer"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#141220]">
        {work.anime.cover ? (
          <img
            src={work.anime.cover}
            alt={work.anime.title}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-zinc-600">
            <Film className="size-5 sm:size-6" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

        {(work.anime.year || work.anime.format || work.anime.score) && (
          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[8px] sm:text-[9.5px] font-semibold text-zinc-300 leading-none">
            <span className="truncate">
              {work.anime.year}
              {work.anime.year && work.anime.format ? " • " : ""}
              {work.anime.format}
            </span>
            {work.anime.score && (
              <span className="flex items-center gap-0.5 text-amber-400 shrink-0">
                <Star className="size-2 sm:size-2.5 fill-amber-400" />
                {work.anime.score.toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-1.5 min-w-0">
        <h3
          className="line-clamp-2 min-h-[26px] sm:min-h-[30px] text-[10px] sm:text-xs font-semibold text-zinc-100 transition-colors group-hover:text-purple-300 leading-snug break-words"
          title={work.anime.title}
        >
          {work.anime.title}
        </h3>
      </div>

      <div className="mt-1 min-w-0">
        <span className="inline-flex items-center gap-0.5 max-w-full rounded border border-purple-500/30 bg-purple-950/70 px-1 py-0.5 text-[8px] sm:text-[9px] font-semibold text-purple-200 leading-none">
          <Layers className="size-2 shrink-0 text-purple-400" />
          <span className="truncate">{work.roleLabel}</span>
        </span>
      </div>
    </Link>
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
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev };
          delete next.dublador;
          delete next.dubladorId;
          return next;
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
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev };
          delete next.staff;
          delete next.staffId;
          delete next.person;
          delete next.personId;
          return next;
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
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev };
          delete next.studio;
          return next;
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
