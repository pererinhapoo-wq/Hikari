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
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FORMAT_PT, STATUS_PT } from "@/lib/labels";
import type { LocalAnime } from "@/lib/types";
import type { OutboxOperation } from "@/lib/episode-writer";

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
  importId,
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
      // Falha tratada na ação onDelete; mantém o anime intacto
    } finally {
      setIsDeleting(false);
    }
  };

  // Determina o estado canônico de persistência sem heurística de prefixo
  const effectiveSyncState: AnimeSyncState =
    conflictCount > 0
      ? "conflict"
      : pendingCount > 0
      ? "pending"
      : syncState ??
        (anime.syncedAt && anime.syncedAt >= (anime.updatedAt ?? 0)
          ? "synced"
          : "local");

  return (
    <div className="relative rounded-2xl border border-white/5 bg-surface/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
      {/* Barra de Navegação Superior */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <Link
          to="/admin"
          className="group inline-flex items-center gap-2 text-xs font-medium text-muted transition-colors hover:text-white"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Voltar ao Catálogo</span>
        </Link>

        {/* Indicador Preciso de Persistência */}
        <div className="flex flex-wrap items-center gap-2">
          {effectiveSyncState === "conflict" ? (
            <Badge className="h-6 border border-rose-500/30 bg-rose-500/10 text-[11px] font-medium text-rose-300">
              <AlertTriangle className="mr-1.5 size-3 text-rose-400" />
              {conflictCount > 0 ? `${conflictCount} conflito(s) no Outbox` : "Conflito / Validação"}
            </Badge>
          ) : effectiveSyncState === "pending" ? (
            <Badge className="h-6 border border-amber-500/30 bg-amber-500/10 text-[11px] font-medium text-amber-300">
              <Clock className="mr-1.5 size-3 text-amber-400" />
              {pendingCount > 0 ? `${pendingCount} pendência(s) de envio` : "Sincronização Pendente"}
            </Badge>
          ) : effectiveSyncState === "error" ? (
            <Badge className="h-6 border border-orange-500/30 bg-orange-500/10 text-[11px] font-medium text-orange-300">
              <AlertTriangle className="mr-1.5 size-3 text-orange-400" />
              Erro de comunicação
            </Badge>
          ) : effectiveSyncState === "synced" ? (
            <Badge className="h-6 border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-300">
              <CheckCircle2 className="mr-1.5 size-3 text-emerald-400" />
              Sincronizado no Servidor
            </Badge>
          ) : (
            <Badge className="h-6 border border-purple-500/30 bg-purple-500/10 text-[11px] font-medium text-purple-300">
              <HardDrive className="mr-1.5 size-3 text-purple-400" />
              Salvo Localmente (Dispositivo)
            </Badge>
          )}

          {/* Badge de ID com Cópia Rápida */}
          <button
            type="button"
            onClick={handleCopyId}
            title="Clique para copiar o ID"
            className="group inline-flex h-6 items-center gap-1.5 rounded-full border border-white/10 bg-elevated/60 px-2.5 text-[11px] font-mono text-zinc-400 transition-colors hover:border-purple-500/40 hover:bg-elevated hover:text-white"
          >
            <span>#{anime.id.length > 20 ? `${anime.id.slice(0, 8)}…` : anime.id}</span>
            {copiedId ? (
              <CopyCheck className="size-3 text-emerald-400" />
            ) : (
              <Copy className="size-3 text-zinc-500 group-hover:text-zinc-300" />
            )}
          </button>
        </div>
      </div>

      {/* Conteúdo Principal do Cabeçalho */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Identificação com Capa Miniatura e Títulos */}
        <div className="flex items-center gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-md sm:size-20">
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
              <div className="flex size-full items-center justify-center text-zinc-600">
                <Film className="size-6 text-zinc-600" />
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-xl font-bold tracking-tight text-white sm:text-2xl md:text-3xl">
                {displayTitle}
              </h1>

              {anime.hidden && (
                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  Oculto
                </span>
              )}

              {anime.format && (
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                  {FORMAT_PT[anime.format] || anime.format}
                </span>
              )}

              {anime.status && (
                <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                  {STATUS_PT[anime.status] || anime.status}
                </span>
              )}

              {anime.year && (
                <span className="text-xs text-muted">
                  ({anime.year})
                </span>
              )}
            </div>

            {secondaryTitle && (
              <p className="truncate text-xs text-muted sm:text-sm">
                {secondaryTitle}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-zinc-400">
              <span>{anime.seasons.length} {anime.seasons.length === 1 ? "temporada" : "temporadas"}</span>
              <span>•</span>
              <span>
                {anime.seasons.reduce((acc, s) => acc + s.episodes.length, 0)} episódios
              </span>
              {anime.score && (
                <>
                  <span>•</span>
                  <span className="font-medium text-amber-400">★ {anime.score}/100</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Grupo de Ações do Cabeçalho */}
        <div className="flex flex-wrap items-center gap-2.5 sm:self-auto">
          {!isNew && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDuplicateAsDubbed}
              title="Cria um cadastro independente clonando metadados e episódios para versão dublada"
              className="h-9 border-white/10 bg-elevated/40 text-xs text-zinc-300 hover:border-purple-500/40 hover:bg-elevated hover:text-white"
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
              className="h-9 text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${isReloading ? "animate-spin text-purple-400" : ""}`} />
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
              className="h-9 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 className="mr-1.5 size-3.5" />
              <span>Excluir</span>
            </Button>
          )}

          {/* Botão de Salvar Destacado e Acessível */}
          <Button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="h-9 bg-purple-600 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-600/20 hover:bg-purple-500 focus:ring-2 focus:ring-purple-500/50"
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
        <DialogContent className="border-rose-500/20 bg-zinc-950 sm:max-w-md">
          <DialogTitle className="flex items-center gap-2 text-rose-400 font-display text-lg">
            <AlertTriangle className="size-5 shrink-0" />
            <span>Excluir anime do catálogo?</span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs leading-relaxed text-zinc-400">
            Esta ação removerá <strong className="text-zinc-200">{displayTitle}</strong> e todas as suas temporadas e episódios deste dispositivo e disparará a exclusão correspondente no banco PostgreSQL.
          </DialogDescription>

          <div className="mt-6 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(false)}
              className="border-white/10 text-xs text-zinc-300 hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="bg-rose-600 text-xs font-medium text-white hover:bg-rose-700"
            >
              {isDeleting ? "Excluindo…" : "Sim, Excluir Anime"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
