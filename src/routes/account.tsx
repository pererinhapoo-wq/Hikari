import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Check,
  Heart,
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
    <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
      {/* TÍTULO */}
      <header className="mb-5 hidden lg:block">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted">
          Seu perfil
        </p>

        <h1 className="mt-1 font-display text-3xl tracking-tight">
          Perfil
        </h1>
      </header>

      {/* ESTRUTURA PRINCIPAL */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* COLUNA PRINCIPAL */}
        <section className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface shadow-[var(--shadow-border)]">
          {/* CAPA */}
          <div className="relative h-40 overflow-hidden sm:h-48 lg:h-56">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(95,65,190,0.9),transparent_45%),radial-gradient(circle_at_85%_25%,rgba(150,35,230,0.8),transparent_48%),linear-gradient(135deg,#16122d,#54108a,#29104d)]" />

            <div className="absolute inset-0 opacity-30">
              <div className="absolute -left-20 -top-32 size-80 rounded-full border border-white/20" />
              <div className="absolute -right-16 -top-24 size-80 rounded-full border border-white/20" />
              <div className="absolute left-1/2 top-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
            </div>

            <div className="absolute bottom-4 left-5 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.25em] text-white/70 backdrop-blur-sm sm:left-7">
              HIKARI PROFILE
            </div>
          </div>

          {/* IDENTIDADE */}
          <div className="relative px-5 pb-0 sm:px-7">
            {/* AVATAR */}
            <div className="-mt-14 sm:-mt-16">
              {user.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt=""
                  className="size-28 rounded-full border-4 border-surface object-cover shadow-xl sm:size-32"
                />
              ) : (
                <div className="grid size-28 place-items-center rounded-full border-4 border-surface bg-elevated font-display text-4xl shadow-xl sm:size-32">
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
                      <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                        {nick || "Defina seu Nick"}
                      </h2>

                      {nick && (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-fg text-bg">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>

                    {nick && (
                      <p className="mt-1 text-sm text-muted sm:text-base">
                        @{nick}
                      </p>
                    )}
                  </>
                )}
              </div>

              {!loadingProfile && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSaved(false);
                    setError("");
                    setEditing(true);
                  }}
                  className="w-fit shrink-0"
                >
                  <Pencil className="size-4" />
                  Editar perfil
                </Button>
              )}
            </div>

            {/* BIO */}
            {!loadingProfile && bio && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                {bio}
              </p>
            )}

            {/* DATA */}
            <div className="mt-4 flex items-center gap-2 text-xs text-subtle">
              <CalendarDays className="size-3.5" />
              Membro da comunidade HIKARI
            </div>

            {/* ESTATÍSTICAS */}
            <div className="mt-6 grid grid-cols-4 overflow-hidden rounded-2xl border border-border">
              <div className="flex flex-col items-center justify-center px-2 py-4 text-center">
                <MessageCircle className="size-5 text-muted" />

                <p className="mt-2 text-xl font-medium tabular-nums">
                  0
                </p>

                <p className="mt-1 text-[11px] text-muted sm:text-xs">
                  Comentários
                </p>
              </div>

              <div className="border-l border-border px-2 py-4 text-center">
                <Heart className="mx-auto size-5 text-muted" />

                <p className="mt-2 text-xl font-medium tabular-nums">
                  0
                </p>

                <p className="mt-1 text-[11px] text-muted sm:text-xs">
                  Curtidas
                </p>
              </div>

              <div className="border-l border-border px-2 py-4 text-center">
                <Users className="mx-auto size-5 text-muted" />

                <p className="mt-2 text-xl font-medium tabular-nums">
                  0
                </p>

                <p className="mt-1 text-[11px] text-muted sm:text-xs">
                  Seguidores
                </p>
              </div>

              <div className="border-l border-border px-2 py-4 text-center">
                <UserPlus className="mx-auto size-5 text-muted" />

                <p className="mt-2 text-xl font-medium tabular-nums">
                  0
                </p>

                <p className="mt-1 text-[11px] text-muted sm:text-xs">
                  Seguindo
                </p>
              </div>
            </div>
          </div>

          {/* ABAS */}
          <div className="mt-7 border-t border-border">
            <div className="grid grid-cols-3">
              <button
                type="button"
                className="relative px-4 py-4 text-sm font-medium text-fg"
              >
                Comentários

                <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-fg" />
              </button>

              <button
                type="button"
                className="px-4 py-4 text-sm font-medium text-muted transition hover:text-fg"
              >
                Favoritos
              </button>

              <button
                type="button"
                className="px-4 py-4 text-sm font-medium text-muted transition hover:text-fg"
              >
                Sobre
              </button>
            </div>
          </div>

          {/* CONTEÚDO */}
          <div className="border-t border-border p-5 sm:p-7">
            <div className="mb-5">
              <h3 className="text-lg font-medium">
                Comentários de{" "}
                {nick || "você"}
              </h3>

              <p className="mt-1 text-sm text-muted">
                Suas atividades nos episódios do HIKARI.
              </p>
            </div>

            {/* PLACEHOLDER DE COMENTÁRIOS */}
            <div className="rounded-2xl border border-border bg-elevated/40 px-5 py-12 text-center">
              <MessageCircle className="mx-auto size-12 text-muted" />

              <h4 className="mt-4 text-base font-medium">
                Seus comentários aparecerão aqui
              </h4>

              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                Os comentários que você fizer nos episódios do HIKARI poderão aparecer nesta área.
              </p>
            </div>

            {/* FAVORITOS */}
            {favoriteList.length > 0 && (
              <div className="mt-7">
                <h3 className="text-lg font-medium">
                  Animes favoritos
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  {favoriteList.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border bg-elevated px-3 py-1.5 text-xs text-fg"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* MINHA LISTA */}
            <div className="mt-7 rounded-2xl border border-border bg-elevated/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    Minha Lista
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    Animes adicionados à sua lista.
                  </p>
                </div>

                <span className="text-xl font-medium tabular-nums">
                  {myList.length}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* COLUNA LATERAL */}
        <aside className="space-y-4">
          {/* CONTA */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated">
                <Users className="size-5 text-muted" />
              </div>

              <div>
                <h3 className="text-sm font-medium">
                  Conta aberta
                </h3>

                <p className="mt-1 text-xs text-muted">
                  Outros usuários poderão seguir você.
                </p>
              </div>
            </div>
          </section>

          {/* SOBRE */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-border)]">
            <h3 className="text-sm font-semibold">
              Sobre
            </h3>

            <p className="mt-3 text-sm leading-relaxed text-muted">
              {bio ||
                "Este usuário ainda não adicionou uma descrição ao perfil."}
            </p>
          </section>

          {/* SEGUIDORES */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Seguidores
              </h3>

              <span className="text-xs text-muted">
                0
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-full border border-border bg-elevated">
                <Users className="size-4 text-muted" />
              </div>

              <p className="text-xs text-muted">
                Você ainda não possui seguidores.
              </p>
            </div>
          </section>

          {/* SEGUINDO */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Seguindo
              </h3>

              <span className="text-xs text-muted">
                0
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-full border border-border bg-elevated">
                <UserPlus className="size-4 text-muted" />
              </div>

              <p className="text-xs text-muted">
                Você ainda não segue ninguém.
              </p>
            </div>
          </section>

          {/* ADMIN */}
          {admin && (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-border)]">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated">
                  <ShieldCheck className="size-5" />
                </div>

                <div>
                  <h3 className="text-sm font-medium">
                    Administrador HIKARI
                  </h3>

                  <p className="mt-1 text-xs text-muted">
                    Acesso administrativo liberado.
                  </p>
                </div>
              </div>

              <Button
                asChild
                className="mt-4 w-full"
              >
                <Link to="/admin">
                  Abrir Admin
                </Link>
              </Button>
            </section>
          )}
        </aside>
      </div>

      {/* EDITOR */}
      {editing && (
        <div className="mt-5 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-border)] sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-medium">
              Editar perfil
            </h2>

            <p className="mt-1 text-sm text-muted">
              Atualize as informações que aparecem no seu perfil.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
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

            <div className="lg:col-span-2">
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
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm text-fg">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void saveProfile()}
              disabled={saving}
            >
              <Save className="size-4" />

              {saving
                ? "Salvando..."
                : "Salvar alterações"}
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
      )}

      {/* SAIR */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void signOut("/")}
        >
          Sair da conta
        </Button>

        <Button asChild variant="ghost">
          <Link to="/">
            Voltar ao início
          </Link>
        </Button>

        {saved && !editing && (
          <span className="text-xs text-muted">
            Perfil salvo.
          </span>
        )}
      </div>
    </main>
  );
            }
