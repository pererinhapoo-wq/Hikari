import {
  createFileRoute,
} from "@tanstack/react-router";

import {
  Bell,
  ChevronRight,
  Eye,
  Palette,
  Play,
  Shield,
  User,
  UserCircle,
  Info,
} from "lucide-react";

export const Route = createFileRoute(
  "/settings",
)({
  component: Settings,
});

const items = [
  {
    title: "Conta",
    description: "Gerencie informações da sua conta.",
    icon: User,
    href: "https://grokhikari.vercel.app/settings-account",
  },
  {
    title: "Perfil",
    description: "Altere suas informações públicas.",
    icon: UserCircle,
    href: "https://grokhikari.vercel.app/settings-profile",
  },
  {
    title: "Privacidade",
    description: "Controle sua privacidade no Hikari.",
    icon: Eye,
    href: "https://grokhikari.vercel.app/settings-privacy",
  },
  {
    title: "Notificações",
    description: "Escolha quais notificações receber.",
    icon: Bell,
    href: "https://grokhikari.vercel.app/settings-notifications",
  },
  {
    title: "Player",
    description: "Configure suas preferências de reprodução.",
    icon: Play,
    href: "https://grokhikari.vercel.app/settings-player",
  },
  {
    title: "Aparência",
    description: "Personalize a aparência do Hikari.",
    icon: Palette,
    href: "https://grokhikari.vercel.app/settings-appearance",
  },
  {
    title: "Segurança",
    description: "Gerencie os dispositivos e sessões da sua conta.",
    icon: Shield,
    href: "https://grokhikari.vercel.app/settings-security",
  },
  {
    title: "Sobre",
    description: "Informações sobre o Hikari.",
    icon: Info,
    href: "https://grokhikari.vercel.app/settings-about",
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
            <a
              key={item.title}
              href={item.href}
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
            </a>
          );
        })}

      </div>

    </div>
  );
  }
