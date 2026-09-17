import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LogOut,
  Pencil,
  Save,
  ShieldCheck,
  UserCircle,
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

  const [bio, setBio] = useState("");
  const [favorites, setFavorites] = useState("");
  const [editing, setEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;

    let active = true;

    void getProfileFn()
      .then((profile) => {
        if (!active) return;

        setBio(profile.bio);
        setFavorites(profile.favorites.join(", "));
      })
      .catch(() => {
        if (!active) return;

        setBio("");
        setFavorites("");
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  if (isPending) return null;

  if (!user) {
    return <RedirectToSignIn to="/login" />;
  }

  const admin = isHikariAdmin(user.primaryEmail);

  const displayName = user.displayName ?? "Usuário";
  const email = user.primaryEmail ?? "";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  async function saveProfile() {
    setSaving(true);
    setSaved(false);

    try {
      await updateProfileFn({
        data: {
          bio,
          favorites: favorites
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      });

      setSaved(true);
      setEditing(false);
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
          Minha conta
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
              <p className="truncate text-xl font-medium">
                {displayName}
              </p>

              <p className="truncate text-sm text-muted">
                {email}
              </p>

              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
                <UserCircle className="size-3.5" />
                Perfil HIKARI
              </div>
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
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-elevated" />

              <div className="h-16 animate-pulse rounded-xl bg-elevated" />
            </div>
          ) : editing ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted">
                  Bio
                </label>

                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
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
                  value={favorites}
                  onChange={(e) => setFavorites(e.target.value)}
                  placeholder="One Piece, Naruto, Jujutsu Kaisen..."
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-fg/30"
                />

                <p className="mt-1.5 text-[11px] text-subtle">
                  Separe os títulos por vírgula.
                </p>
              </div>

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
                  onClick={() => setEditing(false)}
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

              <div className="mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSaved(false);
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

      <section className="flex flex-wrap gap-2 px-1">
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
