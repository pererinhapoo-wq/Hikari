import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  Bell,
  ChevronRight,
  CircleUserRound,
  Eye,
  Info,
  Palette,
  Play,
  Shield,
  User,
} from "lucide-react";

export const Route = createFileRoute(
  "/settings",
)({
  component: Settings,
});

const items = [
  {
    title: "Perfil",
    description: "Personalize seu nick, foto e biografia pública.",
    icon: CircleUserRound,
    to: "/settings-profile" as const,
  },
  {
    title: "Conta",
    description: "Gerencie informações da sua conta.",
    icon: User,
    to: "/settings-account" as const,
  },
  {
    title: "Privacidade",
    description: "Controle sua privacidade no Hikari.",
    icon: Eye,
    to: "/settings-privacy" as const,
  },
  {
    title: "Notificações",
    description: "Escolha quais notificações receber.",
    icon: Bell,
    to: "/settings-notifications" as const,
  },
  {
    title: "Player",
    description: "Configure suas preferências de reprodução.",
    icon: Play,
    to: "/settings-player" as const,
  },
  {
    title: "Aparência",
    description: "Personalize a aparência do Hikari.",
    icon: Palette,
    to: "/settings-appearance" as const,
  },
  {
    title: "Segurança",
    description: "Gerencie os dispositivos e sessões da sua conta.",
    icon: Shield,
    to: "/settings-security" as const,
  },
  {
    title: "Sobre",
    description: "Informações sobre o Hikari.",
    icon: Info,
    to: "/settings-about" as const,
  },
];

function Settings() {
  return (
    <div className="min-h-screen pb-20 pt-5">

      {/* CABEÇALHO */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-fg">
          Configurações
        </h1>

        <p className="mt-1 text-sm text-muted">
          Gerencie sua conta e suas preferências.
        </p>
      </div>

      {/* CONFIGURAÇÕES */}
      <div className="overflow-hidden rounded-xl border border-border bg-bg">

        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.title}
              to={item.to}
              className="flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-elevated"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
                <Icon className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">
                  {item.title}
                </p>

                <p className="mt-1 text-xs leading-5 text-muted">
                  {item.description}
                </p>
              </div>

              <ChevronRight className="size-5 shrink-0 text-muted" />
            </Link>
          );
        })}

      </div>

    </div>
  );
}
