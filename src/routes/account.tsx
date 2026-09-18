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

type ProfileTab = "comments" | "favorites" | "about";

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

  const [activeTab, setActiveTab] =
    useState<ProfileTab>("comments");

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

  const avatarSource =
    nick || user.displayName || "Usuário";

  const avatarLetter = avatarSource
    .charAt(0)
    .toUpperCase();

  const favoriteList = favorites
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

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
    <main className="mx-auto w-full max-w-6xl px-0 pb-28 pt-0 sm:px-4 sm:pt-5">
      {/* PERFIL */}
      <section className="overflow-hidden border-b border-border bg-surface sm:rounded-2xl sm:border sm:shadow-[var(--shadow-border)]">
        {/* CAPA */}
        <div className="relative h-36 overflow-hidden sm:h-48 md:h-52">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-900 to-violet-800" />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(129,140,248,0.55),transparent_30%),radial-gradient(circle_at_85%_65%,rgba(168,85,247,0.55),transparent_40%)]" />

          <div className="absolute -right-20 -top-36 size-[30rem] rounded-full border border-white/10" />

          <div className="absolute right-10 -top-24 size-72 rounded-full border border-white/10" />

          <div className="absolute -bottom-44 left-10 size-80 rounded-full border border-white/10" />
        </div>

        {/* IDENTIDADE */}
        <div className="relative px-5 pb-5 sm:px-7 sm:pb-6">
          {/* AVATAR */}
          <div className="-mt-12 sm:-mt-16">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt=""
                className="size-24 rounded-full border-4 border-surface bg-surface object-cover shadow-xl sm:size-32"
              />
            ) : (
              <div className="grid size-24 place-items-center rounded-full border-4 border-surface bg-elevated font-display text-3xl shadow-xl sm:size-32 sm:text-4xl">
                {avatarLetter}
              </div>
            )}
          </div>

          {/* NOME E BOTÃO */}
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {loadingProfile ? (
                <>
                  <div className="h-8 w-44 animate-pulse rounded-lg bg-elevated" />
                  <div className="mt-2 h-4 w-28 animate-pulse rounded bg-elevated" />
                </>
              ) : (
                <>
                  <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                    {nick || "Defina seu Nick"}
                  </h1>

                  {nick && (
                    <p className="mt-1 text-sm text-muted sm:text-base">
                      @{nick}
                    </p>
                  )}

                  {bio && (
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                      {bio}
                    </p>
                  )}
                </>
              )}
            </div>

            {!loadingProfile && (
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => {
                  setSaved(false);
                  setError("");
                  setEditing(true);
                }}
              >
                <Pencil className="size-4" />
                Editar perfil
              </Button>
            )}
          </div>

          {/* E-MAIL */}
          {!loadingProfile && (
            <p className="mt-3 truncate text-xs text-subtle">
              {email}
            </p>
          )}

          {/* ESTATÍSTICAS */}
          <div className="mt-5 grid grid-cols-4 border-y border-border">
            <div className="border-r border-border py-3 text-center">
              <MessageCircle className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums">
                0
              </p>

              <p className="text-[10px] text-muted sm:text-xs">
                Comentários
              </p>
            </div>

            <div className="border-r border-border py-3 text-center">
              <Heart className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums">
                0
              </p>

              <p className="text-[10px] text-muted sm:text-xs">
                Curtidas
              </p>
            </div>

            <div className="border-r border-border py-3 text-center">
              <Users className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums">
                0
              </p>

              <p className="text-[10px] text-muted sm:text-xs">
                Seguidores
              </p>
            </div>

            <div className="py-3 text-center">
              <UserPlus className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums">
                0
              </p>

              <p className="text-[10px] text-muted sm:text-xs">
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
              className={`relative py-4 text-xs font-medium sm:text-sm ${
                activeTab === "comments"
                  ? "text-fg"
                  : "text-muted"
              }`}
            >
              Comentários

              {activeTab === "comments" && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-fg sm:left-10 sm:right-10" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("favorites")}
              className={`relative py-4 text-xs font-medium sm:text-sm ${
                activeTab === "favorites"
                  ? "text-fg"
                  : "text-muted"
              }`}
            >
              Favoritos

              {activeTab === "favorites" && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-fg sm:left-10 sm:right-10" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("about")}
              className={`relative py-4 text-xs font-medium sm:text-sm ${
                activeTab === "about"
                  ? "text-fg"
                  : "text-muted"
              }`}
            >
              Sobre

              {activeTab === "about" && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-fg sm:left-10 sm:right-10" />
              )}
            </button>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* PRINCIPAL */}
          <div className="min-w-0 p-5 sm:p-7 lg:border-r lg:border-border">
            {activeTab === "comments" && (
              <div>
                <p className="text-base font-medium">
                  Comentários de Pererinha
                </p>

                <p className="mt-1 text-xs text-muted sm:text-sm">
                  Suas atividades nos episódios do HIKARI.
                </p>

                <div className="mt-5 rounded-2xl border border-border bg-elevated/30 px-5 py-10 text-center">
                  <MessageCircle className="mx-auto size-10 text-subtle" />

                  <p className="mt-4 text-sm font-medium">
                    Seus comentários aparecerão aqui
                  </p>

                  <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">
                    Os comentários que você fizer nos episódios do
                    HIKARI poderão aparecer nesta área.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "favorites" && (
              <div>
                <p className="text-base font-medium">
                  Favoritos
                </p>

                <p className="mt-1 text-xs text-muted sm:text-sm">
                  Seus animes favoritos.
                </p>

                {favoriteList.length > 0 ? (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {favoriteList.map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-border bg-elevated/30 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <Heart className="size-4 text-muted" />

                          <span className="text-sm">
                            {item}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-border bg-elevated/30 px-5 py-10 text-center">
                    <Heart className="mx-auto size-9 text-subtle" />

                    <p className="mt-4 text-sm font-medium">
                      Nenhum favorito ainda
                    </p>

                    <p className="mt-2 text-xs text-muted">
                      Edite seu perfil para adicionar animes
                      favoritos.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "about" && (
              <div>
                <p className="text-base font-medium">
                  Sobre Pererinha
                </p>

                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-border bg-elevated/30 p-4">
                    <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                      Bio
                    </p>

                    <p className="mt-2 text-sm leading-relaxed">
                      {bio ||
                        "Este usuário ainda não adicionou uma descrição."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-elevated/30 p-4">
                    <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                      Minha Lista
                    </p>

                    <p className="mt-2 text-sm">
                      {myList.length} anime
                      {myList.length === 1 ? "" : "s"}.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* LATERAL */}
          <aside className="border-t border-border p-5 sm:p-7 lg:border-t-0">
            {/* CONTA ABERTA */}
            <div className="rounded-xl border border-border bg-elevated/30 p-4">
              <p className="text-sm font-medium">
                Conta aberta
              </p>

              <p className="mt-1 text-xs leading-relaxed text-muted">
                Qualquer pessoa poderá seguir este perfil.
              </p>
            </div>

            {/* SOBRE */}
            <div className="mt-3 rounded-xl border border-border bg-elevated/30 p-4">
              <p className="text-sm font-medium">
                Sobre
              </p>

              <p className="mt-2 text-xs leading-relaxed text-muted">
                {bio ||
                  "Este usuário ainda não adicionou uma descrição."}
              </p>
            </div>

            {/* SEGUIDORES */}
            <div className="mt-3 rounded-xl border border-border bg-elevated/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Seguidores
                </p>

                <span className="text-xs text-muted">
                  0
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-surface">
                  <Users className="size-4 text-muted" />
                </div>

                <p className="text-xs text-muted">
                  Nenhum seguidor ainda.
                </p>
              </div>
            </div>

            {/* SEGUINDO */}
            <div className="mt-3 rounded-xl border border-border bg-elevated/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Seguindo
                </p>

                <span className="text-xs text-muted">
                  0
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-surface">
                  <UserPlus className="size-4 text-muted" />
                </div>

                <p className="text-xs text-muted">
                  Você ainda não segue ninguém.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* EDIÇÃO */}
        {editing && (
          <div className="border-t border-border p-5 sm:p-7">
            <div className="mx-auto max-w-2xl">
              <div className="mb-5">
                <p className="text-base font-medium">
                  Editar perfil
                </p>

                <p className="mt-1 text-xs text-muted">
                  Altere suas informações do HIKARI.
                </p>
              </div>

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
                    3 a 30 caracteres. Use apenas letras, números ou
                    _.
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

                <div className="flex flex-wrap gap-2">
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

                  {saved && (
                    <span className="self-center text-xs text-muted">
                      Perfil salvo.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ADMIN */}
      {admin && (
        <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="size-4" />
                Administrador HIKARI
              </div>

              <p className="mt-1 text-xs text-muted">
                Seu acesso ao painel de administração está liberado.
              </p>
            </div>

            <Button asChild>
              <Link to="/admin">
                Abrir Admin
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* AÇÕES DA CONTA */}
      <section className="mt-4 flex flex-wrap gap-2 px-1">
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
