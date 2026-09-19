import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  ChevronRight,
  LogOut,
  Monitor,
  Shield,
  Smartphone,
} from "lucide-react";

export const Route = createFileRoute(
  "/settings-security",
)({
  component: SettingsSecurity,
});

function SettingsSecurity() {
  return (
    <div className="min-h-screen pb-20 pt-5">

      {/* CABEÇALHO */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="mb-4 inline-flex items-center text-sm text-muted hover:text-fg"
        >
          ← Voltar
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-elevated">
            <Shield className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Segurança
            </h1>

            <p className="mt-1 text-sm text-muted">
              Gerencie os dispositivos e sessões da sua conta.
            </p>
          </div>
        </div>
      </div>

      {/* DISPOSITIVOS */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Dispositivos conectados
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <div className="flex items-center gap-4 border-b border-border px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Smartphone className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Este dispositivo
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Sessão atual do Hikari.
              </p>
            </div>

            <span className="text-xs font-medium text-muted">
              Atual
            </span>
          </div>

          <button
            type="button"
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Monitor className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Sessões ativas
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Veja onde sua conta está conectada.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

      {/* SESSÕES */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Sessão
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <LogOut className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Encerrar outras sessões
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Desconecte sua conta de outros dispositivos.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

    </div>
  );
      }
