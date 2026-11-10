import {
  AlertCircle,
  Check,
  Eye,
  Globe,
  Loader2,
  Lock,
  MessageSquare,
  Save,
  Shield,
  Star,
  Tv,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  getMyBlockedUsers,
  unblockUser,
  type AccountType,
  type BlockedUserItem,
  type SectionPrivacyLevel,
  type UserProfile,
} from "@/lib/profile.functions";

interface ProfilePrivacyModalProps {
  isOpen: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onSave: (data: {
    accountType: AccountType;
    allowFollowers: boolean;
    privacyLists: SectionPrivacyLevel;
    privacyFavorites: SectionPrivacyLevel;
    privacyHistory: SectionPrivacyLevel;
    privacyComments: SectionPrivacyLevel;
    privacyFollowers: SectionPrivacyLevel;
  }) => Promise<void>;
}

const SECTION_OPTIONS: {
  value: SectionPrivacyLevel;
  label: string;
  icon: typeof Globe;
  description: string;
}[] = [
  {
    value: "public",
    label: "Público",
    icon: Globe,
    description: "Visível para qualquer pessoa",
  },
  {
    value: "followers",
    label: "Seguidores",
    icon: Users,
    description: "Apenas quem você aceitou",
  },
  {
    value: "private",
    label: "Somente Eu",
    icon: Lock,
    description: "Totalmente oculto e privado",
  },
];

