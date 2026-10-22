import { useEffect, useState } from "react";
import { AlertCircle, LogIn, X } from "lucide-react";
import { authEnabled, signIn } from "@/lib/auth/client";
import { Logo } from "@/components/logo";

interface LoginMenuProps {
  isOpen?: boolean;
  onClose?: () => void;
  callbackURL?: string;
  isModal?: boolean;
}

export function LoginMenu({
  isOpen = true,
  onClose,
  callbackURL = "/",
  isModal = true,
}: LoginMenuProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<{
    type: "info" | "error" | "warning";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (isModal && !isOpen) return null;

  const handleProviderClick = async (provider: "google" | "x" | "facebook") => {
    setInfoMessage(null);

    if (!authEnabled) {
      setInfoMessage({
        type: "error",
        text: "O sistema de autenticação está temporariamente desativado nas configurações.",
      });
      return;
    }

    if (provider === "facebook") {
      setInfoMessage({
        type: "info",
        text: "O login com Facebook requer a configuração de FACEBOOK_CLIENT_ID e FACEBOOK_CLIENT_SECRET no servidor. No momento, este provedor não está configurado.",
      });
      return;
    }

    if (provider === "x") {
      try {
        setLoadingProvider("x");
        await signIn("grok-x", { callbackURL });
      } catch (err) {
        console.warn("Erro ao iniciar login com X:", err);
        setInfoMessage({
          type: "info",
          text: "O login com X (Twitter) requer a configuração de credenciais no servidor (GROK_AUTH_CLIENT_ID / X_CLIENT_ID).",
        });
      } finally {
        setLoadingProvider(null);
      }
      return;
    }

    if (provider === "google") {
      try {
        setLoadingProvider("google");
        await signIn("google", { callbackURL });
      } catch (err) {
        console.warn("Tentando fallback do Google via broker:", err);
        try {
          await signIn("grok-google", { callbackURL });
        } catch (brokerErr) {
          console.warn("Erro no broker do Google:", brokerErr);
          setInfoMessage({
            type: "error",
            text: "O login com Google requer a configuração de GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no servidor.",
          });
        }
      } finally {
        setLoadingProvider(null);
      }
    }
  };

  const content = (
    <div
      role="dialog"
      aria-modal={isModal}
      aria-labelledby="login-menu-title"
      className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#141419]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl"
    >
      {/* Botão fechar */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar janela de login"
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="size-4" />
        </button>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col items-center text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Logo />
          <span className="font-display text-sm font-black tracking-widest text-white">
            HIKARI
          </span>
        </div>

        <h2
          id="login-menu-title"
          className="font-display text-base sm:text-lg font-bold tracking-tight text-white flex items-center justify-center gap-1.5"
        >
          <LogIn className="size-4 text-[#c084fc]" />
          <span>Entrar na Conta</span>
        </h2>

        <p className="mt-1 text-xs text-white/60 max-w-xs leading-relaxed">
          Acesse sua conta para curtir, responder e interagir com a comunidade.
        </p>
      </div>

      {/* Mensagem informativa / aviso */}
      {infoMessage && (
        <div
          role="alert"
          className={`mt-3.5 flex items-start gap-2 rounded-xl border p-2.5 text-xs leading-relaxed transition-all ${
            infoMessage.type === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : infoMessage.type === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-[#a855f7]/30 bg-[#a855f7]/10 text-purple-200"
          }`}
        >
          <AlertCircle className="size-3.5 shrink-0 mt-0.5 text-[#c084fc]" />
          <span className="flex-1">{infoMessage.text}</span>
        </div>
      )}

      {/* Os 3 provedores solicitados */}
      <div className="mt-4 flex flex-col gap-2">
        {/* 1. Google */}
        <button
          type="button"
          onClick={() => void handleProviderClick("google")}
          disabled={Boolean(loadingProvider)}
          className="group relative flex min-h-10 w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-[#1b1b22] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white/90 shadow-sm transition-all hover:border-[#a855f7]/50 hover:bg-[#a855f7]/15 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7] disabled:opacity-50"
        >
          <svg className="size-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>
            {loadingProvider === "google"
              ? "Conectando..."
              : "Continuar com Google"}
          </span>
        </button>

        {/* 2. X (Twitter) */}
        <button
          type="button"
          onClick={() => void handleProviderClick("x")}
          disabled={Boolean(loadingProvider)}
          className="group relative flex min-h-10 w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-[#1b1b22] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white/90 shadow-sm transition-all hover:border-[#a855f7]/50 hover:bg-[#a855f7]/15 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7] disabled:opacity-50"
        >
          <svg
            className="size-4 shrink-0 fill-current text-white"
            viewBox="0 0 24 24"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>
            {loadingProvider === "x" ? "Conectando..." : "Continuar com X (Twitter)"}
          </span>
        </button>

        {/* 3. Facebook */}
        <button
          type="button"
          onClick={() => void handleProviderClick("facebook")}
          disabled={Boolean(loadingProvider)}
          className="group relative flex min-h-10 w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-[#1b1b22] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white/90 shadow-sm transition-all hover:border-[#a855f7]/50 hover:bg-[#a855f7]/15 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7] disabled:opacity-50"
        >
          <svg
            className="size-4 shrink-0 fill-[#1877F2]"
            viewBox="0 0 24 24"
          >
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Continuar com Facebook</span>
        </button>
      </div>

      <p className="mt-4 text-center text-[10px] text-white/40 leading-relaxed">
        Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade do Hikari.
      </p>
    </div>
  );

  if (!isModal) return content;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      {content}
    </div>
  );
}
