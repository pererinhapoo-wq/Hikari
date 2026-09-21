import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import {
  AlertTriangle,
  ChevronRight,
  Lock,
  Mail,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { auth } from "@/lib/auth/server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const getAccountSession = createServerFn({
  method: "GET",
}).handler(async () => {
  try {
    const session =
      await auth.api.getSession({
        headers: getRequestHeaders(),
      });

    return {
      email:
        session?.user?.email ??
        null,
    };
  } catch {
    return {
      email: null,
    };
  }
});

export const Route = createFileRoute(
  "/settings-account",
)({
  loader: async () => {
    return getAccountSession();
  },

  component: SettingsAccount,
});

function getSavedEmail() {
  if (typeof window === "undefined") {
    return "";
  }

  const savedEmail =
    window.localStorage.getItem(
      "hikari-account-email",
    );

  return savedEmail ?? "";
}

function SettingsAccount() {
  const {
    email: serverEmail,
  } =
    Route.useLoaderData();

  const { user } =
    useCurrentUserState();

  const initialEmail =
    serverEmail ||
    user?.primaryEmail ||
    getSavedEmail();

  const [
    email,
    setEmail,
  ] = useState<string>(
    initialEmail,
  );

  const [
    emailOpen,
    setEmailOpen,
  ] = useState(false);

  const [
    passwordOpen,
    setPasswordOpen,
  ] = useState(false);

  const [
    newEmail,
    setNewEmail,
  ] = useState(
    initialEmail,
  );

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  useEffect(() => {
    const currentEmail =
      user?.primaryEmail;

    if (!currentEmail) {
      return;
    }

    setEmail(currentEmail);

    setNewEmail((currentValue) =>
      currentValue || currentEmail,
    );

    window.localStorage.setItem(
      "hikari-account-email",
      currentEmail,
    );
  }, [user?.primaryEmail]);

  const closeModals = () => {
    if (saving) {
      return;
    }

    setEmailOpen(false);
    setPasswordOpen(false);

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    setError("");
  };

  const handleChangeEmail =
    async () => {
      const value =
        newEmail.trim();

      if (!value) {
        setError(
          "Digite um novo e-mail.",
        );
        return;
      }

      if (value === email) {
        setError(
          "Digite um e-mail diferente do atual.",
        );
        return;
      }

      try {
        setSaving(true);
        setError("");
        setSuccess("");

        const response =
          await fetch(
            "/api/auth/change-email",
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                newEmail: value,
                callbackURL:
                  "/settings-account",
              }),
            },
          );

        const data =
          await response
            .json()
            .catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error?.message ||
              data?.error ||
              "Não foi possível alterar o e-mail.",
          );
        }

        setEmailOpen(false);

        setEmail(value);
        setNewEmail(value);

        window.localStorage.setItem(
          "hikari-account-email",
          value,
        );

        setSuccess(
          "Solicitação enviada. Verifique seu novo e-mail para confirmar a alteração.",
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível alterar o e-mail.",
        );
      } finally {
        setSaving(false);
      }
    };

  const handleChangePassword =
    async () => {
      if (!currentPassword) {
        setError(
          "Digite sua senha atual.",
        );
        return;
      }

      if (!newPassword) {
        setError(
          "Digite uma nova senha.",
        );
        return;
      }

      if (newPassword.length < 8) {
        setError(
          "A nova senha deve ter pelo menos 8 caracteres.",
        );
        return;
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        setError(
          "As senhas não coincidem.",
        );
        return;
      }

      try {
        setSaving(true);
        setError("");
        setSuccess("");

        const response =
          await fetch(
            "/api/auth/change-password",
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                currentPassword,
                newPassword,
                revokeOtherSessions:
                  false,
              }),
            },
          );

        const data =
          await response
            .json()
            .catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error?.message ||
              data?.error ||
              "Não foi possível alterar a senha.",
          );
        }

        setPasswordOpen(false);

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

        setSuccess(
          "Senha alterada com sucesso.",
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível alterar a senha.",
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <div className="min-h-screen pb-20 pt-5">
      {/* CABEÇALHO */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="mb-4 inline-flex items-center text-sm text-muted hover:text-fg"
        >
          ← Voltar
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-elevated">
            <Mail className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Conta
            </h1>

            <p className="mt-1 text-sm text-muted">
              Gerencie seus dados de acesso.
            </p>
          </div>
        </div>
      </div>

      {/* MENSAGEM DE SUCESSO */}
      {success && (
        <div className="mb-5 rounded-xl border border-white/10 bg-elevated px-4 py-3 text-sm text-muted">
          {success}
        </div>
      )}

      {/* E-MAIL */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          E-mail
        </h2>

        <button
          type="button"
          onClick={() => {
            setNewEmail(
              email ||
                user?.primaryEmail ||
                serverEmail ||
                "",
            );
            setError("");
            setEmailOpen(true);
          }}
          className="flex w-full items-center gap-4 rounded-xl border border-border bg-bg p-4 text-left transition-colors hover:bg-elevated"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
            <Mail className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">
              E-mail da conta
            </p>

            <p className="mt-1 truncate text-sm text-muted">
              {email}
            </p>
          </div>

          <ChevronRight className="size-5 shrink-0 text-muted" />
        </button>
      </section>

      {/* SENHA */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Segurança
        </h2>

        <button
          type="button"
          onClick={() => {
            setError("");
            setPasswordOpen(true);
          }}
          className="flex w-full items-center gap-4 rounded-xl border border-border bg-bg px-4 py-4 text-left transition-colors hover:bg-elevated"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
            <Lock className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">
              Alterar senha
            </p>

            <p className="mt-1 text-xs text-muted">
              Altere a senha usada para acessar sua conta.
            </p>
          </div>

          <ChevronRight className="size-5 shrink-0 text-muted" />
        </button>
      </section>

      {/* EXCLUIR CONTA */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-red-400">
          Zona de perigo
        </h2>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <AlertTriangle className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Excluir conta
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                A exclusão da conta é uma ação permanente.
                Esta opção será configurada posteriormente.
              </p>

              <button
                type="button"
                disabled
                className="mt-4 rounded-lg border border-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 opacity-50"
              >
                Excluir minha conta
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* MODAL E-MAIL */}
      {emailOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated">
                <Mail className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-semibold text-fg">
                  Alterar e-mail
                </h3>

                <p className="mt-1 text-sm text-muted">
                  Digite o novo e-mail da sua conta.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModals}
                disabled={saving}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5">
              <label className="text-sm text-muted">
                Novo e-mail
              </label>

              <input
                type="email"
                value={newEmail}
                onChange={(event) =>
                  setNewEmail(
                    event.target.value,
                  )
                }
                placeholder="novo@email.com"
                className="mt-2 w-full rounded-xl border border-white/10 bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/20"
              />
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeModals}
                disabled={saving}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-muted hover:bg-elevated"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleChangeEmail()
                }
                disabled={saving}
                className="flex-1 rounded-xl bg-elevated px-4 py-3 text-sm font-medium text-fg hover:bg-white/10 disabled:opacity-50"
              >
                {saving
                  ? "Enviando..."
                  : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SENHA */}
      {passwordOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated">
                <Lock className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-semibold text-fg">
                  Alterar senha
                </h3>

                <p className="mt-1 text-sm text-muted">
                  Digite sua senha atual e escolha uma nova.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModals}
                disabled={saving}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm text-muted">
                  Senha atual
                </label>

                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-bg px-4 py-3 text-sm text-fg outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="text-sm text-muted">
                  Nova senha
                </label>

                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-bg px-4 py-3 text-sm text-fg outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="text-sm text-muted">
                  Confirmar nova senha
                </label>

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-bg px-4 py-3 text-sm text-fg outline-none focus:border-white/20"
                />
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeModals}
                disabled={saving}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-muted hover:bg-elevated"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleChangePassword()
                }
                disabled={saving}
                className="flex-1 rounded-xl bg-elevated px-4 py-3 text-sm font-medium text-fg hover:bg-white/10 disabled:opacity-50"
              >
                {saving
                  ? "Salvando..."
                  : "Alterar senha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
    }
