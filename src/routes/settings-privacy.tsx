import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  Ban,
  ChevronRight,
  Eye,
  Lock,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

export const Route = createFileRoute(
  "/settings-privacy",
)({
  component: SettingsPrivacy,
});

function SettingsPrivacy() {
  const [
    publicProfile,
    setPublicProfile,
  ] = useState(true);

  const [
    followersOpen,
    setFollowersOpen,
  ] = useState(false);

  const [
    blockedOpen,
    setBlockedOpen,
  ] = useState(false);

  const [
    followers,
    setFollowers,
  ] = useState("Todos");

  useEffect(() => {
    const savedPublicProfile =
      localStorage.getItem(
        "hikari-public-profile",
      );

    if (savedPublicProfile === "true") {
      setPublicProfile(true);
    }

    if (savedPublicProfile === "false") {
      setPublicProfile(false);
    }

    const savedFollowers =
      localStorage.getItem(
        "hikari-followers",
      );

    if (savedFollowers) {
      setFollowers(savedFollowers);
    }
  }, []);

  function handlePublicProfileToggle() {
    setPublicProfile((current) => {
      const next = !current;

      localStorage.setItem(
        "hikari-public-profile",
        String(next),
      );

      return next;
    });
  }

  function handleFollowersChange(
    option: string,
  ) {
    setFollowers(option);

    localStorage.setItem(
      "hikari-followers",
      option,
    );

    setFollowersOpen(false);
  }

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
            <Lock className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Privacidade
            </h1>

            <p className="mt-1 text-sm text-muted">
              Controle quem pode acessar e interagir com seu perfil.
            </p>
          </div>
        </div>
      </div>

      {/* VISIBILIDADE */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Visibilidade
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            onClick={
              handlePublicProfileToggle
            }
            className="flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Eye className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Perfil público
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Permitir que outras pessoas encontrem e vejam seu perfil.
              </p>
            </div>

            <div
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                publicProfile
                  ? "bg-green-500"
                  : "bg-elevated"
              }`}
            >
              <span
                className={`absolute top-1 size-4 rounded-full transition-transform ${
                  publicProfile
                    ? "translate-x-6 bg-white"
                    : "translate-x-1 bg-muted"
                }`}
              />
            </div>
          </button>

        </div>
      </section>

      {/* SEGUIDORES */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Seguidores
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            onClick={() =>
              setFollowersOpen(true)
            }
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Users className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Quem pode me seguir
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                {followers}
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

      {/* BLOQUEADOS */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Usuários bloqueados
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            onClick={() =>
              setBlockedOpen(true)
            }
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Ban className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Usuários bloqueados
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Gerencie as pessoas que você bloqueou.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

      {/* MODAL — SEGUIDORES */}
      {followersOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl">

            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-elevated">
                <Users className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-semibold text-fg">
                  Quem pode me seguir
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFollowersOpen(false)
                }
                className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-2">

              {[
                "Todos",
                "Somente pessoas que você aprovar",
                "Ninguém",
              ].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    handleFollowersChange(
                      option,
                    )
                  }
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-bg px-4 py-4 text-left hover:bg-elevated"
                >
                  <span className="text-sm text-fg">
                    {option}
                  </span>

                  {followers === option && (
                    <span className="text-sm font-semibold text-green-500">
                      ✓
                    </span>
                  )}
                </button>
              ))}

            </div>

          </div>
        </div>
      )}

      {/* MODAL — BLOQUEADOS */}
      {blockedOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl">

            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-elevated">
                <Ban className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-semibold text-fg">
                  Usuários bloqueados
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setBlockedOpen(false)
                }
                className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-bg p-5 text-center">

              <Ban className="mx-auto size-8 text-muted" />

              <p className="mt-3 text-sm font-medium text-fg">
                Nenhum usuário bloqueado
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Os usuários que você bloquear aparecerão aqui.
              </p>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}