import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LogOut,
  Pencil,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { isHikariAdmin } from "@/lib/auth/admin";
import { signOut } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getProfile,
  updateProfile,
} from "@/lib/profile.functions";
import { useHikariStore } from "@/lib/store";

export const Route = createFileRoute("/account")({
  component: Account,
});

function Account() {
  const { user, isPending } = useCurrentUserState();
  const myList = useHikariStore((s) => s.myList);

  const getProfileFn = useServerFn(getProfile);
  const updateProfileFn = useServerFn(updateProfile);

  const [nick, setNick] = useState("");
  const [bio, setBio] = useState("");
  const [favorites, setFavorites] = useState("");
  const [editing, setEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const userId = user?.id;

    if (!userId) return;

    let active = true;

    setLoadingProfile(true);

    void getProfileFn()
      .then((profile) => {
        if (!active) return;

        setNick(profile.nick);
        setBio(profile.bio);
        setFavorites(profile.favorites.join(", "));
        setError("");
      })
      .catch(() => {
        if (!active) return;

        setNick("");
        setBio("");
        setFavorites("");
        setError("Não foi possível carregar seu perfil.");
      })
      .finally(() => {
        if (active) {
          setLoadingProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  if (isPending) return null;

  if (!user) {
    return <RedirectToSignIn to="/login" />;
  }

  const admin = isHikariAdmin(user.primaryEmail);

  const email = user.primaryEmail ?? "";
  const avatarSource = nick || user.displayName || "Usuário";
  const avatarLetter = avatarSource.charAt(0).toUpperCase();

  async function saveProfile() {
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const profile = await updateProfileFn({
        data: {
          nick,
          bio,
          favorites: favorites
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      });

      setNick(profile.nick);
      setBio(profile.bio);
      setFavorites(profile.favorites.join(", "));

      setSaved(true);
      setEditing(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-5 py-6">
      <header className="px-1">
        <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
          Seu perfil
        </p>

        <h1 className="mt-1 font-display text-3xl tracking-tight">
          Meu perfil
        </h1>
      </header>

      <section className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        <div className="p-5">
          <div className="flex items-center gap-4">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt=""
                className="size-20 rounded-full object-cover"
              />
            ) : (
              <div className="grid size-20 shrink-0 place-items-center rounded-full bg-elevated font-display text-2xl">
                {avatarLetter}
              </div>
            )}

            <div className="min-w-0 flex-1">
              {loadingProfile ? (
                <>
                  <div className="h-6 w-32 animate-pulse rounded bg-elevated" />

                  <div className="mt-2 h-4 w-24 animate-pulse rounded bg-elevated" />

                  <div className="mt-2 h-3 w-36 animate-pulse rounded bg-elevated" />
                </>
              ) : (
                <>
                  <p className="truncate text-xl font-medium">
                    {nick || "Defina seu Nick"}
                  </p>

                  {nick && (
                    <p className="truncate text-sm text-muted">
                      @{nick}
                    </p>
                  )}

                  <p className="mt-1 truncate text-xs text-subtle">
                    {email}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-elevated p-3">
              <p className="text-xs text-muted">
                Minha Lista
              </p>

              <p className="mt-1 text-xl font-medium tabular-nums">
                {myList.length}
              </p>
            </div>

            <div className="rounded-xl bg-elevated p-3">
              <p className="text-xs text-muted">
                Favoritos
              </p>

              <p className="mt-1 text-xl font-medium tabular-nums">
                {favorites
                  ? favorites
                      .split(",")
                      .filter((item) => item.trim()).length
                  : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border p-5">
          {loadingProfile ? (
            <div className="space-y-3">
              <div className="h-3 w-20 animate-pulse rounded bg-elevated" />

              <div className="h-16 animate-pulse rounded-xl bg-elevated" />
            </div>
          ) : editing ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted">
                  Nick
                </label>

                <input
                  type="text"
                  value={nick}
                  onChange={(e) => {
                    setNick(e.target.value.toLowerCase());
                    setError("");
                  }}
                  maxLength={30}
                  placeholder="pererinha"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-fg/30"
                />

                <p className="mt-1.5 text-[11px] text-subtle">
                  3 a 30 caracteres. Use apenas letras, números ou _.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted">
                  Bio
                </label>

                <textarea
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value);
                    setError("");
                  }}
                  maxLength={500}
                  rows={4}
                  placeholder="Conte um pouco sobre você..."
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-bg p-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-fg/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted">
                  Animes favoritos
                </label>

                <input
                  type="text"
                  value={favorites}
                  onChange={(e) => {
                    setFavorites(e.target.value);
                    setError("");
                  }}
                  placeholder="One Piece, Naruto, Jujutsu Kaisen..."
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-fg/30"
                />

                <p className="mt-1.5 text-[11px] text-subtle">
                  Separe os títulos por vírgula.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm text-fg">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => void saveProfile()}
                  disabled={saving}
                >
                  <Save className="size-4" />

                  {saving ? "Salvando..." : "Salvar"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError("");
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  <X className="size-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  Bio
                </p>

                <p className="mt-2 text-sm leading-relaxed text-fg">
                  {bio || "Você ainda não adicionou uma bio."}
                </p>
              </div>

              {favorites && (
                <div className="mt-5">
                  <p className="text-xs font-medium tracking-wide text-muted uppercase">
                    Animes favoritos
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {favorites
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-elevated px-3 py-1.5 text-xs text-fg"
                        >
                          {item}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm text-fg">
                  {error}
                </div>
              )}

              <div className="mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSaved(false);
                    setError("");
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-4" />
                  Editar perfil
                </Button>

                {saved && (
                  <span className="ml-3 text-xs text-muted">
                    Perfil salvo.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {admin && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4" />
            Administrador HIKARI
          </div>

          <p className="mt-1 text-sm text-muted">
            Seu acesso ao painel de administração está liberado.
          </p>

          <Button asChild className="mt-4">
            <Link to="/admin">
              Abrir Admin
            </Link>
          </Button>
        </section>
      )}

      <section className="flex flex-wrap gap-2 px-1 pb-24">
        <Button
          type="button"
          variant="outline"
          onClick={() => void signOut("/")}
        >
          <LogOut className="size-4" />
          Sair da conta
        </Button>

        <Button asChild variant="ghost">
          <Link to="/">
            Voltar ao início
          </Link>
        </Button>
      </section>
    </main>
  );
              }
