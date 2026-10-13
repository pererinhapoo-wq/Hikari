import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as MessageCircle, Ct as ArrowLeft, Q as Heart, St as BadgeCheck, i as Users, o as UserPlus, s as UserCheck } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { B as useServerFn, F as getPublicProfile, P as getPublicComments, a as Route$15 } from "./router-Dx2-dd95.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profile._nick-Btr5FtVl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/profile.$nick.tsx?tsr-split=component";
async function getProfileBackgroundColor(imageUrl) {
	return new Promise((resolve) => {
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				canvas.width = 32;
				canvas.height = 32;
				const context = canvas.getContext("2d");
				if (!context) {
					resolve(null);
					return;
				}
				context.drawImage(image, 0, 0, 32, 32);
				const data = context.getImageData(0, 0, 32, 32).data;
				let red = 0;
				let green = 0;
				let blue = 0;
				let count = 0;
				for (let index = 0; index < data.length; index += 4) {
					const r = data[index];
					const g = data[index + 1];
					const b = data[index + 2];
					if (data[index + 3] < 80) continue;
					if ((r + g + b) / 3 > 235) continue;
					red += r;
					green += g;
					blue += b;
					count++;
				}
				if (!count) {
					resolve(null);
					return;
				}
				red = Math.round(red / count * .35);
				green = Math.round(green / count * .35);
				blue = Math.round(blue / count * .35);
				resolve(`rgb(${red}, ${green}, ${blue})`);
			} catch {
				resolve(null);
			}
		};
		image.onerror = () => {
			resolve(null);
		};
		image.src = imageUrl;
	});
}
function PublicProfile() {
	const { nick } = Route$15.useParams();
	const getPublicProfileFn = useServerFn(getPublicProfile);
	const getPublicCommentsFn = useServerFn(getPublicComments);
	const [profile, setProfile] = (0, import_react.useState)(null);
	const [comments, setComments] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [commentsLoading, setCommentsLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [commentsError, setCommentsError] = (0, import_react.useState)("");
	const [following, setFollowing] = (0, import_react.useState)(false);
	const [followersCount, setFollowersCount] = (0, import_react.useState)(0);
	const [followLoading, setFollowLoading] = (0, import_react.useState)(false);
	const [profileBgColor, setProfileBgColor] = (0, import_react.useState)("#030817");
	(0, import_react.useEffect)(() => {
		let active = true;
		setLoading(true);
		setError("");
		setCommentsError("");
		setComments([]);
		setProfileBgColor("#030817");
		getPublicProfileFn({ data: { nick } }).then(async (result) => {
			if (!active) return;
			setProfile(result);
			setFollowing(result.isFollowing);
			setFollowersCount(result.followersCount);
			if (result.image) {
				const color = await getProfileBackgroundColor(result.image);
				if (active && color) setProfileBgColor(color);
			}
			setCommentsLoading(true);
			try {
				const publicComments = await getPublicCommentsFn({ data: { userId: result.userId } });
				if (!active) return;
				setComments(publicComments);
			} catch {
				if (!active) return;
				setComments([]);
				setCommentsError("Não foi possível carregar os comentários.");
			} finally {
				if (active) setCommentsLoading(false);
			}
		}).catch((err) => {
			if (!active) return;
			setProfile(null);
			setError(err instanceof Error ? err.message : "Não foi possível carregar o perfil.");
		}).finally(() => {
			if (active) setLoading(false);
		});
		return () => {
			active = false;
		};
	}, [nick]);
	async function toggleFollow() {
		if (!profile) return;
		if (followLoading) return;
		setFollowLoading(true);
		setError("");
		try {
			const response = await fetch("/api/profile/follow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targetUserId: profile.userId })
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Não foi possível alterar o seguimento.");
			const newFollowing = Boolean(result.following);
			const newFollowersCount = Number(result.followersCount ?? 0);
			setFollowing(newFollowing);
			setFollowersCount(newFollowersCount);
			setProfile((current) => current ? {
				...current,
				isFollowing: newFollowing,
				followersCount: newFollowersCount
			} : current);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Não foi possível alterar o seguimento.");
		} finally {
			setFollowLoading(false);
		}
	}
	async function toggleCommentLike(commentId) {
		try {
			const response = await fetch("/api/comments/like", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ commentId })
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Não foi possível curtir o comentário.");
			setComments((current) => current.map((comment) => comment.id === commentId ? {
				...comment,
				liked: Boolean(result.liked),
				likes: Number(result.likes ?? 0)
			} : comment));
		} catch (err) {
			setCommentsError(err instanceof Error ? err.message : "Não foi possível curtir o comentário.");
		}
	}
	if (loading) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("main", {
		className: "min-h-screen bg-[#030817] px-4 py-8 text-white",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mx-auto max-w-4xl",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-8 w-24 animate-pulse rounded bg-[#102343]" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 215,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "mt-6 rounded-3xl border border-[#1c3c70] bg-[#061329] p-6 sm:p-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-10 w-56 animate-pulse rounded bg-[#102343]" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 218,
						columnNumber: 13
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-3 h-5 w-32 animate-pulse rounded bg-[#102343]" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 220,
						columnNumber: 13
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-6 h-4 w-full animate-pulse rounded bg-[#102343]" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 222,
						columnNumber: 13
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-4 w-3/4 animate-pulse rounded bg-[#102343]" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 224,
						columnNumber: 13
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 217,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 214,
			columnNumber: 9
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 213,
		columnNumber: 12
	}, this);
	if (!profile) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("main", {
		className: "min-h-screen bg-[#030817] px-4 py-8 text-white",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mx-auto max-w-4xl",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
				to: "/",
				className: "inline-flex items-center gap-2 text-sm text-[#9fb2d4] transition hover:text-white",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ArrowLeft, { className: "size-4" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 233,
					columnNumber: 13
				}, this), "Voltar"]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 232,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "mt-6 rounded-3xl border border-red-500/20 bg-[#061329] p-8 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Users, { className: "mx-auto size-10 text-red-300" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 238,
						columnNumber: 13
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
						className: "mt-4 text-xl font-semibold",
						children: "Perfil não encontrado"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 240,
						columnNumber: 13
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-2 text-sm text-[#8197ba]",
						children: error || "Esse perfil não existe."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 244,
						columnNumber: 13
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 237,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 231,
			columnNumber: 9
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 230,
		columnNumber: 12
	}, this);
	const avatarLetter = profile.nick.charAt(0).toUpperCase();
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("main", {
		className: "min-h-screen pb-24 pt-5 text-white transition-colors duration-700",
		style: { backgroundColor: profileBgColor },
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "w-full",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "px-5 sm:px-8 lg:px-10",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/",
						className: "inline-flex items-center gap-2 text-sm text-[#d0d9ea] transition hover:text-white",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ArrowLeft, { className: "size-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 258,
							columnNumber: 13
						}, this), "Voltar"]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 257,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 256,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
					className: "mt-5 w-full",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "px-5 pb-7 pt-7 sm:px-8 sm:pt-8 lg:px-10",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "grid size-28 place-items-center overflow-hidden rounded-full border-[5px] border-white/10 bg-[#15284b] text-5xl font-semibold shadow-xl sm:size-32",
								children: profile.image ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
									src: profile.image,
									alt: `Foto de ${profile.nick}`,
									className: "size-full object-cover"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 267,
									columnNumber: 34
								}, this) : avatarLetter
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 266,
								columnNumber: 15
							}, this) }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 265,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "flex flex-wrap items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
											className: "text-3xl font-semibold sm:text-4xl",
											children: profile.nick
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 274,
											columnNumber: 19
										}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(BadgeCheck, { className: "size-6 fill-violet-500 text-white" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 278,
											columnNumber: 19
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 273,
										columnNumber: 17
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "mt-1 text-base text-[#c0cbe0]",
										children: ["@", profile.nick]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 281,
										columnNumber: 17
									}, this),
									profile.bio && /* @__PURE__ */ (void 0)("p", {
										className: "mt-4 max-w-2xl text-sm leading-6 text-[#d0d9ea]",
										children: profile.bio
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 285,
										columnNumber: 33
									}, this)
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 272,
									columnNumber: 15
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
									type: "button",
									onClick: () => void toggleFollow(),
									disabled: followLoading,
									className: following ? "border border-[#365b91] bg-[#102343] text-white hover:bg-[#163055]" : "bg-violet-600 text-white hover:bg-violet-500",
									children: following ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(UserCheck, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 292,
										columnNumber: 21
									}, this), followLoading ? "Atualizando..." : "Seguindo"] }, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 291,
										columnNumber: 30
									}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(UserPlus, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 296,
										columnNumber: 21
									}, this), followLoading ? "Atualizando..." : "Seguir"] }, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 295,
										columnNumber: 25
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 290,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 271,
								columnNumber: 13
							}, this),
							error && /* @__PURE__ */ (void 0)("div", {
								className: "mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200",
								children: error
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 303,
								columnNumber: 23
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "mt-7 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-black/15 sm:grid-cols-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(PublicStat, {
										icon: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, {}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 308,
											columnNumber: 33
										}, this),
										value: String(profile.commentCount),
										label: "Comentários"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 308,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(PublicStat, {
										icon: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Heart, {}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 310,
											columnNumber: 33
										}, this),
										value: "0",
										label: "Curtidas"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 310,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(PublicStat, {
										icon: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Users, {}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 312,
											columnNumber: 33
										}, this),
										value: String(followersCount),
										label: "Seguidores"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 312,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(PublicStat, {
										icon: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(UserPlus, {}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 314,
											columnNumber: 33
										}, this),
										value: String(profile.followingCount),
										label: "Seguindo"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 314,
										columnNumber: 15
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 307,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 264,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 263,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
					className: "mt-6 px-5 sm:px-8 lg:px-10",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mb-4 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, { className: "size-5 text-[#b2bfff]" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 321,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
								className: "text-xl font-semibold",
								children: [
									"Comentários de",
									" ",
									profile.nick
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 323,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 320,
							columnNumber: 11
						}, this),
						commentsError && /* @__PURE__ */ (void 0)("div", {
							className: "mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200",
							children: commentsError
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 329,
							columnNumber: 29
						}, this),
						commentsLoading ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "space-y-3",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CommentSkeleton, {}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 334,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CommentSkeleton, {}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 335,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 333,
							columnNumber: 30
						}, this) : comments.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "rounded-2xl border border-white/10 bg-black/20 px-5 py-10 text-center",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, { className: "mx-auto size-9 text-[#8190ad]" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 337,
								columnNumber: 15
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-3 text-sm text-[#b5c0d5]",
								children: "Esse usuário ainda não fez comentários."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 339,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 336,
							columnNumber: 46
						}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "space-y-3",
							children: comments.map((comment) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(PublicCommentCard, {
								comment,
								onLike: () => void toggleCommentLike(comment.id)
							}, comment.id, false, {
								fileName: _jsxFileName,
								lineNumber: 343,
								columnNumber: 40
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 342,
							columnNumber: 22
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 319,
					columnNumber: 9
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 255,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 252,
		columnNumber: 10
	}, this);
}
function PublicCommentCard({ comment, onLike }) {
	const avatarLetter = comment.userName?.charAt(0).toUpperCase() || "U";
	const createdAt = new Date(comment.createdAt).toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	});
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("article", {
		className: "rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-start gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#15284b] text-sm font-semibold text-white",
					children: comment.userImage ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
						src: comment.userImage,
						alt: "",
						className: "size-full object-cover"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 365,
						columnNumber: 32
					}, this) : avatarLetter
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 364,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "font-medium text-white",
							children: comment.userName || "Usuário"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 370,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "text-xs text-[#aab5c9]",
							children: createdAt
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 374,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 369,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/watch/$id",
						params: { id: comment.animeId },
						search: { ep: comment.episodeId },
						className: "mt-1 inline-flex text-xs text-[#b2bfff] transition hover:text-white",
						children: [
							"Episódio",
							" ",
							comment.episodeId
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 379,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 368,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 363,
				columnNumber: 7
			}, this),
			comment.isSpoiler ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("details", {
				className: "mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("summary", {
					className: "cursor-pointer px-4 py-3 text-sm font-medium text-yellow-200",
					children: "⚠️ Mostrar spoiler"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 391,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "border-t border-yellow-500/10 px-4 py-3 text-sm leading-6 text-[#d0d9ea]",
					children: comment.content
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 395,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 390,
				columnNumber: 28
			}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-4 whitespace-pre-wrap text-sm leading-6 text-[#d0d9ea]",
				children: comment.content
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 398,
				columnNumber: 22
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "mt-4 flex items-center gap-5 border-t border-white/10 pt-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					type: "button",
					onClick: onLike,
					className: comment.liked ? "inline-flex items-center gap-2 text-sm text-violet-300 transition hover:text-violet-200" : "inline-flex items-center gap-2 text-sm text-[#aab5c9] transition hover:text-white",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Heart, {
						className: "size-4",
						fill: comment.liked ? "currentColor" : "none"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 404,
						columnNumber: 11
					}, this), comment.likes]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 403,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/watch/$id",
					params: { id: comment.animeId },
					search: { ep: comment.episodeId },
					className: "inline-flex items-center gap-2 text-sm text-[#aab5c9] transition hover:text-white",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, { className: "size-4" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 414,
						columnNumber: 11
					}, this), "Comentário"]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 409,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 402,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 362,
		columnNumber: 10
	}, this);
}
function CommentSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "rounded-2xl border border-white/10 bg-black/20 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "size-10 animate-pulse rounded-full bg-white/10" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 423,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-4 w-32 animate-pulse rounded bg-white/10" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 426,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-3 w-24 animate-pulse rounded bg-white/10" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 428,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 425,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 422,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-5 h-4 w-full animate-pulse rounded bg-white/10" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 432,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-4 w-4/5 animate-pulse rounded bg-white/10" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 434,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 421,
		columnNumber: 10
	}, this);
}
function PublicStat({ icon, value, label }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "flex min-h-[100px] flex-col items-center justify-center border-b border-white/10 px-3 py-4 text-center sm:border-b-0 sm:border-r last:border-r-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "text-[#b2bfff] [&>svg]:size-5",
				children: icon
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 447,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("strong", {
				className: "mt-2 text-xl font-semibold",
				children: value
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 451,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
				className: "mt-1 text-xs text-[#aab5c9]",
				children: label
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 455,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 446,
		columnNumber: 10
	}, this);
}
//#endregion
export { PublicProfile as component };
