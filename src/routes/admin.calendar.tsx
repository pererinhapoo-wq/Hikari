import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarClock,
  CheckCircle2,
  Film,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import {
  StudioEmptyState,
  StudioLoadingState,
  StudioPageHeader,
  StudioPanel,
  StudioStatStrip,
} from "@/components/admin/studio-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBearerToken } from "@/lib/auth/client";
import { WEEK_DAY_OPTIONS, getWeekdayLabelSaoPaulo } from "@/lib/calendar-timezone";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/calendar")({
  component: AdminCalendarRecurrencesPage,
});

interface RecurrenceItem {
  id: string;
  animeId: string;
  dayOfWeek: number;
  timezone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  anime: {
    id: string;
    anilistId: number | null;
    title: string;
    titleRomaji: string | null;
    titleEnglish: string | null;
    cover: string | null;
    format: string | null;
    status: string | null;
  };
}

interface CatalogAnimeOption {
  id: string;
  anilistId: number | null;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  cover: string | null;
  format: string | null;
  status: string | null;
  year: number | null;
}

function resolveAnimeDisplayTitle(anime: {
  title: string;
  titleEnglish?: string | null;
  titleRomaji?: string | null;
}): string {
  return (
    anime.titleEnglish?.trim() ||
    anime.titleRomaji?.trim() ||
    anime.title?.trim() ||
    "Anime"
  );
}

