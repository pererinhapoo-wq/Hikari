import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

export interface ProfileSaveNotificationDetail {
  title?: string;
  message?: string;
}

const NOTIFICATION_EVENT = "hikari:profile-save-notification";

/**
 * Função utilitária para acionar a notificação moderna de salvamento do Perfil
 * de qualquer formulário, modal ou tela de configurações do Perfil.
 */
export function triggerProfileSaveNotification(
  message = "Alterações salvas com sucesso.",
  title = "Salvo com sucesso",
) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ProfileSaveNotificationDetail>(NOTIFICATION_EVENT, {
        detail: { title, message },
      }),
    );
  }
}

interface ProfileSaveNotificationProps {
  /** Permite controle direto via prop opcionalmente */
  show?: boolean;
  title?: string;
  message?: string;
  onClose?: () => void;
  autoCloseDurationMs?: number;
}

/**
 * Notificação moderna, elegante e coerente com a identidade visual escura do Hikari.
 * - Posicionamento fixo no canto superior direito (nunca no centro da tela).
 * - Não cobre botões nem gera deslocamento de layout (layout shift).
 * - Suporta dispensar arrastando (swipe to dismiss) horizontalmente no mobile e desktop.
 * - Se o arraste for insuficiente (< 70px), retorna suavemente à posição original.
 */
export function ProfileSaveNotification({
  show: controlledShow,
  title: controlledTitle,
  message: controlledMessage,
  onClose: controlledOnClose,
  autoCloseDurationMs = 4000,
}: ProfileSaveNotificationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<{ title: string; message: string }>({
    title: "Salvo com sucesso",
    message: "Alterações salvas com sucesso.",
  });

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissDirection, setDismissDirection] = useState<"left" | "right">("right");

  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVisible = controlledShow !== undefined ? controlledShow : isOpen;
  const currentTitle = controlledTitle ?? data.title;
  const currentMessage = controlledMessage ?? data.message;

  const handleDismiss = useCallback(() => {
    setIsDismissing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsDismissing(false);
      setDragOffset(0);
      controlledOnClose?.();
    }, 250);
  }, [controlledOnClose]);

  // Limpa o timer automático
  const clearAutoCloseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reinicia o timer de fechamento automático
  const startAutoCloseTimer = useCallback(() => {
    clearAutoCloseTimer();
    if (autoCloseDurationMs > 0) {
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, autoCloseDurationMs);
    }
  }, [autoCloseDurationMs, clearAutoCloseTimer, handleDismiss]);

  // Escuta eventos globais de salvamento do Perfil
  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ProfileSaveNotificationDetail>;
      setData({
        title: customEvent.detail?.title || "Salvo com sucesso",
        message: customEvent.detail?.message || "Alterações salvas com sucesso.",
      });
      setDragOffset(0);
      setIsDismissing(false);
      setIsOpen(true);
      startAutoCloseTimer();
    };

    window.addEventListener(NOTIFICATION_EVENT, handleEvent);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT, handleEvent);
      clearAutoCloseTimer();
    };
  }, [clearAutoCloseTimer, startAutoCloseTimer]);

  useEffect(() => {
    if (controlledShow) {
      setDragOffset(0);
      setIsDismissing(false);
      startAutoCloseTimer();
    } else if (controlledShow === false) {
      clearAutoCloseTimer();
    }
  }, [controlledShow, startAutoCloseTimer, clearAutoCloseTimer]);

  // Handlers para o gesto de arrastar (Swipe to dismiss)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDismissing) return;
    setIsDragging(true);
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    clearAutoCloseTimer();
    // Captura ponteiro para manter rastreio fluido mesmo se sair da borda
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignora erro em navegadores que não suportam pointerCapture em elementos aninhados
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isDismissing) return;
    currentXRef.current = e.clientX;
    const diff = currentXRef.current - startXRef.current;
    setDragOffset(diff);
  };

  const handlePointerUp = () => {
    if (!isDragging || isDismissing) return;
    setIsDragging(false);

    const threshold = 75; // Limite de deslocamento para confirmar descarte
    if (Math.abs(dragOffset) >= threshold) {
      setDismissDirection(dragOffset > 0 ? "right" : "left");
      handleDismiss();
    } else {
      // Retorna suavemente à posição original se não atingir o limite
      setDragOffset(0);
      startAutoCloseTimer();
    }
  };

  const handlePointerCancel = () => {
    if (!isDragging) return;
    setIsDragging(false);
    setDragOffset(0);
    startAutoCloseTimer();
  };

  if (!isVisible && !isDismissing) {
    return null;
  }

  // Calcula opacidade dinâmica durante o arraste
  const dragOpacity = Math.max(0.2, 1 - Math.abs(dragOffset) / 220);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[99999] pointer-events-none top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] select-none"
      style={{
        maxWidth: "min(92vw, 380px)",
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onMouseEnter={clearAutoCloseTimer}
        onMouseLeave={() => {
          if (!isDragging) startAutoCloseTimer();
        }}
        className={`group relative flex items-center gap-3 rounded-2xl border border-purple-500/35 bg-[#0c0a18]/95 p-3.5 sm:p-4 text-white shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(168,85,247,0.28)] backdrop-blur-xl cursor-grab active:cursor-grabbing pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200 ${
          isDragging
            ? "transition-none"
            : isDismissing
              ? "transition-all duration-200 ease-in"
              : "transition-all duration-300 ease-out"
        }`}
        style={{
          transform: isDismissing
            ? `translateX(${dismissDirection === "right" ? "120%" : "-120%"})`
            : `translateX(${dragOffset}px)`,
          opacity: isDismissing ? 0 : dragOpacity,
          touchAction: "pan-y",
        }}
      >
        {/* Ícone de Sucesso estilizado com a identidade visual roxa/amethyst do Hikari */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-500/20 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.35)]">
          <Check className="size-4.5 text-purple-300 stroke-[2.5]" />
        </div>

        {/* Textos de confirmação */}
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight line-clamp-1">
            {currentTitle}
          </h4>
          <p className="mt-0.5 text-[11px] sm:text-xs text-zinc-300 font-medium leading-snug line-clamp-2">
            {currentMessage}
          </p>
        </div>

        {/* Botão de Fechar acessível para desktop e mobile */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDismissDirection("right");
            handleDismiss();
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          aria-label="Fechar confirmação"
          title="Dispensar"
        >
          <X className="size-3.5" />
        </button>

        {/* Indicador visual sutil de arraste na borda inferior */}
        <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-white/20 opacity-60 sm:opacity-40" />
      </div>
    </div>
  );
}
