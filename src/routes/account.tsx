import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Bookmark,
  CalendarDays,
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
  const [activeTab, setActiveTab] =
    useState<ProfileTab>("comments");

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

  const avatarSource =
    nick || user.displayName || "Usuário";

  const avatarLetter = avatarSource
    .charAt(0)
    .toUpperCase();

  const favoriteItems = favorites
    ? favorites
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

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
    <main className="min-h-screen bg-bg pb-24 text-fg">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 lg:px-6 lg:py-8">

        {/* PERFIL */}
        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-border)]">

          {/* CAPA */}
          <div className="relative h-40 overflow-hidden sm:h-48 lg:h-56">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(88,80,190,0.95),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(133,45,210,0.9),transparent_48%),linear-gradient(135deg,#1d1744,#4d137d,#24103d)]" />

            <div className="absolute -right-20 -top-32 size-80 rounded-full border border-white/5" />
            <div className="absolute right-10 -top-20 size-64 rounded-full border border-white/5" />
            <div className="absolute -left-24 bottom-[-180px] size-96 rounded-full border border-white/5" />

            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/5" />
          </div>

          {/* IDENTIDADE */}
          <div className="relative px-5 pb-6 sm:px-7 lg:px-9">

            {/* AVATAR */}
            <div className="-mt-16 sm:-mt-20">
              {user.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt=""
                  className="size-28 rounded-full border-4 border-surface object-cover shadow-xl sm:size-32 lg:size-36"
                />
              ) : (
                <div className="grid size-28 place-items-center rounded-full border-4 border-surface bg-elevated font-sans text-4xl font-semibold shadow-xl sm:size-32 lg:size-36">
                  {avatarLetter}
                </div>
              )}
            </div>

            {/* NOME + BOTÃO */}
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

              <div className="min-w-0">
                {loadingProfile ? (
                  <>
                    <div className="h-8 w-40 animate-pulse rounded bg-elevated" />
                    <div className="mt-2 h-5 w-28 animate-pulse rounded bg-elevated" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h1 className="font-sans text-2xl font-bold tracking-tight sm:text-3xl">
                        {nick || "Defina seu Nick"}
                      </h1>

                      {nick && (
                        <BadgeCheck className="size-5 shrink-0 fill-current" />
                      )}
                    </div>

                    {nick && (
                      <p className="mt-1 font-sans text-sm text-muted sm:text-base">
                        @{nick}
                      </p>
                    )}
                  </>
                )}

                {!loadingProfile && bio && (
                  <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted">
                    {bio}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSaved(false);
                  setError("");
                  setEditing(true);
                }}
                className="w-fit shrink-0 rounded-xl"
              >
                <Pencil className="size-4" />
                Editar perfil
              </Button>
            </div>

            {/* INFORMAÇÕES DA CONTA */}
            <div className="mt-4">
              <p className="font-sans text-xs text-subtle">
                {email}
              </p>

              <div className="mt-2 flex items-center gap-2 font-sans text-xs text-subtle">
                <CalendarDays className="size-3.5" />
                <span>Membro da comunidade HIKARI</span>
              </div>
            </div>

            {/* ESTATÍSTICAS */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-border">
              <div className="grid grid-cols-2 sm:grid-cols-4">

                <div className="flex flex-col items-center justify-center border-b border-border px-3 py-4 sm:border-b-0 sm:border-r">
                  <MessageCircle className="size-5 text-muted" />

                  <strong className="mt-2 font-sans text-xl font-semibold">
                    0
                  </strong>

                  <span className="mt-0.5 font-sans text-xs text-muted">
                    Comentários
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center border-b border-border px-3 py-4 sm:border-b-0 sm:border-r">
                  <Heart className="size-5 text-muted" />

                  <strong className="mt-2 font-sans text-xl font-semibold">
                    0
                  </strong>

                  <span className="mt-0.5 font-sans text-xs text-muted">
                    Curtidas
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center border-r border-border px-3 py-4">
                  <Users className="size-5 text-muted" />

                  <strong className="mt-2 font-sans text-xl font-semibold">
                    0
                  </strong>

                  <span className="mt-0.5 font-sans text-xs text-muted">
                    Seguidores
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center px-3 py-4">
                  <UserPlus className="size-5 text-muted" />

                  <strong className="mt-2 font-sans text-xl font-semibold">
                    0
                  </strong>

                  <span className="mt-0.5 font-sans text-xs text-muted">
                    Seguindo
                  </span>
                </div>

              </div>
            </div>
          </div>

          {/* ABAS */}
          <div className="border-t border-border">

            <div className="grid grid-cols-3">

              <button
                type="button"
                onClick={() => setActiveTab("comments")}
                className={`relative px-3 py-4 font-sans text-sm font-medium transition ${
                  activeTab === "comments"
                    ? "text-fg"
                    : "text-muted hover:text-fg"
                }`}
              >
                Comentários

                {activeTab === "comments" && (
                  <span className="absolute inset-x-0 bottom-0 mx-auto h-0.5 max-w-32 rounded-full bg-fg" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("favorites")}
                className={`relative px-3 py-4 font-sans text-sm font-medium transition ${
                  activeTab === "favorites"
                    ? "text-fg"
                    : "text-muted hover:text-fg"
                }`}
              >
                Favoritos

                {activeTab === "favorites" && (
                  <span className="absolute inset-x-0 bottom-0 mx-auto h-0.5 max-w-32 rounded-full bg-fg" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("about")}
                className={`relative px-3 py-4 font-sans text-sm font-medium transition ${
                  activeTab === "about"
                    ? "text-fg"
                    : "text-muted hover:text-fg"
                }`}
              >
                Sobre

                {activeTab === "about" && (
                  <span className="absolute inset-x-0 bottom-0 mx-auto h-0.5 max-w-32 rounded-full bg-fg" />
                )}
              </button>

            </div>
          </div>

          {/* CONTEÚDO DAS ABAS */}
          <div className="p-5 sm:p-7 lg:p-9">

            {/* COMENTÁRIOS */}
            {activeTab === "comments" && (
              <div>

                <div>
                  <h2 className="font-sans text-lg font-semibold">
                    Comentários de {nick || "pererinha"}
                  </h2>

                  <p className="mt-1 font-sans text-sm text-muted">
                    Suas atividades nos episódios do HIKARI.
                  </p>
                </div>

                <div className="mt-5 rounded-2xl border border-border bg-bg p-8 text-center sm:p-12">

                  <MessageCircle className="mx-auto size-12 text-muted/70" />

                  <h3 className="mt-4 font-sans text-base font-semibold">
                    Seus comentários aparecerão aqui
                  </h3>

                  <p className="mx-auto mt-2 max-w-md font-sans text-sm leading-relaxed text-muted">
                    Os comentários que você fizer nos episódios
                    do HIKARI poderão aparecer nesta área.
                  </p>

                </div>
              </div>
            )}

            {/* FAVORITOS */}
            {activeTab === "favorites" && (
              <div>

                <div>
                  <h2 className="font-sans text-lg font-semibold">
                    Animes favoritos
                  </h2>

                  <p className="mt-1 font-sans text-sm text-muted">
                    Títulos que fazem parte dos seus favoritos.
                  </p>
                </div>

                {favoriteItems.length > 0 ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {favoriteItems.map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 rounded-xl border border-border bg-bg p-4"
                      >
                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated">
                          <Heart className="size-4" />
                        </div>

                        <span className="font-sans text-sm font-medium">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-border bg-bg p-8 text-center sm:p-12">

                    <Heart className="mx-auto size-12 text-muted/70" />

                    <h3 className="mt-4 font-sans text-base font-semibold">
                      Nenhum favorito ainda
                    </h3>

                    <p className="mx-auto mt-2 max-w-md font-sans text-sm leading-relaxed text-muted">
                      Seus animes favoritos aparecerão aqui.
                    </p>

                  </div>
                )}
              </div>
            )}

            {/* SOBRE */}
            {activeTab === "about" && (
              <div>

                <div>
                  <h2 className="font-sans text-lg font-semibold">
                    Sobre {nick || "pererinha"}
                  </h2>

                  <p className="mt-1 font-sans text-sm text-muted">
                    Informações públicas do perfil.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">

                  <div className="rounded-2xl border border-border bg-bg p-5">
                    <h3 className="font-sans text-sm font-semibold">
                      Bio
                    </h3>

                    <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
                      {bio ||
                        "Este usuário ainda não adicionou uma descrição."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-bg p-5">
                    <h3 className="font-sans text-sm font-semibold">
                      Informações
                    </h3>

                    <div className="mt-4 space-y-3">

                      <div className="flex items-center gap-3">
                        <Users className="size-4 text-muted" />

                        <span className="font-sans text-sm text-muted">
                          0 seguidores
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <UserPlus className="size-4 text-muted" />

                        <span className="font-sans text-sm text-muted">
                          0 seguindo
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Bookmark className="size-4 text-muted" />

                        <span className="font-sans text-sm text-muted">
                          {myList.length} animes na lista
                        </span>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </section>

        {/* RESUMO DA CONTA */}
        <section className="mt-5 grid gap-4 lg:grid-cols-2">

          <div className="rounded-2xl border border-border bg-surface p-5">

            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-elevated">
                <Users className="size-5" />
              </div>

              <div>
                <h2 className="font-sans text-sm font-semibold">
                  Conta aberta
                </h2>

                <p className="mt-1 font-sans text-xs text-muted">
                  Outros usuários poderão seguir você.
                </p>
              </div>
            </div>

          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">

            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-elevated">
                <Bookmark className="size-5" />
              </div>

              <div>
                <h2 className="font-sans text-sm font-semibold">
                  Minha Lista
                </h2>

                <p className="mt-1 font-sans text-xs text-muted">
                  {myList.length} animes adicionados à sua lista.
                </p>
              </div>
            </div>

          </div>

        </section>

        {/* EDITAR PERFIL */}
        {editing && (
          <section className="mt-5 rounded-2xl border border-border bg-surface p-5 sm:p-7">

            <div>
              <h2 className="font-sans text-lg font-semibold">
                Editar perfil
              </h2>

              <p className="mt-1 font-sans text-sm text-muted">
                Altere as informações públicas do seu perfil.
              </p>
            </div>

            <div className="mt-6 space-y-5">

              <div>
                <label className="font-sans text-xs font-medium text-muted">
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
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-bg px-3 font-sans text-sm text-fg outline-none placeholder:text-subtle focus:border-fg/30"
                />

                <p className="mt-1.5 font-sans text-[11px] text-subtle">
                  3 a 30 caracteres. Use apenas letras, números ou _.
                </p>
              </div>

              <div>
                <label className="font-sans text-xs font-medium text-muted">
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
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-bg p-3 font-sans text-sm text-fg outline-none placeholder:text-subtle focus:border-fg/30"
                />
              </div>

              <div>
                <label className="font-sans text-xs font-medium text-muted">
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
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-bg px-3 font-sans text-sm text-fg outline-none placeholder:text-subtle focus:border-fg/30"
                />

                <p className="mt-1.5 font-sans text-[11px] text-subtle">
                  Separe os títulos por vírgula.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-border bg-elevated px-3 py-3 font-sans text-sm">
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

              </div>

            </div>
          </section>
        )}

        {/* ADMIN */}
        {admin && (
          <section className="mt-5 rounded-2xl border border-border bg-surface p-5">

            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-elevated">
                <ShieldCheck className="size-5" />
              </div>

              <div>
                <h2 className="font-sans text-sm font-semibold">
                  Administrador HIKARI
                </h2>

                <p className="mt-1 font-sans text-xs text-muted">
                  Seu acesso ao painel de administração está liberado.
                </p>
              </div>
            </div>

            <Button asChild className="mt-4">
              <Link to="/admin">
                Abrir Admin
              </Link>
            </Button>

          </section>
        )}

        {/* AÇÕES */}
        <section className="mt-5 flex flex-wrap gap-2 pb-4">

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

          {saved && (
            <span className="self-center font-sans text-xs text-muted">
              Perfil salvo.
            </span>
          )}

        </section>

      </div>
    </main>
  );
}
