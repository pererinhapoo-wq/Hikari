import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Wrench,
  X,
} from "lucide-react";
import { usePublicSettings } from "@/lib/settings/use-public-settings";
import { cn } from "@/lib/utils";

export function GlobalNoticeBanner() {
  const { settings } = usePublicSettings();
  const notice = settings.notice;

  const [dismissed, setDismissed] = useState(false);

  // Armazena no sessionStorage para persistir o fechamento durante a navegação da sessão
  useEffect(() => {
    if (typeof window !== "undefined" && notice.enabled) {
      const noticeKey = `hikari_notice_dismissed_${notice.title}_${notice.type}`;
      const isDismissed = sessionStorage.getItem(noticeKey) === "true";
      setDismissed(isDismissed);
    }
  }, [notice.enabled, notice.title, notice.type]);

  if (!notice.enabled || !notice.content || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      const noticeKey = `hikari_notice_dismissed_${notice.title}_${notice.type}`;
      sessionStorage.setItem(noticeKey, "true");
    }
  };

  const typeConfig = {
    info: {
      border: "border-purple-500/30",
      bg: "bg-purple-950/40 text-purple-200",
      iconColor: "text-purple-400",
      badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      badgeText: "Informativo",
      Icon: Info,
    },
    warning: {
      border: "border-amber-500/35",
      bg: "bg-amber-950/40 text-amber-100",
      iconColor: "text-amber-400",
      badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      badgeText: "Atenção",
      Icon: AlertTriangle,
    },
    maintenance: {
      border: "border-rose-500/35",
      bg: "bg-rose-950/40 text-rose-100",
      iconColor: "text-rose-400",
      badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/30",
      badgeText: "Manutenção",
      Icon: Wrench,
    },
    success: {
      border: "border-emerald-500/35",
      bg: "bg-emerald-950/40 text-emerald-100",
      iconColor: "text-emerald-400",
      badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      badgeText: "Concluído",
      Icon: CheckCircle2,
    },
  }[notice.type] || {
    border: "border-purple-500/30",
    bg: "bg-purple-950/40 text-purple-200",
    iconColor: "text-purple-400",
    badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    badgeText: "Informativo",
    Icon: Info,
  };

  const IconComponent = typeConfig.Icon;

  return (
    <aside
      aria-label="Aviso Global da Plataforma"
      className={cn(
        "relative z-40 w-full border-b backdrop-blur-md transition-all duration-300",
        typeConfig.bg,
        typeConfig.border,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-start gap-3 sm:items-center">
          <div
            className={cn(
              "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border",
              typeConfig.badgeBg,
            )}
          >
            <IconComponent className={cn("size-4", typeConfig.iconColor)} />
          </div>

          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2.5 text-xs sm:text-sm">
            {notice.title && (
              <span className="font-semibold text-white tracking-wide">
                {notice.title}
              </span>
            )}
            {notice.title && (
              <span className="hidden text-white/40 sm:inline">•</span>
            )}
            <span className="leading-relaxed opacity-90">{notice.content}</span>
          </div>
        </div>

        {notice.dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fechar aviso"
            className="group shrink-0 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <X className="size-4 transition-transform group-hover:scale-110" />
          </button>
        )}
      </div>
    </aside>
  );
}
