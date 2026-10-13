import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore, n as displayTitle } from "./types-CX6YV1cu.mjs";
import { a as youtubeIdFrom, r as isDirectVideo, t as cn } from "./utils-Cws_m9jY.mjs";
import { $ as Flag, B as MessageCircle, D as Search, E as Send, M as PenLine, Q as Heart, Y as Image, d as TriangleAlert, dt as ChevronLeft, ft as ChevronDown, p as Trash2, rt as EllipsisVertical, t as X, ut as ChevronRight, xt as Ban } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { r as upload } from "../_libs/@vercel/blob+[...].mjs";
import { O as mergeDetail, R as isHikariAdmin, r as Route$13 } from "./router-Dx2-dd95.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/watch._id-gif-Dy6faRqU.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/watch.$id-gif.tsx?tsr-split=component";
function WatchPage() {
	const { id } = Route$13.useParams();
	const { ep: epQuery, comment: commentQuery } = Route$13.useSearch();
	const { remote } = Route$13.useLoaderData();
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
	const [gifOpen, setGifOpen] = (0, import_react.useState)(false);
	const [gifSearch, setGifSearch] = (0, import_react.useState)("");
	const [gifs, setGifs] = (0, import_react.useState)([]);
	const [gifLoading, setGifLoading] = (0, import_react.useState)(false);
	const [selectedGifUrl, setSelectedGifUrl] = (0, import_react.useState)(null);
	const [gifSearching, setGifSearching] = (0, import_react.useState)(false);
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
		setSelectedGifUrl(null);
		setCommentImage(file);
	};
	const handleRemoveImage = () => {
		setCommentImage(null);
		setCommentImagePreview(null);
		setSelectedGifUrl(null);
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
	const searchGifs = async (query = gifSearch) => {
		setError("Configure VITE_GIPHY_API_KEY no Vercel para usar GIFs.");
	};
	const openGifPicker = async () => {
		setGifOpen(true);
		setGifSearching(false);
		if (!gifs.length) await searchGifs("");
	};
	const handleGifSearch = async () => {
		setGifSearching(true);
		try {
			await searchGifs();
		} finally {
			setGifSearching(false);
		}
	};
	const handleSelectGif = (gif) => {
		setSelectedGifUrl(gif.url);
		setCommentImage(null);
		setCommentImagePreview(null);
		if (imageInputRef.current) imageInputRef.current.value = "";
		setGifOpen(false);
		setError("");
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
		if (!value && !commentImage && !selectedGifUrl || !animeId || !episodeId || sending || imageUploading) return;
		try {
			setSending(true);
			setError("");
			let imageUrl = selectedGifUrl;
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
								lineNumber: 1036,
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
								lineNumber: 1040,
								columnNumber: 15
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1034,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex items-center justify-between gap-3 sm:justify-end",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-center gap-2 text-sm text-muted",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1052,
										columnNumber: 17
									}, this), comments.length]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1050,
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
											lineNumber: 1062,
											columnNumber: 19
										}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronDown, { className: cn("size-4 text-muted transition-transform", sortOpen && "rotate-180") }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1066,
											columnNumber: 19
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1060,
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
												lineNumber: 1072,
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
												lineNumber: 1079,
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
												lineNumber: 1086,
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
												lineNumber: 1093,
												columnNumber: 21
											}, this)
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1070,
										columnNumber: 30
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1058,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1048,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1032,
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
									lineNumber: 1114,
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
											lineNumber: 1129,
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
												lineNumber: 1132,
												columnNumber: 17
											}, this), "Imagem"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 1131,
											columnNumber: 15
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
											type: "button",
											onClick: () => {
												openGifPicker();
											},
											disabled: sending || imageUploading,
											"aria-label": "Adicionar GIF",
											title: "GIF",
											className: "flex min-h-10 items-center gap-2 rounded-lg border border-white/5 bg-bg px-3 text-xs font-medium text-muted transition-colors hover:border-white/10 hover:bg-elevated hover:text-fg disabled:cursor-not-allowed disabled:opacity-50",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "text-[10px] font-bold tracking-wide",
												children: "GIF"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 1139,
												columnNumber: 17
											}, this), "GIF"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 1136,
											columnNumber: 15
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1127,
									columnNumber: 13
								}, this),
								(commentImagePreview || selectedGifUrl) && /* @__PURE__ */ (void 0)("div", {
									className: "relative mt-3 w-fit max-w-full overflow-hidden rounded-xl border border-white/10 bg-bg",
									children: [/* @__PURE__ */ (void 0)("img", {
										src: commentImagePreview ?? selectedGifUrl ?? "",
										alt: selectedGifUrl ? "Prévia do GIF do comentário" : "Prévia da imagem do comentário",
										className: "max-h-64 max-w-full object-contain"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1153,
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
											lineNumber: 1156,
											columnNumber: 19
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1155,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1151,
									columnNumber: 57
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
										lineNumber: 1163,
										columnNumber: 15
									}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Marcar como spoiler" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1167,
										columnNumber: 15
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1161,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "text-xs text-subtle",
										children: "Enter para enviar · Shift + Enter para quebrar linha"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1175,
										columnNumber: 15
									}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
										type: "button",
										size: "sm",
										onClick: () => void handleComment(),
										disabled: !text.trim() && !commentImage && !selectedGifUrl || sending || imageUploading,
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Send, { className: "size-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1180,
											columnNumber: 17
										}, this), imageUploading ? "Enviando imagem..." : sending ? "Enviando..." : "Comentar"]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1179,
										columnNumber: 15
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1173,
									columnNumber: 13
								}, this),
								error && /* @__PURE__ */ (void 0)("p", {
									className: "mt-3 text-sm text-red-400",
									children: error
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1187,
									columnNumber: 23
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1112,
							columnNumber: 11
						}, this),
						gifOpen && /* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-xl border border-white/5 bg-surface p-4 sm:p-5",
							children: [
								/* @__PURE__ */ (void 0)("div", {
									className: "flex items-center justify-between gap-3",
									children: [/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("h3", {
										className: "text-sm font-semibold text-fg",
										children: "Escolher GIF"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1196,
										columnNumber: 19
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-xs text-subtle",
										children: "Pesquise um GIF para adicionar ao comentário."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1199,
										columnNumber: 19
									}, this)] }, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1195,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("button", {
										type: "button",
										onClick: () => setGifOpen(false),
										"aria-label": "Fechar GIFs",
										title: "Fechar",
										className: "flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-fg",
										children: /* @__PURE__ */ (void 0)(X, { className: "size-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1205,
											columnNumber: 19
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1204,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1194,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (void 0)("form", {
									className: "mt-3 flex gap-2",
									onSubmit: (event) => {
										event.preventDefault();
										handleGifSearch();
									},
									children: [/* @__PURE__ */ (void 0)("input", {
										value: gifSearch,
										onChange: (event) => setGifSearch(event.target.value),
										placeholder: "Buscar GIF...",
										maxLength: 50,
										className: "min-w-0 flex-1 rounded-lg border border-white/5 bg-bg px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/15"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1213,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("button", {
										type: "submit",
										disabled: gifLoading || gifSearching,
										"aria-label": "Buscar GIF",
										title: "Buscar GIF",
										className: "flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-bg text-muted transition-colors hover:border-white/10 hover:bg-elevated hover:text-fg disabled:cursor-not-allowed disabled:opacity-50",
										children: /* @__PURE__ */ (void 0)(Search, { className: "size-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1216,
											columnNumber: 19
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1215,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1209,
									columnNumber: 15
								}, this),
								gifLoading ? /* @__PURE__ */ (void 0)("div", {
									className: "mt-4 py-8 text-center text-sm text-subtle",
									children: "Carregando GIFs..."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1220,
									columnNumber: 29
								}, this) : gifs.length ? /* @__PURE__ */ (void 0)("div", {
									className: "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4",
									children: gifs.map((gif) => /* @__PURE__ */ (void 0)("button", {
										type: "button",
										onClick: () => handleSelectGif(gif),
										className: "group relative overflow-hidden rounded-lg border border-white/5 bg-bg transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-white/20",
										title: gif.title || "Selecionar GIF",
										children: /* @__PURE__ */ (void 0)("img", {
											src: gif.previewUrl,
											alt: gif.title || "GIF",
											loading: "lazy",
											className: "aspect-square w-full object-cover"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1224,
											columnNumber: 23
										}, this)
									}, gif.id, false, {
										fileName: _jsxFileName,
										lineNumber: 1223,
										columnNumber: 36
									}, this))
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1222,
									columnNumber: 40
								}, this) : /* @__PURE__ */ (void 0)("div", {
									className: "mt-4 py-8 text-center text-sm text-subtle",
									children: "Nenhum GIF encontrado."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1226,
									columnNumber: 26
								}, this),
								/* @__PURE__ */ (void 0)("p", {
									className: "mt-3 text-right text-[10px] text-subtle",
									children: "Powered by GIPHY"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1230,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1193,
							columnNumber: 23
						}, this),
						moderationSuccess && /* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-lg border border-white/5 bg-surface px-4 py-3 text-sm text-muted",
							children: moderationSuccess
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1239,
							columnNumber: 33
						}, this),
						sortBy === "spoiler" && /* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-lg border border-white/5 bg-surface px-4 py-3 text-sm text-muted",
							children: "Mostrando apenas comentários marcados como spoiler."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1247,
							columnNumber: 36
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mt-5 space-y-3",
							children: loading ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "rounded-xl border border-white/5 bg-surface p-5 text-sm text-muted",
								children: "Carregando comentários..."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1257,
								columnNumber: 24
							}, this) : displayedRootComments.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "rounded-xl border border-white/5 bg-surface p-5 text-center text-sm text-muted",
								children: sortBy === "spoiler" ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
									"Não há comentários com spoiler neste episódio.",
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("br", {}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1263,
										columnNumber: 23
									}, this),
									"Tente outro filtro."
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1261,
									columnNumber: 41
								}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
									"Ainda não há comentários neste episódio.",
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("br", {}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1267,
										columnNumber: 23
									}, this),
									"Seja o primeiro a comentar."
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1265,
									columnNumber: 27
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1259,
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
										lineNumber: 1276,
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
												lineNumber: 1296,
												columnNumber: 26
											}, this);
										})
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1292,
										columnNumber: 46
									}, this)]
								}, comment.id, true, {
									fileName: _jsxFileName,
									lineNumber: 1274,
									columnNumber: 20
								}, this);
							})
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1255,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1026,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1024,
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
										lineNumber: 1326,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1324,
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
										lineNumber: 1332,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Altere o texto do seu comentário."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1336,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1330,
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
										lineNumber: 1349,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1342,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1322,
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
							lineNumber: 1354,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-2 flex justify-end",
							children: /* @__PURE__ */ (void 0)("span", {
								className: "text-xs text-subtle",
								children: [editText.length, "/2000"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1358,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1356,
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
								lineNumber: 1366,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("span", { children: "Marcar como spoiler" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1368,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1364,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1374,
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
								lineNumber: 1380,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => void handleEdit(),
								disabled: !editText.trim() || editSaving,
								children: [/* @__PURE__ */ (void 0)(PenLine, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1391,
									columnNumber: 17
								}, this), editSaving ? "Salvando..." : "Salvar alterações"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1390,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1378,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1320,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1318,
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
										lineNumber: 1414,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1412,
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
										lineNumber: 1420,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Essa ação não pode ser desfeita."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1424,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1418,
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
										lineNumber: 1435,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1430,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1410,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 rounded-lg border border-white/5 bg-surface p-3",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "line-clamp-5 whitespace-pre-wrap text-sm text-muted",
								children: deletingComment.content
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1442,
								columnNumber: 15
							}, this), deletingComment.imageUrl && /* @__PURE__ */ (void 0)("img", {
								src: deletingComment.imageUrl,
								alt: "",
								className: "mt-3 max-h-40 rounded-lg object-contain"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1446,
								columnNumber: 44
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1440,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1450,
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
								lineNumber: 1456,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => void handleDelete(),
								disabled: deleteSending,
								children: [/* @__PURE__ */ (void 0)(Trash2, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1465,
									columnNumber: 17
								}, this), deleteSending ? "Excluindo..." : "Excluir comentário"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1464,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1454,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1408,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1406,
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
										lineNumber: 1488,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1486,
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
										lineNumber: 1494,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Por que você está denunciando este comentário?"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1498,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1492,
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
										lineNumber: 1510,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1504,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1484,
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
									lineNumber: 1537,
									columnNumber: 21
								}, this), /* @__PURE__ */ (void 0)("span", { children: item.label }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1539,
									columnNumber: 21
								}, this)]
							}, item.value, true, {
								fileName: _jsxFileName,
								lineNumber: 1535,
								columnNumber: 26
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1515,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1547,
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
								lineNumber: 1553,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => {
									if (reportingComment && reportReason) handleModeration(reportingComment.id, "report", reportReason);
								},
								disabled: !reportReason || reportSending || Boolean(moderatingId),
								children: [/* @__PURE__ */ (void 0)(Flag, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1567,
									columnNumber: 17
								}, this), reportSending ? "Enviando..." : "Enviar denúncia"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1562,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1551,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("p", {
							className: "mt-4 text-xs leading-5 text-subtle",
							children: "As denúncias ajudam a equipe de moderação a manter a comunidade do Hikari segura."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1574,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1482,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1480,
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
									lineNumber: 1594,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1592,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (void 0)("h3", {
									id: "spam-dialog-title",
									className: "font-display text-xl",
									children: "Marcar como spam?"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1600,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("p", {
									className: "mt-1 text-sm text-muted",
									children: "Este comentário será sinalizado para análise da moderação."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1604,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1598,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1590,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-lg border border-white/5 bg-surface p-3",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "line-clamp-4 whitespace-pre-wrap text-sm text-muted",
								children: spamComment.content
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1614,
								columnNumber: 15
							}, this), spamComment.imageUrl && /* @__PURE__ */ (void 0)("img", {
								src: spamComment.imageUrl,
								alt: "",
								className: "mt-3 max-h-40 rounded-lg object-contain"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1618,
								columnNumber: 40
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1612,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1622,
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
								lineNumber: 1628,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => {
									handleModeration(spamComment.id, "spam");
								},
								disabled: Boolean(moderatingId),
								children: [/* @__PURE__ */ (void 0)(Ban, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1639,
									columnNumber: 17
								}, this), moderatingId === spamComment.id ? "Enviando..." : "Marcar como spam"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1636,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1626,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1588,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1586,
				columnNumber: 23
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 1022,
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
					lineNumber: 1723,
					columnNumber: 32
				}, this) : (comment.userName || "U").charAt(0).toUpperCase()
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1721,
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
									lineNumber: 1741,
									columnNumber: 15
								}, this),
								isReply && replyToName && /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (void 0)("span", {
									className: "text-sm text-subtle",
									children: "→"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1746,
									columnNumber: 21
								}, this), /* @__PURE__ */ (void 0)("span", {
									className: "text-sm font-semibold text-muted",
									children: replyToName
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1750,
									columnNumber: 21
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1745,
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
									lineNumber: 1755,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1739,
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
									lineNumber: 1770,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1768,
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
										lineNumber: 1779,
										columnNumber: 25
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Editar comentário" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1781,
										columnNumber: 25
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1777,
									columnNumber: 23
								}, this), /* @__PURE__ */ (void 0)("button", {
									type: "button",
									role: "menuitem",
									onClick: onDelete,
									disabled: moderating,
									className: "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50",
									children: [/* @__PURE__ */ (void 0)(Trash2, { className: "size-4 shrink-0" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1789,
										columnNumber: 25
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Excluir comentário" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1791,
										columnNumber: 25
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1787,
									columnNumber: 23
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1776,
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
											lineNumber: 1799,
											columnNumber: 25
										}, this), /* @__PURE__ */ (void 0)("span", { children: moderating ? "Enviando..." : "Marcar como spoiler" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1801,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1797,
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
											lineNumber: 1809,
											columnNumber: 25
										}, this), /* @__PURE__ */ (void 0)("span", { children: "Denunciar comentário" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1811,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1807,
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
											lineNumber: 1819,
											columnNumber: 25
										}, this), /* @__PURE__ */ (void 0)("span", { children: "Marcar como spam" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1821,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1817,
										columnNumber: 23
									}, this)
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1796,
									columnNumber: 27
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1774,
								columnNumber: 28
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1766,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 1737,
						columnNumber: 11
					}, this),
					comment.isSpoiler ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("details", {
						className: "mt-2 rounded-lg border border-white/5 bg-bg/50 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("summary", {
							className: "cursor-pointer text-sm font-medium text-fg",
							children: "⚠️ Mostrar spoiler"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1840,
							columnNumber: 15
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-2 whitespace-pre-wrap text-sm leading-6 text-muted",
							children: comment.content
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1844,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 1838,
						columnNumber: 32
					}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-2 whitespace-pre-wrap text-sm leading-6 text-muted",
						children: comment.content
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1848,
						columnNumber: 26
					}, this),
					comment.imageUrl && /* @__PURE__ */ (void 0)("div", {
						className: "mt-3 w-fit max-w-full overflow-hidden rounded-xl border border-white/5 bg-bg",
						children: /* @__PURE__ */ (void 0)("a", {
							href: comment.imageUrl,
							target: "_blank",
							rel: "noreferrer",
							className: "block w-fit max-w-full cursor-zoom-in",
							"aria-label": "Abrir imagem em tamanho maior",
							children: /* @__PURE__ */ (void 0)("img", {
								src: comment.imageUrl,
								alt: "Imagem anexada ao comentário",
								loading: "lazy",
								className: "block max-h-[520px] w-auto max-w-full object-contain"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1859,
								columnNumber: 17
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1858,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1856,
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
									lineNumber: 1872,
									columnNumber: 15
								}, this), comment.likes]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1870,
								columnNumber: 13
							}, this),
							!isReply && /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: onStartReply,
								className: "flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-fg",
								children: [/* @__PURE__ */ (void 0)(MessageCircle, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1880,
									columnNumber: 17
								}, this), "Responder"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1878,
								columnNumber: 26
							}, this),
							!isReply && replyCount > 0 && /* @__PURE__ */ (void 0)("span", {
								className: "flex items-center gap-1.5 text-xs text-subtle",
								children: [
									/* @__PURE__ */ (void 0)(MessageCircle, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1888,
										columnNumber: 19
									}, this),
									replyCount,
									" ",
									replyCount === 1 ? "Resposta" : "Respostas"
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1886,
								columnNumber: 44
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 1868,
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
								lineNumber: 1903,
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
									lineNumber: 1909,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("span", { children: "Marcar como spoiler" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1913,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1907,
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
									lineNumber: 1921,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)(Button, {
									type: "button",
									size: "sm",
									onClick: onSendReply,
									disabled: !replyText.trim() || replySending,
									children: [/* @__PURE__ */ (void 0)(Send, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1926,
										columnNumber: 19
									}, this), replySending ? "Enviando..." : "Responder"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1925,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1919,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 1901,
						columnNumber: 26
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 1731,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 1715,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 1713,
		columnNumber: 10
	}, this);
}
//#endregion
export { WatchPage as component };