function AdminCalendarRecurrencesPage() {
  const [recurrences, setRecurrences] = useState<RecurrenceItem[]>([]);
  const [animeOptions, setAnimeOptions] = useState<CatalogAnimeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchingAnimes, setSearchingAnimes] = useState(false);

  const [animeQuery, setAnimeQuery] = useState("");
  const [selectedAnime, setSelectedAnime] = useState<CatalogAnimeOption | null>(null);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);

  const [filterText, setFilterText] = useState("");
  const [filterDay, setFilterDay] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurrenceItem | null>(null);

  const hasInitialCatalogLoadedRef = useRef(false);
  const lastFetchedQueryRef = useRef<string>("");
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchSeqRef = useRef(0);

  const authHeaders = useCallback((withJson = false): Record<string, string> => {
    const token = getBearerToken();
    return {
      ...(withJson ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchRecurrencesAndInitialCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const currentQ = animeQuery.trim();
      const params = new URLSearchParams({ includeCatalog: "1" });
      if (currentQ) {
        params.set("q", currentQ);
      }
      const res = await fetch(
        `/api/admin/calendar-recurrences?${params.toString()}`,
        {
          headers: authHeaders(false),
          credentials: "include",
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error || "Falha ao carregar programações recorrentes.",
        );
      }
      setRecurrences(Array.isArray(json?.recurrences) ? json.recurrences : []);
      if (Array.isArray(json?.animeOptions)) {
        setAnimeOptions(json.animeOptions);
        hasInitialCatalogLoadedRef.current = true;
        lastFetchedQueryRef.current = currentQ;
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao carregar dados do calendário semanal.",
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial/manual usa animeQuery atual sem recriar o efeito de mount
  }, [authHeaders]);

  useEffect(() => {
    void fetchRecurrencesAndInitialCatalog();
    return () => {
      searchAbortRef.current?.abort();
    };
  }, [fetchRecurrencesAndInitialCatalog]);

  const searchCatalogAnimes = useCallback(
    async (query: string) => {
      const normalized = query.trim();
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      const seq = ++searchSeqRef.current;

      setSearchingAnimes(true);
      try {
        const params = new URLSearchParams({ q: normalized });
        const res = await fetch(
          `/api/admin/calendar-recurrences?${params.toString()}`,
          {
            headers: authHeaders(false),
            credentials: "include",
            signal: controller.signal,
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || "Falha ao buscar animes no catálogo.");
        }
        if (seq !== searchSeqRef.current || controller.signal.aborted) {
          return;
        }
        lastFetchedQueryRef.current = normalized;
        setAnimeOptions(Array.isArray(json?.animeOptions) ? json.animeOptions : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Erro ao pesquisar catálogo local.",
        );
      } finally {
        if (seq === searchSeqRef.current) {
          setSearchingAnimes(false);
        }
      }
    },
    [authHeaders],
  );

  useEffect(() => {
    if (!hasInitialCatalogLoadedRef.current) return;
    const normalized = animeQuery.trim();
    if (normalized === lastFetchedQueryRef.current) return;

    const timer = window.setTimeout(() => {
      void searchCatalogAnimes(normalized);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [animeQuery, searchCatalogAnimes]);

  const handleCreateRecurrence = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAnime) {
      toast.error("Selecione um anime do catálogo antes de cadastrar.");
      return;
    }
    if (isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/calendar-recurrences", {
        method: "POST",
        headers: authHeaders(true),
        credentials: "include",
        body: JSON.stringify({
          animeId: selectedAnime.id,
          dayOfWeek: selectedDayOfWeek,
          active: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error || "Não foi possível cadastrar a programação recorrente.",
        );
      }

      if (json?.recurrence) {
        setRecurrences((prev) => [json.recurrence as RecurrenceItem, ...prev]);
      } else {
        await fetchRecurrencesAndInitialCatalog();
      }
      toast.success(
        `${resolveAnimeDisplayTitle(selectedAnime)} programado para ${getWeekdayLabelSaoPaulo(selectedDayOfWeek)}.`,
      );
      setSelectedAnime(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao cadastrar recorrência.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateRecurrence = async (
    item: RecurrenceItem,
    patch: { dayOfWeek?: number; active?: boolean },
  ) => {
    if (busyRowId) return;
    setBusyRowId(item.id);
    try {
      const res = await fetch("/api/admin/calendar-recurrences", {
        method: "PATCH",
        headers: authHeaders(true),
        credentials: "include",
        body: JSON.stringify({
          id: item.id,
          ...patch,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Falha ao atualizar programação.");
      }

      if (json?.recurrence) {
        setRecurrences((prev) =>
          prev.map((row) =>
            row.id === item.id ? (json.recurrence as RecurrenceItem) : row,
          ),
        );
      }
      toast.success("Programação semanal atualizada!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao atualizar programação.",
      );
    } finally {
      setBusyRowId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || busyRowId) return;
    const target = pendingDelete;
    setBusyRowId(target.id);
    try {
      const res = await fetch("/api/admin/calendar-recurrences", {
        method: "DELETE",
        headers: authHeaders(true),
        credentials: "include",
        body: JSON.stringify({ id: target.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Falha ao remover recorrência.");
      }

      setRecurrences((prev) => prev.filter((row) => row.id !== target.id));
      setPendingDelete(null);
      toast.success("Programação semanal removida.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao remover programação.",
      );
    } finally {
      setBusyRowId(null);
    }
  };

  const stats = useMemo(() => {
    let activeCount = 0;
    let inactiveCount = 0;
    for (const r of recurrences) {
      if (r.active) activeCount += 1;
      else inactiveCount += 1;
    }
    return { total: recurrences.length, activeCount, inactiveCount };
  }, [recurrences]);

  const filteredRecurrences = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return recurrences.filter((item) => {
      if (filterDay !== "all" && item.dayOfWeek !== Number(filterDay)) {
        return false;
      }
      if (filterStatus === "active" && !item.active) return false;
      if (filterStatus === "inactive" && item.active) return false;
      if (q) {
        const haystack =
          `${item.anime.title} ${item.anime.titleEnglish ?? ""} ${item.anime.titleRomaji ?? ""} ${item.animeId}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [recurrences, filterDay, filterStatus, filterText]);

  if (loading) {
    return (
      <StudioLoadingState message="Carregando programações semanais recorrentes..." />
    );
  }

  return (
    <div className="studio-enter space-y-6 pb-10">
      <StudioPageHeader
        kicker="Catálogo & Acervo"
        title="Calendário Semanal Recorrente"
        description="Vincule animes do catálogo a dias fixos da semana (America/Sao_Paulo), sem exigir horário ou data específica. As ocorrências aparecem automaticamente na Home e em /calendar."
        backTo="/admin"
        backLabel="Voltar à Central"
        status={
          <span className="studio-mono font-semibold text-emerald-400">
            {stats.activeCount} ativa(s)
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel)] text-xs hover:bg-white/[0.06]"
            >
              <Link to="/calendar">Ver Calendário Público</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchRecurrencesAndInitialCatalog()}
              className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel)] text-xs hover:bg-white/[0.06]"
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Atualizar
            </Button>
          </div>
        }
      />

      <StudioStatStrip
        columns={4}
        items={[
          {
            label: "Total Cadastrado",
            value: stats.total.toLocaleString("pt-BR"),
            detail: "Regras semanais no PostgreSQL",
            accent: "violet",
          },
          {
            label: "Recorrências Ativas",
            value: stats.activeCount.toLocaleString("pt-BR"),
            detail: "Exibidas na Home e /calendar",
            accent: "emerald",
          },
          {
            label: "Pausadas / Inativas",
            value: stats.inactiveCount.toLocaleString("pt-BR"),
            detail: "Mantidas sem exibição pública",
            accent: stats.inactiveCount > 0 ? "amber" : "default",
          },
          {
            label: "Fuso Oficial",
            value: "America/Sao_Paulo",
            detail: "Virada automática à meia-noite BRT",
            accent: "cobalt",
          },
        ]}
      />

      {/* Formulário de Cadastro */}
      <StudioPanel
        title="Nova Programação Recorrente"
        description="Selecione um anime já existente no catálogo do Hikari e o dia da semana em que ele lança."
        icon={<Plus className="size-4" />}
      >
        <form onSubmit={handleCreateRecurrence} className="space-y-5">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Seleção do Anime */}
            <div className="space-y-3 lg:col-span-7">
              <Label htmlFor="anime-recurrence-search" className="text-xs font-semibold text-white">
                1. Selecione o Anime do Catálogo
              </Label>

              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="anime-recurrence-search"
                  value={animeQuery}
                  onChange={(e) => setAnimeQuery(e.target.value)}
                  placeholder="Buscar por título, ID local ou ID AniList no banco..."
                  className="studio-input h-10 pl-9 text-xs"
                />
                {searchingAnimes && (
                  <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-purple-400" />
                )}
              </div>

              {selectedAnime && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-11 w-8 shrink-0 overflow-hidden rounded bg-[#0d0c16] border border-white/10">
                      {selectedAnime.cover ? (
                        <img
                          src={selectedAnime.cover}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-zinc-500">
                          <Film className="size-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200 truncate">
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                        <span className="truncate">{resolveAnimeDisplayTitle(selectedAnime)}</span>
                      </p>
                      <p className="studio-mono text-[10px] text-emerald-300/80 truncate">
                        {selectedAnime.id}
                        {selectedAnime.format ? ` · ${selectedAnime.format}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedAnime(null)}
                    className="h-8 border-emerald-500/30 bg-transparent text-[11px] text-emerald-200 hover:bg-emerald-500/20"
                  >
                    Trocar
                  </Button>
                </div>
              )}

              <div className="studio-scroll max-h-56 divide-y divide-white/[0.06] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#120f20]">
                {animeOptions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-zinc-400">
                    Nenhum anime encontrado no catálogo local para essa busca.
                  </p>
                ) : (
                  animeOptions.map((option) => {
                    const isSelected = selectedAnime?.id === option.id;
                    const display = resolveAnimeDisplayTitle(option);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedAnime(option)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors cursor-pointer",
                          isSelected
                            ? "bg-purple-600/20 text-white"
                            : "hover:bg-white/[0.04] text-zinc-200",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-10 w-7 shrink-0 overflow-hidden rounded border border-white/10 bg-[#0d0c16]">
                            {option.cover ? (
                              <img
                                src={option.cover}
                                alt=""
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="grid size-full place-items-center text-zinc-500">
                                <Film className="size-3" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{display}</p>
                            <p className="truncate text-[10px] text-zinc-400">
                              {option.format || "Anime"}
                              {option.year ? ` · ${option.year}` : ""}
                              {option.status ? ` · ${option.status}` : ""}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold border",
                            isSelected
                              ? "border-purple-400/50 bg-purple-500/30 text-purple-200"
                              : "border-white/10 bg-white/[0.03] text-zinc-400",
                          )}
                        >
                          {isSelected ? "Selecionado" : "Selecionar"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Seleção do Dia da Semana */}
            <div className="flex flex-col justify-between space-y-4 lg:col-span-5">
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-white">
                  2. Dia da Semana Recorrente (Horário de Brasília)
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                  {WEEK_DAY_OPTIONS.map((day) => {
                    const active = selectedDayOfWeek === day.index;
                    return (
                      <button
                        key={day.index}
                        type="button"
                        onClick={() => setSelectedDayOfWeek(day.index)}
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer",
                          active
                            ? "border-purple-500 bg-purple-600/25 text-white shadow-sm shadow-purple-500/20"
                            : "border-white/[0.08] bg-[#161226] text-zinc-300 hover:border-purple-500/40 hover:text-white",
                        )}
                      >
                        <span>{day.name}</span>
                        <span className="studio-mono text-[10px] opacity-70">
                          {day.shortName}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Não é necessário informar horário nem data fixa. Quando já houver um horário específico sincronizado para aquele dia, o item específico tem prioridade sem duplicar o anime.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isCreating || !selectedAnime}
                className="h-10 w-full bg-purple-600 text-xs font-semibold text-white shadow-md shadow-purple-600/25 hover:bg-purple-700 disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                    Salvando programação...
                  </>
                ) : (
                  <>
                    <CalendarClock className="mr-1.5 size-4" />
                    Cadastrar Recorrência Semanal
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </StudioPanel>

      {/* Lista de Recorrências Cadastradas */}
      <StudioPanel
        title="Programações Recorrentes Cadastradas"
        description="Edite o dia da semana, pause/ative ou remova recorrências existentes. Caches de calendário e Hoje são invalidados automaticamente."
        icon={<CalendarClock className="size-4" />}
        right={
          <span className="studio-mono text-xs text-zinc-400">
            {filteredRecurrences.length} exibida(s)
          </span>
        }
        bodyClassName="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtrar recorrências por título..."
              className="studio-input h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrar por dia da semana"
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="h-9 rounded-lg border border-white/[0.08] bg-[#161226] px-3 text-xs text-zinc-200 focus:border-purple-500/50 focus:outline-none"
            >
              <option value="all">Todos os dias</option>
              {WEEK_DAY_OPTIONS.map((d) => (
                <option key={d.index} value={String(d.index)}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por status"
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as "all" | "active" | "inactive")
              }
              className="h-9 rounded-lg border border-white/[0.08] bg-[#161226] px-3 text-xs text-zinc-200 focus:border-purple-500/50 focus:outline-none"
            >
              <option value="all">Todas (Ativas + Inativas)</option>
              <option value="active">Somente Ativas</option>
              <option value="inactive">Somente Inativas</option>
            </select>
          </div>
        </div>

        {filteredRecurrences.length === 0 ? (
          <StudioEmptyState
            icon={<CalendarClock className="size-6" />}
            title="Nenhuma programação recorrente encontrada"
            description={
              recurrences.length === 0
                ? "Selecione um anime acima e escolha o dia da semana para cadastrar a primeira recorrência."
                : "Nenhuma recorrência corresponde aos filtros atuais."
            }
          />
        ) : (
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-[#120f20]">
            {filteredRecurrences.map((item) => {
              const title = resolveAnimeDisplayTitle(item.anime);
              const isBusy = busyRowId === item.id;
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 p-3.5 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#0d0c16]">
                      {item.anime.cover ? (
                        <img
                          src={item.anime.cover}
                          alt={title}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-zinc-500">
                          <Film className="size-4" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {title}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                            item.active
                              ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                              : "border-amber-500/35 bg-amber-500/15 text-amber-300",
                          )}
                        >
                          {item.active ? "Ativa" : "Pausada"}
                        </span>
                      </div>
                      <p className="studio-mono mt-0.5 truncate text-[11px] text-zinc-400">
                        {item.anime.format || "Anime"} · {item.timezone} · {item.animeId}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <select
                      aria-label={`Dia da semana para ${title}`}
                      disabled={isBusy}
                      value={String(item.dayOfWeek)}
                      onChange={(e) =>
                        void handleUpdateRecurrence(item, {
                          dayOfWeek: Number(e.target.value),
                        })
                      }
                      className="h-9 rounded-lg border border-white/[0.08] bg-[#161226] px-2.5 text-xs font-medium text-zinc-100 focus:border-purple-500/50 focus:outline-none disabled:opacity-50"
                    >
                      {WEEK_DAY_OPTIONS.map((d) => (
                        <option key={d.index} value={String(d.index)}>
                          {d.name}
                        </option>
                      ))}
                    </select>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() =>
                        void handleUpdateRecurrence(item, {
                          active: !item.active,
                        })
                      }
                      className={cn(
                        "h-9 text-xs font-semibold",
                        item.active
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
                      )}
                    >
                      {item.active ? "Desativar" : "Ativar"}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => setPendingDelete(item)}
                      className="h-9 border-rose-500/30 bg-rose-500/10 px-2.5 text-xs text-rose-300 hover:bg-rose-500/20"
                      aria-label={`Excluir recorrência de ${title}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </StudioPanel>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !busyRowId) setPendingDelete(null);
        }}
      >
        <DialogContent className="border-white/10 bg-[#141024] text-zinc-100 sm:max-w-md">
          <DialogTitle className="text-base font-bold text-white">
            Remover programação recorrente?
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-zinc-300">
            {pendingDelete ? (
              <>
                O anime{" "}
                <strong className="text-white">
                  {resolveAnimeDisplayTitle(pendingDelete.anime)}
                </strong>{" "}
                deixará de aparecer automaticamente toda{" "}
                <strong className="text-purple-300">
                  {getWeekdayLabelSaoPaulo(pendingDelete.dayOfWeek)}
                </strong>
                . Os episódios e metadados do anime no catálogo permanecem intactos.
              </>
            ) : null}
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={Boolean(busyRowId)}
              onClick={() => setPendingDelete(null)}
              className="h-9 border-white/10 bg-transparent text-xs text-zinc-300 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={Boolean(busyRowId)}
              onClick={() => void handleConfirmDelete()}
              className="h-9 bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
            >
              {busyRowId ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 size-3.5" />
              )}
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminCalendarRecurrencesPage;
