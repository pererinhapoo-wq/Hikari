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
  Lock,
  MonitorPlay,
  Palette,
  Shield,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute(
  "/settings",
)({
  component: Settings,
});

type SettingItem = {
  icon: typeof UserRound;
  title: string;
  description: string;
  to?: string;
};

const sections: Array<{
  title: string;
  items: SettingItem[];
}> = [
  {
    title: "Conta",
    items: [
      {
        icon: UserRound,
        title: "Conta",
        description:
          "E-mail, senha e gerenciamento da conta",
        to: "/settings-account",
      },
    ],
  },
  {
    title: "Perfil",
    items: [
      {
        icon: CircleUserRound,
        title: "Perfil",
        description:
          "Nome, bio e foto do perfil",
      },
    ],
  },
  {
    title: "Privacidade",
    items: [
      {
        icon: Eye,
        title: "Privacidade",
        description:
          "Visibilidade do perfil, seguidores e usuários bloqueados",
      },
    ],
  },
  {
    title: "Notificações",
    items: [
      {
        icon: Bell,
        title: "Notificações",
        description:
          "Curtidas, respostas e novos seguidores",
      },
    ],
  },
  {
    title: "Player",
    items: [
      {
        icon: MonitorPlay,
        title: "Player",
        description:
          "Reprodução automática, qualidade, legendas e tela cheia",
      },
    ],
  },
  {
    title: "Aparência",
    items: [
      {
        icon: Palette,
        title: "Aparência",
        description:
          "Tema, tamanho da fonte e animações",
      },
    ],
  },
  {
    title: "Segurança",
    items: [
      {
        icon: Shield,
        title: "Segurança",
        description:
          "Dispositivos conectados e sessões ativas",
      },
    ],
  },
  {
    title: "Sobre",
    items: [
      {
        icon: Info,
        title: "Sobre o Hikari",
        description:
          "Termos, privacidade, regras da comunidade e versão",
      },
    ],
  },
];

function Settings() {
  return (
    <div className="min-h-screen pb-20 pt-5">

      {/* CABEÇALHO */}
      <div className="mb-6">
        <Link
          to="/account"
          className="mb-4 inline-flex items-center text-sm text-muted hover:text-fg"
        >
          ← Voltar
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-elevated">
            <Lock className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Configurações
            </h1>

            <p className="mt-1 text-sm text-muted">
              Personalize sua conta e sua experiência no Hikari.
            </p>
          </div>
        </div>
      </div>

      {/* CONFIGURAÇÕES */}
      <div className="space-y-7">

        {sections.map(
          (section) => (
            <section
              key={section.title}
            >
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                {section.title}
              </h2>

              <div className="overflow-hidden rounded-xl border border-border bg-bg">

                {section.items.map(
                  (item) => {
                    const Icon =
                      item.icon;

                    if (item.to) {
                      return (
                        <Link
                          key={
                            item.title
                          }
                          to={
                            item.to
                          }
                          className="flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-elevated"
                        >
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
                            <Icon className="size-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-fg">
                              {
                                item.title
                              }
                            </p>

                            <p className="mt-1 text-xs leading-5 text-muted">
                              {
                                item.description
                              }
                            </p>
                          </div>

                          <ChevronRight className="size-5 shrink-0 text-muted" />
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={
                          item.title
                        }
                        type="button"
                        className="flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-elevated"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
                          <Icon className="size-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg">
                            {
                              item.title
                            }
                          </p>

                          <p className="mt-1 text-xs leading-5 text-muted">
                            {
                              item.description
                            }
                          </p>
                        </div>

                        <ChevronRight className="size-5 shrink-0 text-muted" />
                      </button>
                    );
                  },
                )}

              </div>
            </section>
          ),
        )}

      </div>

      {/* INFORMAÇÃO */}
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-border bg-elevated/50 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-muted" />

        <p className="text-xs leading-5 text-muted">
          As opções de configuração serão adicionadas
          individualmente nesta área.
        </p>
      </div>

      {/* VOLTAR AO PERFIL */}
      <div className="mt-8">
        <Link
          to="/account"
          className="flex w-full items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-medium text-fg transition-colors hover:bg-elevated"
        >
          Voltar para o perfil
        </Link>
      </div>

    </div>
  );
      }
