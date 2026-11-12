import {
  Calendar,
  Sparkles,
} from "lucide-react";
import type { ProfileListSummary } from "@/types/profile-list";

interface ProfileAboutSpaceProps {
  name?: string;
  nick?: string;
  bio?: string;
  favorites: string[];
  lists?: ProfileListSummary[];
  createdAt?: string | null;
  onOpenEdit?: () => void;
}

/**
 * Formata a data de entrada do usuário na comunidade em português brasileiro (ex: "Entrou em 12 de março de 2026").
 * Retorna null se não houver data válida para não inventar datas fictícias.
 */
function formatJoinDate(isoString?: string | null): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;

  const day = date.getDate();
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `Entrou em ${day} de ${month} de ${year}.`;
}

export function ProfileAboutSpace({
  favorites,
  createdAt,
}: ProfileAboutSpaceProps) {
  const hasFavorites = favorites.length > 0;
  const joinDateText = formatJoinDate(createdAt);

  return (
    <div className="space-y-6">
      {/* Gêneros e Interesses Selecionados se houver */}
      {hasFavorites && (
        <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#100e1f] via-[#0b0915] to-[#07060c] p-5 sm:p-6 shadow-[0_12px_45px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex size-7 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
              <Sparkles className="size-3.5" />
            </div>
            <h3 className="font-display text-sm sm:text-base font-bold text-white">
              Gêneros e Interesses Selecionados
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {favorites.map((fav, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300"
              >
                <Sparkles className="size-3" />
                <span>{fav}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metadados e Informações de Conta */}
      <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#100e1f] via-[#0b0915] to-[#07060c] p-5 sm:p-6 shadow-[0_12px_45px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] p-3 border border-white/[0.04] w-full sm:w-auto">
            <Calendar className="size-4 text-violet-400 shrink-0" />
            <div>
              <span className="block text-[11px] text-zinc-500">Membro da Comunidade</span>
              <span className="block font-semibold text-zinc-200">Hikari 2026</span>
              {joinDateText && (
                <span className="block text-[11px] text-zinc-400 font-medium mt-0.5">
                  {joinDateText}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
