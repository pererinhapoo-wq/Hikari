import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Mail,
  User,
  X,
} from "lucide-react";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Logo } from "@/components/logo";
import { useScrollLock } from "@/lib/scroll-lock";
import { cn } from "@/lib/utils";

export type AuthMenuMode = "login" | "register" | "forgot";

interface LoginMenuProps {
  isOpen?: boolean;
  onClose?: () => void;
  callbackURL?: string;
  isModal?: boolean;
  initialMode?: AuthMenuMode;
}

type FeedbackState = {
  type: "error" | "success" | "info";
  text: string;
} | null;

type FieldErrors = Partial<
  Record<"name" | "email" | "password" | "confirmPassword", string>
>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function translateAuthError(
  error: { code?: string; message?: string; status?: number } | null | undefined,
  fallback: string,
): string {
  const code = error?.code?.toUpperCase() ?? "";
  const msg = error?.message ?? "";

  if (
    code.includes("INVALID_EMAIL_OR_PASSWORD") ||
    code.includes("INVALID_PASSWORD") ||
    msg.toLowerCase().includes("invalid email or password")
  ) {
    return "E-mail ou senha incorretos. Verifique seus dados e tente novamente.";
  }

  if (
    code.includes("USER_ALREADY_EXISTS") ||
    msg.toLowerCase().includes("already exists")
  ) {
    return "Já existe uma conta cadastrada com este e-mail. Tente entrar ou recuperar sua senha.";
  }

  if (code.includes("PASSWORD_TOO_SHORT")) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }

  if (code.includes("PASSWORD_TOO_LONG")) {
    return "A senha excede o limite máximo de caracteres.";
  }

  if (code.includes("INVALID_EMAIL")) {
    return "Informe um endereço de e-mail válido.";
  }

  if (code.includes("TOO_MANY_REQUESTS")) {
    return "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.";
  }

  if (
    code.includes("RESET_PASSWORD_DISABLED") ||
    msg.toLowerCase().includes("reset password isn't enabled")
  ) {
    return "A redefinição automática por e-mail não está ativa neste servidor. Se você entrou com o Google, acesse usando o botão acima.";
  }

  if (code.includes("INVALID_ORIGIN") || msg.toLowerCase().includes("invalid origin")) {
    return "Origem não autorizada para autenticação neste endereço.";
  }

  return msg || fallback;
}

function GoogleMark() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

