import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Heart,
  LogOut,
  MessageCircle,
  Pencil,
  Save,
  ShieldCheck,
  UserPlus,
  Users,
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
  const [activeTab, setActiveTab] = useState<
    "comments" | "favorites" | "about"
  >("comments");

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

  const favoriteCount = favorites
    ? favorites
        .split(",")
        .filter((item) => item.trim()).length
    : 0;

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
    <main className="mx-auto max-w-2xl space-y-5 py-6">
      <header className="px-1">
        <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
          Seu perfil
        </p>

        <h1 className="mt-1 font-display text-3xl tracking-tight">
          Perfil
        </h1>
      </header>

      {/* PERFIL */}
      <section className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        {/* CAPA */}
        <div className="relative h-40 overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 sm:h-48">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(129,140,248,0.38),transparent_32%),radial-gradient(circle_at_82%_75%,rgba(168,85,247,0.34),transparent_40%)]" />

          <div className="absolute inset-0 opacity-20">
            <div className="absolute -right-10 -top-28 size-72 rounded-full border border-white/20" />

            <div className="absolute -right-2 -top-20 size-56 rounded-full border border-white/10" />

            <div className="absolute -bottom-36 -left-20 size-80 rounded-full border border-white/10" />
          </div>
        </div>

        {/* IDENTIDADE */}
        <div className="relative px-5 pb-5 sm:px-6">
          {/* AVATAR */}
          <div className="-mt-11">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt=""
                className="size-22 rounded-full border-4 border-surface bg-surface object-cover shadow-xl"
              />
            ) : (
              <div className="grid size-22 place-items-center rounded-full border-4 border-surface bg-elevated font-display text-3xl shadow-xl">
                {avatarLetter}
              </div>
            )}
          </div>

          {/* NOME */}
          <div className="mt-3">
            {loadingProfile ? (
              <>
                <div className="h-8 w-40 animate-pulse rounded-lg bg-elevated" />

                <div className="mt-2 h-4 w-28 animate-pulse rounded bg-elevated" />
              </>
            ) : (
              <>
                <h2 className="truncate text-2xl font-semibold tracking-tight">
                  {nick || "Defina seu Nick"}
                </h2>

                {nick && (
                  <p className="mt-0.5 text-sm text-muted">
                    @{nick}
                  </p>
                )}
              </>
            )}
          </div>

          {/* BOTÃO */}
          {!loadingProfile && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
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
                <span className="text-xs text-muted">
                  Perfil salvo.
                </span>
              )}
            </div>
          )}

          {/* EMAIL - PRIVADO DO PRÓPRIO PERFIL */}
          {!loadingProfile && (
            <p className="mt-3 truncate text-xs text-subtle">
              {email}
            </p>
          )}

          {/* ESTATÍSTICAS */}
          <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-border sm:grid-cols-4">
            <div className="border-b border-border p-3 text-center sm:border-b-0 sm:border-r">
              <MessageCircle className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums">
                0
              </p>

              <p className="text-[11px] text-muted">
                Comentários
              </p>
            </div>

            <div className="border-b border-border p-3 text-center sm:border-b-0 sm:border-r">
              <Heart className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums">
                0
              </p>

              <p className="text-[11px] text-muted">
                Curtidas
              </p>
            </div>

            <div className="border-border p-3 text-center sm:border-r">
              <Users className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums">
                0
              </p>

              <p className="text-[11px] text-muted">
                Seguidores
              </p>
            </div>

            <div className="border-t border-border p-3 text-center sm:border-t-0">
              <UserPlus className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums">
                0
              </p>

              <p className="text-[11px] text-muted">
                Seguindo
              </p>
            </div>
          </div>
        </div>

        {/* ABAS */}
        <div className="border-t border-border">
          <div className="grid grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveTab("comments")}
              className={`relative px-3 py-4 text-sm font-medium transition ${
                activeTab === "comments"
                  ? "text-fg"
                  : "text-muted hover:text-fg"
              }`}
            >
              Comentários

              {activeTab === "comments" && (
                <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-fg" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("favorites")}
              className={`relative px-3 py-4 text-sm font-medium transition ${
                activeTab === "favorites"
                  ? "text-fg"
                  : "text-muted hover:text-fg"
              }`}
            >
              Favoritos

              {activeTab === "favorites" && (
                <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-fg" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("about")}
              className={`relative px-3 py-4 text-sm font-medium transition ${
                activeTab === "about"
                  ? "text-fg"
                  : "text-muted hover:text-fg"
              }`}
            >
              Sobre

              {activeTab === "about" && (
                <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-fg" />
              )}
            </button>
          </div>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="min-h-44 border-t border-border p-5 sm:p-6">
          {activeTab === "comments" && (
            <div className="flex min-h-32 flex-col items-center justify-center text-center">
              <MessageCircle className="size-7 text-subtle" />

              <p className="mt-3 text-sm font-medium">
                Seus comentários aparecerão aqui
              </p>

              <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">
                Os comentários que você fizer nos episódios do HIKARI
                poderão aparecer nesta área.
              </p>
            </div>
          )}

          {activeTab === "favorites" && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted uppercase">
                    Animes favoritos
                  </p>

                  <p className="mt-1 text-xs text-subtle">
                    {favoriteCount} favorito
                    {favoriteCount === 1 ? "" : "s"}
                  </p>
                </div>

                <Heart className="size-5 text-muted" />
              </div>

              {favorites ? (
                <div className="mt-4 flex flex-wrap gap-2">
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
              ) : (
                <p className="mt-5 text-sm text-muted">
                  Você ainda não adicionou animes favoritos.
                </p>
              )}
            </div>
          )}

          {activeTab === "about" && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  Bio
                </p>

                <p className="mt-2 text-sm leading-relaxed text-fg">
                  {bio || "Você ainda não adicionou uma bio."}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  Minha Lista
                </p>

                <p className="mt-2 text-sm text-fg">
                  {myList.length} anime
                  {myList.length === 1 ? "" : "s"} na sua lista.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* EDIÇÃO */}
        {editing && (
          <div className="border-t border-border p-5 sm:p-6">
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
          </div>
        )}
      </section>

      {/* ADMINISTRADOR */}
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

      {/* CONTA */}
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
