import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore, n as displayTitle } from "./types-CX6YV1cu.mjs";
import { a as youtubeIdFrom, r as isDirectVideo, t as cn } from "./utils-Cws_m9jY.mjs";
import { $ as Flag, B as MessageCircle, E as Send, M as PenLine, Q as Heart, Y as Image, d as TriangleAlert, dt as ChevronLeft, ft as ChevronDown, p as Trash2, rt as EllipsisVertical, t as X, ut as ChevronRight, xt as Ban } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { r as upload } from "../_libs/@vercel/blob+[...].mjs";
import { O as mergeDetail, R as isHikariAdmin, n as Route$12 } from "./router-Dx2-dd95.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/watch._id-imagem-corrigida-CIoRkyNG.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/watch.$id-imagem-corrigida.tsx?tsr-split=component";
function WatchPage() {
	const { id } = Route$12.useParams();
	const { ep: epQuery, comment: commentQuery } = Route$12.useSearch();
	const { remote } = Route$12.useLoaderData();
	const locals = useHikariStore((s) => s.animes);
	const markContinue = useHikariStore((s) => s.markContinue);
	const anime = mergeDetail(remote, id, locals);
	const episodes = (0, import_react.useMemo)(() => {
		if (!anime) return [];
		return anime.seasons.flatMap((s) => s.episodes);
	}, [anime]);
	const current = (0, import_react.useMemo)(() => {
		if (!episodes.length) return null;
		return episodes.find((e) => e.id === epQuery) ?? episodes[0];
	}, [episodes, epQuery]);
	const idx = current ? episodes.findIndex((e) => e.id === current.id) : -1;
	const prev = idx > 0 ? episodes[idx - 1] : null;
	const next = idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1] : null;
	(0, import_react.useEffect)(() => {
		if (!anime || !current) return;
		markContinue({
			animeId: anime.id,
			episodeId: current.id,
			episodeNumber: current.number,
			episodeTitle: current.title,
			cover: current.thumbnail || anime.cover,
			title: displayTitle(anime),
			updatedAt: Date.now()
		});
	}, [
		anime,
		current,
		markContinue
	]);
	const title = anime ? displayTitle(anime) : "";
	const playerUrls = (0, import_react.useMemo)(() => [
		current?.videoUrl,
		current?.videoUrl2,
		current?.videoUrl3
	], [current]);
	const [playerIndex, setPlayerIndex] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		setPlayerIndex(0);
	}, [current?.id]);
	if (!anime) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "flex min-h-dvh items-center justify-center bg-bg text-fg",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", { children: "Título não encontrado." }, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 63,
			columnNumber: 9
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 62,
		columnNumber: 12
	}, this);
	const playUrl = playerUrls[playerIndex] ?? current?.videoUrl ?? "";
	const yt = youtubeIdFrom(playUrl) || (!playUrl ? youtubeIdFrom(anime.trailerId) : null);
	const file = playUrl && isDirectVideo(playUrl) ? playUrl : null;
	const external = playUrl && !yt && !file ? playUrl : null;
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "flex min-h-dvh flex-col bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("header", {
			className: "flex h-14 items-center gap-2 px-3 sm:px-5",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
				to: "/anime/$id",
				params: { id: anime.id },
				className: "flex size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg",
				"aria-label": "Fechar player",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(X, { className: "size-5" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 81,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 78,
				columnNumber: 9
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "truncate text-sm font-medium",
					children: title
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 86,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "truncate text-xs text-muted",
					children: current ? `Episódio ${current.number} · ${current.title}` : "Trailer"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 90,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 84,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 76,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mx-auto w-full max-w-6xl flex-1 px-3 pb-12 sm:px-5",
			children: [
				playerUrls.length > 0 && /* @__PURE__ */ (void 0)("div", {
					className: "mb-3 flex flex-wrap gap-2",
					children: playerUrls.map((url, index) => url ? /* @__PURE__ */ (void 0)(Button, {
						type: "button",
						size: "sm",
						variant: playerIndex === index ? "default" : "outline",
						onClick: () => setPlayerIndex(index),
						children: ["Player ", index + 1]
					}, index, true, {
						fileName: _jsxFileName,
						lineNumber: 106,
						columnNumber: 51
					}, this) : null)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 104,
					columnNumber: 35
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "aspect-video overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]",
					children: yt ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("iframe", {
						title: `${title} — player`,
						src: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`,
						className: "size-full",
						allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
						allowFullScreen: true
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 118,
						columnNumber: 17
					}, this) : file ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("video", {
						src: file,
						controls: true,
						autoPlay: true,
						className: "size-full bg-bg object-contain"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 118,
						columnNumber: 270
					}, this) : external ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-full flex-col items-center justify-center gap-3 px-6 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "font-display text-2xl",
								children: "Este episódio abre no site oficial"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 120,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "max-w-md text-sm text-muted",
								children: "O catálogo não replica streams protegidos. Use o link da fonte ou adicione uma URL de vídeo no painel admin."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 124,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
								asChild: true,
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("a", {
									href: external,
									target: "_blank",
									rel: "noreferrer",
									children: "Abrir episódio"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 131,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 130,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 118,
						columnNumber: 365
					}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-full flex-col items-center justify-center gap-3 px-6 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "font-display text-2xl",
								children: "Sem vídeo neste episódio"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 138,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "max-w-md text-sm text-muted",
								children: "Adicione um trailer do YouTube ou uma URL de vídeo no Admin para reproduzir aqui."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 142,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
								asChild: true,
								variant: "outline",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
									to: "/admin/$id",
									params: { id: anime.id.startsWith("local-") ? anime.id : "new" },
									search: { importId: anime.id },
									children: "Abrir Admin"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 148,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 147,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 136,
						columnNumber: 22
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 116,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mt-4 flex items-center justify-between gap-3",
					children: [prev ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
						asChild: true,
						variant: "outline",
						size: "sm",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
							to: "/watch/$id",
							params: { id: anime.id },
							search: { ep: prev.id },
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronLeft, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 173,
								columnNumber: 17
							}, this), "Anterior"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 168,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 167,
						columnNumber: 19
					}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 176,
						columnNumber: 25
					}, this), next && /* @__PURE__ */ (void 0)(Button, {
						asChild: true,
						size: "sm",
						children: /* @__PURE__ */ (void 0)(Link, {
							to: "/watch/$id",
							params: { id: anime.id },
							search: { ep: next.id },
							children: ["Próximo", /* @__PURE__ */ (void 0)(ChevronRight, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 185,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 179,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 178,
						columnNumber: 20
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 165,
					columnNumber: 9
				}, this),
				episodes.length > 0 && /* @__PURE__ */ (void 0)("section", {
					className: "mt-6",
					children: [/* @__PURE__ */ (void 0)("h2", {
						className: "mb-3 font-display text-xl",
						children: "Episódios"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 197,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)("ol", {
						className: "grid max-h-[40vh] gap-1 overflow-y-auto sm:grid-cols-2",
						children: episodes.map((ep) => /* @__PURE__ */ (void 0)("li", { children: /* @__PURE__ */ (void 0)(Link, {
							to: "/watch/$id",
							params: { id: anime.id },
							search: { ep: ep.id },
							className: cn("flex min-h-12 items-center gap-3 rounded-md px-3 text-sm", current?.id === ep.id ? "bg-elevated text-fg" : "text-muted hover:bg-surface hover:text-fg"),
							children: [/* @__PURE__ */ (void 0)("span", {
								className: "w-8 tabular-nums text-xs text-subtle",
								children: ep.number
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 211,
								columnNumber: 23
							}, this), /* @__PURE__ */ (void 0)("span", {
								className: "truncate",
								children: ep.title
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 215,
								columnNumber: 23
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 205,
							columnNumber: 21
						}, this) }, ep.id, false, {
							fileName: _jsxFileName,
							lineNumber: 203,
							columnNumber: 35
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 201,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 195,
					columnNumber: 33
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CommentsSection, {
					animeId: anime.id,
					episodeId: current?.id ?? "",
					animeTitle: title,
					episodeNumber: current?.number ?? 1,
					targetCommentId: commentQuery
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 231,
					columnNumber: 9
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 98,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 70,
		columnNumber: 10
	}, this);
}
function CommentsSection({ animeId, episodeId, animeTitle, episodeNumber, targetCommentId }) {
	const [text, setText] = (0, import_react.useState)("");
	const [isSpoiler, setIsSpoiler] = (0, import_react.useState)(false);
	const [comments, setComments] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [sending, setSending] = (0, import_react.useState)(false);
	const [likingId, setLikingId] = (0, import_react.useState)(null);
	const [replyingId, setReplyingId] = (0, import_react.useState)(null);
	const [replyText, setReplyText] = (0, import_react.useState)("");
	const [replyIsSpoiler, setReplyIsSpoiler] = (0, import_react.useState)(false);
	const [replySending, setReplySending] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [commentImage, setCommentImage] = (0, import_react.useState)(null);
	const [commentImagePreview, setCommentImagePreview] = (0, import_react.useState)(null);
	const [imageUploading, setImageUploading] = (0, import_react.useState)(false);
	const imageInputRef = (0, import_react.useRef)(null);
	const [currentUserId, setCurrentUserId] = (0, import_react.useState)(null);
	const [currentUserEmail, setCurrentUserEmail] = (0, import_react.useState)(null);
	const [sessionLoading, setSessionLoading] = (0, import_react.useState)(true);
	const isAdmin = isHikariAdmin(currentUserEmail);
	const [highlightedCommentId, setHighlightedCommentId] = (0, import_react.useState)(null);
	const [sortBy, setSortBy] = (0, import_react.useState)("recent");
	const [sortOpen, setSortOpen] = (0, import_react.useState)(false);
	const [menuOpenId, setMenuOpenId] = (0, import_react.useState)(null);
	const [moderatingId, setModeratingId] = (0, import_react.useState)(null);
	const [reportingComment, setReportingComment] = (0, import_react.useState)(null);
	const [reportReason, setReportReason] = (0, import_react.useState)("");
	const [reportSending, setReportSending] = (0, import_react.useState)(false);
	const [spamComment, setSpamComment] = (0, import_react.useState)(null);
	const [moderationSuccess, setModerationSuccess] = (0, import_react.useState)("");
	const [editingComment, setEditingComment] = (0, import_react.useState)(null);
	const [editText, setEditText] = (0, import_react.useState)("");
	const [editIsSpoiler, setEditIsSpoiler] = (0, import_react.useState)(false);
	const [editSaving, setEditSaving] = (0, import_react.useState)(false);
	const [deletingComment, setDeletingComment] = (0, import_react.useState)(null);
	const [deleteSending, setDeleteSending] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!commentImage) {
			setCommentImagePreview(null);
			return;
		}
		const previewUrl = URL.createObjectURL(commentImage);
		setCommentImagePreview(previewUrl);
		return () => {
			URL.revokeObjectURL(previewUrl);
		};
	}, [commentImage]);
	const handleSelectImage = (event) => {
		const file = event.target.files?.[0];
		if (!file) return;
		if (![
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/gif"
		].includes(file.type)) {
			setError("Escolha uma imagem JPG, PNG, WebP ou GIF.");
			event.target.value = "";
			return;
		}
		if (file.size > 10485760) {
			setError("A imagem pode ter no máximo 10 MB.");
			event.target.value = "";
			return;
		}
		setError("");
		setCommentImage(file);
	};
	const handleRemoveImage = () => {
		setCommentImage(null);
		setCommentImagePreview(null);
		if (imageInputRef.current) imageInputRef.current.value = "";
	};
	const uploadCommentImage = async (file) => {
		if (typeof window === "undefined") throw new Error("Navegador necessário.");
		return (await upload(`hikari/comments/${file.name}`, file, {
			access: "public",
			handleUploadUrl: "/api/upload-comment-image",
			multipart: true
		})).url;
	};
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		async function loadSession() {
			try {
				setSessionLoading(true);
				const response = await fetch("/api/auth/get-session", {
					method: "GET",
					credentials: "include"
				});
				if (!response.ok) {
					if (!cancelled) {
						setCurrentUserId(null);
						setCurrentUserEmail(null);
					}
					return;
				}
				const data = await response.json();
				if (!cancelled) {
					setCurrentUserId(typeof data?.user?.id === "string" ? data.user.id : null);
					setCurrentUserEmail(typeof data?.user?.email === "string" ? data.user.email : null);
				}
			} catch (err) {
				console.error("ERRO AO CARREGAR SESSÃO:", err);
				if (!cancelled) {
					setCurrentUserId(null);
					setCurrentUserEmail(null);
				}
			} finally {
				if (!cancelled) setSessionLoading(false);
			}
		}
		loadSession();
		return () => {
			cancelled = true;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!animeId || !episodeId) return;
		let cancelled = false;
		async function loadComments() {
			try {
				setLoading(true);
				setError("");
				const response = await fetch(`/api/comments?animeId=${encodeURIComponent(animeId)}&episodeId=${encodeURIComponent(episodeId)}`, {
					method: "GET",
					credentials: "include"
				});
				if (!response.ok) throw new Error("Não foi possível carregar os comentários.");
				const data = await response.json();
				if (!cancelled) {
					setComments(Array.isArray(data.comments) ? data.comments : []);
					if (typeof data.currentUserId === "string") setCurrentUserId(data.currentUserId);
					else setCurrentUserId(null);
					if (typeof data.isAdmin === "boolean") {
						if (data.isAdmin && currentUserEmail) setCurrentUserEmail(currentUserEmail);
					}
				}
			} catch (err) {
				console.error(err);
				if (!cancelled) setError("Não foi possível carregar os comentários.");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		loadComments();
		return () => {
			cancelled = true;
		};
	}, [animeId, episodeId]);
	(0, import_react.useEffect)(() => {
		if (loading || !targetCommentId || comments.length === 0) return;
		let cancelled = false;
		const focusComment = () => {
			if (cancelled) return;
			const element = document.getElementById(`comment-${targetCommentId}`);
			if (!element) return;
			setHighlightedCommentId(targetCommentId);
			element.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
			window.setTimeout(() => {
				if (!cancelled) setHighlightedCommentId(null);
			}, 4e3);
		};
		const firstFrame = window.requestAnimationFrame(focusComment);
		return () => {
			cancelled = true;
			window.cancelAnimationFrame(firstFrame);
		};
	}, [
		loading,
		comments,
		targetCommentId
	]);
	const handleComment = async () => {
		const value = text.trim();
		if (!value && !commentImage || !animeId || !episodeId || sending || imageUploading) return;
		try {
			setSending(true);
			setError("");
			let imageUrl = null;
			if (commentImage) {
				setImageUploading(true);
				imageUrl = await uploadCommentImage(commentImage);
			}
			const response = await fetch("/api/comments", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					animeId,
					episodeId,
					content: value,
					imageUrl,
					parentId: null,
					isSpoiler
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || "Não foi possível publicar o comentário.");
			if (data.comment) setComments((current) => [data.comment, ...current]);
			setText("");
			setIsSpoiler(false);
			handleRemoveImage();
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : "Não foi possível publicar o comentário.");
		} finally {
			setSending(false);
			setImageUploading(false);
		}
	};
	const handleReply = async (parentId) => {
		const value = replyText.trim();
		if (!value || !animeId || !episodeId || replySending) return;
		try {
			setReplySending(true);
			setError("");
			const response = await fetch("/api/comments", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					animeId,
					episodeId,
					content: value,
					parentId,
					isSpoiler: replyIsSpoiler
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || "Não foi possível publicar a resposta.");
			if (data.comment) setComments((current) => [...current, data.comment]);
			setReplyText("");
			setReplyIsSpoiler(false);
			setReplyingId(null);
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : "Não foi possível publicar a resposta.");
		} finally {
			setReplySending(false);
		}
	};
	const handleLike = async (commentId) => {
		if (likingId) return;
		try {
			setLikingId(commentId);
			setError("");
			const response = await fetch("/api/comments/like", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ commentId })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || "Não foi possível alterar a curtida.");
			setComments((current) => current.map((comment) => comment.id === commentId ? {
				...comment,
				likes: Number(data.likes) || 0,
				liked: Boolean(data.liked)
			} : comment));
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : "Não foi possível alterar a curtida.");
		} finally {
			setLikingId(null);
		}
	};
	const openEdit = (comment) => {
		setMenuOpenId(null);
		setEditingComment(comment);
		setEditText(comment.content);
		setEditIsSpoiler(comment.isSpoiler);
		setError("");
		setModerationSuccess("");
	};
	const handleEdit = async () => {
		if (!editingComment || !editText.trim() || editSaving) return;
		try {
			setEditSaving(true);
			setError("");
			const response = await fetch("/api/comments/edit", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					commentId: editingComment.id,
					action: "edit",
					content: editText.trim(),
					isSpoiler: editIsSpoiler
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || "Não foi possível editar o comentário.");
			if (data.comment) setComments((current) => current.map((comment) => comment.id === editingComment.id ? {
				...comment,
				...data.comment,
				liked: comment.liked,
				likes: comment.likes
			} : comment));
			setEditingComment(null);
			setEditText("");
			setEditIsSpoiler(false);
			setModerationSuccess("Comentário editado com sucesso.");
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : "Não foi possível editar o comentário.");
		} finally {
			setEditSaving(false);
		}
	};
	const openDelete = (comment) => {
		setMenuOpenId(null);
		setDeletingComment(comment);
		setError("");
		setModerationSuccess("");
	};
	const handleDelete = async () => {
		if (!deletingComment || deleteSending) return;
		try {
			setDeleteSending(true);
			setError("");
			const response = await fetch("/api/comments/edit", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					commentId: deletingComment.id,
					action: "delete"
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || "Não foi possível excluir o comentário.");
			setComments((current) => current.filter((comment) => comment.id !== deletingComment.id && comment.parentId !== deletingComment.id));
			if (replyingId === deletingComment.id) {
				setReplyingId(null);
				setReplyText("");
				setReplyIsSpoiler(false);
			}
			setDeletingComment(null);
			setModerationSuccess("Comentário excluído com sucesso.");
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : "Não foi possível excluir o comentário.");
		} finally {
			setDeleteSending(false);
		}
	};
	const handleModeration = async (commentId, action, reason) => {
		if (moderatingId) return;
		try {
			setModeratingId(commentId);
			setError("");
			setModerationSuccess("");
			if (action === "report") setReportSending(true);
			const response = await fetch("/api/comments/moderation", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					commentId,
					action,
					...reason ? { reason } : {}
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || "Não foi possível realizar esta ação.");
			if (action === "spoiler") {
				setComments((current) => current.map((comment) => comment.id === commentId ? {
					...comment,
					isSpoiler: true
				} : comment));
				setModerationSuccess("Comentário marcado como spoiler.");
			}
			if (action === "spam") setModerationSuccess("Comentário sinalizado como spam.");
			if (action === "report") setModerationSuccess("Denúncia enviada. Obrigado por ajudar a manter a comunidade do Hikari segura.");
			setMenuOpenId(null);
			setSpamComment(null);
			setReportingComment(null);
			setReportReason("");
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : "Não foi possível realizar esta ação.");
		} finally {
			setModeratingId(null);
			setReportSending(false);
		}
	};
	const openReport = (comment) => {
		setMenuOpenId(null);
		setReportingComment(comment);
		setReportReason("");
		setError("");
		setModerationSuccess("");
	};
	const formatDate = (value) => {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "";
		return date.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric"
		});
	};
	const rootComments = comments.filter((comment) => !comment.parentId);
	const repliesFor = (parentId) => comments.filter((comment) => comment.parentId === parentId);
	const displayedRootComments = (0, import_react.useMemo)(() => {
		let result = [...rootComments];
		if (sortBy === "spoiler") result = result.filter((comment) => comment.isSpoiler);
		if (sortBy === "liked") result.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
		if (sortBy === "replies") result.sort((a, b) => repliesFor(b.id).length - repliesFor(a.id).length);
		if (sortBy === "recent") result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return result;
	}, [
		rootComments,
		sortBy,
		comments
	]);
	const sortLabel = sortBy === "recent" ? "Mais recentes" : sortBy === "liked" ? "Mais curtidos" : sortBy === "replies" ? "Mais respondidos" : "Com spoiler";
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
		className: "mt-12 border-t border-white/5 pt-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "grid gap-8",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
								className: "font-display text-2xl tracking-tight sm:text-3xl",
								children: "Comentários"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 935,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-sm text-muted",
								children: [
									"Comentários do episódio",
									" ",
									episodeNumber,
									" de",
									" ",
									animeTitle
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 939,
								columnNumber: 15
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 933,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex items-center justify-between gap-3 sm:justify-end",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-center gap-2 text-sm text-muted",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 951,
										columnNumber: 17
									}, this), comments.length]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 949,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "relative",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
										type: "button",
										onClick: () => setSortOpen((open) => !open),
										"aria-haspopup": "menu",
										"aria-expanded": sortOpen,
										className: "flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 text-sm text-fg outline-none transition-colors hover:border-white/20 hover:bg-elevated focus:border-white/20",
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: sortLabel }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 961,
											columnNumber: 19
										}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronDown, { className: cn("size-4 text-muted transition-transform", sortOpen && "rotate-180") }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 965,
											columnNumber: 19
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 959,
										columnNumber: 17
									}, this), sortOpen && /* @__PURE__ */ (void 0)("div", {
										role: "menu",
										className: "absolute right-0 top-[calc(100%+8px)] z-50 min-w-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#17171a] p-1 shadow-2xl",
										children: [
											/* @__PURE__ */ (void 0)("button", {
												type: "button",
												role: "menuitem",
												onClick: () => {
													setSortBy("recent");
													setSortOpen(false);
												},
												className: cn("flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors", sortBy === "recent" ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
												children: "Mais recentes"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 971,
												columnNumber: 21
											}, this),
											/* @__PURE__ */ (void 0)("button", {
												type: "button",
												role: "menuitem",
												onClick: () => {
													setSortBy("liked");
													setSortOpen(false);
												},
												className: cn("flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors", sortBy === "liked" ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
												children: "Mais curtidos"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 978,
												columnNumber: 21
											}, this),
											/* @__PURE__ */ (void 0)("button", {
												type: "button",
												role: "menuitem",
												onClick: () => {
													setSortBy("replies");
													setSortOpen(false);
												},
												className: cn("flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors", sortBy === "replies" ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
												children: "Mais respondidos"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 985,
												columnNumber: 21
											}, this),
											/* @__PURE__ */ (void 0)("button", {
												type: "button",
												role: "menuitem",
												onClick: () => {
													setSortBy("spoiler");
													setSortOpen(false);
												},
												className: cn("flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors", sortBy === "spoiler" ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"),
												children: "Com spoiler"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 992,
												columnNumber: 21
											}, this)
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 969,
										columnNumber: 30
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 957,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 947,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 931,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mt-5 rounded-xl border border-white/5 bg-surface p-4 sm:p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("textarea", {
									value: text,
									onChange: (event) => {
										setText(event.target.value);
									},
									onKeyDown: (event) => {
										if (event.key === "Enter" && !event.shiftKey) {
											event.preventDefault();
											handleComment();
										}
									},
									placeholder: "Escreva um comentário...",
									rows: 3,
									maxLength: 2e3,
									className: "w-full resize-none rounded-lg border border-white/5 bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/15"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1013,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "mt-3 flex items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("input", {
											ref: imageInputRef,
											type: "file",
											accept: "image/jpeg,image/png,image/webp,image/gif",
											onChange: handleSelectImage,
											className: "hidden"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1028,
											columnNumber: 15
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
											type: "button",
											onClick: () => imageInputRef.current?.click(),
											disabled: sending || imageUploading,
											"aria-label": "Adicionar imagem",
											title: "Imagem",
											className: "flex min-h-10 items-center gap-2 rounded-lg border border-white/5 bg-bg px-3 text-xs font-medium text-muted transition-colors hover:border-white/10 hover:bg-elevated hover:text-fg disabled:cursor-not-allowed disabled:opacity-50",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Image, { className: "size-4" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 1031,
												columnNumber: 17
											}, this), "Imagem"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 1030,
											columnNumber: 15
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
											type: "button",
											disabled: true,
											"aria-label": "Adicionar GIF",
											title: "GIF",
											className: "flex min-h-10 items-center gap-2 rounded-lg border border-white/5 bg-bg px-3 text-xs font-medium text-muted opacity-60",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "text-[10px] font-bold tracking-wide",
												children: "GIF"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 1036,
												columnNumber: 17
											}, this), "GIF"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 1035,
											columnNumber: 15
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1026,
									columnNumber: 13
								}, this),
								commentImagePreview && /* @__PURE__ */ (void 0)("div", {
									className: "relative mt-3 w-fit max-w-full overflow-hidden rounded-xl border border-white/10 bg-bg",
									children: [/* @__PURE__ */ (void 0)("img", {
										src: commentImagePreview,
										alt: "Prévia da imagem do comentário",
										className: "max-h-64 max-w-full object-contain"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1050,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("button", {
										type: "button",
										onClick: handleRemoveImage,
										disabled: sending || imageUploading,
										"aria-label": "Remover imagem",
										title: "Remover imagem",
										className: "absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm transition-colors hover:bg-black disabled:opacity-50",
										children: /* @__PURE__ */ (void 0)(X, { className: "size-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1053,
											columnNumber: 19
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1052,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1048,
									columnNumber: 37
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("label", {
									className: "mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted select-none",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("input", {
										type: "checkbox",
										checked: isSpoiler,
										onChange: (event) => {
											setIsSpoiler(event.target.checked);
										},
										className: "size-4 accent-current"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1060,
										columnNumber: 15
									}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Marcar como spoiler" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1064,
										columnNumber: 15
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1058,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "text-xs text-subtle",
										children: "Enter para enviar · Shift + Enter para quebrar linha"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1072,
										columnNumber: 15
									}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
										type: "button",
										size: "sm",
										onClick: () => void handleComment(),
										disabled: !text.trim() && !commentImage || sending || imageUploading,
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Send, { className: "size-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1077,
											columnNumber: 17
										}, this), imageUploading ? "Enviando imagem..." : sending ? "Enviando..." : "Comentar"]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1076,
										columnNumber: 15
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1070,
									columnNumber: 13
								}, this),
								error && /* @__PURE__ */ (void 0)("p", {
									className: "mt-3 text-sm text-red-400",
									children: error
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1084,
									columnNumber: 23
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1011,
							columnNumber: 11
						}, this),
						moderationSuccess && /* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-lg border border-white/5 bg-surface px-4 py-3 text-sm text-muted",
							children: moderationSuccess
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1094,
							columnNumber: 33
						}, this),
						sortBy === "spoiler" && /* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-lg border border-white/5 bg-surface px-4 py-3 text-sm text-muted",
							children: "Mostrando apenas comentários marcados como spoiler."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1102,
							columnNumber: 36
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mt-5 space-y-3",
							children: loading ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "rounded-xl border border-white/5 bg-surface p-5 text-sm text-muted",
								children: "Carregando comentários..."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1112,
								columnNumber: 24
							}, this) : displayedRootComments.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "rounded-xl border border-white/5 bg-surface p-5 text-center text-sm text-muted",
								children: sortBy === "spoiler" ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
									"Não há comentários com spoiler neste episódio.",
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("br", {}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1118,
										columnNumber: 23
									}, this),
									"Tente outro filtro."
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1116,
									columnNumber: 41
								}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
									"Ainda não há comentários neste episódio.",
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("br", {}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1122,
										columnNumber: 23
									}, this),
									"Seja o primeiro a comentar."
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1120,
									columnNumber: 27
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1114,
								columnNumber: 61
							}, this) : displayedRootComments.map((comment) => {
								const replies = repliesFor(comment.id);
								const canEdit = !sessionLoading && Boolean(currentUserId && (currentUserId === comment.userId || isAdmin));
								return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "space-y-2",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CommentCard, {
										comment,
										replyCount: replies.length,
										replyToName: void 0,
										likingId,
										replyingId,
										replyText,
										replyIsSpoiler,
										replySending,
										formatDate,
										onLike: handleLike,
										onReplyChange: setReplyText,
										onReplySpoilerChange: setReplyIsSpoiler,
										onStartReply: () => {
											setReplyingId(comment.id);
											setReplyText("");
											setReplyIsSpoiler(false);
										},
										onCancelReply: () => {
											setReplyingId(null);
											setReplyText("");
											setReplyIsSpoiler(false);
										},
										onSendReply: () => {
											handleReply(comment.id);
										},
										menuOpen: menuOpenId === comment.id,
										onToggleMenu: () => {
											setMenuOpenId((current) => current === comment.id ? null : comment.id);
										},
										onEdit: () => openEdit(comment),
										onDelete: () => openDelete(comment),
										onMarkSpoiler: () => {
											handleModeration(comment.id, "spoiler");
										},
										onReport: () => openReport(comment),
										onSpam: () => setSpamComment(comment),
										moderating: moderatingId === comment.id,
										canEdit,
										highlighted: highlightedCommentId === comment.id
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1131,
										columnNumber: 23
									}, this), replies.length > 0 && /* @__PURE__ */ (void 0)("div", {
										className: "ml-5 space-y-2 border-l border-white/10 pl-3 sm:ml-8 sm:pl-4",
										children: replies.map((reply) => {
											const canEditReply = !sessionLoading && Boolean(currentUserId && (currentUserId === reply.userId || isAdmin));
											return /* @__PURE__ */ (void 0)(CommentCard, {
												comment: reply,
												replyCount: 0,
												replyToName: comment.userName || "Usuário",
												likingId,
												replyingId: null,
												replyText: "",
												replyIsSpoiler: false,
												replySending: false,
												formatDate,
												onLike: handleLike,
												onReplyChange: () => {},
												onReplySpoilerChange: () => {},
												onStartReply: () => {},
												onCancelReply: () => {},
												onSendReply: () => {},
												isReply: true,
												menuOpen: menuOpenId === reply.id,
												onToggleMenu: () => {
													setMenuOpenId((current) => current === reply.id ? null : reply.id);
												},
												onEdit: () => openEdit(reply),
												onDelete: () => openDelete(reply),
												onMarkSpoiler: () => {
													handleModeration(reply.id, "spoiler");
												},
												onReport: () => openReport(reply),
												onSpam: () => setSpamComment(reply),
												moderating: moderatingId === reply.id,
												canEdit: canEditReply,
												highlighted: highlightedCommentId === reply.id
											}, reply.id, false, {
												fileName: _jsxFileName,
												lineNumber: 1151,
												columnNumber: 26
											}, this);
										})
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1147,
										columnNumber: 46
									}, this)]
								}, comment.id, true, {
									fileName: _jsxFileName,
									lineNumber: 1129,
									columnNumber: 20
								}, this);
							})
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1110,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 925,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 923,
				columnNumber: 7
			}, this),
			editingComment && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5",
				children: /* @__PURE__ */ (void 0)("div", {
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "edit-dialog-title",
					className: "w-full max-w-lg rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl",
					children: [
						/* @__PURE__ */ (void 0)("div", {
							className: "flex items-start gap-3",
							children: [
								/* @__PURE__ */ (void 0)("div", {
									className: "flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated",
									children: /* @__PURE__ */ (void 0)(PenLine, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1181,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1179,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (void 0)("h3", {
										id: "edit-dialog-title",
										className: "font-display text-xl",
										children: "Editar comentário"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1187,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Altere o texto do seu comentário."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1191,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1185,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => {
										if (!editSaving) {
											setEditingComment(null);
											setEditText("");
											setEditIsSpoiler(false);
										}
									},
									disabled: editSaving,
									className: "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg",
									"aria-label": "Fechar",
									children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1204,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1197,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1177,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("textarea", {
							value: editText,
							onChange: (event) => setEditText(event.target.value),
							rows: 6,
							maxLength: 2e3,
							disabled: editSaving,
							className: "mt-5 w-full resize-none rounded-lg border border-white/5 bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/15 disabled:opacity-60"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1209,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-2 flex justify-end",
							children: /* @__PURE__ */ (void 0)("span", {
								className: "text-xs text-subtle",
								children: [editText.length, "/2000"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1213,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1211,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("label", {
							className: "mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted select-none",
							children: [/* @__PURE__ */ (void 0)("input", {
								type: "checkbox",
								checked: editIsSpoiler,
								onChange: (event) => setEditIsSpoiler(event.target.checked),
								disabled: editSaving,
								className: "size-4 accent-current"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1221,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("span", { children: "Marcar como spoiler" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1223,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1219,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1229,
							columnNumber: 23
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
							children: [/* @__PURE__ */ (void 0)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => {
									if (!editSaving) {
										setEditingComment(null);
										setEditText("");
										setEditIsSpoiler(false);
									}
								},
								disabled: editSaving,
								children: "Cancelar"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1235,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => void handleEdit(),
								disabled: !editText.trim() || editSaving,
								children: [/* @__PURE__ */ (void 0)(PenLine, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1246,
									columnNumber: 17
								}, this), editSaving ? "Salvando..." : "Salvar alterações"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1245,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1233,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1175,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1173,
				columnNumber: 26
			}, this),
			deletingComment && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5",
				children: /* @__PURE__ */ (void 0)("div", {
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "delete-dialog-title",
					className: "w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl",
					children: [
						/* @__PURE__ */ (void 0)("div", {
							className: "flex items-start gap-3",
							children: [
								/* @__PURE__ */ (void 0)("div", {
									className: "flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated",
									children: /* @__PURE__ */ (void 0)(Trash2, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1269,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1267,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (void 0)("h3", {
										id: "delete-dialog-title",
										className: "font-display text-xl",
										children: "Excluir comentário?"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1275,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Essa ação não pode ser desfeita."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1279,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1273,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => {
										if (!deleteSending) setDeletingComment(null);
									},
									disabled: deleteSending,
									className: "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg",
									"aria-label": "Fechar",
									children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1290,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1285,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1265,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 rounded-lg border border-white/5 bg-surface p-3",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "line-clamp-5 whitespace-pre-wrap text-sm text-muted",
								children: deletingComment.content
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1297,
								columnNumber: 15
							}, this), deletingComment.imageUrl && /* @__PURE__ */ (void 0)("img", {
								src: deletingComment.imageUrl,
								alt: "",
								className: "mt-3 max-h-40 rounded-lg object-contain"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1301,
								columnNumber: 44
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1295,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1305,
							columnNumber: 23
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
							children: [/* @__PURE__ */ (void 0)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => {
									if (!deleteSending) setDeletingComment(null);
								},
								disabled: deleteSending,
								children: "Cancelar"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1311,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => void handleDelete(),
								disabled: deleteSending,
								children: [/* @__PURE__ */ (void 0)(Trash2, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1320,
									columnNumber: 17
								}, this), deleteSending ? "Excluindo..." : "Excluir comentário"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1319,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1309,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1263,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1261,
				columnNumber: 27
			}, this),
			reportingComment && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5",
				children: /* @__PURE__ */ (void 0)("div", {
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "report-dialog-title",
					className: "w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl",
					children: [
						/* @__PURE__ */ (void 0)("div", {
							className: "flex items-start gap-3",
							children: [
								/* @__PURE__ */ (void 0)("div", {
									className: "flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated",
									children: /* @__PURE__ */ (void 0)(Flag, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1343,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1341,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (void 0)("h3", {
										id: "report-dialog-title",
										className: "font-display text-xl",
										children: "Denunciar comentário"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1349,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Por que você está denunciando este comentário?"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1353,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1347,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("button", {
									type: "button",
									onClick: () => {
										if (!reportSending) {
											setReportingComment(null);
											setReportReason("");
										}
									},
									className: "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg",
									"aria-label": "Fechar",
									disabled: reportSending,
									children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1365,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1359,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1339,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 space-y-2",
							children: [
								{
									value: "spam",
									label: "Spam ou propaganda"
								},
								{
									value: "hate",
									label: "Discurso de ódio ou ofensa"
								},
								{
									value: "spoiler",
									label: "Spoiler não marcado"
								},
								{
									value: "sexual",
									label: "Conteúdo sexual ou impróprio"
								},
								{
									value: "harassment",
									label: "Assédio ou ameaça"
								},
								{
									value: "other",
									label: "Outro motivo"
								}
							].map((item) => /* @__PURE__ */ (void 0)("label", {
								className: cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition-colors", reportReason === item.value ? "border-white/20 bg-elevated text-fg" : "border-white/5 bg-surface text-muted hover:border-white/10 hover:text-fg"),
								children: [/* @__PURE__ */ (void 0)("input", {
									type: "radio",
									name: "report-reason",
									value: item.value,
									checked: reportReason === item.value,
									onChange: () => setReportReason(item.value),
									className: "size-4 accent-current"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1392,
									columnNumber: 21
								}, this), /* @__PURE__ */ (void 0)("span", { children: item.label }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1394,
									columnNumber: 21
								}, this)]
							}, item.value, true, {
								fileName: _jsxFileName,
								lineNumber: 1390,
								columnNumber: 26
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1370,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1402,
							columnNumber: 23
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
							children: [/* @__PURE__ */ (void 0)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => {
									if (!reportSending) {
										setReportingComment(null);
										setReportReason("");
									}
								},
								disabled: reportSending,
								children: "Cancelar"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1408,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => {
									if (reportingComment && reportReason) handleModeration(reportingComment.id, "report", reportReason);
								},
								disabled: !reportReason || reportSending || Boolean(moderatingId),
								children: [/* @__PURE__ */ (void 0)(Flag, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1422,
									columnNumber: 17
								}, this), reportSending ? "Enviando..." : "Enviar denúncia"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1417,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1406,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("p", {
							className: "mt-4 text-xs leading-5 text-subtle",
							children: "As denúncias ajudam a equipe de moderação a manter a comunidade do Hikari segura."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1429,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1337,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1335,
				columnNumber: 28
			}, this),
			spamComment && /* @__PURE__ */ (void 0)("div", {
				className: "fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5",
				children: /* @__PURE__ */ (void 0)("div", {
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "spam-dialog-title",
					className: "w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl",
					children: [
						/* @__PURE__ */ (void 0)("div", {
							className: "flex items-start gap-3",
							children: [/* @__PURE__ */ (void 0)("div", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated",
								children: /* @__PURE__ */ (void 0)(Ban, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1449,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1447,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (void 0)("h3", {
									id: "spam-dialog-title",
									className: "font-display text-xl",
									children: "Marcar como spam?"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1455,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("p", {
									className: "mt-1 text-sm text-muted",
									children: "Este comentário será sinalizado para análise da moderação."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1459,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1453,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1445,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-lg border border-white/5 bg-surface p-3",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "line-clamp-4 whitespace-pre-wrap text-sm text-muted",
								children: spamComment.content
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1469,
								columnNumber: 15
							}, this), spamComment.imageUrl && /* @__PURE__ */ (void 0)("img", {
								src: spamComment.imageUrl,
								alt: "",
								className: "mt-3 max-h-40 rounded-lg object-contain"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1473,
								columnNumber: 40
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1467,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1477,
							columnNumber: 23
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
							children: [/* @__PURE__ */ (void 0)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => {
									if (!moderatingId) setSpamComment(null);
								},
								disabled: Boolean(moderatingId),
								children: "Cancelar"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1483,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => {
									handleModeration(spamComment.id, "spam");
								},
								disabled: Boolean(moderatingId),
								children: [/* @__PURE__ */ (void 0)(Ban, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1494,
									columnNumber: 17
								}, this), moderatingId === spamComment.id ? "Enviando..." : "Marcar como spam"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1491,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1481,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1443,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1441,
				columnNumber: 23
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 921,
		columnNumber: 10
	}, this);
}
function CommentCard({ comment, replyCount, replyToName, likingId, replyingId, replyText, replyIsSpoiler, replySending, formatDate, onLike, onReplyChange, onReplySpoilerChange, onStartReply, onCancelReply, onSendReply, isReply = false, menuOpen, onToggleMenu, onEdit, onDelete, onMarkSpoiler, onReport, onSpam, moderating, canEdit, highlighted = false }) {
	const isReplying = replyingId === comment.id;
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("article", {
		id: `comment-${comment.id}`,
		className: cn("rounded-xl border border-white/5 bg-surface p-4 transition-all duration-500 sm:p-5", isReply && "bg-surface/80", highlighted && "border-white/30 bg-elevated shadow-[0_0_0_2px_rgba(255,255,255,0.08)]"),
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-sm font-semibold",
				children: comment.userImage ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
					src: comment.userImage,
					alt: "",
					className: "size-full object-cover"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 1578,
					columnNumber: 32
				}, this) : (comment.userName || "U").charAt(0).toUpperCase()
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1576,
				columnNumber: 9
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "relative flex items-start gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "text-sm font-semibold",
									children: comment.userName || "Usuário"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1596,
									columnNumber: 15
								}, this),
								isReply && replyToName && /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (void 0)("span", {
									className: "text-sm text-subtle",
									children: "→"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1601,
									columnNumber: 21
								}, this), /* @__PURE__ */ (void 0)("span", {
									className: "text-sm font-semibold text-muted",
									children: replyToName
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1605,
									columnNumber: 21
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1600,
									columnNumber: 42
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "text-xs text-subtle",
									children: [
										"·",
										" ",
										formatDate(comment.createdAt)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1610,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1594,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "relative shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								type: "button",
								onClick: onToggleMenu,
								disabled: moderating,
								"aria-label": "Opções do comentário",
								"aria-haspopup": "menu",
								"aria-expanded": menuOpen,
								className: "flex size-9 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(EllipsisVertical, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1625,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1623,
								columnNumber: 15
							}, this), menuOpen && /* @__PURE__ */ (void 0)("div", {
								role: "menu",
								className: "absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#17171a] p-1 shadow-2xl",
								children: canEdit ? /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (void 0)("button", {
									type: "button",
									role: "menuitem",
									onClick: onEdit,
									disabled: moderating,
									className: "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50",
									children: [/* @__PURE__ */ (void 0)(PenLine, { className: "size-4 shrink-0" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1634,
										columnNumber: 25
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Editar comentário" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1636,
										columnNumber: 25
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1632,
									columnNumber: 23
								}, this), /* @__PURE__ */ (void 0)("button", {
									type: "button",
									role: "menuitem",
									onClick: onDelete,
									disabled: moderating,
									className: "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50",
									children: [/* @__PURE__ */ (void 0)(Trash2, { className: "size-4 shrink-0" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1644,
										columnNumber: 25
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Excluir comentário" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1646,
										columnNumber: 25
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1642,
									columnNumber: 23
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1631,
									columnNumber: 30
								}, this) : /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [
									/* @__PURE__ */ (void 0)("button", {
										type: "button",
										role: "menuitem",
										onClick: onMarkSpoiler,
										disabled: moderating,
										className: "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50",
										children: [/* @__PURE__ */ (void 0)(TriangleAlert, { className: "size-4 shrink-0" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1654,
											columnNumber: 25
										}, this), /* @__PURE__ */ (void 0)("span", { children: moderating ? "Enviando..." : "Marcar como spoiler" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1656,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1652,
										columnNumber: 23
									}, this),
									/* @__PURE__ */ (void 0)("button", {
										type: "button",
										role: "menuitem",
										onClick: onReport,
										disabled: moderating,
										className: "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50",
										children: [/* @__PURE__ */ (void 0)(Flag, { className: "size-4 shrink-0" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1664,
											columnNumber: 25
										}, this), /* @__PURE__ */ (void 0)("span", { children: "Denunciar comentário" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1666,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1662,
										columnNumber: 23
									}, this),
									/* @__PURE__ */ (void 0)("button", {
										type: "button",
										role: "menuitem",
										onClick: onSpam,
										disabled: moderating,
										className: "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50",
										children: [/* @__PURE__ */ (void 0)(Ban, { className: "size-4 shrink-0" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1674,
											columnNumber: 25
										}, this), /* @__PURE__ */ (void 0)("span", { children: "Marcar como spam" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1676,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1672,
										columnNumber: 23
									}, this)
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1651,
									columnNumber: 27
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1629,
								columnNumber: 28
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1621,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 1592,
						columnNumber: 11
					}, this),
					comment.isSpoiler ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("details", {
						className: "mt-2 rounded-lg border border-white/5 bg-bg/50 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("summary", {
							className: "cursor-pointer text-sm font-medium text-fg",
							children: "⚠️ Mostrar spoiler"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1695,
							columnNumber: 15
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-2 whitespace-pre-wrap text-sm leading-6 text-muted",
							children: comment.content
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1699,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 1693,
						columnNumber: 32
					}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-2 whitespace-pre-wrap text-sm leading-6 text-muted",
						children: comment.content
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1703,
						columnNumber: 26
					}, this),
					comment.imageUrl && /* @__PURE__ */ (void 0)("div", {
						className: "mt-3 overflow-hidden rounded-xl border border-white/5 bg-bg",
						children: /* @__PURE__ */ (void 0)("a", {
							href: comment.imageUrl,
							target: "_blank",
							rel: "noreferrer",
							"aria-label": "Abrir imagem em tamanho completo",
							className: "block cursor-zoom-in",
							children: /* @__PURE__ */ (void 0)("img", {
								src: comment.imageUrl,
								alt: "Imagem anexada ao comentário",
								loading: "lazy",
								className: "max-h-[520px] w-auto max-w-full object-contain transition-opacity hover:opacity-90"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1713,
								columnNumber: 17
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1712,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1711,
						columnNumber: 32
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "mt-3 flex flex-wrap items-center gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								type: "button",
								onClick: () => void onLike(comment.id),
								disabled: likingId === comment.id,
								className: cn("flex items-center gap-1.5 text-xs transition-colors", comment.liked ? "text-fg" : "text-subtle hover:text-fg"),
								"aria-label": comment.liked ? "Remover curtida" : "Curtir comentário",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Heart, { className: cn("size-4", comment.liked && "fill-current") }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1725,
									columnNumber: 15
								}, this), comment.likes]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1723,
								columnNumber: 13
							}, this),
							!isReply && /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: onStartReply,
								className: "flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-fg",
								children: [/* @__PURE__ */ (void 0)(MessageCircle, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1733,
									columnNumber: 17
								}, this), "Responder"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1731,
								columnNumber: 26
							}, this),
							!isReply && replyCount > 0 && /* @__PURE__ */ (void 0)("span", {
								className: "flex items-center gap-1.5 text-xs text-subtle",
								children: [
									/* @__PURE__ */ (void 0)(MessageCircle, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1741,
										columnNumber: 19
									}, this),
									replyCount,
									" ",
									replyCount === 1 ? "Resposta" : "Respostas"
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1739,
								columnNumber: 44
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 1721,
						columnNumber: 11
					}, this),
					isReplying && /* @__PURE__ */ (void 0)("div", {
						className: "mt-4 rounded-lg border border-white/5 bg-bg p-3",
						children: [
							/* @__PURE__ */ (void 0)("textarea", {
								value: replyText,
								onChange: (event) => {
									onReplyChange(event.target.value);
								},
								rows: 3,
								maxLength: 2e3,
								placeholder: "Escreva uma resposta...",
								className: "w-full resize-none rounded-lg border border-white/5 bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/15"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1756,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (void 0)("label", {
								className: "mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted select-none",
								children: [/* @__PURE__ */ (void 0)("input", {
									type: "checkbox",
									checked: replyIsSpoiler,
									onChange: (event) => {
										onReplySpoilerChange(event.target.checked);
									},
									className: "size-4 accent-current"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1762,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("span", { children: "Marcar como spoiler" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1766,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1760,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (void 0)("div", {
								className: "mt-3 flex items-center justify-end gap-2",
								children: [/* @__PURE__ */ (void 0)(Button, {
									type: "button",
									size: "sm",
									variant: "outline",
									onClick: onCancelReply,
									disabled: replySending,
									children: "Cancelar"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1774,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)(Button, {
									type: "button",
									size: "sm",
									onClick: onSendReply,
									disabled: !replyText.trim() || replySending,
									children: [/* @__PURE__ */ (void 0)(Send, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1779,
										columnNumber: 19
									}, this), replySending ? "Enviando..." : "Responder"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1778,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1772,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 1754,
						columnNumber: 26
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 1586,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 1570,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 1568,
		columnNumber: 10
	}, this);
}
//#endregion
export { WatchPage as component };
