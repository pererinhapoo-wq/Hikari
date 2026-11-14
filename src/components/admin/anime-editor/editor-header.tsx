import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Copy,
  Trash2,
  Save,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HardDrive,
  CopyCheck,
  Film,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FORMAT_PT, STATUS_PT } from "@/lib/labels";
import type { LocalAnime } from "@/lib/types";
import type { OutboxOperation } from "@/lib/episode-writer";
import { cn } from "@/lib/utils";

export type AnimeSyncState = "synced" | "local" | "pending" | "conflict" | "error";

interface EditorHeaderProps {
  anime: LocalAnime;
  isNew: boolean;
  importId?: string;
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  onDuplicateAsDubbed: () => void;
  onDelete: () => Promise<void> | void;
  onReloadFromServer: () => Promise<void> | void;
  isReloading: boolean;
  outboxOps: OutboxOperation[];
  canDelete: boolean;
  syncState?: AnimeSyncState;
}

export function EditorHeader({
  anime,
  isNew,
  isSaving,
  onSave,
  onDuplicateAsDubbed,
  onDelete,
  onReloadFromServer,
  isReloading,
  outboxOps,
  canDelete,
  syncState,
}: EditorHeaderProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const displayTitle =
    anime.titleRomaji ||
    anime.titleEnglish ||
    anime.titleNative ||
    (isNew ? "Novo Anime" : "Anime Sem Título");

  const secondaryTitle =
    anime.titleEnglish && anime.titleEnglish !== anime.titleRomaji
      ? anime.titleEnglish
      : anime.titleNative && anime.titleNative !== anime.titleRomaji
        ? anime.titleNative
        : null;

  const animeOutboxOps = outboxOps.filter((o) => o.animeId === anime.id);
  const conflictCount = animeOutboxOps.filter((o) => o.status === "conflict").length;
  const pendingCount = animeOutboxOps.filter((o) => o.status !== "conflict").length;

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(anime.id);
      setCopiedId(true);
      toast.success("ID copiado para a área de transferência!");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o ID.");
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setDeleteDialogOpen(false);
    } catch {
      // Falha tratada em onDelete
    } finally {
      setIsDeleting(false);
    }
  };

  const effectiveSyncState: AnimeSyncState =
    conflictCount > 0
      ? "conflict"
      : pendingCount > 0
        ? "pending"
        : syncState ??
          (anime.syncedAt && anime.syncedAt >= (anime.updatedAt ?? 0)
            ? "synced"
            : "local");

  const totalEpisodes = anime.seasons.reduce((acc, s) => acc + s.episodes.length, 0);

  return (
    <header className="studio-panel rounded-2xl p-4 sm:p-6">
      {/* Barra Superior: Retorno e Persistência */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
        <Link
          to="/admin"
          className="group inline-flex items-center gap-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Voltar ao Catálogo</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          {effectiveSyncState === "conflict" ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/12 px-2.5 py-1 text-[11px] font-semibold text-rose-300">
              <AlertTriangle className="size-3.5 text-rose-400" />
              {conflictCount > 0 ? `${conflictCount} conflito(s) no Outbox` : "Conflito / Validação"}
            </span>
          ) : effectiveSyncState === "pending" ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/12 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
              <Clock className="size-3.5 text-amber-300" />
              {pendingCount > 0 ? `${pendingCount} pendência(s) de envio` : "Sincronização Pendente"}
            </span>
          ) : effectiveSyncState === "error" ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/35 bg-orange-500/12 px-2.5 py-1 text-[11px] font-semibold text-orange-300">
              <AlertTriangle className="size-3.5 text-orange-400" />
              Erro de comunicação
            </span>
          ) : effectiveSyncState === "synced" ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              Sincronizado no Servidor
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-300">
              <HardDrive className="size-3.5 text-purple-400" />
              Salvo Localmente (Dispositivo)
            </span>
          )}

          <button
            type="button"
            onClick={handleCopyId}
            title="Clique para copiar o ID"
            className="studio-mono group inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-[var(--studio-panel-alt)] px-2.5 text-[11px] text-[var(--color-muted)] transition-colors hover:border-purple-500/40 hover:text-[var(--color-fg)]"
          >
            <span>#{anime.id.length > 20 ? `${anime.id.slice(0, 8)}…` : anime.id}</span>
            {copiedId ? (
              <CopyCheck className="size-3 text-emerald-400" />
            ) : (
              <Copy className="size-3 text-[var(--color-subtle)] group-hover:text-[var(--color-fg)]" />
            )}
          </button>
        </div>
      </div>

      {/* Identidade e Ações Principais */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:h-24 sm:w-16">
            {anime.cover ? (
              <img
                src={anime.cover}
                alt=""
                className="size-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-[var(--color-subtle)]">
                <Film className="size-6" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="line-clamp-2 break-words font-display text-xl font-bold tracking-tight text-[var(--color-fg)] sm:text-2xl lg:text-[26px]">
                {displayTitle}
              </h1>
              {anime.hidden && (
                <span className="studio-mono text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                  Oculto
                </span>
              )}
            </div>

            {secondaryTitle && (
              <p className="truncate text-xs text-[var(--color-muted)] sm:text-sm">
                {secondaryTitle}
              </p>
            )}

            <div className="studio-tabular flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--color-muted)]">
              {anime.format && (
                <span className="font-medium text-[var(--color-fg)]">
                  {FORMAT_PT[anime.format] || anime.format}
                </span>
              )}
              {anime.status && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="text-purple-300">
                    {STATUS_PT[anime.status] || anime.status}
                  </span>
                </>
              )}
              {anime.year && (
                <>
                  <span className="text-white/20">·</span>
                  <span>{anime.year}</span>
                </>
              )}
              <span className="text-white/20">·</span>
              <span>
                {anime.seasons.length}{" "}
                {anime.seasons.length === 1 ? "temporada" : "temporadas"}
              </span>
              <span className="text-white/20">·</span>
              <span>{totalEpisodes} episódios</span>
              {anime.score && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="font-semibold text-amber-300">
                    ★ {anime.score}/100
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Ações */}
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          {!isNew && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDuplicateAsDubbed}
              title="Cria um cadastro independente clonando metadados e episódios para versão dublada"
              className="h-10 border-white/10 bg-[var(--studio-panel-alt)] px-3 text-xs text-[var(--color-fg)] hover:border-purple-500/40"
            >
              <Copy className="mr-1.5 size-3.5 text-purple-400" />
              <span>Duplicar como Dublado</span>
            </Button>
          )}

          {!isNew && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isReloading}
              onClick={onReloadFromServer}
              title="Recarrega dados e episódios persistidos no PostgreSQL"
              className="h-10 px-3 text-xs text-[var(--color-muted)] hover:bg-white/[0.06] hover:text-[var(--color-fg)]"
            >
              <RefreshCw
                className={cn(
                  "mr-1.5 size-3.5",
                  isReloading && "animate-spin text-purple-400",
                )}
              />
              <span className="hidden sm:inline">Recarregar do Servidor</span>
              <span className="sm:hidden">Recarregar</span>
            </Button>
          )}

          {!isNew && canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="h-10 px-3 text-xs text-rose-400 hover:bg-rose-500/12 hover:text-rose-300"
            >
              <Trash2 className="mr-1.5 size-3.5" />
              <span>Excluir</span>
            </Button>
          )}

          <Button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="h-10 bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500"
          >
            {isSaving ? (
              <>
                <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                <span>Salvando…</span>
              </>
            ) : (
              <>
                <Save className="mr-1.5 size-3.5" />
                <span>Salvar Alterações</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="hikari-studio-dialog max-h-[88dvh] overflow-y-auto border border-rose-500/25 bg-[#0e0c17] text-[var(--color-fg)] sm:max-w-md">
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-rose-400">
            <AlertTriangle className="size-5 shrink-0" />
            <span>Excluir anime do catálogo?</span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
            Esta ação removerá <strong className="text-[var(--color-fg)]">{displayTitle}</strong>{" "}
            e todas as suas temporadas e episódios deste dispositivo e disparará a exclusão
            correspondente no banco PostgreSQL.
          </DialogDescription>

          <div className="mt-6 flex justify-end gap-2.5 border-t border-white/[0.07] pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(false)}
              className="h-9 border-white/10 text-xs text-[var(--color-muted)] hover:bg-white/[0.06]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="h-9 bg-rose-600 text-xs font-semibold text-white hover:bg-rose-500"
            >
              {isDeleting ? "Excluindo…" : "Sim, Excluir Anime"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
