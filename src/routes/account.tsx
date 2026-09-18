import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Camera,
  Heart,
  Lock,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Save,
  ShieldCheck,
  Sparkles,
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

  const avatarLetter =
    avatarSource.charAt(0).toUpperCase();

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
          favorites: favoriteList,
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
    <main className="min-h-screen bg-[#030817] text-white">
      {/* Fundo geral do perfil */}
      <div className="mx-auto w-full max-w-[1500px] px-3 pb-24 pt-4 sm:px-5 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* ====================================================== */}
          {/* COLUNA PRINCIPAL                                       */}
          {/* ====================================================== */}

          <section className="min-w-0 overflow-hidden rounded-2xl border border-[#1c3c70] bg-[#061329] shadow-[0_0_40px_rgba(38,70,180,0.12)]">

            {/* ================================================== */}
            {/* CAPA                                                */}
            {/* ================================================== */}

            <div className="relative h-[250px] overflow-hidden sm:h-[300px] lg:h-[340px]">
              {/* textura de fundo */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 50% 115%, rgba(88,54,255,0.95) 0%, rgba(39,48,145,0.75) 34%, rgba(6,19,41,0.25) 70%), linear-gradient(135deg, #152f72 0%, #4025a3 45%, #741bc7 100%)",
                }}
              />

              {/* textura luminosa */}
              <div className="absolute -left-20 top-10 size-[280px] rounded-full bg-blue-500/20 blur-3xl" />

              <div className="absolute right-0 top-0 size-[330px] rounded-full bg-purple-500/25 blur-3xl" />

              {/* círculos da textura */}
              <div className="absolute -right-20 -top-40 size-[520px] rounded-full border border-white/10" />

              <div className="absolute -right-10 -top-32 size-[430px] rounded-full border border-white/5" />

              <div className="absolute left-20 -bottom-48 size-[480px] rounded-full border border-white/5" />

              {/* brilho central */}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(1,8,22,0.12)_60%,rgba(1,8,22,0.78)_100%)]" />

              {/* personagem/cenário estilizado */}
              <div className="absolute bottom-[-70px] left-1/2 h-[280px] w-[300px] -translate-x-1/2 opacity-50">
                <div className="absolute left-1/2 top-0 h-[210px] w-[145px] -translate-x-1/2 rounded-t-[80px] bg-[#050918] shadow-[0_0_60px_rgba(0,0,0,0.7)]" />

                <div className="absolute left-1/2 top-[75px] h-[170px] w-[230px] -translate-x-1/2 rounded-t-[110px] bg-[#071126]" />

                <div className="absolute left-1/2 top-[45px] h-[130px] w-[70px] -translate-x-1/2 rounded-full bg-[#111b35]" />
              </div>

              {/* texto da capa */}
              <div className="absolute right-5 top-6 text-right sm:right-8 sm:top-8">
                <p className="text-xl font-medium tracking-[0.45em] text-white/90 sm:text-2xl">
                  好きなことで
                </p>

                <p className="text-xl font-medium tracking-[0.45em] text-white/90 sm:text-2xl">
                  生きていく
                </p>

                <p className="mt-1 text-xs text-white/60">
                  Viver do que ama
                </p>
              </div>

              {/* marca da capa */}
              <div className="absolute bottom-5 left-5 hidden items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 backdrop-blur-md sm:flex">
                <Sparkles className="size-4 text-violet-300" />

                <span className="text-xs font-medium tracking-[0.18em] text-white/80">
                  PERFIL HIKARI
                </span>
              </div>
            </div>

            {/* ================================================== */}
            {/* IDENTIDADE                                          */}
            {/* ================================================== */}

            <div className="relative px-5 pb-5 sm:px-8 lg:px-10">
              {/* avatar */}
              <div className="-mt-16 sm:-mt-20">
                <div className="relative inline-block">
                  {user.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt=""
                      className="size-32 rounded-full border-[5px] border-[#061329] bg-[#09172f] object-cover shadow-[0_8px_35px_rgba(0,0,0,0.55)] sm:size-40"
                    />
                  ) : (
                    <div className="grid size-32 place-items-center rounded-full border-[5px] border-[#061329] bg-[#15284b] font-display text-5xl shadow-[0_8px_35px_rgba(0,0,0,0.55)] sm:size-40">
                      {avatarLetter}
                    </div>
                  )}

                  <button
                    type="button"
                    className="absolute bottom-1 right-1 grid size-10 place-items-center rounded-full border-2 border-[#061329] bg-[#101f3c] text-white shadow-lg"
                    aria-label="Alterar foto"
                  >
                    <Camera className="size-4" />
                  </button>
                </div>
              </div>

              {/* identidade + ações */}
              <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  {loadingProfile ? (
                    <>
                      <div className="h-9 w-48 animate-pulse rounded-lg bg-[#102343]" />

                      <div className="mt-2 h-5 w-32 animate-pulse rounded bg-[#102343]" />

                      <div className="mt-4 h-4 w-64 animate-pulse rounded bg-[#102343]" />
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                          {nick || "Defina seu Nick"}
                        </h1>

                        {nick && (
                          <BadgeCheck className="size-6 fill-violet-500 text-white" />
                        )}
                      </div>

                      {nick && (
                        <p className="mt-1 text-base text-[#9fb2d4] sm:text-lg">
                          @{nick}
                        </p>
                      )}

                      {bio && (
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c4d1e8]">
                          {bio}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSaved(false);
                      setError("");
                      setEditing(true);
                    }}
                    className="border-[#294674] bg-[#0a1932] text-white hover:bg-[#102343]"
                  >
                    <Pencil className="size-4" />
                    Editar perfil
                  </Button>

                  <button
                    type="button"
                    className="grid size-10 place-items-center rounded-xl border border-[#294674] bg-[#0a1932] text-[#b6c8e5] hover:bg-[#102343]"
                    aria-label="Mais opções"
                  >
                    <MoreHorizontal className="size-5" />
                  </button>
                </div>
              </div>

              {/* email */}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#7186aa]">
                {email && (
                  <span>{email}</span>
                )}

                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5" />
                  Membro da comunidade HIKARI
                </span>
              </div>

              {/* ================================================== */}
              {/* ESTATÍSTICAS                                       */}
              {/* ================================================== */}

              <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-[#1b3762] bg-[#07152b] sm:grid-cols-4">
                <Stat
                  icon={<MessageCircle />}
                  value="0"
                  label="Comentários"
                />

                <Stat
                  icon={<Heart />}
                  value="0"
                  label="Curtidas"
                />

                <Stat
                  icon={<Users />}
                  value="0"
                  label="Seguidores"
                />

                <Stat
                  icon={<UserPlus />}
                  value="0"
                  label="Seguindo"
                />
              </div>
            </div>

            {/* ================================================== */}
            {/* ABAS                                                */}
            {/* ================================================== */}

            <div className="border-t border-[#1b3762] px-3 sm:px-6">
              <div className="grid grid-cols-3">
                <ProfileTabButton
                  active={activeTab === "comments"}
                  onClick={() => setActiveTab("comments")}
                >
                  Comentários
                </ProfileTabButton>

                <ProfileTabButton
                  active={activeTab === "favorites"}
                  onClick={() => setActiveTab("favorites")}
                >
                  Favoritos
                </ProfileTabButton>

                <ProfileTabButton
                  active={activeTab === "about"}
                  onClick={() => setActiveTab("about")}
                >
                  Sobre
                </ProfileTabButton>
              </div>
            </div>

            {/* ================================================== */}
            {/* CONTEÚDO DAS ABAS                                  */}
            {/* ================================================== */}

            <div className="p-5 sm:p-7 lg:p-8">
              {activeTab === "comments" && (
                <CommentsTab nick={nick} />
              )}

              {activeTab === "favorites" && (
                <FavoritesTab
                  favoriteList={favoriteList}
                />
              )}

              {activeTab === "about" && (
                <AboutTab
                  bio={bio}
                  email={email}
                  myListLength={myList.length}
                />
              )}
            </div>
          </section>

          {/* ====================================================== */}
          {/* COLUNA DIREITA                                         */}
          {/* ====================================================== */}

          <aside className="space-y-4 lg:pt-0">
            {/* Conta aberta */}
            <SideCard>
              <div className="flex gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
                  <Users className="size-5" />
                </div>

                <div>
                  <h2 className="font-medium text-white">
                    Conta aberta
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-[#8fa5c7]">
                    Qualquer pessoa pode seguir você.
                  </p>
                </div>
              </div>
            </SideCard>

            {/* Sobre */}
            <SideCard>
              <div className="flex items-center gap-2">
                <Users className="size-5 text-violet-300" />

                <h2 className="font-semibold">
                  Sobre
                </h2>
              </div>

              <p className="mt-4 text-sm leading-6 text-[#9eb1d1]">
                {bio ||
                  "Este usuário ainda não adicionou uma descrição."}
              </p>

              <div className="mt-5 flex items-center gap-2 text-xs text-[#7186aa]">
                <CalendarDays className="size-4" />
                Membro da comunidade HIKARI
              </div>
            </SideCard>

            {/* Seguidores */}
            <SideCard>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  Seguidores (0)
                </h2>

                <Users className="size-4 text-[#7489ad]" />
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-[#294674] px-4 py-5 text-center">
                <Users className="mx-auto size-6 text-[#637da8]" />

                <p className="mt-2 text-xs text-[#7186aa]">
                  Seus seguidores aparecerão aqui.
                </p>
              </div>
            </SideCard>

            {/* Seguindo */}
            <SideCard>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  Seguindo (0)
                </h2>

                <UserPlus className="size-4 text-[#7489ad]" />
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-[#294674] px-4 py-5 text-center">
                <UserPlus className="mx-auto size-6 text-[#637da8]" />

                <p className="mt-2 text-xs text-[#7186aa]">
                  Os usuários que você seguir aparecerão aqui.
                </p>
              </div>
            </SideCard>

            {/* Privacidade */}
            <SideCard>
              <div className="flex gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300">
                  <Lock className="size-5" />
                </div>

                <div>
                  <h2 className="font-medium">
                    Conta privada
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-[#8fa5c7]">
                    Futuramente você poderá controlar quem pode
                    acompanhar seu perfil.
                  </p>
                </div>
              </div>
            </SideCard>
          </aside>
        </div>

        {/* ====================================================== */}
        {/* EDITOR DE PERFIL                                      */}
        {/* ====================================================== */}

        {editing && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[#294674] bg-[#07152b] p-5 shadow-2xl sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7186aa]">
                    Perfil Hikari
                  </p>

                  <h2 className="mt-1 text-2xl font-semibold">
                    Editar perfil
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setEditing(false);
                  }}
                  className="grid size-9 place-items-center rounded-lg text-[#8fa5c7] hover:bg-[#102343]"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                {/* Nick */}
                <div>
                  <label className="text-sm font-medium text-white">
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
                    className="mt-2 h-12 w-full rounded-xl border border-[#294674] bg-[#030b19] px-4 text-sm text-white outline-none placeholder:text-[#536988] focus:border-violet-400"
                  />

                  <p className="mt-1.5 text-xs text-[#7186aa]">
                    3 a 30 caracteres. Use apenas letras, números
                    ou _.
                  </p>
                </div>

                {/* Bio */}
                <div>
                  <label className="text-sm font-medium text-white">
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
                    className="mt-2 w-full resize-none rounded-xl border border-[#294674] bg-[#030b19] p-4 text-sm text-white outline-none placeholder:text-[#536988] focus:border-violet-400"
                  />
                </div>

                {/* Favoritos */}
                <div>
                  <label className="text-sm font-medium text-white">
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
                    className="mt-2 h-12 w-full rounded-xl border border-[#294674] bg-[#030b19] px-4 text-sm text-white outline-none placeholder:text-[#536988] focus:border-violet-400"
                  />

                  <p className="mt-1.5 text-xs text-[#7186aa]">
                    Separe os títulos por vírgula.
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={saving}
                    className="bg-violet-600 text-white hover:bg-violet-500"
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
                    className="border-[#294674] bg-transparent text-white hover:bg-[#102343]"
                  >
                    <X className="size-4" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* ADMIN                                                 */}
        {/* ====================================================== */}

        {admin && (
          <section className="mt-5 rounded-2xl border border-violet-500/20 bg-[#07152b] p-5 shadow-[0_0_35px_rgba(92,55,255,0.08)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-violet-300" />

                  <h2 className="font-semibold">
                    Administrador HIKARI
                  </h2>
                </div>

                <p className="mt-1 text-sm text-[#8fa5c7]">
                  Seu acesso ao painel de administração está liberado.
                </p>
              </div>

              <Button
                asChild
                className="bg-violet-600 text-white hover:bg-violet-500"
              >
                <Link to="/admin">
                  Abrir Admin
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* ====================================================== */}
        {/* RODAPÉ DO PERFIL                                      */}
        {/* ====================================================== */}

        <div className="mt-5 flex flex-wrap items-center gap-2 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => void signOut("/")}
            className="border-[#294674] bg-[#07152b] text-white hover:bg-[#102343]"
          >
            <LogOut className="size-4" />
            Sair da conta
          </Button>

          <Button
            asChild
            variant="ghost"
            className="text-[#9eb1d1] hover:bg-[#102343] hover:text-white"
          >
            <Link to="/">
              Voltar ao início
            </Link>
          </Button>

          {saved && (
            <span className="text-xs text-[#8197ba]">
              Perfil salvo.
            </span>
          )}
        </div>
      </div>
    </main>
  );
}

/* ============================================================ */
/* COMPONENTE DE ESTATÍSTICA                                   */
/* ============================================================ */

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-h-[100px] flex-col items-center justify-center border-b border-[#1b3762] px-3 py-4 text-center sm:border-b-0 sm:border-r last:border-r-0">
      <div className="text-[#91a8ff] [&>svg]:size-5">
        {icon}
      </div>

      <strong className="mt-2 text-xl font-semibold">
        {value}
      </strong>

      <span className="mt-1 text-xs text-[#7186aa]">
        {label}
      </span>
    </div>
  );
}

/* ============================================================ */
/* ABA DE COMENTÁRIOS                                          */
/* ============================================================ */

function CommentsTab({
  nick,
}: {
  nick: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">
        Comentários de {nick || "você"}
      </h2>

      <p className="mt-1 text-sm text-[#8197ba]">
        Suas atividades nos episódios do HIKARI.
      </p>

      <div className="mt-6 rounded-2xl border border-[#294674] bg-[#07152b] p-8 text-center sm:p-12">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#102343] text-[#8da4ff]">
          <MessageCircle className="size-8" />
        </div>

        <h3 className="mt-5 font-semibold">
          Seus comentários aparecerão aqui
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7186aa]">
          Os comentários que você fizer nos episódios do HIKARI
          poderão aparecer nesta área.
        </p>
      </div>
    </div>
  );
}

/* ============================================================ */
/* ABA DE FAVORITOS                                            */
/* ============================================================ */

function FavoritesTab({
  favoriteList,
}: {
  favoriteList: string[];
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">
        Animes favoritos
      </h2>

      <p className="mt-1 text-sm text-[#8197ba]">
        Os títulos que você escolheu como favoritos.
      </p>

      {favoriteList.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {favoriteList.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#294674] bg-[#0b1c38] px-4 py-2 text-sm text-[#c6d4ec]"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-[#294674] bg-[#07152b] p-8 text-center">
          <Bookmark className="mx-auto size-7 text-[#667ea9]" />

          <p className="mt-3 text-sm text-[#8197ba]">
            Você ainda não adicionou animes favoritos.
          </p>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/* ABA SOBRE                                                   */
/* ============================================================ */

function AboutTab({
  bio,
  email,
  myListLength,
}: {
  bio: string;
  email: string;
  myListLength: number;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">
        Sobre
      </h2>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border border-[#294674] bg-[#07152b] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[#7186aa]">
            Bio
          </p>

          <p className="mt-3 text-sm leading-6 text-[#b4c5df]">
            {bio ||
              "Este usuário ainda não adicionou uma descrição."}
          </p>
        </div>

        <div className="rounded-2xl border border-[#294674] bg-[#07152b] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[#7186aa]">
            Minha conta
          </p>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#8197ba]">
                Animes na minha lista
              </span>

              <strong>{myListLength}</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8197ba]">
                E-mail
              </span>

              <span className="max-w-[60%] truncate text-[#b4c5df]">
                {email}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/* CARD LATERAL                                                */
/* ============================================================ */

function SideCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#1c3c70] bg-[#061329] p-5 shadow-[0_0_30px_rgba(28,60,112,0.08)]">
      {children}
    </section>
  );
}

/* ============================================================ */
/* BOTÃO DAS ABAS                                              */
/* ============================================================ */

function ProfileTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-14 px-3 text-sm font-medium transition ${
        active
          ? "text-white"
          : "text-[#7186aa] hover:text-[#c7d5ec]"
      }`}
    >
      {children}

      {active && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-20 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#5366ff] to-[#a855f7] shadow-[0_0_12px_rgba(100,80,255,0.8)]" />
      )}
    </button>
  );
                                 }
