import {
  AlertCircle,
  Check,
  Eye,
  Globe,
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
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type {
  AccountType,
  SectionPrivacyLevel,
  UserProfile,
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

  useEffect(() => {
    if (isOpen && profile) {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0918] shadow-[0_25px_70px_rgba(0,0,0,0.85)]">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#140e24]/70 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-600/20 text-violet-300">
              <Shield className="size-5" />
            </div>
            <div>
              <h2
                id="privacy-modal-title"
                className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2"
              >
                <span>Privacidade do Perfil</span>
                {isDirty && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                    Não salvo
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                Gerencie quem pode visualizar suas informações no Hikari.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-white/10 p-2 text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
            title="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Feedback de Erro ou Sucesso */}
        {error && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            <AlertCircle className="size-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-300">
            <Check className="size-4 shrink-0 text-emerald-400" />
            <span>Preferências de privacidade atualizadas com sucesso!</span>
          </div>
        )}

        {/* Formulário de Configurações com Rolagem Suave */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-6 text-sm"
        >
          {/* 1. Visibilidade Geral da Conta */}
          <section className="space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                  Visibilidade da Conta
                </span>
                <h3 className="font-semibold text-white">
                  Conta Privada vs Pública
                </h3>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  accountType === "private"
                    ? "border border-amber-500/30 bg-amber-500/15 text-amber-300"
                    : "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {accountType === "private" ? "Conta Privada" : "Conta Pública"}
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Quando a conta é privada, seu perfil básico é exibido, mas suas
              listas, favoritos, comentários e histórico ficam protegidos contra
              visitantes e somente seguidores aprovados podem vê-los.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAccountType("public")}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                  accountType === "public"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <Globe
                  className={`size-4 ${
                    accountType === "public" ? "text-emerald-400" : "text-zinc-500"
                  }`}
                />
                <div>
                  <div className="font-semibold text-xs">Pública</div>
                  <div className="text-[11px] text-zinc-400">
                    Acesso normal ao perfil
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccountType("private")}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                  accountType === "private"
                    ? "border-violet-500/60 bg-violet-600/20 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                    : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <Lock
                  className={`size-4 ${
                    accountType === "private" ? "text-violet-400" : "text-zinc-500"
                  }`}
                />
                <div>
                  <div className="font-semibold text-xs">Privada</div>
                  <div className="text-[11px] text-zinc-400">
                    Apenas seguidores aprovados
                  </div>
                </div>
              </button>
            </div>
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

          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-zinc-400">
            <span className="flex items-center gap-2">
              <UserX className="size-4 text-zinc-500" />
              <span>Gerenciar usuários bloqueados</span>
            </span>
            <Link
              to="/settings-privacy"
              onClick={onClose}
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Abrir Configurações
            </Link>
          </div>
        </form>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#140e24]/70 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none active:scale-98"
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
