import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Clock,
  Eye,
  Heart,
  ListOrdered,
  Loader2,
  Lock,
  MessageSquare,
  Settings,
  UserCheck,
  UserMinus,
  Users,
  UserX,
} from "lucide-react";

import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getMyBlockedUsers,
  getProfile,
  unblockUser,
  updateProfile,
  type BlockedUserItem,
  type SectionPrivacyLevel,
  type UserProfile,
} from "@/lib/profile.functions";

export const Route = createFileRoute("/settings-privacy")({
  component: SettingsPrivacy,
});

export function SettingsPrivacy() {
  const { user, isPending } = useCurrentUserState();
  const getProfileFn = useServerFn(getProfile);
  const updateProfileFn = useServerFn(updateProfile);
  const getMyBlockedUsersFn = useServerFn(getMyBlockedUsers);
  const unblockUserFn = useServerFn(unblockUser);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lista de usuários bloqueados (Etapa 9)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [unblockTarget, setUnblockTarget] = useState<BlockedUserItem | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const [unblockSuccess, setUnblockSuccess] = useState<string | null>(null);

  // Estados dos 7 campos de privacidade (Migration 0020)
  const [accountType, setAccountType] = useState<"public" | "private">("public");
  const [allowFollowers, setAllowFollowers] = useState<boolean>(true);
  const [privacyLists, setPrivacyLists] = useState<SectionPrivacyLevel>("public");
  const [privacyFavorites, setPrivacyFavorites] = useState<SectionPrivacyLevel>("public");
  const [privacyHistory, setPrivacyHistory] = useState<SectionPrivacyLevel>("public");
  const [privacyComments, setPrivacyComments] = useState<SectionPrivacyLevel>("public");
  const [privacyFollowers, setPrivacyFollowers] = useState<SectionPrivacyLevel>("public");

  const [initialState, setInitialState] = useState<{
    accountType: "public" | "private";
    allowFollowers: boolean;
    privacyLists: SectionPrivacyLevel;
    privacyFavorites: SectionPrivacyLevel;
    privacyHistory: SectionPrivacyLevel;
    privacyComments: SectionPrivacyLevel;
    privacyFollowers: SectionPrivacyLevel;
  } | null>(null);

  // Carregar dados reais do perfil
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    setLoading(true);
    void getProfileFn()
      .then((data: UserProfile) => {
        if (!active) return;
        const current = {
          accountType: data.accountType || "public",
          allowFollowers: data.allowFollowers ?? true,
          privacyLists: data.privacyLists || "public",
          privacyFavorites: data.privacyFavorites || "public",
          privacyHistory: data.privacyHistory || "public",
          privacyComments: data.privacyComments || "public",
          privacyFollowers: data.privacyFollowers || "public",
        };
        setAccountType(current.accountType);
        setAllowFollowers(current.allowFollowers);
        setPrivacyLists(current.privacyLists);
        setPrivacyFavorites(current.privacyFavorites);
        setPrivacyHistory(current.privacyHistory);
        setPrivacyComments(current.privacyComments);
        setPrivacyFollowers(current.privacyFollowers);
        setInitialState(current);
      })
      .catch((err) => {
        console.warn("Erro ao carregar privacidade:", err);
        setErrorMsg("Não foi possível carregar suas configurações atuais.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  // Carregar usuários bloqueados (Etapa 9)
  const loadBlockedUsers = () => {
    if (!user?.id) return;
    setBlockedLoading(true);
    getMyBlockedUsersFn()
      .then((data) => {
        setBlockedUsers(data || []);
      })
      .catch((err) => {
        console.warn("Erro ao buscar usuários bloqueados:", err);
      })
      .finally(() => {
        setBlockedLoading(false);
      });
  };

  useEffect(() => {
    loadBlockedUsers();
  }, [user?.id]);

  // Desbloquear usuário diretamente pela lista (Etapa 9)
  const handleUnblock = async () => {
    if (!unblockTarget) return;
    setUnblocking(true);
    setErrorMsg(null);
    try {
      await unblockUserFn({ data: { targetUserId: unblockTarget.id } });
      setBlockedUsers((prev) => prev.filter((u) => u.id !== unblockTarget.id));
      setUnblockSuccess(`Usuário ${unblockTarget.name || unblockTarget.username || "selecionado"} foi desbloqueado.`);
      setUnblockTarget(null);
      setTimeout(() => setUnblockSuccess(null), 3500);
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error ? err.message : "Erro ao desbloquear usuário.";
      setErrorMsg(errMessage);
    } finally {
      setUnblocking(false);
    }
  };

  const isDirty =
    initialState &&
    (accountType !== initialState.accountType ||
      allowFollowers !== initialState.allowFollowers ||
      privacyLists !== initialState.privacyLists ||
      privacyFavorites !== initialState.privacyFavorites ||
      privacyHistory !== initialState.privacyHistory ||
      privacyComments !== initialState.privacyComments ||
      privacyFollowers !== initialState.privacyFollowers);

  // Salvar alterações
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated = await updateProfileFn({
        data: {
          accountType,
          allowFollowers,
          privacyLists,
          privacyFavorites,
          privacyHistory,
          privacyComments,
          privacyFollowers,
        },
      });

      const nextState = {
        accountType: updated.accountType || accountType,
        allowFollowers: updated.allowFollowers ?? allowFollowers,
        privacyLists: updated.privacyLists || privacyLists,
        privacyFavorites: updated.privacyFavorites || privacyFavorites,
        privacyHistory: updated.privacyHistory || privacyHistory,
        privacyComments: updated.privacyComments || privacyComments,
        privacyFollowers: updated.privacyFollowers || privacyFollowers,
      };

      setInitialState(nextState);
      setSuccessMsg("Configurações de privacidade salvas com sucesso!");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error ? err.message : "Falha ao salvar as configurações.";
      setErrorMsg(errMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isPending || loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-zinc-300">
        <div className="flex flex-col items-center justify-center space-y-4 py-20">
          <Loader2 className="size-8 animate-spin text-violet-400" />
          <p className="text-sm text-zinc-400">Carregando configurações de privacidade...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <RedirectToSignIn to="/login" />;
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-3 py-6 sm:px-6 pb-24 text-zinc-100">
      {/* Topo / Breadcrumb */}
      <div className="mb-6">
        <Link
          to="/account"
          className="group mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
        >
          <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Voltar para o Perfil</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-[#c084fc] shadow-[0_0_25px_rgba(168,85,247,0.15)]">
              <Settings className="size-6 text-[#c084fc]" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-white">
                Configurações do Perfil
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Gerencie quem pode visualizar sua conta, seções e usuários bloqueados no Hikari
              </p>
            </div>
          </div>

          {/* Botão de Salvar no topo */}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
              isDirty
                ? "border border-violet-500/40 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:brightness-110 active:scale-98"
                : "border border-white/5 bg-white/[0.04] text-zinc-500 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check className="size-4" />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs sm:text-sm text-emerald-300 shadow-lg animate-in fade-in">
          <Check className="size-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs sm:text-sm text-red-300 shadow-lg animate-in fade-in">
          <Lock className="size-5 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        {/* Bloco 1: Visibilidade Geral da Conta: Somente Perfil Privado */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0a17] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/10 text-violet-400">
                <Lock className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Perfil Privado
                </h2>
                <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                  Quando ativado, apenas você e seus seguidores confirmados conseguem acessar as seções e detalhes do perfil.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={accountType === "private"}
              onClick={() => setAccountType(accountType === "private" ? "public" : "private")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-[#0c0a17] ${
                accountType === "private" ? "bg-violet-600" : "bg-zinc-800"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
                  accountType === "private" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {accountType === "private" && (
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-200/90 leading-relaxed">
              <strong>Atenção:</strong> Ao tornar o perfil privado, visitantes não seguidores verão apenas um aviso de conta privada e não terão acesso a listas, favoritos, animes assistidos ou comentários.
            </div>
          )}
        </section>

        {/* Bloco 2: Controle de Novos Seguidores */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0a17] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/10 text-violet-400">
                <Users className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Permitir Novos Seguidores
                </h2>
                <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                  Quando desativado, o botão "Seguir" será desabilitado no seu perfil público, impedindo novos vínculos.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={allowFollowers}
              onClick={() => setAllowFollowers(!allowFollowers)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-[#0c0a17] ${
                allowFollowers ? "bg-violet-600" : "bg-zinc-800"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
                  allowFollowers ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>

        {/* Bloco 3: Visibilidade Individual das Seções */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0a17] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="mb-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ListOrdered className="size-4 text-violet-400" />
              <span>Visibilidade Individual das Seções</span>
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
              Personalize quem tem acesso a cada tipo de dado público. Se sua conta for privada, visitantes anônimos não terão acesso independente dessas configurações.
            </p>
          </div>

          <div className="space-y-4 divide-y divide-white/[0.06]">
            {/* Seção 1: Listas de Animes */}
            <SectionPrivacyRow
              icon={<ListOrdered className="size-4 text-violet-400" />}
              title="Listas de Animes"
              description="Coleções personalizadas de animes criadas por você"
              value={privacyLists}
              onChange={setPrivacyLists}
            />

            {/* Seção 2: Favoritos */}
            <div className="pt-4">
              <SectionPrivacyRow
                icon={<Heart className="size-4 text-rose-400" />}
                title="Favoritos"
                description="Animes, personagens, estúdios e pessoas favoritadas"
                value={privacyFavorites}
                onChange={setPrivacyFavorites}
              />
            </div>

            {/* Seção 3: Histórico de Episódios */}
            <div className="pt-4">
              <SectionPrivacyRow
                icon={<Clock className="size-4 text-amber-400" />}
                title="Histórico de Episódios"
                description="Episódios assistidos e atividade recente no player"
                value={privacyHistory}
                onChange={setPrivacyHistory}
              />
            </div>

            {/* Seção 4: Comentários */}
            <div className="pt-4">
              <SectionPrivacyRow
                icon={<MessageSquare className="size-4 text-sky-400" />}
                title="Comentários"
                description="Comentários publicados em episódios e discussões de animes"
                value={privacyComments}
                onChange={setPrivacyComments}
              />
            </div>

            {/* Seção 5: Seguidores e Seguindo */}
            <div className="pt-4">
              <SectionPrivacyRow
                icon={<Users className="size-4 text-emerald-400" />}
                title="Seguidores e Seguindo"
                description="Visibilidade das pessoas que você segue e de quem te segue"
                value={privacyFollowers}
                onChange={setPrivacyFollowers}
              />
            </div>
          </div>
        </section>

        {/* Barra Inferior com Status e Ações */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c0a17] p-4">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            {isDirty ? (
              <span className="flex items-center gap-1.5 font-medium text-amber-400">
                <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                Você possui alterações não salvas
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <Check className="size-3.5 text-emerald-400" />
                Todas as configurações estão sincronizadas
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              to="/account"
              className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-center text-xs sm:text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              Ver Meu Perfil
            </Link>

            <button
              type="submit"
              disabled={saving || !isDirty}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                isDirty
                  ? "border border-violet-500/40 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:brightness-110 active:scale-98"
                  : "border border-white/5 bg-white/[0.04] text-zinc-500 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Seção de Usuários Bloqueados (Etapa 9) */}
      <section className="mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0a17] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <UserX className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Usuários Bloqueados</h2>
              <p className="text-xs text-zinc-400">
                Pessoas bloqueadas não podem interagir, seguir ou visualizar seus dados privados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-1 text-xs font-semibold text-zinc-300 tabular-nums">
              {blockedUsers.length} {blockedUsers.length === 1 ? "bloqueado" : "bloqueados"}
            </span>
          </div>
        </div>

        {unblockSuccess && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
            <Check className="size-4 shrink-0 text-emerald-400" />
            <span>{unblockSuccess}</span>
          </div>
        )}

        {blockedLoading ? (
          <div className="flex items-center justify-center py-10 text-zinc-400 gap-2.5 text-xs">
            <Loader2 className="size-4 animate-spin text-violet-400" />
            <span>Carregando lista de bloqueios...</span>
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-8 text-center">
            <UserX className="mx-auto size-8 text-zinc-600 mb-2" />
            <p className="text-sm font-medium text-zinc-300">Nenhum usuário bloqueado</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Você não possui nenhum bloqueio ativo. Para bloquear alguém, acesse o perfil público do usuário e escolha "Bloquear usuário".
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {blockedUsers.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name || item.username || "Avatar"}
                      className="size-10 rounded-full object-cover border border-white/10 bg-zinc-800"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-violet-600/30 border border-violet-500/30 text-sm font-bold text-violet-200 uppercase">
                      {(item.name?.[0] || item.username?.[0] || "U")}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {item.name || item.username || "Usuário"}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      @{item.username || item.id.slice(0, 8)}
                    </p>
                    {item.blockedAt && (
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Bloqueado em {new Date(item.blockedAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setUnblockTarget(item)}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300 transition-colors"
                >
                  Desbloquear
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal de Confirmação para Desbloquear */}
      {unblockTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !unblocking) {
              setUnblockTarget(null);
            }
          }}
        >
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d0c18] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  Desbloquear Usuário
                </h3>
                <p className="text-xs text-zinc-400">
                  Confirmar liberação de interações
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Deseja desbloquear <strong className="text-white">@{unblockTarget.username || unblockTarget.name}</strong>?
              Isso permitirá novas interações públicas, mas <span className="text-amber-300 font-medium">não restaurará automaticamente seguidores ou solicitações anteriores</span>.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={unblocking}
                onClick={() => setUnblockTarget(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={unblocking}
                onClick={() => void handleUnblock()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-600/20 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-600/30 transition-colors disabled:opacity-50"
              >
                {unblocking ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Desbloqueando...</span>
                  </>
                ) : (
                  <span>Confirmar Desbloqueio</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SectionPrivacyRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: SectionPrivacyLevel;
  onChange: (val: SectionPrivacyLevel) => void;
}

function SectionPrivacyRow({
  icon,
  title,
  description,
  value,
  onChange,
}: SectionPrivacyRowProps) {
  const options: Array<{
    value: SectionPrivacyLevel;
    label: string;
    icon: React.ReactNode;
  }> = [
    { value: "public", label: "Público", icon: <Eye className="size-3.5" /> },
    { value: "followers", label: "Seguidores", icon: <UserCheck className="size-3.5" /> },
    { value: "private", label: "Somente Eu", icon: <UserMinus className="size-3.5" /> },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-zinc-400">{description}</p>
        </div>
      </div>

      <div className="flex items-center rounded-xl border border-white/[0.08] bg-black/40 p-1 self-start sm:self-center">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                isSelected
                  ? "bg-violet-600 text-white shadow-md font-semibold"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
