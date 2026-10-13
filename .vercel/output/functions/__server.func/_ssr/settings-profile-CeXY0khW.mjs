import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { O as Save, ct as CircleUserRound, ht as Camera } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { I as updateProfile } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-profile-CeXY0khW.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/settings-profile.tsx?tsr-split=component";
function SettingsProfile() {
	const fileInputRef = (0, import_react.useRef)(null);
	const [nick, setNick] = (0, import_react.useState)("");
	const [bio, setBio] = (0, import_react.useState)("");
	const [imagePreview, setImagePreview] = (0, import_react.useState)(null);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [message, setMessage] = (0, import_react.useState)("");
	const handlePhotoClick = () => {
		fileInputRef.current?.click();
	};
	const handlePhotoChange = (event) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const preview = URL.createObjectURL(file);
		setImagePreview(preview);
		setMessage("Foto selecionada.");
	};
	const handleSave = async () => {
		if (!nick.trim()) {
			setMessage("Digite um nick.");
			return;
		}
		try {
			setSaving(true);
			setMessage("");
			await updateProfile({ data: {
				nick: nick.trim(),
				bio: bio.trim(),
				favorites: []
			} });
			setMessage("Perfil salvo com sucesso.");
		} catch (error) {
			console.error(error);
			setMessage("Não foi possível salvar o perfil.");
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
					lineNumber: 51,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-11 items-center justify-center rounded-xl bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleUserRound, { className: "size-5 text-fg" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 57,
							columnNumber: 13
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 56,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
						className: "text-2xl font-bold text-fg",
						children: "Perfil"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 61,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Personalize as informações do seu perfil."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 65,
						columnNumber: 13
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 60,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 55,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 50,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted",
					children: "Foto do perfil"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 74,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "rounded-xl border border-border bg-bg p-5",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex flex-col items-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex size-24 items-center justify-center overflow-hidden rounded-full bg-elevated",
									children: imagePreview ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
										src: imagePreview,
										alt: "Prévia da foto de perfil",
										className: "size-full object-cover"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 85,
										columnNumber: 33
									}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleUserRound, { className: "size-12 text-muted" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 85,
										columnNumber: 128
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 83,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
									type: "button",
									onClick: handlePhotoClick,
									className: "absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full border border-border bg-bg text-fg shadow-lg transition-colors hover:bg-elevated",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Camera, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 90,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 89,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 81,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("input", {
								ref: fileInputRef,
								type: "file",
								accept: "image/*",
								onChange: handlePhotoChange,
								className: "hidden"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 95,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-3 text-sm text-fg",
								children: "Sua foto de perfil"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 97,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-xs text-muted",
								children: "Toque no ícone da câmera para alterar."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 101,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 79,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 78,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 73,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("label", {
						htmlFor: "profile-nick",
						className: "mb-2 block px-1 text-xs font-semibold uppercase tracking-wider text-muted",
						children: "Nick"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 111,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("input", {
						id: "profile-nick",
						type: "text",
						value: nick,
						onChange: (event) => setNick(event.target.value),
						placeholder: "Seu nick",
						className: "w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-fg"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 115,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-2 px-1 text-xs text-muted",
						children: "Esse nome será exibido no seu perfil público."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 117,
						columnNumber: 9
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 110,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mb-7",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("label", {
						htmlFor: "profile-bio",
						className: "mb-2 block px-1 text-xs font-semibold uppercase tracking-wider text-muted",
						children: "Bio"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 124,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("textarea", {
						id: "profile-bio",
						rows: 5,
						value: bio,
						onChange: (event) => setBio(event.target.value),
						placeholder: "Conte um pouco sobre você...",
						className: "w-full resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-fg"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 128,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-2 px-1 text-xs text-muted",
						children: "Sua bio aparecerá no seu perfil público."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 130,
						columnNumber: 9
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 123,
				columnNumber: 7
			}, this),
			message && /* @__PURE__ */ (void 0)("p", {
				className: "mb-4 text-center text-sm text-muted",
				children: message
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 136,
				columnNumber: 19
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
				type: "button",
				onClick: () => void handleSave(),
				disabled: saving,
				className: "flex w-full items-center justify-center gap-2 rounded-xl bg-fg px-4 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Save, { className: "size-4" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 142,
					columnNumber: 9
				}, this), saving ? "Salvando..." : "Salvar alterações"]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 141,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 47,
		columnNumber: 10
	}, this);
}
//#endregion
export { SettingsProfile as component };
