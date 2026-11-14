import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Clock,
  Film,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getBearerToken } from "@/lib/auth/client";

export const Route = createFileRoute("/admin/moderation")({
  component: AdminModeration,
});

type ReportReason = {
  value: string;
  label: string;
};

type Report = {
  commentId: string;
  animeId: string;
  episodeId: string;
  content: string;
  parentId: string | null;
  isSpoiler: boolean;
  createdAt: string;
  updatedAt: string;

  userId: string;
  userName: string;
  userEmail: string | null;
  userImage: string | null;

  reportCount: number;
  firstReportedAt: string;

  reasons: ReportReason[];
};

function AdminModeration() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [pendingAction, setPendingAction] = useState<{
    type: "resolve" | "delete";
    commentId: string;
  } | null>(null);
  const [processing, setProcessing] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);

    try {
      const token = getBearerToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/admin/comment-reports", {
        method: "GET",
        credentials: "include",
        headers,
      });

      const data = (await response.json()) as {
        reports?: Report[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? "Não foi possível carregar as denúncias.",
        );
      }

      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as denúncias.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  async function executeAction() {
    if (!pendingAction) return;

    setProcessing(true);

    try {
      const token = getBearerToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/admin/comment-reports", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          commentId: pendingAction.commentId,
          action: pendingAction.type,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível realizar a ação.");
      }

      if (pendingAction.type === "delete") {
        toast.success("Comentário removido.");
      } else {
        toast.success("Denúncia resolvida.");
      }

      setPendingAction(null);
      await loadReports();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível realizar a ação.",
      );
    } finally {
      setProcessing(false);
    }
  }

  const availableReasons = useMemo(() => {
    const map = new Map<string, string>();
    for (const report of reports) {
      for (const reason of report.reasons) {
        if (reason.value && !map.has(reason.value)) {
          map.set(reason.value, reason.label);
        }
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [reports]);

  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return reports.filter((report) => {
      if (
        reasonFilter !== "ALL" &&
        !report.reasons.some((reason) => reason.value === reasonFilter)
      ) {
        return false;
      }

      if (!query) return true;

      return (
        report.userName.toLowerCase().includes(query) ||
        report.content.toLowerCase().includes(query) ||
        report.animeId.toLowerCase().includes(query) ||
        report.episodeId.toLowerCase().includes(query)
      );
    });
  }, [reports, searchQuery, reasonFilter]);

  const totalReportCount = useMemo(
    () => reports.reduce((acc, item) => acc + (item.reportCount || 0), 0),
    [reports],
  );

  const spoilerCount = useMemo(
    () => reports.filter((item) => item.isSpoiler).length,
    [reports],
  );

  return (
    <div className="studio-enter space-y-6 pb-12 pt-2">
      {/* Cabeçalho */}
      <header className="studio-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              to="/admin"
              className="inline-flex h-8 items-center gap-1.5 rounded-md text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              <ChevronLeft className="size-3.5" />
              Painel
            </Link>

            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-300">
              Comunidade
            </p>

            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[var(--color-fg)] sm:text-3xl">
              Moderação
            </h1>

            <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-muted)]">
              Analise os comentários denunciados e decida se a denúncia deve ser
              resolvida ou se o comentário deve ser removido.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadReports()}
              disabled={loading}
              className="h-10 gap-2 border-white/15 bg-[var(--studio-panel-alt)] px-4 text-xs font-medium hover:bg-white/[0.06]"
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Atualizando…" : "Atualizar"}
            </Button>
          </div>
        </div>
      </header>

      {/* Resumo & Filtros da Fila */}
      <section className="studio-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5 sm:items-center">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-purple-500/25 bg-purple-500/12 text-purple-300">
              <MessageCircle className="size-5" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[var(--color-fg)]">
                  Denúncias pendentes
                </p>
                <span className="studio-mono rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-2 py-0.5 text-xs text-purple-300">
                  {reports.length}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {reports.length === 0
                  ? "Nenhuma denúncia pendente."
                  : reports.length === 1
                  ? "1 comentário aguardando análise."
                  : `${reports.length} comentários aguardando análise (${totalReportCount} sinalizações · ${spoilerCount} com alerta de spoiler).`}
              </p>
            </div>
          </div>

          {reports.length > 0 && (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:w-[420px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-subtle)]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar autor, texto ou ID..."
                  aria-label="Buscar denúncias"
                  className="h-10 border-white/10 bg-[var(--studio-panel-alt)] pl-8 text-xs"
                />
              </div>

              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                aria-label="Filtrar por motivo"
                className="h-10 w-full cursor-pointer rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-3 text-xs text-[var(--color-fg)] focus:border-purple-500/50 focus:outline-none"
              >
                <option value="ALL">Todos os motivos</option>
                {availableReasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Conteúdo */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="studio-panel h-52 animate-pulse rounded-2xl p-5"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-white/[0.06]" />
                <div className="space-y-2">
                  <div className="h-4 w-36 rounded bg-white/[0.08]" />
                  <div className="h-3 w-48 rounded bg-white/[0.05]" />
                </div>
              </div>
              <div className="mt-5 h-20 rounded-xl bg-white/[0.04]" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="studio-panel rounded-2xl px-6 py-16 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-emerald-500/25 bg-emerald-500/12 text-emerald-300">
            <Check className="size-6" />
          </div>

          <h2 className="mt-4 font-display text-xl font-semibold text-[var(--color-fg)]">
            Tudo limpo
          </h2>

          <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--color-muted)]">
            Não há comentários denunciados aguardando análise.
          </p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="studio-panel rounded-2xl px-6 py-12 text-center">
          <ShieldAlert className="mx-auto size-8 text-[var(--color-subtle)]" />
          <h2 className="mt-3 font-display text-lg font-semibold text-[var(--color-fg)]">
            Nenhuma denúncia corresponde aos filtros
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Limpe a busca ou altere o filtro de motivo para visualizar os{" "}
            {reports.length} itens da fila.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setReasonFilter("ALL");
            }}
            className="mt-4 h-9 border-white/15 bg-[var(--studio-panel-alt)] text-xs"
          >
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <ReportCard
              key={report.commentId}
              report={report}
              onResolve={() =>
                setPendingAction({
                  type: "resolve",
                  commentId: report.commentId,
                })
              }
              onDelete={() =>
                setPendingAction({
                  type: "delete",
                  commentId: report.commentId,
                })
              }
            />
          ))}
        </div>
      )}

      {/* Diálogo de Confirmação */}
      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !processing) {
            setPendingAction(null);
          }
        }}
      >
        <DialogContent className="hikari-studio-dialog border border-white/15 bg-[var(--studio-panel)] text-[var(--color-fg)] shadow-2xl">
          <DialogTitle className="font-display text-lg font-bold">
            {pendingAction?.type === "delete"
              ? "Remover comentário?"
              : "Resolver denúncia?"}
          </DialogTitle>

          <DialogDescription className="text-sm text-[var(--color-muted)]">
            {pendingAction?.type === "delete"
              ? "O comentário será removido permanentemente. As respostas, curtidas e denúncias relacionadas também serão removidas."
              : "A denúncia será marcada como resolvida e deixará de aparecer nesta lista."}
          </DialogDescription>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={processing}
              onClick={() => setPendingAction(null)}
              className="h-10 border border-white/10 hover:bg-white/[0.06]"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant={pendingAction?.type === "delete" ? "danger" : "default"}
              disabled={processing}
              onClick={() => void executeAction()}
              className={
                pendingAction?.type === "delete"
                  ? "h-10 bg-rose-600 text-white hover:bg-rose-500"
                  : "h-10 bg-purple-600 text-white hover:bg-purple-500"
              }
            >
              {processing
                ? "Processando…"
                : pendingAction?.type === "delete"
                ? "Remover"
                : "Resolver"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportCard({
  report,
  onResolve,
  onDelete,
}: {
  report: Report;
  onResolve: () => void;
  onDelete: () => void;
}) {
  const formattedCommentDate = formatDate(report.createdAt);
  const formattedReportDate = formatDate(report.firstReportedAt);

  return (
    <article className="studio-panel overflow-hidden rounded-2xl transition-colors hover:border-white/[0.14]">
      <div className="border-b border-white/[0.07] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Avatar image={report.userImage} name={report.userName} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate text-sm font-semibold text-[var(--color-fg)]">
                  {report.userName}
                </p>

                <span className="studio-mono text-xs text-[var(--color-muted)]">
                  comentou em {report.episodeId}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-[var(--color-subtle)]">
                Comentário criado em {formattedCommentDate}
              </p>
            </div>
          </div>

          <div className="studio-tabular inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/12 px-2.5 py-1 text-xs font-medium text-rose-200">
            <ShieldAlert className="size-3.5 text-rose-400" />
            <span>
              {report.reportCount}{" "}
              {report.reportCount === 1 ? "denúncia" : "denúncias"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="studio-panel-alt rounded-xl p-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-fg)]">
            {report.content}
          </p>
        </div>

        {report.isSpoiler && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
            <AlertTriangle className="size-4 shrink-0 text-amber-400" />
            <span>Este comentário está marcado como spoiler.</span>
          </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Motivos
          </p>

          <div className="flex flex-wrap gap-2">
            {report.reasons.length > 0 ? (
              report.reasons.map((reason) => (
                <span
                  key={reason.value}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[var(--studio-panel-alt)] px-3 py-1.5 text-xs text-[var(--color-fg)]"
                >
                  {reason.value === "spoiler" && (
                    <AlertTriangle className="size-3 text-amber-400" />
                  )}
                  <span>{reason.label}</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--color-subtle)]">
                Motivo não informado
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-[var(--color-subtle)] sm:grid-cols-3">
          <div className="flex items-center gap-1.5 truncate">
            <Film className="size-3.5 shrink-0 text-[var(--color-muted)]" />
            <span className="text-[var(--color-muted)]">Anime:</span>
            <span className="studio-mono truncate text-[var(--color-fg)]">
              {report.animeId}
            </span>
          </div>

          <div className="flex items-center gap-1.5 truncate">
            <MessageCircle className="size-3.5 shrink-0 text-[var(--color-muted)]" />
            <span className="text-[var(--color-muted)]">Episódio:</span>
            <span className="studio-mono truncate text-[var(--color-fg)]">
              {report.episodeId}
            </span>
          </div>

          <div className="flex items-center gap-1.5 truncate">
            <Clock className="size-3.5 shrink-0 text-[var(--color-muted)]" />
            <span className="text-[var(--color-muted)]">
              Primeira denúncia:
            </span>
            <span className="studio-tabular truncate text-[var(--color-fg)]">
              {formattedReportDate}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-white/[0.07] pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onResolve}
            className="h-10 gap-2 border-white/15 bg-[var(--studio-panel-alt)] px-4 text-xs font-medium hover:bg-white/[0.06]"
          >
            <Check className="size-4 text-emerald-400" />
            Resolver
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={onDelete}
            className="h-10 gap-2 bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-500"
          >
            <Trash2 className="size-4" />
            Remover comentário
          </Button>
        </div>
      </div>
    </article>
  );
}

function Avatar({
  image,
  name,
}: {
  image: string | null;
  name: string;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="size-10 shrink-0 rounded-full border border-white/10 object-cover"
      />
    );
  }

  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-[var(--studio-panel-alt)] text-[var(--color-muted)]">
      <User className="size-5" />
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
