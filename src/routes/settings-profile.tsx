import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  Camera,
  CircleUserRound,
  Save,
} from "lucide-react";

import {
  useRef,
  useState,
} from "react";

import { updateProfile } from "@/lib/profile.functions";

export const Route = createFileRoute(
  "/settings-profile",
)({
  component: SettingsProfile,
});

function SettingsProfile() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [
    nick,
    setNick,
  ] = useState("");

  const [
    bio,
    setBio,
  ] = useState("");

  const [
    imagePreview,
    setImagePreview,
  ] = useState<string | null>(null);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const handlePhotoClick =
    () => {
      fileInputRef.current?.click();
    };

  const handlePhotoChange =
    (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      const preview =
        URL.createObjectURL(file);

      setImagePreview(preview);
      setMessage(
        "Foto selecionada.",
      );
    };

  const handleSave =
    async () => {
      if (!nick.trim()) {
        setMessage(
          "Digite um nick.",
        );
        return;
      }

      try {
        setSaving(true);
        setMessage("");

        await updateProfile({
          data: {
            nick: nick.trim(),
            bio: bio.trim(),
            favorites: [],
          },
        });

        setMessage(
          "Perfil salvo com sucesso.",
        );
      } catch (error) {
        console.error(error);

        setMessage(
          "Não foi possível salvar o perfil.",
        );
      } finally {
        setSaving(false);
      }
    };

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

                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Prévia da foto de perfil"
                    className="size-full object-cover"
                  />
                ) : (
                  <CircleUserRound className="size-12 text-muted" />
                )}

              </div>

              <button
                type="button"
                onClick={handlePhotoClick}
                className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full border border-border bg-bg text-fg shadow-lg transition-colors hover:bg-elevated"
              >
                <Camera className="size-4" />
              </button>

            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />

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
          value={nick}
          onChange={(event) =>
            setNick(event.target.value)
          }
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
          value={bio}
          onChange={(event) =>
            setBio(event.target.value)
          }
          placeholder="Conte um pouco sobre você..."
          className="w-full resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-fg"
        />

        <p className="mt-2 px-1 text-xs text-muted">
          Sua bio aparecerá no seu perfil público.
        </p>
      </section>

      {/* MENSAGEM */}
      {message && (
        <p className="mb-4 text-center text-sm text-muted">
          {message}
        </p>
      )}

      {/* SALVAR */}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-fg px-4 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Save className="size-4" />

        {saving
          ? "Salvando..."
          : "Salvar alterações"}
      </button>

    </div>
  );
    }
