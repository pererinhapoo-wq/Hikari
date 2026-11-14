import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
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
 * Cabeçalho editorial padronizado para todos os módulos do Hikari Studio.
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
        "flex flex-col gap-5 border-b border-[var(--studio-line)] pb-6 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {backTo && (
          <Link
            to={backTo}
            className="group inline-flex h-8 items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>{backLabel}</span>
          </Link>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="studio-kicker">{kicker}</span>
          {status && (
            <>
              <span className="text-white/20" aria-hidden="true">
                ·
              </span>
              <div className="text-xs">{status}</div>
            </>
          )}
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-fg)] sm:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="max-w-2xl text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      )}
    </header>
  );
}

interface StudioStatItem {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  accent?: "default" | "violet" | "emerald" | "amber" | "rose";
  href?: string;
}

/**
 * Faixa de métricas unificada com divisórias hairline (sem caixas aninhadas).
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
        "studio-panel grid overflow-hidden rounded-xl divide-y divide-[var(--studio-line)] sm:divide-x sm:divide-y-0",
        gridCols,
        className,
      )}
    >
      {items.map((item) => {
        const accentClass =
          item.accent === "violet"
            ? "text-violet-300"
            : item.accent === "emerald"
              ? "text-emerald-400"
              : item.accent === "amber"
                ? "text-amber-300"
                : item.accent === "rose"
                  ? "text-rose-400"
                  : "text-[var(--color-fg)]";

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
              <div className="studio-tabular mt-1.5 text-xs text-[var(--color-muted)]">
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
              className="block transition-colors hover:bg-white/[0.025]"
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
 * Painel estrutural único (single-elevation) com cabeçalho hairline opcional.
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--studio-line)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-violet-300">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="truncate font-display text-base font-semibold text-[var(--color-fg)]">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
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
    <div className="studio-enter studio-panel flex min-h-[340px] flex-col items-center justify-center gap-3 rounded-xl p-8 text-center">
      <Loader2 className="size-7 animate-spin text-violet-400" />
      <p className="studio-mono text-xs text-[var(--color-muted)]">{message}</p>
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
    <div className="studio-panel flex min-h-[260px] flex-col items-center justify-center rounded-xl p-8 text-center">
      <div className="grid size-12 place-items-center rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-[var(--color-muted)]">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-[var(--color-fg)]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--color-muted)]">
        {description}
      </p>
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
