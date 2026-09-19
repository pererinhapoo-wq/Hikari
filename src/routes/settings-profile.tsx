import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  Camera,
  CircleUserRound,
  Save,
} from "lucide-react";

export const Route = createFileRoute(
  "/settings-profile",
)({
  component: SettingsProfile,
});

function SettingsProfile() {
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
            <CircleUserRound className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Perfil
            </h1>

            <p className="mt-1 text-sm text-muted">
              Personalize as informações do seu perfil.
            </p>
          </div>
        </div>
      </div>

      {/* FOTO */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Foto do perfil
        </h2>

        <div className="rounded-xl border border-border bg-bg p-5">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-elevated">
                <CircleUserRound className="size-12 text-muted" />
              </div>

              <button
                type="button"
                className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full border border-border bg-bg text-fg shadow-lg transition-colors hover:bg-elevated"
              >
                <Camera className="size-4" />
              </button>
            </div>

            <p className="mt-3 text-sm text-fg">
              Sua foto de perfil
            </p>

            <p className="mt-1 text-xs text-muted">
              Toque no ícone da câmera para alterar.
            </p>
          </div>
        </div>
      </section>

      {/* NICK */}
      <section className="mb-6">
        <label
          htmlFor="profile-nick"
          className="mb-2 block px-1 text-xs font-semibold uppercase tracking-wider text-muted"
        >
          Nick
        </label>

        <input
          id="profile-nick"
          type="text"
          placeholder="Seu nick"
          className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-fg"
        />

        <p className="mt-2 px-1 text-xs text-muted">
          Esse nome será exibido no seu perfil público.
        </p>
      </section>

      {/* BIO */}
      <section className="mb-7">
        <label
          htmlFor="profile-bio"
          className="mb-2 block px-1 text-xs font-semibold uppercase tracking-wider text-muted"
        >
          Bio
        </label>

        <textarea
          id="profile-bio"
          rows={5}
          placeholder="Conte um pouco sobre você..."
          className="w-full resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-fg"
        />

        <p className="mt-2 px-1 text-xs text-muted">
          Sua bio aparecerá no seu perfil público.
        </p>
      </section>

      {/* SALVAR */}
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-fg px-4 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
      >
        <Save className="size-4" />
        Salvar alterações
      </button>

    </div>
  );
  }
