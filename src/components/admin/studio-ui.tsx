import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Ban, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getBearerToken } from "@/lib/auth/client";
import {
  BAN_DURATION_PRESETS,
  formatBanDateTime,
  resolveBanDuration,
  type ActiveUserBan,
  type BanDurationPreset,
  type CustomDurationUnit,
} from "@/lib/moderation-ban-types";
import { cn } from "@/lib/utils";

interface StudioPageHeaderProps {
  kicker: string;
  title: string;
  description?: string;
  status?: ReactNode;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
  className?: string;
}

/**
 * Cabeçalho editorial padronizado para todos os módulos do Hikari Console.
 */
export function StudioPageHeader({
  kicker,
  title,
  description,
  status,
  actions,
  backTo,
  backLabel = "Voltar ao Painel",
  className,
}: StudioPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 border-b border-[var(--studio-line)] pb-5 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {backTo && (
          <Link
            to={backTo}
            className="group inline-flex h-7 items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--studio-accent)]"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>{backLabel}</span>
          </Link>
        )}

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="studio-kicker">{kicker}</span>
          {status && (
            <>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <div className="text-xs">{status}</div>
            </>
          )}
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="max-w-2xl text-xs leading-relaxed text-slate-600 sm:text-sm">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}

export interface StudioStatItem {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  accent?: "default" | "cobalt" | "violet" | "emerald" | "amber" | "rose";
  href?: string;
}

/**
 * Faixa de métricas unificada com divisórias hairline em superfície clara.
 */
export function StudioStatStrip({
  items,
  columns = 4,
  className,
}: {
  items: StudioStatItem[];
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  }[columns];

  return (
    <div
      className={cn(
        "studio-panel grid overflow-hidden rounded-xl divide-y divide-slate-200 sm:divide-x sm:divide-y-0",
        gridCols,
        className,
      )}
    >
      {items.map((item) => {
        const accentClass =
          item.accent === "cobalt" || item.accent === "violet"
            ? "text-blue-700"
            : item.accent === "emerald"
              ? "text-emerald-700"
              : item.accent === "amber"
                ? "text-amber-700"
                : item.accent === "rose"
                  ? "text-rose-700"
                  : "text-slate-900";

        const content = (
          <div className="flex h-full flex-col justify-between p-4 sm:p-5">
            <span className="studio-label">{item.label}</span>
            <div
              className={cn(
                "studio-tabular mt-2 font-display text-2xl font-bold tracking-tight sm:text-[28px]",
                accentClass,
              )}
            >
              {item.value}
            </div>
            {item.detail && (
              <div className="studio-tabular mt-1.5 text-xs text-slate-500">
                {item.detail}
              </div>
            )}
          </div>
        );

        if (item.href) {
          return (
            <Link
              key={item.label}
              to={item.href}
              className="block transition-colors hover:bg-slate-50"
            >
              {content}
            </Link>
          );
        }

        return <div key={item.label}>{content}</div>;
      })}
    </div>
  );
}

interface StudioPanelProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Painel estrutural único (single-elevation) com cabeçalho hairline em superfície branca.
 */
export function StudioPanel({
  title,
  description,
  icon,
  right,
  children,
  className,
  bodyClassName,
}: StudioPanelProps) {
  return (
    <section className={cn("studio-panel rounded-xl", className)}>
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="truncate font-display text-base font-semibold text-slate-900">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {description}
                </p>
              )}
            </div>
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StudioLoadingState({
  message = "Carregando informações do servidor...",
}: {
  message?: string;
}) {
  return (
    <div className="studio-enter studio-panel flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl p-8 text-center">
      <Loader2 className="size-7 animate-spin text-blue-600" />
      <p className="studio-mono text-xs text-slate-500">{message}</p>
    </div>
  );
}

export function StudioEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="studio-panel flex min-h-[240px] flex-col items-center justify-center rounded-xl p-8 text-center">
      <div className="grid size-12 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-slate-900">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
        {description}
      </p>
      {action && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}

export interface BanModalTargetUser {
  userId: string;
  userName: string;
  userEmail?: string | null;
  userNick?: string | null;
}

interface UserBanModalProps {
  target: BanModalTargetUser | null;
  onClose: () => void;
  onSuccess?: (ban: ActiveUserBan) => void;
}

/**
 * Modal administrativo reutilizável para aplicar banimento temporário de comentários.
 * Suporta durações predefinidas (20m..30d) e duração personalizada + motivo obrigatório.
 */
