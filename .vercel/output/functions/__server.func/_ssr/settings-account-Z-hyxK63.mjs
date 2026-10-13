import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { G as Lock, U as Mail, d as TriangleAlert, t as X, ut as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { L as useCurrentUserState, x as Route$40 } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-account-Z-hyxK63.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/settings-account.tsx?tsr-split=component";
function getSavedEmail() {
	if (typeof window === "undefined") return "";
	return window.localStorage.getItem("hikari-account-email") ?? "";
}
function SettingsAccount() {
	const { email: serverEmail } = Route$40.useLoaderData();
	const { user } = useCurrentUserState();
	const initialEmail = serverEmail || user?.primaryEmail || getSavedEmail();
	const [email, setEmail] = (0, import_react.useState)(initialEmail);
	const [emailOpen, setEmailOpen] = (0, import_react.useState)(false);
	const [passwordOpen, setPasswordOpen] = (0, import_react.useState)(false);
	const [newEmail, setNewEmail] = (0, import_react.useState)(initialEmail);
	const [currentPassword, setCurrentPassword] = (0, import_react.useState)("");
	const [newPassword, setNewPassword] = (0, import_react.useState)("");
	const [confirmPassword, setConfirmPassword] = (0, import_react.useState)("");
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [success, setSuccess] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		const currentEmail = user?.primaryEmail;
		if (!currentEmail) return;
		setEmail(currentEmail);
		setNewEmail((currentValue) => currentValue || currentEmail);
		window.localStorage.setItem("hikari-account-email", currentEmail);
	}, [user?.primaryEmail]);
	const closeModals = () => {
		if (saving) return;
		setEmailOpen(false);
		setPasswordOpen(false);
		setCurrentPassword("");
		setNewPassword("");
		setConfirmPassword("");
		setError("");
	};
	const handleChangeEmail = async () => {
		const value = newEmail.trim();
		if (!value) {
			setError("Digite um novo e-mail.");
			return;
		}
		if (value === email) {
			setError("Digite um e-mail diferente do atual.");
			return;
		}
		try {
			setSaving(true);
			setError("");
			setSuccess("");
			const response = await fetch("/api/auth/change-email", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					newEmail: value,
					callbackURL: "/settings-account"
				})
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) throw new Error(data?.error?.message || data?.error || "Não foi possível alterar o e-mail.");
			setEmailOpen(false);
			setEmail(value);
			setNewEmail(value);
			window.localStorage.setItem("hikari-account-email", value);
			setSuccess("Solicitação enviada. Verifique seu novo e-mail para confirmar a alteração.");
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : "Não foi possível alterar o e-mail.");
		} finally {
			setSaving(false);
		}
	};
	const handleChangePassword = async () => {
		if (!currentPassword) {
			setError("Digite sua senha atual.");
			return;
		}
		if (!newPassword) {
			setError("Digite uma nova senha.");
			return;
		}
		if (newPassword.length < 8) {
			setError("A nova senha deve ter pelo menos 8 caracteres.");
			return;
		}
		if (newPassword !== confirmPassword) {
			setError("As senhas não coincidem.");
			return;
		}
		try {
			setSaving(true);
			setError("");
			setSuccess("");
			const response = await fetch("/api/auth/change-password", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					currentPassword,
					newPassword,
					revokeOtherSessions: false
				})
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) throw new Error(data?.error?.message || data?.error || "Não foi possível alterar a senha.");
			setPasswordOpen(false);
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setSuccess("Senha alterada com sucesso.");
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
		} finally {
			setSaving(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "min-h-screen pb-20 pt-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "mb-6",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/settings",
					className: "mb-4 inline-flex items-center text-sm text-muted hover:text-fg",
					children: "← Voltar"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 144,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-11 items-center justify-center rounded-xl bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Mail, { className: "size-5 text-fg" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 150,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 149,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
						className: "text-2xl font-bold text-fg",
						children: "Conta"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 154,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Gerencie seus dados de acesso."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 158,
						columnNumber: 13
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 153,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 148,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 143,
				columnNumber: 7
			}, this),
			success && /* @__PURE__ */ (void 0)("div", {
				className: "mb-5 rounded-xl border border-white/10 bg-elevated px-4 py-3 text-sm text-muted",
				children: success
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 166,
				columnNumber: 19
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "E-mail"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 172,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					type: "button",
					onClick: () => {
						setNewEmail(email || user?.primaryEmail || serverEmail || "");
						setError("");
						setEmailOpen(true);
					},
					className: "flex w-full items-center gap-4 rounded-xl border border-border bg-bg p-4 text-left transition-colors hover:bg-elevated",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Mail, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 182,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 181,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-medium text-fg",
								children: "E-mail da conta"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 186,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 truncate text-sm text-muted",
								children: email
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 190,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 185,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-5 shrink-0 text-muted" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 195,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 176,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 171,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "Segurança"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 201,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					type: "button",
					onClick: () => {
						setError("");
						setPasswordOpen(true);
					},
					className: "flex w-full items-center gap-4 rounded-xl border border-border bg-bg px-4 py-4 text-left transition-colors hover:bg-elevated",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Lock, { className: "size-5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 210,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 209,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-medium text-fg",
								children: "Alterar senha"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 214,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-xs text-muted",
								children: "Altere a senha usada para acessar sua conta."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 218,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 213,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-5 shrink-0 text-muted" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 223,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 205,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 200,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
				className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-red-400",
				children: "Zona de perigo"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 229,
				columnNumber: 9
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "rounded-xl border border-red-500/20 bg-red-500/5 p-4",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-start gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(TriangleAlert, { className: "size-5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 236,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 235,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "min-w-0 flex-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-medium text-fg",
								children: "Excluir conta"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 240,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-xs leading-5 text-muted",
								children: "A exclusão da conta é uma ação permanente. Esta opção será configurada posteriormente."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 244,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								type: "button",
								disabled: true,
								className: "mt-4 rounded-lg border border-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 opacity-50",
								children: "Excluir minha conta"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 249,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 239,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 234,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 233,
				columnNumber: 9
			}, this)] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 228,
				columnNumber: 7
			}, this),
			emailOpen && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5",
				children: /* @__PURE__ */ (void 0)("div", {
					className: "w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl",
					children: [
						/* @__PURE__ */ (void 0)("div", {
							className: "flex items-start gap-3",
							children: [
								/* @__PURE__ */ (void 0)("div", {
									className: "flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated",
									children: /* @__PURE__ */ (void 0)(Mail, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 262,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 261,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (void 0)("h3", {
										className: "text-xl font-semibold text-fg",
										children: "Alterar e-mail"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 266,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Digite o novo e-mail da sua conta."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 270,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 265,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: closeModals,
									disabled: saving,
									className: "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg",
									children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 276,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 275,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 260,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5",
							children: [/* @__PURE__ */ (void 0)("label", {
								className: "text-sm text-muted",
								children: "Novo e-mail"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 281,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("input", {
								type: "email",
								value: newEmail,
								onChange: (event) => setNewEmail(event.target.value),
								placeholder: "novo@email.com",
								className: "mt-2 w-full rounded-xl border border-white/10 bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/20"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 285,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 280,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 288,
							columnNumber: 23
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 flex gap-2",
							children: [/* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: closeModals,
								disabled: saving,
								className: "flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-muted hover:bg-elevated",
								children: "Cancelar"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 293,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => void handleChangeEmail(),
								disabled: saving,
								className: "flex-1 rounded-xl bg-elevated px-4 py-3 text-sm font-medium text-fg hover:bg-white/10 disabled:opacity-50",
								children: saving ? "Enviando..." : "Continuar"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 297,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 292,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 259,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 258,
				columnNumber: 21
			}, this),
			passwordOpen && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5",
				children: /* @__PURE__ */ (void 0)("div", {
					className: "w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl",
					children: [
						/* @__PURE__ */ (void 0)("div", {
							className: "flex items-start gap-3",
							children: [
								/* @__PURE__ */ (void 0)("div", {
									className: "flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated",
									children: /* @__PURE__ */ (void 0)(Lock, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 309,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 308,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (void 0)("h3", {
										className: "text-xl font-semibold text-fg",
										children: "Alterar senha"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 313,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Digite sua senha atual e escolha uma nova."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 317,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 312,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: closeModals,
									disabled: saving,
									className: "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg",
									children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 323,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 322,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 307,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 space-y-4",
							children: [
								/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("label", {
									className: "text-sm text-muted",
									children: "Senha atual"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 329,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("input", {
									type: "password",
									value: currentPassword,
									onChange: (event) => setCurrentPassword(event.target.value),
									className: "mt-2 w-full rounded-xl border border-white/10 bg-bg px-4 py-3 text-sm text-fg outline-none focus:border-white/20"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 333,
									columnNumber: 17
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 328,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("label", {
									className: "text-sm text-muted",
									children: "Nova senha"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 337,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("input", {
									type: "password",
									value: newPassword,
									onChange: (event) => setNewPassword(event.target.value),
									className: "mt-2 w-full rounded-xl border border-white/10 bg-bg px-4 py-3 text-sm text-fg outline-none focus:border-white/20"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 341,
									columnNumber: 17
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 336,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("label", {
									className: "text-sm text-muted",
									children: "Confirmar nova senha"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 345,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("input", {
									type: "password",
									value: confirmPassword,
									onChange: (event) => setConfirmPassword(event.target.value),
									className: "mt-2 w-full rounded-xl border border-white/10 bg-bg px-4 py-3 text-sm text-fg outline-none focus:border-white/20"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 349,
									columnNumber: 17
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 344,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 327,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 353,
							columnNumber: 23
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 flex gap-2",
							children: [/* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: closeModals,
								disabled: saving,
								className: "flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-muted hover:bg-elevated",
								children: "Cancelar"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 358,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => void handleChangePassword(),
								disabled: saving,
								className: "flex-1 rounded-xl bg-elevated px-4 py-3 text-sm font-medium text-fg hover:bg-white/10 disabled:opacity-50",
								children: saving ? "Salvando..." : "Alterar senha"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 362,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 357,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 306,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 305,
				columnNumber: 24
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 141,
		columnNumber: 10
	}, this);
}
//#endregion
export { SettingsAccount as component };