export function LoginMenu({
  isOpen = true,
  onClose,
  callbackURL = "/",
  isModal = true,
  initialMode = "login",
}: LoginMenuProps) {
  useScrollLock(Boolean(isModal && isOpen));
  const router = useRouter();
  const baseId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const redirectTimerRef = useRef<number | null>(null);

  const [mode, setMode] = useState<AuthMenuMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [loadingAction, setLoadingAction] = useState<
    "google" | "email" | null
  >(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setFieldErrors({});
      setFeedback(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen, initialMode]);

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

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  if (isModal && !isOpen) return null;

  const isBusy = loadingAction !== null;

  const switchMode = (nextMode: AuthMenuMode) => {
    if (isBusy) return;
    setMode(nextMode);
    setFieldErrors({});
    setFeedback(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const clearFieldError = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const completeEmailSuccess = async (successText: string) => {
    setFeedback({ type: "success", text: successText });

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem("hikari_signed_out");
      } catch {
        /* ignore */
      }
    }

    try {
      await authClient.getSession();
    } catch {
      /* session store recovers on next read */
    }

    await router.invalidate().catch(() => {});

    if (typeof window !== "undefined") {
      const target = new URL(callbackURL, window.location.origin);
      const currentPath = window.location.pathname + window.location.search;
      const targetPath = target.pathname + target.search;

      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }

      redirectTimerRef.current = window.setTimeout(() => {
        if (isModal && onClose && targetPath === currentPath) {
          onClose();
        } else {
          window.location.assign(target.href);
        }
      }, 650);
    }
  };

  const handleGoogleLogin = async () => {
    setFeedback(null);
    setFieldErrors({});

    if (!authEnabled) {
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem("hikari_signed_out");
        } catch {
          /* ignore */
        }
        window.location.href = callbackURL;
      }
      return;
    }

    try {
      setLoadingAction("google");
      await signIn("google", { callbackURL });
    } catch (err) {
      console.warn("Tentando fallback do Google via broker:", err);
      try {
        await signIn("grok-google", { callbackURL });
      } catch (brokerErr) {
        console.warn("Erro no broker do Google:", brokerErr);
        setFeedback({
          type: "error",
          text: "Não foi possível conectar com o Google no momento. Verifique sua conexão ou tente entrar com e-mail.",
        });
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEmailLogin = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const trimmedEmail = email.trim();
    const errors: FieldErrors = {};

    if (!trimmedEmail) {
      errors.email = "Informe seu e-mail.";
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = "Digite um e-mail válido.";
    }

    if (!password) {
      errors.password = "Informe sua senha.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoadingAction("email");

    try {
      const { error } = await authClient.signIn.email({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setFeedback({
          type: "error",
          text: translateAuthError(
            error,
            "Não foi possível entrar com e-mail e senha.",
          ),
        });
        return;
      }

      await completeEmailSuccess("Sessão iniciada com sucesso. Redirecionando...");
    } catch (err) {
      setFeedback({
        type: "error",
        text: translateAuthError(
          err instanceof Error ? { message: err.message } : undefined,
          "Ocorreu uma falha ao tentar entrar. Tente novamente.",
        ),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEmailRegister = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const errors: FieldErrors = {};

    if (!trimmedName) {
      errors.name = "Informe seu nome de exibição.";
    } else if (trimmedName.length < 2) {
      errors.name = "O nome precisa ter pelo menos 2 caracteres.";
    }

    if (!trimmedEmail) {
      errors.email = "Informe seu e-mail.";
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = "Digite um e-mail válido.";
    }

    if (!password) {
      errors.password = "Crie uma senha para sua conta.";
    } else if (password.length < 8) {
      errors.password = "A senha deve ter no mínimo 8 caracteres.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirme sua senha.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "As senhas não coincidem.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoadingAction("email");

    try {
      const { error } = await authClient.signUp.email({
        name: trimmedName,
        email: trimmedEmail,
        password,
        callbackURL,
      });

      if (error) {
        setFeedback({
          type: "error",
          text: translateAuthError(
            error,
            "Não foi possível concluir o cadastro.",
          ),
        });
        return;
      }

      await completeEmailSuccess(
        "Conta criada com sucesso! Preparando seu perfil no Hikari...",
      );
    } catch (err) {
      setFeedback({
        type: "error",
        text: translateAuthError(
          err instanceof Error ? { message: err.message } : undefined,
          "Erro inesperado ao criar sua conta. Tente novamente.",
        ),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePasswordRecovery = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const trimmedEmail = email.trim();
    const errors: FieldErrors = {};

    if (!trimmedEmail) {
      errors.email = "Informe o e-mail cadastrado na sua conta.";
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = "Digite um e-mail válido.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoadingAction("email");

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : "/login";

      const { error } = await authClient.requestPasswordReset({
        email: trimmedEmail,
        redirectTo,
      });

      if (error) {
        const isDisabled =
          error.code?.toUpperCase().includes("RESET_PASSWORD_DISABLED") ||
          error.message?.toLowerCase().includes("reset password isn't enabled");

        setFeedback({
          type: isDisabled ? "info" : "error",
          text: translateAuthError(
            error,
            "Não foi possível enviar o link de recuperação.",
          ),
        });
        return;
      }

      setFeedback({
        type: "success",
        text: "Se este e-mail estiver cadastrado no Hikari, você receberá as instruções para redefinir sua senha.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: translateAuthError(
          err instanceof Error ? { message: err.message } : undefined,
          "Falha ao solicitar recuperação de senha.",
        ),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const headingCopy =
    mode === "register"
      ? {
          title: "Criar conta no Hikari",
          subtitle:
            "Salve seus animes favoritos, acompanhe episódios e participe das discussões.",
        }
      : mode === "forgot"
        ? {
            title: "Recuperar acesso",
            subtitle:
              "Informe o e-mail da sua conta para solicitar a redefinição de senha.",
          }
        : {
            title: "Bem-vindo de volta",
            subtitle:
              "Acesse sua conta para sincronizar sua coleção, curtidas e comentários.",
          };

  const inputBaseClass =
    "w-full min-h-[46px] rounded-xl border bg-[#08070d]/90 pl-10 pr-4 text-base sm:text-sm text-[#f4f4f1] placeholder:text-zinc-500 outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-[#a855f7] focus:bg-[#0b0914] focus:ring-2 focus:ring-[#a855f7]/25 disabled:opacity-60";

  const content = (
    <div
      ref={dialogRef}
      role={isModal ? "dialog" : undefined}
      aria-modal={isModal || undefined}
      aria-labelledby={`${baseId}-title`}
      className={cn(
        "relative w-full max-w-[432px] overflow-hidden rounded-2xl sm:rounded-3xl",
        "border border-[#a855f7]/22 bg-[#0d0b16]/[0.98] text-[#f4f4f1]",
        "shadow-[0_28px_80px_-16px_rgba(0,0,0,0.92),0_0_0_1px_rgba(255,255,255,0.03)_inset]",
        "backdrop-blur-2xl p-4 sm:p-6",
      )}
    >
      {/* Aura obsidiana & ametista sutil no topo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgba(168,85,247,0.16),transparent_75%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#c084fc]/70 to-transparent"
      />

      {/* Botão fechar (apenas quando callback é fornecido) */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          disabled={isBusy}
          aria-label="Fechar janela de autenticação"
          className="absolute right-2.5 top-2.5 z-20 flex size-11 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc] disabled:opacity-50"
        >
          <X className="size-4.5" />
        </button>
      )}

      <div className="relative z-10">
        {/* Cabeçalho com marca preservada */}
        <div className="flex flex-col items-center text-center pt-0.5">
          <div className="mb-2.5 flex items-center justify-center">
            <Logo size="sm" linkToHome={false} />
          </div>

          <h2
            id={`${baseId}-title`}
            className="font-display text-xl sm:text-[22px] font-bold tracking-tight text-[#f4f4f1] leading-snug"
          >
            {headingCopy.title}
          </h2>

          <p className="mt-1 text-[13px] text-zinc-400 max-w-[34ch] leading-relaxed">
            {headingCopy.subtitle}
          </p>
        </div>

        {/* Alternância de modo: Entrar | Criar conta */}
        {mode !== "forgot" ? (
          <div
            role="tablist"
            aria-label="Modo de autenticação"
            className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-[#08070d]/90 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => switchMode("login")}
              disabled={isBusy}
              className={cn(
                "min-h-[42px] rounded-lg px-3 text-[13px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]",
                mode === "login"
                  ? "bg-[#1c162e] text-white shadow-[0_2px_10px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(192,132,252,0.35)]"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => switchMode("register")}
              disabled={isBusy}
              className={cn(
                "min-h-[42px] rounded-lg px-3 text-[13px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]",
                mode === "register"
                  ? "bg-[#1c162e] text-white shadow-[0_2px_10px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(192,132,252,0.35)]"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              Criar conta
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => switchMode("login")}
              disabled={isBusy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-[#c084fc] transition-colors hover:bg-[#a855f7]/10 hover:text-[#d8b4fe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]"
            >
              <ArrowLeft className="size-4" />
              <span>Voltar para o login</span>
            </button>
          </div>
        )}

        {/* Alerta de feedback (erro, informação ou sucesso) */}
        {feedback && (
          <div
            role={feedback.type === "error" ? "alert" : "status"}
            className={cn(
              "mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed",
              feedback.type === "error"
                ? "border-rose-500/35 bg-rose-950/35 text-rose-200"
                : feedback.type === "success"
                  ? "border-emerald-500/35 bg-emerald-950/35 text-emerald-200"
                  : "border-[#a855f7]/35 bg-[#a855f7]/12 text-purple-100",
            )}
          >
            {feedback.type === "error" ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-300" />
            ) : feedback.type === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-[#c084fc]" />
            )}
            <span className="flex-1">{feedback.text}</span>
          </div>
        )}

        {/* Google Auth (único provedor social mantido) */}
        {mode !== "forgot" && (
          <>
            <div className="mt-3.5">
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={isBusy}
                className="group flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-[#161224] px-4 py-2 text-sm font-semibold text-[#f4f4f1] shadow-sm transition-all duration-150 hover:border-[#c084fc]/50 hover:bg-[#1e1833] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc] disabled:opacity-60"
              >
                {loadingAction === "google" ? (
                  <Loader2 className="size-4 animate-spin text-[#c084fc]" />
                ) : (
                  <GoogleMark />
                )}
                <span>
                  {loadingAction === "google"
                    ? "Conectando ao Google..."
                    : "Continuar com Google"}
                </span>
              </button>
            </div>

            <div className="my-3.5 flex items-center gap-3" aria-hidden="true">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                ou com e-mail
              </span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>
          </>
        )}

        {/* Formulário: Login por e-mail */}
        {mode === "login" && (
          <form
            noValidate
            onSubmit={(e) => void handleEmailLogin(e)}
            className="space-y-3.5"
          >
            <div>
              <label
                htmlFor={`${baseId}-login-email`}
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id={`${baseId}-login-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }}
                  placeholder="voce@exemplo.com"
                  disabled={isBusy}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? `${baseId}-login-email-err` : undefined
                  }
                  className={cn(
                    inputBaseClass,
                    fieldErrors.email
                      ? "border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/20"
                      : "border-white/12",
                  )}
                />
              </div>
              {fieldErrors.email && (
                <p
                  id={`${baseId}-login-email-err`}
                  className="mt-1.5 text-xs text-rose-300"
                >
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label
                  htmlFor={`${baseId}-login-password`}
                  className="text-xs font-medium text-zinc-300"
                >
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  disabled={isBusy}
                  className="text-xs font-medium text-[#c084fc] transition-colors hover:text-[#d8b4fe] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc] rounded px-1 py-0.5"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id={`${baseId}-login-password`}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  placeholder="Sua senha"
                  disabled={isBusy}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password
                      ? `${baseId}-login-password-err`
                      : undefined
                  }
                  className={cn(
                    inputBaseClass,
                    "pr-12",
                    fieldErrors.password
                      ? "border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/20"
                      : "border-white/12",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p
                  id={`${baseId}-login-password-err`}
                  className="mt-1.5 text-xs text-rose-300"
                >
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="mt-1 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9333ea] to-[#7e22ce] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_-8px_rgba(168,85,247,0.55)] transition-all duration-150 hover:from-[#a855f7] hover:to-[#9333ea] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc] disabled:opacity-60"
            >
              {loadingAction === "email" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              <span>
                {loadingAction === "email" ? "Entrando..." : "Entrar na conta"}
              </span>
            </button>
          </form>
        )}

        {/* Formulário: Cadastro por e-mail */}
        {mode === "register" && (
          <form
            noValidate
            onSubmit={(e) => void handleEmailRegister(e)}
            className="space-y-2.5"
          >
            <div>
              <label
                htmlFor={`${baseId}-register-name`}
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Nome de exibição
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id={`${baseId}-register-name`}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError("name");
                  }}
                  placeholder="Como quer ser chamado"
                  disabled={isBusy}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={
                    fieldErrors.name ? `${baseId}-register-name-err` : undefined
                  }
                  className={cn(
                    inputBaseClass,
                    fieldErrors.name
                      ? "border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/20"
                      : "border-white/12",
                  )}
                />
              </div>
              {fieldErrors.name && (
                <p
                  id={`${baseId}-register-name-err`}
                  className="mt-1.5 text-xs text-rose-300"
                >
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={`${baseId}-register-email`}
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id={`${baseId}-register-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }}
                  placeholder="voce@exemplo.com"
                  disabled={isBusy}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email
                      ? `${baseId}-register-email-err`
                      : undefined
                  }
                  className={cn(
                    inputBaseClass,
                    fieldErrors.email
                      ? "border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/20"
                      : "border-white/12",
                  )}
                />
              </div>
              {fieldErrors.email && (
                <p
                  id={`${baseId}-register-email-err`}
                  className="mt-1.5 text-xs text-rose-300"
                >
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label
                  htmlFor={`${baseId}-register-password`}
                  className="text-xs font-medium text-zinc-300"
                >
                  Senha
                </label>
                <span className="text-[11px] text-zinc-500">
                  Mínimo de 8 caracteres
                </span>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id={`${baseId}-register-password`}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  placeholder="Crie uma senha segura"
                  disabled={isBusy}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password
                      ? `${baseId}-register-password-err`
                      : undefined
                  }
                  className={cn(
                    inputBaseClass,
                    "pr-12",
                    fieldErrors.password
                      ? "border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/20"
                      : "border-white/12",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p
                  id={`${baseId}-register-password-err`}
                  className="mt-1.5 text-xs text-rose-300"
                >
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={`${baseId}-register-confirm`}
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Confirmar senha
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id={`${baseId}-register-confirm`}
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearFieldError("confirmPassword");
                  }}
                  placeholder="Repita sua senha"
                  disabled={isBusy}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={
                    fieldErrors.confirmPassword
                      ? `${baseId}-register-confirm-err`
                      : undefined
                  }
                  className={cn(
                    inputBaseClass,
                    "pr-12",
                    fieldErrors.confirmPassword
                      ? "border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/20"
                      : "border-white/12",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword
                      ? "Ocultar confirmação de senha"
                      : "Mostrar confirmação de senha"
                  }
                  className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p
                  id={`${baseId}-register-confirm-err`}
                  className="mt-1.5 text-xs text-rose-300"
                >
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="mt-1 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9333ea] to-[#7e22ce] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_-8px_rgba(168,85,247,0.55)] transition-all duration-150 hover:from-[#a855f7] hover:to-[#9333ea] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc] disabled:opacity-60"
            >
              {loadingAction === "email" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              <span>
                {loadingAction === "email"
                  ? "Criando conta..."
                  : "Criar conta Hikari"}
              </span>
            </button>
          </form>
        )}

        {/* Formulário: Recuperação de senha */}
        {mode === "forgot" && (
          <form
            noValidate
            onSubmit={(e) => void handlePasswordRecovery(e)}
            className="mt-4 space-y-4"
          >
            <div>
              <label
                htmlFor={`${baseId}-forgot-email`}
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                E-mail da conta
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id={`${baseId}-forgot-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }}
                  placeholder="voce@exemplo.com"
                  disabled={isBusy}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? `${baseId}-forgot-email-err` : undefined
                  }
                  className={cn(
                    inputBaseClass,
                    fieldErrors.email
                      ? "border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/20"
                      : "border-white/12",
                  )}
                />
              </div>
              {fieldErrors.email && (
                <p
                  id={`${baseId}-forgot-email-err`}
                  className="mt-1.5 text-xs text-rose-300"
                >
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9333ea] to-[#7e22ce] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_-8px_rgba(168,85,247,0.55)] transition-all duration-150 hover:from-[#a855f7] hover:to-[#9333ea] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc] disabled:opacity-60"
            >
              {loadingAction === "email" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              <span>
                {loadingAction === "email"
                  ? "Enviando solicitação..."
                  : "Enviar link de recuperação"}
              </span>
            </button>
          </form>
        )}

        {/* Rodapé legal */}
        <p className="mt-4 text-center text-[11px] text-zinc-400 leading-relaxed">
          Ao continuar, você concorda com os{" "}
          <Link
            to="/termos"
            onClick={onClose}
            className="text-[#c084fc] hover:text-[#d8b4fe] hover:underline underline-offset-2"
          >
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link
            to="/privacidade"
            onClick={onClose}
            className="text-[#c084fc] hover:text-[#d8b4fe] hover:underline underline-offset-2"
          >
            Política de Privacidade
          </Link>{" "}
          do Hikari.
        </p>
      </div>
    </div>
  );

  if (!isModal) return content;

  return (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose && !isBusy) {
          onClose();
        }
      }}
    >
      <div
        className="flex min-h-full items-center justify-center"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && onClose && !isBusy) {
            onClose();
          }
        }}
      >
        {content}
      </div>
    </div>
  );
}
