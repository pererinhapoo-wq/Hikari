import {
  Calendar,
  FolderHeart,
  Lock,
  Pencil,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import type { ProfileListSummary } from "@/types/profile-list";

interface ProfileAboutSpaceProps {
  name: string;
  nick: string;
  bio: string;
  favorites: string[];
  lists: ProfileListSummary[];
  onOpenEdit: () => void;
}

export function ProfileAboutSpace({
  name,
  nick,
  bio,
  favorites,
  lists,
  onOpenEdit,
}: ProfileAboutSpaceProps) {
  return (
    <div className="space-y-8">
      {/* Bloco de Apresentação e Biografia */}
      <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#100e1f] via-[#0b0915] to-[#07060c] p-6 sm:p-8 shadow-[0_12px_45px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300">
              <User className="size-4" />
            </div>
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-white">
                Sobre {name || nick || "o Membro"}
              </h3>
              <p className="text-xs text-zinc-400">
                Informações e biografia pessoal no Hikari
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
          >
            <Pencil className="size-3" />
            <span>Editar</span>
          </button>
        </div>

        {/* Biografia */}
        <div className="space-y-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Biografia
            </span>
            <div className="mt-2 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 text-xs sm:text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
              {bio ? (
                bio
              ) : (
                <span className="italic text-zinc-500">
                  Nenhuma biografia informada ainda. Clique no botão "Editar" para adicionar uma introdução sobre você e seus gostos em animes.
                </span>
              )}
            </div>
          </div>

          {/* Destaques / Tags de Interesses */}
          {favorites.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Gêneros e Interesses Selecionados
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {favorites.map((fav, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300"
                  >
                    <Sparkles className="size-3" />
                    <span>{fav}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Metadados de Conta */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/[0.06] pt-5 text-xs">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] p-3 border border-white/[0.04]">
            <Shield className="size-4 text-emerald-400" />
            <div>
              <span className="block text-[11px] text-zinc-500">Privacidade</span>
              <span className="font-semibold text-zinc-200">Perfil Público Protegido</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] p-3 border border-white/[0.04]">
            <Calendar className="size-4 text-violet-400" />
            <div>
              <span className="block text-[11px] text-zinc-500">Membro da Comunidade</span>
              <span className="font-semibold text-zinc-200">Hikari 2026</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] p-3 border border-white/[0.04]">
            <Lock className="size-4 text-indigo-400" />
            <div>
              <span className="block text-[11px] text-zinc-500">Isolamento de Dados</span>
              <span className="font-semibold text-zinc-200">Autenticado e Criptografado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Listas do Usuário */}
      <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#100e1f] via-[#0b0915] to-[#07060c] p-6 sm:p-8 shadow-[0_12px_45px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-300">
              <FolderHeart className="size-4" />
            </div>
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-white">
                Minhas Listas Personalizadas
              </h3>
              <p className="text-xs text-zinc-400">
                Coleções temáticas criadas pelo usuário
              </p>
            </div>
          </div>

          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-xs font-semibold text-zinc-400 tabular-nums">
            {lists.length}
          </span>
        </div>

        {lists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {lists.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl border border-white/[0.07] bg-[#0c0a16] p-4 transition-all hover:border-violet-500/30"
              >
                <h4 className="font-semibold text-sm text-zinc-100 truncate">
                  {l.title}
                </h4>
                {l.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                    {l.description}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{l.itemCount} {l.itemCount === 1 ? "item" : "itens"}</span>
                  <span>{l.isPublic ? "Pública" : "Privada"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic">
            Nenhuma lista personalizada criada ainda.
          </p>
        )}
      </div>
    </div>
  );
}
