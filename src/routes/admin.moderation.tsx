import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import {
  Check,
  ChevronLeft,
  MessageCircle,
  Trash2,
  User,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute(
  "/admin/moderation",
)({
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
  const [reports, setReports] =
    useState<Report[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [pendingAction, setPendingAction] =
    useState<{
      type: "resolve" | "delete";
      commentId: string;
    } | null>(null);

  const [processing, setProcessing] =
    useState(false);

  const loadReports =
    useCallback(async () => {
      setLoading(true);

      try {
        const response =
          await fetch(
            "/api/admin/comment-reports",
            {
              method: "GET",
              credentials: "include",
            },
          );

        const data =
          (await response.json()) as {
            reports?: Report[];
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Não foi possível carregar as denúncias.",
          );
        }

        setReports(
          Array.isArray(
            data.reports,
          )
            ? data.reports
            : [],
        );
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
      const response =
        await fetch(
          "/api/admin/comment-reports",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              commentId:
                pendingAction.commentId,
              action:
                pendingAction.type,
            }),
          },
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Não foi possível realizar a ação.",
        );
      }

      if (
        pendingAction.type ===
        "delete"
      ) {
        toast.success(
          "Comentário removido.",
        );
      } else {
        toast.success(
          "Denúncia resolvida.",
        );
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

  return (
    <div className="space-y-8 pt-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/admin/"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
          >
            <ChevronLeft className="size-3.5" />
            Painel
          </Link>

          <p className="mt-4 text-[11px] tracking-[0.28em] text-muted uppercase">
            Administração
          </p>

          <h1 className="mt-1 font-display text-3xl tracking-tight">
            Moderação
          </h1>

          <p className="mt-1 max-w-xl text-sm text-muted">
            Analise os comentários
            denunciados e decida se a
            denúncia deve ser resolvida
            ou se o comentário deve ser
            removido.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void loadReports()
          }
          disabled={loading}
        >
          {loading
            ? "Atualizando…"
            : "Atualizar"}
        </Button>
      </header>

      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated">
            <MessageCircle className="size-5 text-muted" />
          </div>

          <div>
            <p className="text-sm font-medium">
              Denúncias pendentes
            </p>

            <p className="text-xs text-muted">
              {reports.length === 0
                ? "Nenhuma denúncia pendente."
                : reports.length === 1
                  ? "1 comentário aguardando análise."
                  : `${reports.length} comentários aguardando análise.`}
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-4">
          {Array.from(
            { length: 3 },
            (_, index) => (
              <div
                key={index}
                className="h-52 animate-pulse rounded-xl bg-surface shadow-[var(--shadow-border)]"
              />
            ),
          )}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl bg-surface px-5 py-14 text-center shadow-[var(--shadow-border)]">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-elevated">
            <Check className="size-6 text-muted" />
          </div>

          <h2 className="mt-4 font-display text-xl">
            Tudo limpo
          </h2>

          <p className="mt-1 text-sm text-muted">
            Não há comentários
            denunciados aguardando
            análise.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(
            (report) => (
              <ReportCard
                key={
                  report.commentId
                }
                report={report}
                onResolve={() =>
                  setPendingAction({
                    type: "resolve",
                    commentId:
                      report.commentId,
                  })
                }
                onDelete={() =>
                  setPendingAction({
                    type: "delete",
                    commentId:
                      report.commentId,
                  })
                }
              />
            ),
          )}
        </div>
      )}

      <Dialog
        open={
          pendingAction !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !processing
          ) {
            setPendingAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>
            {pendingAction?.type ===
            "delete"
              ? "Remover comentário?"
              : "Resolver denúncia?"}
          </DialogTitle>

          <DialogDescription>
            {pendingAction?.type ===
            "delete"
              ? "O comentário será removido permanentemente. As respostas, curtidas e denúncias relacionadas também serão removidas."
              : "A denúncia será marcada como resolvida e deixará de aparecer nesta lista."}
          </DialogDescription>

          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={processing}
              onClick={() =>
                setPendingAction(
                  null,
                )
              }
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant={
                pendingAction?.type ===
                "delete"
                  ? "danger"
                  : "default"
              }
              disabled={processing}
              onClick={() =>
                void executeAction()
              }
            >
              {processing
                ? "Processando…"
                : pendingAction?.type ===
                    "delete"
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
  const formattedCommentDate =
    formatDate(report.createdAt);

  const formattedReportDate =
    formatDate(
      report.firstReportedAt,
    );

  return (
    <article className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <Avatar
            image={report.userImage}
            name={report.userName}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-medium">
                {report.userName}
              </p>

              <span className="text-xs text-muted">
                comentou em{" "}
                {report.episodeId}
              </span>
            </div>

            <p className="mt-0.5 text-xs text-subtle">
              Comentário criado em{" "}
              {formattedCommentDate}
            </p>
          </div>

          <div className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-xs text-muted">
            {report.reportCount}{" "}
            {report.reportCount ===
            1
              ? "denúncia"
              : "denúncias"}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-lg bg-elevated p-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-6">
            {report.content}
          </p>
        </div>

        {report.isSpoiler && (
          <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
            ⚠️ Este comentário
            está marcado como
            spoiler.
          </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-medium tracking-wider text-muted uppercase">
            Motivos
          </p>

          <div className="flex flex-wrap gap-2">
            {report.reasons.length >
            0 ? (
              report.reasons.map(
                (reason) => (
                  <span
                    key={
                      reason.value
                    }
                    className="rounded-full bg-elevated px-3 py-1.5 text-xs text-muted"
                  >
                    {reason.value ===
                    "spoiler"
                      ? "⚠️ "
                      : ""}
                    {reason.label}
                  </span>
                ),
              )
            ) : (
              <span className="text-xs text-subtle">
                Motivo não
                informado
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-2 text-xs text-subtle sm:grid-cols-3">
          <div>
            <span className="text-muted">
              Anime:
            </span>{" "}
            {report.animeId}
          </div>

          <div>
            <span className="text-muted">
              Episódio:
            </span>{" "}
            {report.episodeId}
          </div>

          <div>
            <span className="text-muted">
              Primeira denúncia:
            </span>{" "}
            {formattedReportDate}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onResolve}
          >
            <Check className="size-4" />
            Resolver
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={onDelete}
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
        alt=""
        className="size-10 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated text-muted">
      <User className="size-5" />
    </div>
  );
}

function formatDate(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
  }
