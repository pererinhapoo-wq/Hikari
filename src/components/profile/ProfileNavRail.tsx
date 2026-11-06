import {
  Activity,
  Compass,
  Info,
  MessageSquare,
  Tv,
} from "lucide-react";
import type { ElementType } from "react";

export type ProfileSpace =
  | "overview"
  | "animes"
  | "comments"
  | "about"
  | "activity";

export interface ProfileSpaceItem {
  id: ProfileSpace;
  label: string;
  icon: ElementType;
  count?: number;
}

interface ProfileNavRailProps {
  activeSpace: ProfileSpace;
  onChangeSpace: (space: ProfileSpace) => void;
  counts: {
    animes: number;
    comments: number;
    activity: number;
  };
}

export function ProfileNavRail({
  activeSpace,
  onChangeSpace,
  counts,
}: ProfileNavRailProps) {
  const spaces: ProfileSpaceItem[] = [
    {
      id: "overview",
      label: "Visão geral",
      icon: Compass,
    },
    {
      id: "animes",
      label: "Animes",
      icon: Tv,
      count: counts.animes,
    },
    {
      id: "comments",
      label: "Comentários",
      icon: MessageSquare,
      count: counts.comments,
    },
    {
      id: "about",
      label: "Sobre",
      icon: Info,
    },
    {
      id: "activity",
      label: "Atividade",
      icon: Activity,
      count: counts.activity,
    },
  ];

  return (
    <nav
      aria-label="Navegação Horizontal do Perfil"
      className="relative z-10 w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0b14]/90 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl"
    >
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
        {spaces.map((space) => {
          const Icon = space.icon;
          const isActive = activeSpace === space.id;

          return (
            <button
              key={space.id}
              type="button"
              onClick={() => onChangeSpace(space.id)}
              className={`group relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                isActive
                  ? "bg-gradient-to-r from-violet-600/30 via-purple-600/25 to-violet-500/15 text-white shadow-[0_0_20px_rgba(168,85,247,0.25)] ring-1 ring-violet-500/50"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              <Icon
                className={`size-4 transition-transform duration-200 ${
                  isActive
                    ? "text-violet-300 scale-110"
                    : "text-zinc-400 group-hover:text-zinc-300"
                }`}
              />

              <span className="font-semibold tracking-wide">
                {space.label}
              </span>

              {typeof space.count === "number" && (
                <span
                  className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-bold tabular-nums transition-colors ${
                    isActive
                      ? "bg-violet-500/30 text-violet-200 ring-1 ring-violet-400/30"
                      : "bg-white/[0.06] text-zinc-400 group-hover:bg-white/[0.1] group-hover:text-zinc-300"
                  }`}
                >
                  {space.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
