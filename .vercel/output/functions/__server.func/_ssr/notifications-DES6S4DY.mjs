import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as cn } from "./utils-Cws_m9jY.mjs";
import { Ct as ArrowLeft, bt as Bell, st as CircleUser } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/notifications-DES6S4DY.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/notifications.tsx?tsr-split=component";
function NotificationsPage() {
	const [notifications, setNotifications] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		const loadNotifications = async () => {
			try {
				const response = await fetch("/api/notifications");
				if (!response.ok) return;
				const data = await response.json();
				if (cancelled) return;
				setNotifications(data.notifications ?? []);
			} catch {
				if (!cancelled) setNotifications([]);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		loadNotifications();
		return () => {
			cancelled = true;
		};
	}, []);
	async function markNotificationAsRead(id) {
		setNotifications((current) => current.map((notification) => notification.id === id ? {
			...notification,
			read: true
		} : notification));
		try {
			await fetch("/api/notifications", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id })
			});
		} catch {}
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "mx-auto w-full max-w-3xl py-6 sm:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "mb-6 flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/",
					className: "flex size-10 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-fg",
					"aria-label": "Voltar",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ArrowLeft, { className: "size-5" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 84,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 83,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
					className: "text-xl font-semibold sm:text-2xl",
					children: "Todas as notificações"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 88,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Suas atividades recentes"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 92,
					columnNumber: 11
				}, this)] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 87,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 81,
				columnNumber: 7
			}, this),
			loading && /* @__PURE__ */ (void 0)("div", {
				className: "flex min-h-40 items-center justify-center rounded-xl border border-border bg-bg px-5 py-10",
				children: /* @__PURE__ */ (void 0)("p", {
					className: "text-sm text-muted",
					children: "Carregando notificações..."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 101,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 100,
				columnNumber: 19
			}, this),
			!loading && notifications.length === 0 && /* @__PURE__ */ (void 0)("div", {
				className: "flex min-h-60 items-center justify-center rounded-xl border border-border bg-bg px-5 py-10 text-center",
				children: /* @__PURE__ */ (void 0)("div", { children: [
					/* @__PURE__ */ (void 0)(Bell, { className: "mx-auto mb-4 size-8 text-muted" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 109,
						columnNumber: 15
					}, this),
					/* @__PURE__ */ (void 0)("p", {
						className: "text-sm font-medium",
						children: "Nenhuma notificação"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 111,
						columnNumber: 15
					}, this),
					/* @__PURE__ */ (void 0)("p", {
						className: "mt-1 text-xs text-muted",
						children: "Quando alguém interagir com seu perfil, aparecerá aqui."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 115,
						columnNumber: 15
					}, this)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 108,
					columnNumber: 13
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 107,
				columnNumber: 50
			}, this),
			!loading && notifications.length > 0 && /* @__PURE__ */ (void 0)("div", {
				className: "overflow-hidden rounded-xl border border-border bg-bg",
				children: notifications.map((notification) => {
					const hasEpisodeTarget = Boolean(notification.animeId && notification.episodeId);
					const isLikeNotification = notification.type === "comment_like";
					const isReplyNotification = notification.type === "comment_reply";
					const likeCount = Number(notification.commentLikes ?? 0);
					const likeAvatars = Array.isArray(notification.likeAvatars) ? notification.likeAvatars : [];
					const notificationMessage = isLikeNotification && likeCount > 1 && notification.actorName ? `${notification.actorName} e mais ${likeCount - 1} ${likeCount - 1 === 1 ? "pessoa" : "pessoas"} curtiram seu comentário.` : notification.message;
					const content = /* @__PURE__ */ (void 0)("div", {
						className: cn("border-b border-border px-4 py-4 last:border-b-0 sm:px-5", !notification.read && "border-l-4 border-l-blue-500 bg-blue-500/10"),
						children: /* @__PURE__ */ (void 0)("div", {
							className: "flex gap-3",
							children: [notification.actorImage ? /* @__PURE__ */ (void 0)("img", {
								src: notification.actorImage,
								alt: "",
								className: "size-10 shrink-0 rounded-full object-cover"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 134,
								columnNumber: 50
							}, this) : /* @__PURE__ */ (void 0)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated text-muted",
								children: /* @__PURE__ */ (void 0)(CircleUser, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 135,
									columnNumber: 27
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 134,
								columnNumber: 152
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "min-w-0 flex-1",
								children: [
									/* @__PURE__ */ (void 0)("div", {
										className: "flex items-start gap-3",
										children: [/* @__PURE__ */ (void 0)("p", {
											className: "min-w-0 flex-1 text-sm leading-5 text-fg",
											children: notificationMessage
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 142,
											columnNumber: 27
										}, this), !notification.read && /* @__PURE__ */ (void 0)("span", { className: "mt-1 size-2 shrink-0 rounded-full bg-blue-500" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 146,
											columnNumber: 50
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 140,
										columnNumber: 25
									}, this),
									isLikeNotification && /* @__PURE__ */ (void 0)("div", {
										className: "mt-2 flex items-center gap-2",
										children: [likeAvatars.length > 0 && /* @__PURE__ */ (void 0)("div", {
											className: "flex items-center pl-1",
											children: likeAvatars.slice(0, 2).map((avatar, index) => /* @__PURE__ */ (void 0)("div", {
												className: cn("relative size-6 overflow-hidden rounded-full border-2 border-bg bg-elevated", index > 0 && "-ml-2"),
												style: { zIndex: 10 - index },
												children: avatar.image ? /* @__PURE__ */ (void 0)("img", {
													src: avatar.image,
													alt: "",
													className: "size-full object-cover"
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 157,
													columnNumber: 57
												}, this) : /* @__PURE__ */ (void 0)("div", {
													className: "flex size-full items-center justify-center text-[9px] font-semibold text-muted",
													children: (avatar.name ?? "U").charAt(0).toUpperCase()
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 157,
													columnNumber: 128
												}, this)
											}, avatar.id, false, {
												fileName: _jsxFileName,
												lineNumber: 154,
												columnNumber: 81
											}, this))
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 152,
											columnNumber: 56
										}, this), /* @__PURE__ */ (void 0)("span", {
											className: "text-xs font-medium text-muted",
											children: [
												likeCount,
												" ",
												likeCount === 1 ? "curtida" : "curtidas"
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 164,
											columnNumber: 29
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 150,
										columnNumber: 48
									}, this),
									(notification.animeCover || notification.animeTitle) && /* @__PURE__ */ (void 0)("div", {
										className: "mt-2 flex items-center gap-3",
										children: [notification.animeCover ? /* @__PURE__ */ (void 0)("img", {
											src: notification.animeCover,
											alt: "",
											className: "h-16 w-12 shrink-0 rounded-md object-cover"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 172,
											columnNumber: 56
										}, this) : null, /* @__PURE__ */ (void 0)("div", {
											className: "min-w-0 flex-1",
											children: [notification.animeTitle && /* @__PURE__ */ (void 0)("p", {
												className: "truncate text-sm font-medium text-fg",
												children: notification.animeTitle
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 176,
												columnNumber: 59
											}, this), hasEpisodeTarget && (isLikeNotification || isReplyNotification) && /* @__PURE__ */ (void 0)("p", {
												className: "mt-1 text-xs font-medium text-muted",
												children: notification.commentId ? "Ver comentário" : "Ver episódio"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 180,
												columnNumber: 99
											}, this)]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 174,
											columnNumber: 29
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 170,
										columnNumber: 82
									}, this),
									hasEpisodeTarget && (isLikeNotification || isReplyNotification) && !notification.animeCover && !notification.animeTitle && /* @__PURE__ */ (void 0)("div", {
										className: "mt-2",
										children: /* @__PURE__ */ (void 0)("span", {
											className: "inline-flex items-center rounded-md bg-elevated px-2.5 py-1 text-xs font-medium text-fg",
											children: notification.commentId ? "Ver comentário" : "Ver episódio"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 188,
											columnNumber: 31
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 187,
										columnNumber: 149
									}, this),
									/* @__PURE__ */ (void 0)("p", {
										className: "mt-2 text-[11px] text-muted",
										children: new Date(notification.createdAt).toLocaleString("pt-BR", {
											dateStyle: "short",
											timeStyle: "short"
										})
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 193,
										columnNumber: 25
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 138,
								columnNumber: 23
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 132,
							columnNumber: 21
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 131,
						columnNumber: 25
					}, this);
					if (hasEpisodeTarget) return /* @__PURE__ */ (void 0)(Link, {
						to: "/watch/$id",
						params: { id: notification.animeId },
						search: {
							ep: notification.episodeId,
							comment: notification.commentId ?? void 0
						},
						onClick: () => {
							markNotificationAsRead(notification.id);
						},
						className: "block transition-colors hover:bg-elevated/70",
						children: content
					}, notification.id, false, {
						fileName: _jsxFileName,
						lineNumber: 204,
						columnNumber: 18
					}, this);
					return /* @__PURE__ */ (void 0)("button", {
						type: "button",
						onClick: () => {
							markNotificationAsRead(notification.id);
						},
						className: "block w-full text-left transition-colors hover:bg-elevated/70",
						children: content
					}, notification.id, false, {
						fileName: _jsxFileName,
						lineNumber: 215,
						columnNumber: 16
					}, this);
				})
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 122,
				columnNumber: 48
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 78,
		columnNumber: 10
	}, this);
}
//#endregion
export { NotificationsPage as component };
