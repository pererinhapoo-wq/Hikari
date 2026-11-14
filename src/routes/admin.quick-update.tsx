import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Zap } from "lucide-react";
import { QuickPlayerUpdate } from "@/components/admin/QuickPlayerUpdate";

export const Route = createFileRoute("/admin/quick-update")({
  component: AdminQuickUpdatePage,
});

function AdminQuickUpdatePage() {
  return (
    <div className="studio-enter space-y-6">
      <header className="flex flex-col gap-4 border-b border-white/[0.075] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/admin"
            className="group inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Voltar à Visão Geral</span>
          </Link>

          <div className="mt-3 flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-purple-500/30 bg-purple-500/12 text-purple-300">
              <Zap className="size-5" />
            </div>
            <div>
              <p className="studio-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-purple-400">
                Operação de Episódios
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-fg)] sm:text-3xl">
                Atualização Rápida de Players
              </h1>
            </div>
          </div>

          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
            Substitua ou adicione links de reprodução diretamente em qualquer slot
            (Player 1 a 5) preservando os demais dados do episódio e do catálogo.
          </p>
        </div>
      </header>

      <QuickPlayerUpdate />
    </div>
  );
}
