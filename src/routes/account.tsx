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
    <main className="mx-auto w-full max-w-6xl px-3 py-5 pb-28 sm:px-5 lg:px-6">
      {/* TÍTULO DA PÁGINA */}
      <header className="mb-4 px-1 sm:mb-5">
        <p className="text-[10px] font-medium tracking-[0.28em] text-muted uppercase">
          HIKARI
        </p>

        <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">
          Perfil
        </h1>
      </header>

      {/* PERFIL COMPLETO */}
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-border)]">
        {/* CAPA */}
        <div className="relative h-36 overflow-hidden sm:h-48 md:h-56">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950" />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(129,140,248,0.45),transparent_32%),radial-gradient(circle_at_85%_70%,rgba(168,85,247,0.42),transparent_42%)]" />

          <div className="absolute inset-0 opacity-25">
            <div className="absolute -right-24 -top-32 size-96 rounded-full border border-white/20" />

            <div className="absolute right-8 -top-24 size-72 rounded-full border border-white/10" />

            <div className="absolute -bottom-52 -left-20 size-[28rem] rounded-full border border-white/10" />
          </div>

          <div className="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] tracking-[0.2em] text-white/70 uppercase backdrop-blur-sm sm:left-6">
            HIKARI PROFILE
          </div>
        </div>

        {/* CABEÇALHO DO USUÁRIO */}
        <div className="relative px-4 pb-5 sm:px-6 sm:pb-6">
          {/* AVATAR */}
          <div className="-mt-11 sm:-mt-14">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt=""
                className="size-22 rounded-full border-4 border-surface bg-surface object-cover shadow-xl sm:size-28"
              />
            ) : (
              <div className="grid size-22 place-items-center rounded-full border-4 border-surface bg-elevated font-display text-3xl shadow-xl sm:size-28 sm:text-4xl">
                {avatarLetter}
              </div>
            )}
          </div>

          {/* IDENTIDADE + AÇÃO */}
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {loadingProfile ? (
                <>
                  <div className="h-8 w-44 animate-pulse rounded-lg bg-elevated" />

                  <div className="mt-2 h-4 w-28 animate-pulse rounded bg-elevated" />
                </>
              ) : (
                <>
                  <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                    {nick || "Defina seu Nick"}
                  </h2>

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
              <div className="shrink-0">
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
              </div>
            )}
          </div>

          {/* E-MAIL DA PRÓPRIA CONTA */}
          {!loadingProfile && (
            <p className="mt-3 truncate text-xs text-subtle">
              {email}
            </p>
          )}

          {/* ESTATÍSTICAS */}
          <div className="mt-6 grid grid-cols-4 overflow-hidden rounded-xl border border-border">
            <div className="min-w-0 border-r border-border px-2 py-3 text-center">
              <MessageCircle className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">
                0
              </p>

              <p className="truncate text-[10px] text-muted sm:text-xs">
                Comentários
              </p>
            </div>

            <div className="min-w-0 border-r border-border px-2 py-3 text-center">
              <Heart className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">
                0
              </p>

              <p className="truncate text-[10px] text-muted sm:text-xs">
                Curtidas
              </p>
            </div>

            <div className="min-w-0 border-r border-border px-2 py-3 text-center">
              <Users className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">
                0
              </p>

              <p className="truncate text-[10px] text-muted sm:text-xs">
                Seguidores
              </p>
            </div>

            <div className="min-w-0 px-2 py-3 text-center">
              <UserPlus className="mx-auto size-4 text-muted" />

              <p className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">
                0
              </p>

              <p className="truncate text-[10px] text-muted sm:text-xs">
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
              className={`relative px-2 py-4 text-xs font-medium transition sm:text-sm ${
                activeTab === "comments"
                  ? "text-fg"
                  : "text-muted hover:text-fg"
              }`}
            >
              Comentários

              {activeTab === "comments" && (
                <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-fg sm:inset-x-8" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("favorites")}
              className={`relative px-2 py-4 text-xs font-medium transition sm:text-sm ${
                activeTab === "favorites"
                  ? "text-fg"
                  : "text-muted hover:text-fg"
              }`}
            >
              Favoritos

              {activeTab === "favorites" && (
                <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-fg sm:inset-x-8" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("about")}
              className={`relative px-2 py-4 text-xs font-medium transition sm:text-sm ${
                activeTab === "about"
                  ? "text-fg"
                  : "text-muted hover:text-fg"
              }`}
            >
              Sobre

              {activeTab === "about" && (
                <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-fg sm:inset-x-8" />
              )}
            </button>
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* CONTEÚDO PRINCIPAL */}
          <div className="min-w-0 p-4 sm:p-6 lg:border-r lg:border-border">
            {activeTab === "comments" && (
              <div>
                <div className="mb-4">
                  <p className="text-sm font-medium">
                    Comentários de Pererinha
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    Suas atividades nos episódios do HIKARI.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-elevated/40 p-6 text-center sm:p-10">
                  <MessageCircle className="mx-auto size-9 text-subtle" />

                  <p className="mt-4 text-sm font-medium">
                    Seus comentários aparecerão aqui
                  </p>

                  <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">
                    Quando você comentar nos episódios do HIKARI,
                    seus comentários poderão aparecer nesta área
                    do seu perfil.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "favorites" && (
              <div>
                <div className="mb-4">
                  <p className="text-sm font-medium">
                    Animes favoritos
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    Os títulos que você escolheu no seu perfil.
                  </p>
                </div>

                {favoriteList.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {favoriteList.map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-border bg-elevated/40 px-4 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <Heart className="size-4 text-muted" />

                          <span className="text-sm">
                            {item}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-elevated/40 p-8 text-center">
                    <Heart className="mx-auto size-8 text-subtle" />

                    <p className="mt-3 text-sm font-medium">
                      Nenhum favorito ainda
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      Adicione seus animes favoritos editando seu
                      perfil.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "about" && (
              <div>
                <div className="mb-5">
                  <p className="text-sm font-medium">
                    Sobre Pererinha
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    Informações públicas do perfil.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-elevated/40 p-4">
                    <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                      Bio
                    </p>

                    <p className="mt-2 text-sm leading-relaxed">
                      {bio || "Nenhuma descrição adicionada ainda."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-elevated/40 p-4">
                    <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                      Minha Lista
                    </p>

                    <p className="mt-2 text-sm">
                      {myList.length} anime
                      {myList.length === 1 ? "" : "s"} na lista.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COLUNA LATERAL */}
          <aside className="border-t border-border p-4 sm:p-6 lg:border-t-0">
            {/* CONTA */}
            <div className="rounded-2xl border border-border bg-elevated/40 p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-surface">
                  <Users className="size-4 text-muted" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Conta aberta
                  </p>

                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    Seu perfil está disponível para outras pessoas.
                  </p>
                </div>
              </div>
            </div>

            {/* SOBRE */}
            <div className="mt-3 rounded-2xl border border-border bg-elevated/40 p-4">
              <p className="text-sm font-medium">
                Sobre
              </p>

              <p className="mt-2 text-xs leading-relaxed text-muted">
                {bio ||
                  "Este usuário ainda não adicionou uma descrição."}
              </p>
            </div>

            {/* SEGUIDORES */}
            <div className="mt-3 rounded-2xl border border-border bg-elevated/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Seguidores
                </p>

                <span className="text-xs text-muted">
                  0
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-full bg-surface">
                  <Users className="size-4 text-muted" />
                </div>

                <p className="text-xs text-muted">
                  Nenhum seguidor ainda.
                </p>
              </div>
            </div>

            {/* SEGUINDO */}
            <div className="mt-3 rounded-2xl border border-border bg-elevated/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Seguindo
                </p>

                <span className="text-xs text-muted">
                  0
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
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

        {/* EDIÇÃO DO PERFIL */}
        {editing && (
          <div className="border-t border-border p-4 sm:p-6">
            <div className="mx-auto max-w-2xl">
              <div className="mb-5">
                <p className="text-sm font-medium">
                  Editar perfil
                </p>

                <p className="mt-1 text-xs text-muted">
                  Altere suas informações públicas do HIKARI.
                </p>
              </div>

              <div className="space-y-4">
                {/* NICK */}
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

                {/* BIO */}
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

                {/* FAVORITOS */}
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

                {/* ERRO */}
                {error && (
                  <div className="rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm text-fg">
                    {error}
                  </div>
                )}

                {/* AÇÕES */}
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
        <section className="mt-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="size-4" />
                Administrador HIKARI
              </div>

              <p className="mt-1 text-xs leading-relaxed text-muted">
                Seu acesso administrativo está liberado.
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

      {/* CONTA */}
      <section className="mt-4 flex flex-wrap items-center gap-2 px-1">
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
