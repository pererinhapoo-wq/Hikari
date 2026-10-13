import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore, n as displayTitle } from "./types-CX6YV1cu.mjs";
import { a as youtubeIdFrom } from "./utils-Cws_m9jY.mjs";
import { c as scoreLabel, o as formatLabel, s as genreLabel, u as statusLabel } from "./labels-BsexCKFj.mjs";
import { A as Play, C as Share2, Ct as ArrowLeft, ft as ChevronDown, j as Pencil, pt as Check, vt as Bookmark, yt as BookmarkCheck } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { H as AnimeCard, L as useCurrentUserState, O as mergeDetail, R as isHikariAdmin, u as Route$22 } from "./router-Dx2-dd95.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
import { t as Badge } from "./badge-Dg3McsuO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/anime._id-C2UzF3Dh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/anime.$id.tsx?tsr-split=component";
var EMPTY_WATCHED_EPISODES = [];
function AnimePage() {
	const { id } = Route$22.useParams();
	const { remote } = Route$22.useLoaderData();
	useNavigate();
	const hydrated = useHikariStore((s) => s.hydrated);
	const { user } = useCurrentUserState();
	const canEdit = isHikariAdmin(user?.primaryEmail);
	const locals = useHikariStore((s) => s.animes);
	const inList = useHikariStore((s) => s.myList.includes(id) || (remote?.id ? s.myList.includes(remote.id) : false));
	const toggleList = useHikariStore((s) => s.toggleList);
	const continueEntry = useHikariStore((s) => s.continueWatching.find((entry) => entry.animeId === id));
	const watchedEpisodes = useHikariStore((s) => s.watchedEpisodes[id] ?? EMPTY_WATCHED_EPISODES);
	const anime = mergeDetail(remote, id, locals);
	const [loadedBanner, setLoadedBanner] = (0, import_react.useState)(null);
	const [seasonsOpen, setSeasonsOpen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setLoadedBanner(null);
		if (!anime?.banner) return;
		const bannerId = anime.id;
		const bannerSrc = anime.banner;
		const image = new Image();
		image.onload = () => {
			setLoadedBanner({
				id: bannerId,
				src: bannerSrc
			});
		};
		image.src = bannerSrc;
		return () => {
			image.onload = null;
		};
	}, [
		id,
		anime?.id,
		anime?.banner
	]);
	(0, import_react.useEffect)(() => {
		const defaultColor = "#09090b";
		let meta = document.querySelector("meta[name=\"theme-color\"]");
		if (!meta) {
			meta = document.createElement("meta");
			meta.name = "theme-color";
			document.head.appendChild(meta);
		}
		meta.content = defaultColor;
		if (!anime?.banner) return;
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context) return;
				const width = image.naturalWidth;
				const height = image.naturalHeight;
				if (!width || !height) return;
				canvas.width = 80;
				canvas.height = 40;
				const sourceX = width * .25;
				const sourceY = height * .1;
				const sourceWidth = width * .5;
				const sourceHeight = height * .35;
				context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
				const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
				let red = 0;
				let green = 0;
				let blue = 0;
				let count = 0;
				for (let i = 0; i < pixels.length; i += 4) {
					const r = pixels[i];
					const g = pixels[i + 1];
					const b = pixels[i + 2];
					if (pixels[i + 3] < 180) continue;
					red += r;
					green += g;
					blue += b;
					count++;
				}
				if (!count) return;
				const factor = .72;
				const finalRed = Math.round(red / count * factor);
				const finalGreen = Math.round(green / count * factor);
				const finalBlue = Math.round(blue / count * factor);
				meta.content = `rgb(${finalRed}, ${finalGreen}, ${finalBlue})`;
			} catch {
				meta.content = defaultColor;
			}
		};
		image.onerror = () => {
			meta.content = defaultColor;
		};
		image.src = anime.banner;
		return () => {
			image.onload = null;
			image.onerror = null;
		};
	}, [anime?.id, anime?.banner]);
	const seasonNavigation = remote?.seasonNavigation?.items ?? [];
	const currentSeason = (anime?.seasons ?? [])[0] ?? null;
	const currentEpisodes = currentSeason?.episodes ?? [];
	const allEpisodes = (0, import_react.useMemo)(() => currentEpisodes.map((episode) => ({
		...episode,
		seasonId: currentSeason?.id ?? ""
	})), [currentEpisodes, currentSeason?.id]);
	if (!anime && !hydrated) return null;
	if (!anime) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "py-24 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
			className: "font-display text-2xl",
			children: "Anime não encontrado"
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 159,
			columnNumber: 9
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
			to: "/",
			className: "mt-3 inline-block text-sm text-muted underline",
			children: "Voltar ao início"
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 163,
			columnNumber: 9
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 158,
		columnNumber: 12
	}, this);
	const title = displayTitle(anime);
	const yt = youtubeIdFrom(anime.trailerId);
	const localRecord = locals.find((a) => a.id === anime.id || anime.anilistId && a.anilistId === anime.anilistId);
	const episodeCount = currentEpisodes.length || anime.episodesCount || 0;
	const watchedCount = allEpisodes.filter((episode) => watchedEpisodes.includes(episode.id)).length;
	const continueEpisode = continueEntry ? allEpisodes.find((episode) => episode.id === continueEntry.episodeId) : void 0;
	const continueTarget = continueEpisode ?? allEpisodes[0];
	const watchButtonLabel = continueEpisode ? `Continuar no episódio ${continueEpisode.number}` : "Assistir";
	const handleShare = async () => {
		try {
			if (navigator.share) await navigator.share({
				title,
				text: `Confira ${title} no Hikari`,
				url: window.location.href
			});
			else await navigator.clipboard.writeText(window.location.href);
		} catch {}
	};
	const handleBack = () => {
		if (window.history.length > 1) window.history.back();
	};
	const bannerIsReady = loadedBanner?.id === anime.id && loadedBanner.id === id;
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("article", {
		className: "pb-12",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "relative -mx-4 overflow-hidden sm:-mx-6",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "relative h-[14rem] sm:h-[22rem]",
					children: [
						bannerIsReady && /* @__PURE__ */ (void 0)("img", {
							src: loadedBanner.src,
							alt: "",
							loading: "eager",
							decoding: "async",
							className: "size-full object-cover"
						}, `${loadedBanner.id}-${loadedBanner.src}`, false, {
							fileName: _jsxFileName,
							lineNumber: 208,
							columnNumber: 29
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute inset-0 bg-linear-to-t from-bg via-bg/60 to-bg/10" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 210,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute inset-0 bg-linear-to-r from-bg/80 via-transparent to-bg/30" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 212,
							columnNumber: 11
						}, this),
						window.history.length > 1 && /* @__PURE__ */ (void 0)("button", {
							type: "button",
							onClick: handleBack,
							"aria-label": "Voltar",
							title: "Voltar",
							className: "absolute left-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/65 sm:left-6",
							children: [/* @__PURE__ */ (void 0)(ArrowLeft, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 216,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("span", { children: "Voltar" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 217,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 215,
							columnNumber: 41
						}, this)
					]
				}, `banner-${anime.id}`, true, {
					fileName: _jsxFileName,
					lineNumber: 207,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "relative z-10 -mt-24 px-4 sm:-mt-32 sm:px-6",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mx-auto w-32 shrink-0 overflow-hidden rounded-xl bg-elevated shadow-2xl ring-1 ring-white/10 sm:mx-0 sm:w-44",
							children: anime.cover ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
								src: anime.cover,
								alt: title,
								className: "aspect-2/3 w-full object-cover"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 225,
								columnNumber: 30
							}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "aspect-2/3 bg-elevated" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 225,
								columnNumber: 113
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 224,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex min-w-0 flex-1 flex-col justify-end pb-1 sm:pb-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "mb-2",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-[11px] font-medium tracking-[0.3em] text-muted uppercase",
										children: "Anime"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 231,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 230,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
									className: "font-display text-3xl leading-tight tracking-tight sm:text-5xl",
									children: title
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 236,
									columnNumber: 15
								}, this),
								anime.titles.native && /* @__PURE__ */ (void 0)("p", {
									className: "mt-1 font-display text-sm text-muted",
									children: anime.titles.native
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 240,
									columnNumber: 39
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm",
									children: [
										anime.score != null && /* @__PURE__ */ (void 0)("span", {
											className: "font-semibold tabular-nums text-score",
											children: ["★ ", scoreLabel(anime.score)]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 246,
											columnNumber: 41
										}, this),
										anime.year && /* @__PURE__ */ (void 0)("span", {
											className: "text-muted",
											children: anime.year
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 250,
											columnNumber: 32
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "text-muted",
											children: formatLabel(anime.format)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 254,
											columnNumber: 17
										}, this),
										episodeCount > 0 && /* @__PURE__ */ (void 0)("span", {
											className: "text-muted",
											children: [episodeCount, " episódios"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 258,
											columnNumber: 38
										}, this),
										statusLabel(anime.status) && /* @__PURE__ */ (void 0)("span", {
											className: "text-muted",
											children: statusLabel(anime.status)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 262,
											columnNumber: 47
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 245,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "mt-3 flex flex-wrap gap-1.5",
									children: anime.genres.map((g) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
										to: "/search",
										search: {
											q: "",
											genre: g,
											year: "",
											format: "",
											status: "",
											sort: "TRENDING_DESC"
										},
										children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Badge, { children: genreLabel(g) }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 277,
											columnNumber: 21
										}, this)
									}, g, false, {
										fileName: _jsxFileName,
										lineNumber: 269,
										columnNumber: 40
									}, this))
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 268,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "mt-5 flex flex-wrap gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
											asChild: true,
											size: "lg",
											children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
												to: "/watch/$id",
												params: { id: anime.id },
												search: continueTarget ? { ep: continueTarget.id } : void 0,
												children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Play, { className: "size-4 fill-current" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 291,
													columnNumber: 21
												}, this), watchButtonLabel]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 286,
												columnNumber: 19
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 285,
											columnNumber: 17
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
											type: "button",
											variant: "outline",
											size: "lg",
											onClick: () => toggleList(anime),
											children: [inList ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(BookmarkCheck, { className: "size-4" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 298,
												columnNumber: 29
											}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bookmark, { className: "size-4" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 298,
												columnNumber: 68
											}, this), inList ? "Na lista" : "Minha Lista"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 297,
											columnNumber: 17
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
											type: "button",
											variant: "outline",
											size: "lg",
											onClick: handleShare,
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Share2, { className: "size-4" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 304,
												columnNumber: 19
											}, this), "Compartilhar"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 303,
											columnNumber: 17
										}, this),
										canEdit && /* @__PURE__ */ (void 0)(Button, {
											asChild: true,
											variant: "ghost",
											children: /* @__PURE__ */ (void 0)(Link, {
												to: "/admin/$id",
												params: { id: localRecord?.id ?? "new" },
												search: { importId: anime.id },
												children: [/* @__PURE__ */ (void 0)(Pencil, { className: "size-4" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 315,
													columnNumber: 23
												}, this), "Editar"]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 310,
												columnNumber: 21
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 309,
											columnNumber: 29
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 284,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 229,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 222,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 221,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 206,
				columnNumber: 7
			}, this),
			anime.synopsis && /* @__PURE__ */ (void 0)("section", {
				className: "mt-10 max-w-4xl",
				children: [/* @__PURE__ */ (void 0)("h2", {
					className: "font-display text-2xl tracking-tight",
					children: "Sinopse"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 328,
					columnNumber: 11
				}, this), /* @__PURE__ */ (void 0)("p", {
					className: "mt-3 text-sm leading-7 text-muted sm:text-base",
					children: anime.synopsis
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 332,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 327,
				columnNumber: 26
			}, this),
			yt && /* @__PURE__ */ (void 0)("section", {
				className: "mt-10",
				children: [/* @__PURE__ */ (void 0)("div", {
					className: "flex items-center justify-between",
					children: /* @__PURE__ */ (void 0)("h2", {
						className: "font-display text-2xl tracking-tight",
						children: "Trailer"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 340,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 339,
					columnNumber: 11
				}, this), /* @__PURE__ */ (void 0)("div", {
					className: "mt-4 aspect-video overflow-hidden rounded-xl bg-elevated shadow-[var(--shadow-border)]",
					children: /* @__PURE__ */ (void 0)("iframe", {
						title: `Trailer de ${title}`,
						src: `https://www.youtube-nocookie.com/embed/${yt}`,
						className: "size-full",
						allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
						allowFullScreen: true
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 346,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 345,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 338,
				columnNumber: 14
			}, this),
			seasonNavigation.length > 1 && /* @__PURE__ */ (void 0)("section", {
				className: "mt-8",
				children: /* @__PURE__ */ (void 0)("div", {
					className: "relative w-[220px] max-w-full",
					children: [/* @__PURE__ */ (void 0)("button", {
						type: "button",
						onClick: () => setSeasonsOpen((open) => !open),
						className: "flex w-full items-center justify-between rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-left transition-colors hover:bg-elevated",
						"aria-expanded": seasonsOpen,
						children: [/* @__PURE__ */ (void 0)("span", {
							className: "font-display text-base tracking-tight",
							children: "Temporadas"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 354,
							columnNumber: 15
						}, this), /* @__PURE__ */ (void 0)(ChevronDown, { className: `size-4 text-muted transition-transform ${seasonsOpen ? "rotate-180" : ""}` }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 358,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 353,
						columnNumber: 13
					}, this), seasonsOpen && /* @__PURE__ */ (void 0)("div", {
						className: "absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-white/10 bg-surface p-1 shadow-2xl",
						children: seasonNavigation.map((season, index) => {
							const selected = season.id === anime.id;
							const seasonName = season.label ?? season.title ?? `Temporada ${index + 1}`;
							return /* @__PURE__ */ (void 0)(Link, {
								to: "/anime/$id",
								params: { id: season.id },
								onClick: () => setSeasonsOpen(false),
								className: `flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs leading-snug transition-colors ${selected ? "bg-elevated font-medium text-fg" : "text-muted hover:bg-elevated hover:text-fg"}`,
								children: [/* @__PURE__ */ (void 0)("span", { children: seasonName }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 368,
									columnNumber: 25
								}, this), selected && /* @__PURE__ */ (void 0)(Check, { className: "ml-2 size-3.5 shrink-0" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 372,
									columnNumber: 38
								}, this)]
							}, season.id, true, {
								fileName: _jsxFileName,
								lineNumber: 365,
								columnNumber: 20
							}, this);
						})
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 361,
						columnNumber: 29
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 352,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 351,
				columnNumber: 39
			}, this),
			currentSeason && /* @__PURE__ */ (void 0)("section", {
				id: "episodes",
				className: "mt-12",
				children: [/* @__PURE__ */ (void 0)("div", {
					className: "flex items-end justify-between gap-4",
					children: /* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("h2", {
						className: "font-display text-2xl tracking-tight sm:text-3xl",
						children: "Episódios"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 383,
						columnNumber: 15
					}, this), /* @__PURE__ */ (void 0)("div", {
						className: "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted",
						children: [
							/* @__PURE__ */ (void 0)("span", { children: [episodeCount, " episódios disponíveis"] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 388,
								columnNumber: 17
							}, this),
							/* @__PURE__ */ (void 0)("span", {
								className: "text-subtle",
								children: "•"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 392,
								columnNumber: 17
							}, this),
							/* @__PURE__ */ (void 0)("span", { children: [
								watchedCount,
								"/",
								episodeCount,
								" ",
								"assistidos"
							] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 396,
								columnNumber: 17
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 387,
						columnNumber: 15
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 382,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 381,
					columnNumber: 11
				}, this), /* @__PURE__ */ (void 0)("div", {
					className: "mt-5",
					children: /* @__PURE__ */ (void 0)(EpisodeGrid, {
						episodes: currentSeason.episodes,
						animeId: anime.id,
						cover: anime.cover,
						watchedEpisodes
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 405,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 404,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 380,
				columnNumber: 25
			}, this),
			anime.studios.length > 0 && /* @__PURE__ */ (void 0)("section", {
				className: "mt-10 rounded-xl border border-white/5 bg-surface p-5",
				children: [/* @__PURE__ */ (void 0)("p", {
					className: "text-xs tracking-[0.2em] text-subtle uppercase",
					children: "Estúdio"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 411,
					columnNumber: 11
				}, this), /* @__PURE__ */ (void 0)("p", {
					className: "mt-2 text-sm text-fg",
					children: anime.studios.join(", ")
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 415,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 410,
				columnNumber: 36
			}, this),
			anime.recommendations.length > 0 && /* @__PURE__ */ (void 0)("section", {
				className: "mt-12 space-y-4",
				children: [/* @__PURE__ */ (void 0)("div", {
					className: "flex items-center justify-between",
					children: /* @__PURE__ */ (void 0)("h2", {
						className: "font-display text-2xl tracking-tight sm:text-3xl",
						children: "Relacionados"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 423,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 422,
					columnNumber: 11
				}, this), /* @__PURE__ */ (void 0)("div", {
					className: "rail -mx-4 px-4 sm:-mx-6 sm:px-6",
					children: anime.recommendations.map((r) => /* @__PURE__ */ (void 0)(AnimeCard, { anime: r }, r.id, false, {
						fileName: _jsxFileName,
						lineNumber: 429,
						columnNumber: 45
					}, this))
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 428,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 421,
				columnNumber: 44
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "mt-12 border-t border-white/5 pt-10",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center justify-between",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
						className: "font-display text-2xl tracking-tight sm:text-3xl",
						children: "Comentários"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 437,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-1 text-sm text-muted",
						children: "A discussão deste anime ficará aqui."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 441,
						columnNumber: 13
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 436,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 435,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mt-5 rounded-xl border border-white/5 bg-surface p-6 text-center",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-sm text-muted",
						children: "Os comentários do Hikari serão adicionados aqui."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 448,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 447,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 434,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 204,
		columnNumber: 10
	}, this);
}
function EpisodeGrid({ episodes, animeId, cover, watchedEpisodes }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "\n        max-h-[28rem]\n        overflow-y-auto\n        overscroll-contain\n        rounded-xl\n        pr-1\n        touch-pan-y\n        sm:max-h-[34rem]\n      ",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("ol", {
			className: "grid gap-3 sm:grid-cols-2",
			children: episodes.map((ep) => {
				const watched = watchedEpisodes.includes(ep.id);
				return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/watch/$id",
					params: { id: animeId },
					search: { ep: ep.id },
					className: `group flex gap-3 rounded-xl border p-2.5 shadow-[var(--shadow-border)] transition-all hover:-translate-y-0.5 ${watched ? "border-white/10 bg-elevated" : "border-white/5 bg-surface hover:bg-elevated"}`,
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "relative h-[5rem] w-32 shrink-0 overflow-hidden rounded-lg bg-elevated sm:h-[5.5rem] sm:w-36",
						children: [
							ep.thumbnail || cover ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
								src: ep.thumbnail || cover,
								alt: "",
								className: `size-full object-cover transition-transform duration-300 group-hover:scale-105 ${watched ? "opacity-70" : ""}`
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 493,
								columnNumber: 44
							}, this) : null,
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/5" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 495,
								columnNumber: 19
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex size-9 items-center justify-center rounded-full bg-white text-black shadow-lg",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Play, { className: "ml-0.5 size-4 fill-current" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 499,
										columnNumber: 23
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 498,
									columnNumber: 21
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 497,
								columnNumber: 19
							}, this),
							watched && /* @__PURE__ */ (void 0)("div", {
								className: "absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/75 text-white",
								children: /* @__PURE__ */ (void 0)(Check, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 504,
									columnNumber: 23
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 503,
								columnNumber: 31
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 492,
						columnNumber: 17
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "min-w-0 flex-1 py-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-[11px] font-medium tracking-wide text-subtle uppercase",
									children: [
										"Episódio",
										" ",
										ep.number
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 511,
									columnNumber: 21
								}, this), watched && /* @__PURE__ */ (void 0)("span", {
									className: "shrink-0 text-[10px] font-medium tracking-wide text-subtle uppercase",
									children: "Assistido"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 516,
									columnNumber: 33
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 510,
								columnNumber: 19
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 line-clamp-2 text-sm leading-snug text-fg",
								children: ep.title
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 521,
								columnNumber: 19
							}, this),
							ep.duration && /* @__PURE__ */ (void 0)("p", {
								className: "mt-1 text-xs text-subtle",
								children: ep.duration
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 525,
								columnNumber: 35
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 509,
						columnNumber: 17
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 486,
					columnNumber: 15
				}, this) }, ep.id, false, {
					fileName: _jsxFileName,
					lineNumber: 485,
					columnNumber: 16
				}, this);
			})
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 482,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 473,
		columnNumber: 10
	}, this);
}
//#endregion
export { AnimePage as component };