export function UserBanModal({ target, onClose, onSuccess }: UserBanModalProps) {
  const [preset, setPreset] = useState<BanDurationPreset>("1h");
  const [customAmount, setCustomAmount] = useState("4");
  const [customUnit, setCustomUnit] = useState<CustomDurationUnit>("hours");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (target) {
      setPreset("1h");
      setCustomAmount("4");
      setCustomUnit("hours");
      setReason("");
    }
  }, [target]);

  let previewLabel = "";
  let previewExpires = "";
  let durationValid = true;
  let durationError = "";

  try {
    const resolved = resolveBanDuration({
      preset,
      customAmount: preset === "custom" ? customAmount : undefined,
      customUnit: preset === "custom" ? customUnit : undefined,
    });
    previewLabel = resolved.durationLabel;
    previewExpires = formatBanDateTime(Date.now() + resolved.durationMs);
  } catch (err) {
    durationValid = false;
    durationError =
      err instanceof Error ? err.message : "Duração informada é inválida.";
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || submitting) return;

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      toast.error("Informe um motivo claro com pelo menos 3 caracteres.");
      return;
    }
    if (!durationValid) {
      toast.error(durationError || "Duração inválida.");
      return;
    }

    setSubmitting(true);
    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/bans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          userId: target.userId,
          preset,
          customAmount: preset === "custom" ? Number(customAmount) : undefined,
          customUnit: preset === "custom" ? customUnit : undefined,
          reason: trimmedReason,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        ban?: ActiveUserBan;
        message?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.ban) {
        throw new Error(
          data?.error || "Não foi possível aplicar o banimento temporário.",
        );
      }

      toast.success(
        data.message ||
          `Usuário suspenso de comentar por ${data.ban.durationLabel}.`,
      );
      onSuccess?.(data.ban);
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao aplicar banimento temporário.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !submitting) {
          onClose();
        }
      }}
    >
      <DialogContent className="hikari-studio-dialog max-h-[90dvh] overflow-y-auto border border-slate-200 bg-white text-slate-900 shadow-2xl sm:max-w-lg">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600">
            <Ban className="size-5" />
          </div>
          <div className="min-w-0 pr-6">
            <DialogTitle className="font-display text-lg font-bold text-slate-900">
              Suspender Usuário Temporariamente
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-relaxed text-slate-600">
              Bloqueia o envio de comentários, respostas, curtidas, denúncias e
              anexos até o fim do prazo definido.
            </DialogDescription>
          </div>
        </div>

        {target && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
              <p className="font-semibold text-slate-900">{target.userName}</p>
              <p className="studio-mono mt-0.5 truncate text-[11px] text-slate-500">
                {target.userNick ? `@${target.userNick} · ` : ""}
                {target.userEmail || target.userId}
              </p>
            </div>

            <div className="space-y-2">
              <label className="studio-label block">
                Duração da Suspensão
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {BAN_DURATION_PRESETS.map((opt) => {
                  const selected = preset === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPreset(opt.value)}
                      className={cn(
                        "h-9 rounded-lg border px-2 text-xs font-semibold transition-colors",
                        selected
                          ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      {opt.shortLabel}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPreset("custom")}
                  className={cn(
                    "h-9 rounded-lg border px-2 text-xs font-semibold transition-colors",
                    preset === "custom"
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  Custom
                </button>
              </div>

              {preset === "custom" && (
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Quantidade
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="studio-input studio-tabular h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Unidade
                    </label>
                    <select
                      value={customUnit}
                      onChange={(e) =>
                        setCustomUnit(e.target.value as CustomDurationUnit)
                      }
                      className="studio-input h-9 w-full rounded-md px-2.5 text-xs"
                    >
                      <option value="minutes">Minuto(s)</option>
                      <option value="hours">Hora(s)</option>
                      <option value="days">Dia(s)</option>
                    </select>
                  </div>
                </div>
              )}

              {durationValid ? (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Clock className="size-3.5 text-blue-600" />
                  <span>
                    Duração:{" "}
                    <strong className="text-slate-900">{previewLabel}</strong> ·
                    Expira em{" "}
                    <strong className="studio-tabular text-slate-900">
                      {previewExpires}
                    </strong>
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-medium text-rose-600">
                  {durationError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ban-reason-input"
                className="studio-label block"
              >
                Motivo do Banimento (obrigatório)
              </label>
              <Textarea
                id="ban-reason-input"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: Spam repetitivo ou spoilers sem marcação nos comentários..."
                className="studio-input min-h-20 resize-none text-xs leading-relaxed"
              />
              <p className="text-[11px] text-slate-500">
                Este motivo ficará visível para o usuário bloqueado e no
                histórico de moderação.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={onClose}
                className="h-9 border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || !durationValid || reason.trim().length < 3}
                className="h-9 bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Aplicando…
                  </>
                ) : (
                  <>
                    <Ban className="mr-1.5 size-3.5" />
                    Aplicar Banimento
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