export function ProfilePrivacyModal({
  isOpen,
  profile,
  onClose,
  onSave,
}: ProfilePrivacyModalProps) {
  const getMyBlockedUsersFn = useServerFn(getMyBlockedUsers);
  const unblockUserFn = useServerFn(unblockUser);

  const [showBlocked, setShowBlocked] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedError, setBlockedError] = useState("");
  const [confirmUnblockId, setConfirmUnblockId] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const [unblockSuccess, setUnblockSuccess] = useState("");

  const [accountType, setAccountType] = useState<AccountType>("public");
  const [allowFollowers, setAllowFollowers] = useState(true);
  const [privacyLists, setPrivacyLists] = useState<SectionPrivacyLevel>("public");
  const [privacyFavorites, setPrivacyFavorites] =
    useState<SectionPrivacyLevel>("public");
  const [privacyHistory, setPrivacyHistory] =
    useState<SectionPrivacyLevel>("public");
  const [privacyComments, setPrivacyComments] =
    useState<SectionPrivacyLevel>("public");
  const [privacyFollowers, setPrivacyFollowers] =
    useState<SectionPrivacyLevel>("public");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const loadBlockedUsers = useCallback(() => {
    setBlockedLoading(true);
    setBlockedError("");
    void getMyBlockedUsersFn()
      .then((data) => {
        setBlockedUsers(data || []);
      })
      .catch((err) => {
        console.warn("Erro ao buscar usuários bloqueados:", err);
        setBlockedError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar a lista de usuários bloqueados.",
        );
      })
      .finally(() => {
        setBlockedLoading(false);
      });
  }, [getMyBlockedUsersFn]);

  useEffect(() => {
    if (showBlocked) {
      loadBlockedUsers();
    }
  }, [showBlocked, loadBlockedUsers]);

  const handleUnblock = async (targetUserId: string, targetName?: string | null) => {
    setUnblocking(true);
    setBlockedError("");
    try {
      await unblockUserFn({ data: { targetUserId } });
      setBlockedUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      setUnblockSuccess(
        `Usuário ${targetName || "selecionado"} foi desbloqueado.`,
      );
      setConfirmUnblockId(null);
      setTimeout(() => setUnblockSuccess(""), 3500);
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error ? err.message : "Erro ao desbloquear usuário.";
      setBlockedError(errMessage);
    } finally {
      setUnblocking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setShowBlocked(false);
      setConfirmUnblockId(null);
      setUnblockSuccess("");
      setBlockedError("");
      if (profile) {
        setAccountType(profile.accountType || "public");
        setAllowFollowers(profile.allowFollowers ?? true);
        setPrivacyLists(profile.privacyLists || "public");
        setPrivacyFavorites(profile.privacyFavorites || "public");
        setPrivacyHistory(profile.privacyHistory || "public");
        setPrivacyComments(profile.privacyComments || "public");
        setPrivacyFollowers(profile.privacyFollowers || "public");
        setError("");
        setSuccess(false);
      }
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const isDirty =
    accountType !== (profile?.accountType || "public") ||
    allowFollowers !== (profile?.allowFollowers ?? true) ||
    privacyLists !== (profile?.privacyLists || "public") ||
    privacyFavorites !== (profile?.privacyFavorites || "public") ||
    privacyHistory !== (profile?.privacyHistory || "public") ||
    privacyComments !== (profile?.privacyComments || "public") ||
    privacyFollowers !== (profile?.privacyFollowers || "public");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setError("");
      await onSave({
        accountType,
        allowFollowers,
        privacyLists,
        privacyFavorites,
        privacyHistory,
        privacyComments,
        privacyFollowers,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar preferências de privacidade.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
    >
      <div className="relative flex h-full max-h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0d0918] shadow-[0_25px_70px_rgba(0,0,0,0.85)]">
        {/* Cabeçalho do Modal Original */}
        <div className="shrink-0 flex items-center justify-between border-b border-white/[0.08] bg-[#140e24] px-3.5 py-2.5 sm:px-6 sm:py-4 z-10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-lg sm:rounded-2xl border border-violet-500/30 bg-violet-600/20 text-violet-300">
              <Shield className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="privacy-modal-title"
                className="font-display text-sm sm:text-xl font-bold text-white flex items-center gap-1.5 sm:gap-2"
              >
                <span className="truncate">Privacidade do Perfil</span>
                {isDirty && (
                  <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-amber-300">
                    Não salvo
                  </span>
                )}
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                Gerencie quem pode visualizar suas informações no Hikari.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg sm:rounded-xl border border-white/10 p-1.5 sm:p-2 text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white shrink-0 ml-2 cursor-pointer"
            title="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Feedback de Erro ou Sucesso */}
        {error && (
          <div className="shrink-0 mx-3.5 sm:mx-5 mt-2.5 sm:mt-4 flex items-center gap-2 rounded-xl sm:rounded-2xl border border-red-500/30 bg-red-500/10 px-3 sm:px-4 py-2.5 sm:py-3 text-xs text-red-200">
            <AlertCircle className="size-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="shrink-0 mx-3.5 sm:mx-5 mt-2.5 sm:mt-4 flex items-center gap-2 rounded-xl sm:rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-medium text-emerald-300">
            <Check className="size-4 shrink-0 text-emerald-400" />
            <span>Preferências de privacidade atualizadas com sucesso!</span>
          </div>
        )}

        {/* Formulário de Configurações com Rolagem Suave */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3.5 sm:px-6 sm:py-5 pb-8 sm:pb-6 space-y-4 sm:space-y-6 text-sm overscroll-contain"
        >
          {/* 1. Visibilidade Geral da Conta: Somente Perfil Privado */}
          <section className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-violet-400" />
                <h4 className="font-semibold text-white text-xs sm:text-sm">
                  Perfil privado
                </h4>
              </div>
              <p className="text-xs text-zinc-400">
                Quando ativado, suas listas, favoritos, comentários e histórico ficam protegidos contra visitantes e somente seguidores aprovados podem vê-los.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={accountType === "private"}
              onClick={() => setAccountType(accountType === "private" ? "public" : "private")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                accountType === "private" ? "bg-violet-600" : "bg-white/10"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  accountType === "private" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </section>

          {/* 2. Permissão de Novos Seguidores */}
          <section className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <UserPlus className="size-4 text-violet-400" />
                <h4 className="font-semibold text-white text-xs sm:text-sm">
                  Permitir novos seguidores
                </h4>
              </div>
              <p className="text-xs text-zinc-400">
                Se desativado, o botão de seguir ficará indisponível para outros
                usuários.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={allowFollowers}
              onClick={() => setAllowFollowers(!allowFollowers)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                allowFollowers ? "bg-violet-600" : "bg-white/10"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  allowFollowers ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </section>

          {/* 3. Visibilidade Individual por Seção */}
          <section className="space-y-4">
            <div className="px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                Seções do Perfil
              </span>
              <h3 className="font-semibold text-white">
                Visibilidade Individual
              </h3>
              <p className="text-xs text-zinc-400">
                Defina com precisão quem pode visualizar cada área de conteúdo.
              </p>
            </div>

            {/* Listas Personalizadas */}
            <SectionPrivacyRow
              icon={Tv}
              title="Listas de Animes"
              description="Listas personalizadas criadas na sua conta"
              value={privacyLists}
              onChange={setPrivacyLists}
            />

            {/* Favoritos Canônicos */}
            <SectionPrivacyRow
              icon={Star}
              title="Favoritos"
              description="Animes, personagens, estúdios e pessoas favoritadas"
              value={privacyFavorites}
              onChange={setPrivacyFavorites}
            />

            {/* Histórico de Episódios */}
            <SectionPrivacyRow
              icon={Eye}
              title="Histórico de Episódios"
              description="Registro dos animes e episódios assistidos"
              value={privacyHistory}
              onChange={setPrivacyHistory}
            />

            {/* Comentários */}
            <SectionPrivacyRow
              icon={MessageSquare}
              title="Comentários"
              description="Histórico de comentários postados nos episódios"
              value={privacyComments}
              onChange={setPrivacyComments}
            />

            {/* Seguidores e Seguindo */}
            <SectionPrivacyRow
              icon={Users}
              title="Seguidores e Seguindo"
              description="Listas e conexões de membros da sua comunidade"
              value={privacyFollowers}
              onChange={setPrivacyFollowers}
            />
          </section>

          {/* Atalho para Gerenciar Usuários Bloqueados integrado diretamente no conteúdo */}
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-zinc-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserX className="size-4 text-zinc-500" />
                <span>Gerenciar usuários bloqueados</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowBlocked((prev) => !prev);
                }}
                className="text-violet-400 hover:text-violet-300 font-medium transition-colors cursor-pointer"
              >
                {showBlocked ? "Ocultar" : "Abrir Configurações"}
              </button>
            </div>

            {/* Gerenciamento de Bloqueados Renderizado Diretamente Dentro do Conteúdo */}
            {showBlocked && (
              <div className="mt-3.5 pt-3 border-t border-white/[0.06] space-y-3">
                {unblockSuccess && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
                    <Check className="size-4 shrink-0 text-emerald-400" />
                    <span>{unblockSuccess}</span>
                  </div>
                )}

                {blockedError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    <AlertCircle className="size-4 shrink-0 text-red-400" />
                    <span>{blockedError}</span>
                  </div>
                )}

                {blockedLoading ? (
                  <div className="flex items-center justify-center py-6 text-zinc-400 gap-2 text-xs">
                    <Loader2 className="size-4 animate-spin text-violet-400" />
                    <span>Carregando usuários bloqueados...</span>
                  </div>
                ) : blockedUsers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-4 sm:p-5 text-center">
                    <UserX className="mx-auto size-6 text-zinc-600 mb-1.5" />
                    <p className="text-xs font-medium text-zinc-300">Nenhum usuário bloqueado</p>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      Você não possui nenhum bloqueio ativo. Para bloquear alguém, acesse o perfil público do usuário e escolha &quot;Bloquear usuário&quot;.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-black/20 p-2 sm:p-3">
                    {blockedUsers.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2.5 first:pt-0.5 last:pb-0.5 gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name || item.username || "Avatar"}
                              className="size-8 sm:size-9 rounded-full object-cover border border-white/10 bg-zinc-800 shrink-0"
                            />
                          ) : (
                            <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-full bg-violet-600/30 border border-violet-500/30 text-xs font-bold text-violet-200 uppercase">
                              {(item.name?.[0] || item.username?.[0] || "U")}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white">
                              {item.name || item.username || "Usuário"}
                            </p>
                            <p className="truncate text-[10px] sm:text-[11px] text-zinc-400">
                              @{item.username || item.id.slice(0, 8)}
                            </p>
                            {item.blockedAt && (
                              <p className="text-[9px] text-zinc-500">
                                Bloqueado em {new Date(item.blockedAt).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                          </div>
                        </div>

                        {confirmUnblockId === item.id ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={unblocking}
                              onClick={() => void handleUnblock(item.id, item.name || item.username)}
                              className="rounded-lg border border-red-500/40 bg-red-600/20 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-600/30 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {unblocking ? "..." : "Confirmar"}
                            </button>
                            <button
                              type="button"
                              disabled={unblocking}
                              onClick={() => setConfirmUnblockId(null)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmUnblockId(item.id)}
                            className="shrink-0 rounded-lg sm:rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-zinc-300 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300 transition-colors cursor-pointer"
                          >
                            Desbloquear
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Rodapé de Ações Original */}
        <div className="shrink-0 flex items-center justify-between border-t border-white/[0.08] bg-[#140e24] px-3.5 py-2.5 sm:px-6 sm:py-4 gap-2 z-10 shadow-[0_-8px_20px_rgba(0,0,0,0.5)]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg sm:rounded-xl border border-white/10 px-3.5 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-600 to-purple-600 px-4 sm:px-5 py-2 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none active:scale-98 cursor-pointer"
          >
            {saving ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Salvando...</span>
              </>
            ) : success ? (
              <>
                <Check className="size-4 text-emerald-300" />
                <span>Salvo!</span>
              </>
            ) : (
              <>
                <Save className="size-4" />
                <span>Salvar Privacidade</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionPrivacyRow({
  icon: Icon,
  title,
  description,
  value,
  onChange,
}: {
  icon: typeof Tv;
  title: string;
  description: string;
  value: SectionPrivacyLevel;
  onChange: (level: SectionPrivacyLevel) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 sm:p-4 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-violet-300">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-white text-xs sm:text-sm">
            {title}
          </h4>
          <p className="text-[11px] sm:text-xs text-zinc-400">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 pt-1">
        {SECTION_OPTIONS.map((opt) => {
          const OptionIcon = opt.icon;
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                isSelected
                  ? "border-violet-500/60 bg-violet-600/20 text-white shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                  : "border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white"
              }`}
            >
              <OptionIcon
                className={`size-3.5 mb-1 ${
                  isSelected ? "text-violet-300" : "text-zinc-500"
                }`}
              />
              <span className="text-[11px] font-semibold">{opt.label}</span>
              <span className="hidden sm:inline text-[9px] text-zinc-500 mt-0.5">
                {opt.value === "public"
                  ? "Todos"
                  : opt.value === "followers"
                    ? "Seguidores"
                    : "Somente Eu"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
