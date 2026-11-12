import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  Copy,
  Download,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { searchCatalog } from "@/lib/api";
import {
  animeToLocal,
  displayTitle,
  type SlimAnime,
} from "@/lib/types";
import { useHikariStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickPlayerUpdate } from "@/components/admin/QuickPlayerUpdate";
import {
  importCatalogInBatches,
  retryFailedBatches,
  type BatchImportProgress,
  type FailedBatchItem,
} from "@/lib/catalog-import-client";

export const Route = createFileRoute("/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  const animes = useHikariStore((s) => s.animes);
  const removeAnime = useHikariStore((s) => s.removeAnime);
  const upsertAnime = useHikariStore((s) => s.upsertAnime);
  const importAll = useHikariStore((s) => s.importAll);

  const [q, setQ] = useState("");
  const [importQ, setImportQ] = useState("");
  const [hits, setHits] = useState<SlimAnime[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingDelete, setPendingDelete] =
    useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<BatchImportProgress | null>(null);
  const [failedBatches, setFailedBatches] = useState<FailedBatchItem[]>([]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();

    if (!n) return animes;

    return animes.filter((a) =>
      `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`
        .toLowerCase()
        .includes(n),
    );
  }, [animes, q]);

  async function runImportSearch(e: FormEvent) {
    e.preventDefault();

    if (!importQ.trim()) return;

    setSearching(true);

    try {
      const res = await searchCatalog({
        data: {
          q: importQ.trim(),
          page: 1,
        },
      });

      setHits(res.items);
    } catch {
      toast.error("Não foi possível buscar no AniList.");
    } finally {
      setSearching(false);
    }
  }

  function importHit(hit: SlimAnime, asNew = false) {
    const existing = asNew
      ? undefined
      : animes.find((a) => a.id === hit.id || a.anilistId === hit.anilistId);

    const local = animeToLocal(hit, existing);

    upsertAnime(local);

    toast.success(
      asNew
        ? `${displayTitle(hit)} importado como novo cadastro independente!`
        : `${displayTitle(hit)} importado. Abra para editar episódios.`,
    );
  }

  function duplicateAsDubbed(target: (typeof animes)[number]) {
    const newId = `local-${crypto.randomUUID()}`;
    const baseTitleRomaji = target.titleRomaji ? `${target.titleRomaji} Dublado` : "";
    const baseTitleEnglish = target.titleEnglish ? `${target.titleEnglish} Dublado` : "";

    const clonedSeasons = target.seasons.map((s) => ({
      id: `s-${crypto.randomUUID()}`,
      number: s.number,
      title: s.title,
      episodes: s.episodes.map((e) => ({
        id: `e-${crypto.randomUUID()}`,
        number: e.number,
        title: e.title,
        duration: e.duration,
        thumbnail: e.thumbnail,
        synopsis: e.synopsis,
        videoUrl: "",
        videoUrl2: "",
        videoUrl3: "",
        videoUrl4: "",
        videoUrl5: "",
      })),
    }));

    const duplicated = {
      ...target,
      id: newId,
      titleRomaji: baseTitleRomaji || target.titleRomaji,
      titleEnglish: baseTitleEnglish || target.titleEnglish,
      seasons:
        clonedSeasons.length > 0
          ? clonedSeasons
          : [
              {
                id: `s-${crypto.randomUUID()}`,
                number: 1,
                title: "Temporada 1",
                episodes: [],
              },
            ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    upsertAnime(duplicated);
    toast.success(
      `Versão dublada criada como cadastro independente!`,
    );
  }

  function exportJson() {
    const blob = new Blob(
      [JSON.stringify({ animes }, null, 2)],
      {
        type: "application/json",
      },
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "hikari-catalogo.json";
    a.click();

    URL.revokeObjectURL(url);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const parsed = JSON.parse(
          String(reader.result),
        ) as {
          animes?: typeof animes;
        };

        if (!Array.isArray(parsed.animes)) {
          throw new Error("Formato inválido de arquivo JSON.");
        }

        // 1. Restauração local prioritária (preserva IndexedDB)
        importAll(parsed.animes);
        toast.success("Catálogo restaurado neste dispositivo.");

        // 2. Inicia sincronização no servidor por lotes de 100
        setIsImporting(true);
        setFailedBatches([]);
        toast.info(`Iniciando sincronização de ${parsed.animes.length} animes no banco em lotes de 100...`);

        try {
          const res = await importCatalogInBatches(parsed.animes, (progress) => {
            setImportProgress(progress);
          });

          if (res.abortedDueToAuth) {
            toast.error(
              "Falha de autorização: faça login com conta de administrador para importar no banco.",
            );
          } else if (res.ok) {
            toast.success(
              `Importação no banco concluída! ${res.importedAnimes} animes e ${res.importedEpisodes} episódios sincronizados.`,
            );
            setFailedBatches([]);
          } else {
            setFailedBatches(res.failedBatches);
            toast.warning(
              `Importação parcialmente concluída. ${res.failedBatches.length} lote(s) pendente(s) de reenvio.`,
            );
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Falha na sincronização remota.");
        } finally {
          setIsImporting(false);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Arquivo JSON inválido.");
      }
    };

    reader.readAsText(file);
  }

  return (
    <div className="space-y-8 pt-6">
      {/* Banner de Progresso da Importação em Lotes */}
      {isImporting && importProgress && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm text-foreground space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-primary">
              Sincronizando catálogo no banco de dados...
            </span>
            <span className="text-xs text-muted">
              Lote {importProgress.currentBatchIndex} de {importProgress.totalBatches}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.round(
                  ((importProgress.completedBatches + importProgress.failedBatches) /
                    importProgress.totalBatches) *
                    100,
                )}%`,
              }}
            />
          </div>
          <div className="flex flex-wrap justify-between text-xs text-muted">
            <span>
              {importProgress.processedAnimes} de {importProgress.totalAnimes} animes processados
            </span>
            <span>
              {importProgress.importedEpisodes} episódios importados
            </span>
          </div>
        </div>
      )}

      {/* Banner de Reenvio Seletivo de Lotes com Falha */}
      {failedBatches.length > 0 && !isImporting && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-300">
              Importação parcialmente concluída
            </p>
            <p className="text-xs text-amber-200/80">
              {failedBatches.length} lote(s) apresentaram erros (conflitos ou falhas de rede) e foram mantidos para reenvio.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isImporting}
            onClick={async () => {
              setIsImporting(true);
              toast.info(`Reenviando ${failedBatches.length} lote(s) pendente(s)...`);
              try {
                const res = await retryFailedBatches(failedBatches, (p) => setImportProgress(p));
                if (res.ok) {
                  setFailedBatches([]);
                  toast.success("Todos os lotes pendentes foram sincronizados com sucesso!");
                } else {
                  setFailedBatches(res.failedBatches);
                  toast.warning(
                    `Ainda restam ${res.failedBatches.length} lote(s) com erro.`,
                  );
                }
              } catch {
                toast.error("Falha ao reenviar lotes.");
              } finally {
                setIsImporting(false);
              }
            }}
            className="border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
          >
            Reenviar lotes pendentes ({failedBatches.length})
          </Button>
        </div>
      )}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
            Painel
          </p>

          <h1 className="font-display text-3xl tracking-tight">
            Admin
          </h1>

          <p className="mt-1 max-w-xl text-sm text-muted">
            Adicione, edite e exclua animes, temporadas e
            episódios. Este painel é exclusivo do administrador.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link
              to="/admin/$id"
              params={{ id: "new" }}
            >
              <Plus className="size-4" />
              Novo anime
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={exportJson}
          >
            <Download className="size-4" />
            Exportar
          </Button>

          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md px-4 text-sm font-medium shadow-[var(--shadow-border)] hover:bg-elevated">
            <Upload className="size-4" />
            Importar JSON

            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];

                if (f) onImportFile(f);

                e.target.value = "";
              }}
            />
          </label>
        </div>
      </header>

      {/* Ferramenta de Atualização Rápida de Players */}
      <div id="quick-update" className="scroll-mt-20">
        <QuickPlayerUpdate />
      </div>

      {/* Hikari AI */}
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-elevated">
              <Bot className="size-5" />
            </div>

            <div>
              <h2 className="font-display text-lg">
                Hikari AI
              </h2>

              <p className="mt-1 text-sm text-muted">
                Central de inteligência artificial para revisão
                de notícias e moderação do Hikari.
              </p>

              <p className="mt-2 text-xs text-subtle">
                Estrutura criada. Provedor de IA ainda não
                configurado.
              </p>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Link to="/admin/hikari-ai">
              <Bot className="size-4" />
              Abrir Hikari AI
            </Link>
          </Button>
        </div>
      </section>

      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <h2 className="font-display text-lg">
          Importar do AniList
        </h2>

        <p className="mt-1 text-sm text-muted">
          Busque um título oficial e traga capa, sinopse e
          gêneros. Depois acrescente URLs de episódio.
        </p>

        <form
          className="mt-4 flex gap-2"
          onSubmit={runImportSearch}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />

            <Input
              value={importQ}
              onChange={(e) => setImportQ(e.target.value)}
              placeholder="Ex.: Frieren, Dandadan, One Piece"
              className="pl-10"
            />
          </div>

          <Button
            type="submit"
            disabled={searching}
          >
            {searching ? "Buscando…" : "Buscar"}
          </Button>
        </form>

        {hits.length > 0 && (
          <ul className="mt-4 divide-y divide-border">
            {hits.slice(0, 8).map((hit) => (
              <li
                key={hit.id}
                className="flex items-center gap-3 py-3"
              >
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-elevated">
                  {hit.cover && (
                    <img
                      src={hit.cover}
                      alt=""
                      className="size-full object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {displayTitle(hit)}
                  </p>

                  <p className="truncate text-xs text-muted">
                    {hit.year ?? ""}{" "}
                    {hit.genres.slice(0, 2).join(" · ")}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => importHit(hit)}
                  >
                    {animes.some((a) => a.anilistId === hit.anilistId)
                      ? "Atualizar"
                      : "Importar"}
                  </Button>

                  {animes.some((a) => a.anilistId === hit.anilistId) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => importHit(hit, true)}
                      title="Importar como novo cadastro independente (ex: versão dublada)"
                    >
                      Novo cadastro
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="catalog" className="space-y-4 scroll-mt-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg">
              Seu catálogo ({animes.length})
            </h2>

            <p className="mt-0.5 text-xs text-muted">
              Gerencie seus animes e episódios.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Link to="/admin/moderation">
                <ShieldAlert className="size-4" />
                Moderação
              </Link>
            </Button>

            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar catálogo"
              className="w-full sm:max-w-56"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl bg-surface px-4 py-10 text-center shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted">
              Nenhum título local ainda.
            </p>

            <p className="mt-1 text-xs text-subtle">
              Importe do AniList ou crie um do zero.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((a) => (
              <li
                key={a.id}
                className="rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-elevated">
                    {a.cover ? (
                      <img
                        src={a.cover}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-xs text-subtle">
                        —
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">
                      {a.titleEnglish ||
                        a.titleRomaji ||
                        a.titleNative}
                    </p>

                    {a.hidden && (
                      <span className="mt-1 inline-block rounded-full bg-elevated px-2 py-0.5 text-[10px] text-subtle">
                        Oculto
                      </span>
                    )}

                    <p className="mt-1 text-xs text-muted">
                      {a.seasons.reduce(
                        (n, s) =>
                          n + s.episodes.length,
                        0,
                      )}{" "}
                      episódios
                      {a.anilistId
                        ? ` · AniList ${a.anilistId}`
                        : " · Original"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="flex-1 min-w-24"
                  >
                    <Link
                      to="/admin/$id"
                      params={{ id: a.id }}
                    >
                      Editar
                    </Link>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => duplicateAsDubbed(a)}
                    title="Criar cadastro independente para a versão dublada deste anime"
                  >
                    <Copy className="mr-1.5 size-3.5" />
                    Versão Dublada
                  </Button>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir"
                    onClick={() =>
                      setPendingDelete(a.id)
                    }
                    className="size-9"
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={() => setPendingDelete(null)}
      >
        <DialogContent>
          <DialogTitle>
            Excluir anime?
          </DialogTitle>

          <DialogDescription>
            Temporadas e episódios deste título saem do
            catálogo local. O AniList continua disponível.
          </DialogDescription>

          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingDelete(null)}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (pendingDelete) {
                  removeAnime(pendingDelete);
                }

                setPendingDelete(null);

                toast.success("Removido.");
              }}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
