import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore, n as displayTitle } from "./types-CX6YV1cu.mjs";
import { a as youtubeIdFrom, r as isDirectVideo, t as cn } from "./utils-Cws_m9jY.mjs";
import { $ as Flag, A as Play, B as MessageCircle, D as Search, E as Send, H as Maximize, M as PenLine, N as Pause, Q as Heart, Y as Image, d as TriangleAlert, dt as ChevronLeft, ft as ChevronDown, n as VolumeX, p as Trash2, r as Volume2, rt as EllipsisVertical, t as X, ut as ChevronRight, w as Settings, xt as Ban } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { r as upload } from "../_libs/@vercel/blob+[...].mjs";
import { O as mergeDetail, R as isHikariAdmin, i as Route$14 } from "./router-Dx2-dd95.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/watch._id-_CGbP5_Q.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/watch.$id.tsx?tsr-split=component";
function WatchPage() {
	const { id } = Route$14.useParams();
	useNavigate();
	const { ep: epQuery, comment: commentQuery } = Route$14.useSearch();
	const { remote } = Route$14.useLoaderData();
	const locals = useHikariStore((s) => s.animes);
	const hydrated = useHikariStore((s) => s.hydrated);
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
	}, [anime?.id, current?.id]);
	const title = anime ? displayTitle(anime) : "";
	const playerSources = (0, import_react.useMemo)(() => [
		{
			url: current?.videoUrl,
			kind: "vercel"
		},
		{
			url: current?.videoUrl2,
			kind: "bunny"
		},
		{
			url: current?.videoUrl3,
			kind: "mux"
		}
	].filter((source) => Boolean(source.url)), [current]);
	const [playerIndex, setPlayerIndex] = (0, import_react.useState)(0);
	const [episodesOpen, setEpisodesOpen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setPlayerIndex(0);
	}, [current?.id, playerSources]);
	const videoRef = (0, import_react.useRef)(null);
	const playerRef = (0, import_react.useRef)(null);
	const lastTapRef = (0, import_react.useRef)(null);
	const tapTimeoutRef = (0, import_react.useRef)(null);
	const controlsHideTimeoutRef = (0, import_react.useRef)(null);
	const [isPlaying, setIsPlaying] = (0, import_react.useState)(false);
	const [currentTime, setCurrentTime] = (0, import_react.useState)(0);
	const [duration, setDuration] = (0, import_react.useState)(0);
	const [settingsOpen, setSettingsOpen] = (0, import_react.useState)(false);
	const [controlsVisible, setControlsVisible] = (0, import_react.useState)(true);
	const [playbackRate, setPlaybackRate] = (0, import_react.useState)(1);
	const [volume, setVolume] = (0, import_react.useState)(1);
	const [isMuted, setIsMuted] = (0, import_react.useState)(false);
	const clearControlsHideTimer = () => {
		if (controlsHideTimeoutRef.current) {
			clearTimeout(controlsHideTimeoutRef.current);
			controlsHideTimeoutRef.current = null;
		}
	};
	const showControls = () => {
		clearControlsHideTimer();
		setControlsVisible(true);
		if (isPlaying) controlsHideTimeoutRef.current = setTimeout(() => {
			setControlsVisible(false);
			controlsHideTimeoutRef.current = null;
		}, 5e3);
	};
	const hideControls = () => {
		clearControlsHideTimer();
		setControlsVisible(false);
	};
	(0, import_react.useEffect)(() => {
		clearControlsHideTimer();
		if (isPlaying) controlsHideTimeoutRef.current = setTimeout(() => {
			setControlsVisible(false);
			controlsHideTimeoutRef.current = null;
		}, 5e3);
		else setControlsVisible(true);
		return clearControlsHideTimer;
	}, [isPlaying]);
	const formatTime = (seconds) => {
		if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
		const total = Math.floor(seconds);
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor(total % 3600 / 60);
		const secs = total % 60;
		if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
		return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	};
	const seekBy = (seconds) => {
		const video = videoRef.current;
		if (!video) return;
		const nextTime = Math.min(Math.max(video.currentTime + seconds, 0), Number.isFinite(video.duration) ? video.duration : video.currentTime + seconds);
		video.currentTime = nextTime;
		setCurrentTime(nextTime);
	};
	const togglePlay = async () => {
		const video = videoRef.current;
		if (!video) return;
		if (video.paused) try {
			await video.play();
		} catch {}
		else video.pause();
	};
	const toggleMute = () => {
		const video = videoRef.current;
		if (!video) return;
		if (video.muted || video.volume === 0) {
			const restored = volume > 0 ? volume : 1;
			video.muted = false;
			video.volume = restored;
			setVolume(restored);
			setIsMuted(false);
		} else {
			video.muted = true;
			setIsMuted(true);
		}
	};
	const handlePlayerTap = (event) => {
		const now = Date.now();
		const rect = event.currentTarget.getBoundingClientRect();
		const touch = event.changedTouches[0];
		if (!touch) return;
		const side = touch.clientX - rect.left < rect.width / 2 ? "left" : "right";
		const previous = lastTapRef.current;
		if (previous && previous.side === side && now - previous.time < 320) {
			if (tapTimeoutRef.current) {
				clearTimeout(tapTimeoutRef.current);
				tapTimeoutRef.current = null;
			}
			seekBy(side === "left" ? -10 : 10);
			showControls();
			lastTapRef.current = null;
			return;
		}
		lastTapRef.current = {
			time: now,
			side
		};
		if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
		tapTimeoutRef.current = setTimeout(() => {
			if (controlsVisible) hideControls();
			else showControls();
			lastTapRef.current = null;
			tapTimeoutRef.current = null;
		}, 220);
	};
	const lockLandscape = async () => {
		try {
			if (typeof screen !== "undefined" && screen.orientation && typeof screen.orientation.lock === "function") await screen.orientation.lock("landscape");
		} catch {}
	};
	const unlockOrientation = async () => {
		try {
			if (typeof screen !== "undefined" && screen.orientation && typeof screen.orientation.unlock === "function") screen.orientation.unlock();
		} catch {}
	};
	(0, import_react.useEffect)(() => {
		const handleFullscreenChange = () => {
			if (document.fullscreenElement) lockLandscape();
			else unlockOrientation();
		};
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
			unlockOrientation();
		};
	}, []);
	const handleFullscreen = async () => {
		const player = playerRef.current;
		if (!player) return;
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
				await unlockOrientation();
			} else {
				await player.requestFullscreen();
				await lockLandscape();
			}
		} catch {}
	};
	const changePlaybackRate = (rate) => {
		const video = videoRef.current;
		setPlaybackRate(rate);
		if (video) video.playbackRate = rate;
	};
	if (!anime && !hydrated) return null;
	if (!anime) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "flex min-h-dvh items-center justify-center bg-bg text-fg",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex flex-col items-center justify-center gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "size-8 animate-spin rounded-full border-2 border-white/10 border-t-[#a855f7]",
				"aria-label": "Carregando"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 276,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
				className: "text-sm text-white/50",
				children: "Carregando..."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 277,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 275,
			columnNumber: 9
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 274,
		columnNumber: 12
	}, this);
	const selectedPlayer = playerSources[playerIndex];
	const playUrl = selectedPlayer?.url ?? "";
	const yt = youtubeIdFrom(playUrl) || (!playUrl ? youtubeIdFrom(anime.trailerId) : null);
	const file = playUrl && isDirectVideo(playUrl) ? playUrl : null;
	const bunnyEmbedSource = selectedPlayer?.kind === "bunny" && playUrl ? (() => {
		const value = playUrl;
		if (value.includes("player.mediadelivery.net/embed/")) return value;
		const match = value.match(/b-cdn\.net\/(?:[^/]+\/)?([0-9a-f-]{36})\/playlist\.m3u8/i);
		return match ? `https://player.mediadelivery.net/embed/759317/${match[1]}?autoplay=false&loop=false&muted=false&preload=true&responsive=true` : null;
	})() : null;
	const muxEmbedSource = selectedPlayer?.kind === "mux" && playUrl ? (() => {
		const value = playUrl.trim();
		if (value.includes("player.mux.com/")) return value;
		if (value) return `https://player.mux.com/${value}`;
		return null;
	})() : null;
	const external = playUrl && !yt && !file && !bunnyEmbedSource && !muxEmbedSource ? playUrl : null;
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "flex min-h-dvh flex-col bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("header", {
			className: "flex min-h-16 items-center gap-3 px-3 py-2.5 sm:px-5",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
				type: "button",
				onClick: () => {
					window.history.back();
				},
				className: "flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/80 transition hover:bg-white/[0.08] hover:text-white active:scale-95",
				"aria-label": "Voltar",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronLeft, { className: "size-5" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 317,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 314,
				columnNumber: 9
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/anime/$id",
					params: { id: anime.id },
					className: "block truncate text-[20px] font-semibold leading-tight text-white transition hover:text-[#c084fc]",
					children: title
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 321,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "truncate pt-0.5 text-[14px] leading-tight text-white/55",
					children: current ? `Episódio ${current.number} · ${current.title}` : "Trailer"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 327,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 320,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 312,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mx-auto w-full max-w-6xl flex-1 px-3 pb-12 sm:px-5",
			children: [
				playerSources.length > 0 && /* @__PURE__ */ (void 0)("div", {
					className: "mb-3 flex flex-wrap gap-2",
					children: playerSources.map((source, index) => /* @__PURE__ */ (void 0)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						className: playerIndex === index ? "rounded-xl border-[#a855f7] bg-[#a855f7] px-5 text-white shadow-[0_0_20px_rgba(168,85,247,0.18)] hover:bg-[#a855f7]/90 hover:text-white" : "rounded-xl border-white/10 bg-white/[0.03] px-5 text-white/70 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
						onClick: () => setPlayerIndex(index),
						children: ["Player ", index + 1]
					}, `${source.kind}-${index}`, true, {
						fileName: _jsxFileName,
						lineNumber: 341,
						columnNumber: 51
					}, this))
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 340,
					columnNumber: 38
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					ref: playerRef,
					onPointerMove: (event) => {
						if (event.pointerType !== "touch") showControls();
					},
					className: "hikari-player relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.45)]",
					children: yt ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("iframe", {
						title: `${title} — player`,
						src: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`,
						className: "size-full",
						allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
						allowFullScreen: true
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 356,
						columnNumber: 17
					}, this) : bunnyEmbedSource ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("iframe", {
						title: `${title} — Bunny Player`,
						src: bunnyEmbedSource,
						loading: "lazy",
						className: "size-full border-0 bg-black",
						allow: "accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen",
						allowFullScreen: true
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 356,
						columnNumber: 282
					}, this) : muxEmbedSource ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("iframe", {
						title: `${title} — Mux Player`,
						src: muxEmbedSource,
						loading: "lazy",
						className: "size-full border-0 bg-black",
						allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen",
						allowFullScreen: true
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 356,
						columnNumber: 532
					}, this) : file ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("style", { children: `
        @media (hover: none) and (pointer: coarse) {
          /* MOBILE ONLY — visual integrado ao vídeo. Desktop permanece igual. */
          .hikari-player .hikari-mobile-controls {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            height: 56px !important;
            padding: 0 12px 4px !important;
            display: block !important;
            background: transparent !important;
            z-index: 10 !important;
          }

          .hikari-player .hikari-progress-shell {
            position: absolute !important;
            left: 12px !important;
            right: 12px !important;
            bottom: 0 !important;
            top: auto !important;
            width: auto !important;
            height: 3px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 999px !important;
            background: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          .hikari-player .hikari-progress-track {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            top: 50% !important;
            height: 2px !important;
            transform: translateY(-50%) !important;
            background: rgba(255,255,255,.35) !important;
            border-radius: 999px !important;
          }

          .hikari-player .hikari-progress-track > div {
            height: 100% !important;
            background: rgba(255,255,255,.95) !important;
          }

          .hikari-player .hikari-progress-shell > div:nth-child(2) {
            width: 6px !important;
            height: 6px !important;
            background: #a855f7 !important;
            box-shadow: 0 0 6px rgba(168,85,247,.75) !important;
          }

          .hikari-player .hikari-mobile-time-row {
            position: absolute !important;
            left: 12px !important;
            right: 12px !important;
            bottom: 8px !important;
            top: auto !important;
            width: auto !important;
            height: 28px !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          .hikari-player .hikari-mobile-time-row > div:first-child {
            font-size: 10px !important;
            line-height: 1 !important;
            text-shadow: 0 1px 4px rgba(0,0,0,.95) !important;
          }

          .hikari-player .hikari-mobile-time-row > div:last-child {
            gap: 2px !important;
          }

          .hikari-player .hikari-volume,
          .hikari-player .hikari-settings,
          .hikari-player .hikari-mobile-fullscreen {
            width: 30px !important;
            height: 30px !important;
            border: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          .hikari-player .hikari-volume svg,
          .hikari-player .hikari-settings svg,
          .hikari-player .hikari-mobile-fullscreen svg {
            width: 17px !important;
            height: 17px !important;
            filter: drop-shadow(0 1px 3px rgba(0,0,0,.95));
          }

          .hikari-player > video + div {
            top: 50% !important;
          }

          .hikari-player .hikari-skip {
            width: 38px !important;
            height: 38px !important;
            background: rgba(0,0,0,.28) !important;
            box-shadow: 0 5px 20px rgba(0,0,0,.3) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
          }
        }
      ` }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 357,
							columnNumber: 7
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("video", {
							ref: videoRef,
							src: file ?? void 0,
							preload: "metadata",
							autoPlay: false,
							playsInline: true,
							disablePictureInPicture: true,
							controlsList: "nodownload noremoteplayback",
							onContextMenu: (event) => event.preventDefault(),
							onTouchEnd: handlePlayerTap,
							style: { touchAction: "pan-x" },
							className: "relative z-0 size-full select-none bg-black object-contain",
							"data-player-video": "true",
							onPlay: () => setIsPlaying(true),
							onPause: () => setIsPlaying(false),
							onLoadedMetadata: (event) => {
								setDuration(event.currentTarget.duration);
								event.currentTarget.playbackRate = playbackRate;
								event.currentTarget.volume = volume;
								event.currentTarget.muted = isMuted;
							},
							onTimeUpdate: (event) => setCurrentTime(event.currentTarget.currentTime),
							onDurationChange: (event) => setDuration(event.currentTarget.duration)
						}, file, false, {
							fileName: _jsxFileName,
							lineNumber: 478,
							columnNumber: 15
						}, this),
						controlsVisible && /* @__PURE__ */ (void 0)("div", {
							className: "pointer-events-none absolute inset-0 z-10 flex -translate-y-1/2 items-center justify-center sm:inset-x-0 sm:inset-y-auto sm:top-[40%]",
							children: /* @__PURE__ */ (void 0)("div", {
								onPointerDown: showControls,
								className: "pointer-events-auto flex items-center gap-2 sm:gap-3",
								children: [
									/* @__PURE__ */ (void 0)("button", {
										type: "button",
										onClick: () => seekBy(-10),
										className: "hikari-skip flex size-10 items-center justify-center rounded-full border-0 bg-black/35 text-[10px] font-semibold text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/15 active:scale-95 sm:size-11 sm:text-[11px]",
										"aria-label": "Voltar 10 segundos",
										children: "-10s"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 489,
										columnNumber: 21
									}, this),
									/* @__PURE__ */ (void 0)("button", {
										type: "button",
										onClick: togglePlay,
										className: "flex size-12 items-center justify-center rounded-full border border-white/30 bg-white/[0.14] text-white shadow-[0_10px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-2xl transition hover:border-white/45 hover:bg-white/20 active:scale-95 sm:size-14",
										"aria-label": isPlaying ? "Pausar" : "Reproduzir",
										children: isPlaying ? /* @__PURE__ */ (void 0)(Pause, { className: "size-5 fill-current" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 494,
											columnNumber: 36
										}, this) : /* @__PURE__ */ (void 0)(Play, { className: "ml-0.5 size-5 fill-current" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 494,
											columnNumber: 80
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 493,
										columnNumber: 21
									}, this),
									/* @__PURE__ */ (void 0)("button", {
										type: "button",
										onClick: () => seekBy(10),
										className: "hikari-skip flex size-10 items-center justify-center rounded-full border-0 bg-black/35 text-[10px] font-semibold text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/15 active:scale-95 sm:size-11 sm:text-[11px]",
										"aria-label": "Avançar 10 segundos",
										children: "+10s"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 497,
										columnNumber: 21
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 488,
								columnNumber: 19
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 487,
							columnNumber: 35
						}, this),
						controlsVisible && /* @__PURE__ */ (void 0)("div", {
							onPointerDown: showControls,
							className: "hikari-mobile-controls absolute inset-x-0 bottom-0 z-10 px-2 pb-2 sm:px-5 sm:pb-4",
							children: [/* @__PURE__ */ (void 0)("div", {
								className: "hikari-progress-shell relative h-5 rounded-full border-0 bg-transparent px-2 shadow-none sm:h-7 sm:px-3",
								children: [
									/* @__PURE__ */ (void 0)("div", {
										className: "hikari-progress-track pointer-events-none absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 sm:inset-x-3 sm:h-1.5",
										children: /* @__PURE__ */ (void 0)("div", {
											className: "h-full rounded-full bg-white/90",
											style: { width: `${duration > 0 ? currentTime / duration * 100 : 0}%` }
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 506,
											columnNumber: 23
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 505,
										columnNumber: 21
									}, this),
									/* @__PURE__ */ (void 0)("div", {
										className: "pointer-events-none absolute top-1/2 size-1.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.75)] sm:size-2",
										style: { left: `${duration > 0 ? Math.min(99.5, Math.max(.5, currentTime / duration * 100)) : .5}%` }
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 511,
										columnNumber: 21
									}, this),
									/* @__PURE__ */ (void 0)("input", {
										"aria-label": "Progresso do episódio",
										type: "range",
										min: 0,
										max: duration || 0,
										step: .1,
										value: Math.min(currentTime, duration || 0),
										onChange: (event) => {
											const nextTime = Number(event.target.value);
											if (videoRef.current) videoRef.current.currentTime = nextTime;
											setCurrentTime(nextTime);
										},
										className: "absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 515,
										columnNumber: 21
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 504,
								columnNumber: 19
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "hikari-mobile-time-row mt-1 flex items-center gap-1.5 rounded-full border-0 bg-transparent px-2 py-1 shadow-none sm:gap-2 sm:px-3 sm:py-1.5",
								children: [/* @__PURE__ */ (void 0)("div", {
									className: "flex shrink-0 items-center gap-1.5 text-[10px] font-medium tabular-nums tracking-wide text-white/90 sm:text-[11px]",
									children: [
										/* @__PURE__ */ (void 0)("span", { children: formatTime(currentTime) }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 524,
											columnNumber: 23
										}, this),
										/* @__PURE__ */ (void 0)("span", {
											className: "text-white/35",
											children: "/"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 525,
											columnNumber: 23
										}, this),
										/* @__PURE__ */ (void 0)("span", {
											className: "text-white/65",
											children: formatTime(duration)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 526,
											columnNumber: 23
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 523,
									columnNumber: 21
								}, this), /* @__PURE__ */ (void 0)("div", {
									className: "pointer-events-auto ml-auto flex items-center gap-1.5 sm:gap-2",
									children: [
										/* @__PURE__ */ (void 0)("button", {
											type: "button",
											onClick: toggleMute,
											className: "hikari-volume flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/15 hover:border-white/25 active:scale-95 sm:size-9",
											"aria-label": isMuted ? "Ativar som" : "Silenciar",
											children: isMuted ? /* @__PURE__ */ (void 0)(VolumeX, { className: "size-3.5 sm:size-4" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 531,
												columnNumber: 36
											}, this) : /* @__PURE__ */ (void 0)(Volume2, { className: "size-3.5 sm:size-4" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 531,
												columnNumber: 81
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 530,
											columnNumber: 23
										}, this),
										/* @__PURE__ */ (void 0)("div", {
											className: "relative",
											children: [/* @__PURE__ */ (void 0)("button", {
												type: "button",
												onClick: () => setSettingsOpen((open) => !open),
												className: `hikari-settings flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/15 hover:border-white/25 active:scale-95 sm:size-10 ${settingsOpen ? "bg-white/15" : ""}`,
												"aria-label": "Configurações do player",
												"aria-expanded": settingsOpen,
												children: /* @__PURE__ */ (void 0)(Settings, { className: "size-3.5 sm:size-4" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 536,
													columnNumber: 27
												}, this)
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 535,
												columnNumber: 25
											}, this), settingsOpen && /* @__PURE__ */ (void 0)("div", {
												className: "absolute bottom-11 right-0 z-20 w-56 rounded-2xl border border-white/10 bg-[#111116]/95 p-2 text-sm shadow-2xl backdrop-blur-xl",
												children: [/* @__PURE__ */ (void 0)("div", {
													className: "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45",
													children: "Configurações"
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 540,
													columnNumber: 29
												}, this), /* @__PURE__ */ (void 0)("div", {
													className: "mt-1 rounded-xl px-3 py-2.5",
													children: [/* @__PURE__ */ (void 0)("div", {
														className: "mb-2 text-white/75",
														children: "Velocidade"
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 545,
														columnNumber: 31
													}, this), /* @__PURE__ */ (void 0)("div", {
														className: "grid grid-cols-5 gap-1",
														children: [
															.75,
															1,
															1.25,
															1.5,
															2
														].map((rate) => /* @__PURE__ */ (void 0)("button", {
															type: "button",
															onClick: () => changePlaybackRate(rate),
															className: `rounded-lg px-1 py-1.5 text-[11px] ${playbackRate === rate ? "bg-[#a855f7] text-white" : "bg-white/5 text-white/65 hover:bg-white/10"}`,
															children: [rate, "x"]
														}, rate, true, {
															fileName: _jsxFileName,
															lineNumber: 547,
															columnNumber: 70
														}, this))
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 546,
														columnNumber: 31
													}, this)]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 544,
													columnNumber: 29
												}, this)]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 539,
												columnNumber: 42
											}, this)]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 534,
											columnNumber: 23
										}, this),
										/* @__PURE__ */ (void 0)("button", {
											type: "button",
											onClick: handleFullscreen,
											className: "hikari-mobile-fullscreen flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/15 hover:border-white/25 active:scale-95 sm:size-9",
											"aria-label": "Tela cheia",
											children: /* @__PURE__ */ (void 0)(Maximize, { className: "size-4 sm:size-4" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 556,
												columnNumber: 25
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 555,
											columnNumber: 23
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 529,
									columnNumber: 21
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 522,
								columnNumber: 19
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 503,
							columnNumber: 35
						}, this)
					] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 356,
						columnNumber: 768
					}, this) : external ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-full flex-col items-center justify-center gap-3 px-6 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "font-display text-2xl",
								children: "Este episódio abre no site oficial"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 563,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "max-w-md text-sm text-muted",
								children: "O catálogo não replica streams protegidos. Use o link da fonte ou adicione uma URL de vídeo no painel admin."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 567,
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
									lineNumber: 574,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 573,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 561,
						columnNumber: 30
					}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex size-full flex-col items-center justify-center gap-3 px-6 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "font-display text-2xl",
								children: "Sem vídeo neste episódio"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 581,
								columnNumber: 15
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "max-w-md text-sm text-muted",
								children: "Adicione um trailer do YouTube ou uma URL de vídeo no Admin para reproduzir aqui."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 585,
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
									lineNumber: 591,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 590,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 579,
						columnNumber: 22
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 350,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mt-4 flex items-center gap-2",
					children: [
						prev ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							asChild: true,
							variant: "outline",
							size: "sm",
							className: "flex-1 sm:flex-none",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
								to: "/watch/$id",
								replace: true,
								params: { id: anime.id },
								search: { ep: prev.id },
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronLeft, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 616,
									columnNumber: 17
								}, this), "Anterior"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 611,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 610,
							columnNumber: 19
						}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							disabled: true,
							className: "flex-1 sm:flex-none",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronLeft, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 620,
								columnNumber: 15
							}, this), "Anterior"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 619,
							columnNumber: 25
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => setEpisodesOpen((open) => !open),
							"aria-expanded": episodesOpen,
							className: "flex-1 sm:flex-none",
							children: ["Episódios", /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronDown, { className: cn("size-4 transition-transform", episodesOpen && "rotate-180") }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 626,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 624,
							columnNumber: 11
						}, this),
						next ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							asChild: true,
							size: "sm",
							className: "flex-1 sm:flex-none",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
								to: "/watch/$id",
								replace: true,
								params: { id: anime.id },
								search: { ep: next.id },
								children: ["Próximo", /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 636,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 630,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 629,
							columnNumber: 19
						}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							size: "sm",
							disabled: true,
							className: "flex-1 sm:flex-none",
							children: ["Próximo", /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 640,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 638,
							columnNumber: 25
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 608,
					columnNumber: 9
				}, this),
				episodesOpen && episodes.length > 0 && /* @__PURE__ */ (void 0)("div", {
					className: "mt-3 overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-xl",
					children: [/* @__PURE__ */ (void 0)("div", {
						className: "flex items-center justify-between border-b border-white/10 px-4 py-3",
						children: [/* @__PURE__ */ (void 0)("span", {
							className: "font-medium",
							children: "Episódios"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 652,
							columnNumber: 15
						}, this), /* @__PURE__ */ (void 0)("span", {
							className: "text-xs text-muted",
							children: [episodes.length, " episódios"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 653,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 651,
						columnNumber: 13
					}, this), /* @__PURE__ */ (void 0)("ol", {
						className: "max-h-[45vh] overflow-y-auto p-2",
						children: episodes.map((ep) => /* @__PURE__ */ (void 0)("li", { children: /* @__PURE__ */ (void 0)(Link, {
							to: "/watch/$id",
							replace: true,
							params: { id: anime.id },
							search: { ep: ep.id },
							onClick: () => setEpisodesOpen(false),
							className: cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors", current?.id === ep.id ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/70 hover:text-fg"),
							children: [/* @__PURE__ */ (void 0)("span", {
								className: "w-8 shrink-0 tabular-nums text-xs text-subtle",
								children: ep.number
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 665,
								columnNumber: 21
							}, this), /* @__PURE__ */ (void 0)("span", {
								className: "truncate",
								children: ep.title
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 668,
								columnNumber: 21
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 660,
							columnNumber: 19
						}, this) }, ep.id, false, {
							fileName: _jsxFileName,
							lineNumber: 659,
							columnNumber: 35
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 658,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 649,
					columnNumber: 49
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CommentsSection, {
					animeId: anime.id,
					episodeId: current?.id ?? "",
					animeTitle: title,
					episodeNumber: current?.number ?? 1,
					targetCommentId: commentQuery
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 681,
					columnNumber: 9
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 334,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 306,
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
	(0, import_react.useEffect)(() => {
		if (!gifOpen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [gifOpen]);
	const [gifSearch, setGifSearch] = (0, import_react.useState)("");
	const [gifResults, setGifResults] = (0, import_react.useState)([]);
	const [gifLoading, setGifLoading] = (0, import_react.useState)(false);
	const [gifError, setGifError] = (0, import_react.useState)("");
	const [selectedGifUrl, setSelectedGifUrl] = (0, import_react.useState)(null);
	const gifSearchInputRef = (0, import_react.useRef)(null);
	const gifGalleryInputRef = (0, import_react.useRef)(null);
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
		setGifError("Configure VITE_GIPHY_API_KEY no Vercel para usar a busca de GIFs.");
		setGifResults([]);
	};
	const openGifPicker = () => {
		setGifOpen(true);
		setGifError("");
		if (gifResults.length === 0) searchGifs("");
		window.setTimeout(() => {
			gifSearchInputRef.current?.focus();
		}, 0);
	};
	const closeGifPicker = () => {
		setGifOpen(false);
		setGifError("");
	};
	const handleSelectGif = (url) => {
		setSelectedGifUrl(url);
		setCommentImage(null);
		setCommentImagePreview(null);
		if (imageInputRef.current) imageInputRef.current.value = "";
		closeGifPicker();
	};
	const handleSelectGifFromGallery = (event) => {
		const file = event.target.files?.[0];
		if (!file) return;
		if (file.type !== "image/gif" && !file.name.toLowerCase().endsWith(".gif")) {
			setError("Escolha um arquivo GIF.");
			event.target.value = "";
			return;
		}
		if (file.size > 10485760) {
			setError("O GIF pode ter no máximo 10 MB.");
			event.target.value = "";
			return;
		}
		setError("");
		setSelectedGifUrl(null);
		setCommentImage(file);
		closeGifPicker();
	};
	const handleRemoveGif = () => {
		setSelectedGifUrl(null);
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
			let imageUrl = null;
			if (commentImage) {
				setImageUploading(true);
				imageUrl = await uploadCommentImage(commentImage);
			} else if (selectedGifUrl) imageUrl = selectedGifUrl;
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
			setSelectedGifUrl(null);
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
								lineNumber: 1522,
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
								lineNumber: 1526,
								columnNumber: 15
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1520,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex items-center justify-between gap-3 sm:justify-end",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-center gap-2 text-sm text-muted",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1538,
										columnNumber: 17
									}, this), comments.length]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1536,
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
											lineNumber: 1548,
											columnNumber: 19
										}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronDown, { className: cn("size-4 text-muted transition-transform", sortOpen && "rotate-180") }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1552,
											columnNumber: 19
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1546,
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
												lineNumber: 1558,
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
												lineNumber: 1565,
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
												lineNumber: 1572,
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
												lineNumber: 1579,
												columnNumber: 21
											}, this)
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1556,
										columnNumber: 30
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1544,
									columnNumber: 15
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1534,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1518,
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
									lineNumber: 1600,
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
											lineNumber: 1615,
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
												lineNumber: 1618,
												columnNumber: 17
											}, this), "Imagem"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 1617,
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
											className: "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-bg px-3 text-xs font-medium text-muted transition-colors hover:border-white/10 hover:bg-elevated hover:text-fg disabled:cursor-not-allowed disabled:opacity-50",
											children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "text-[10px] font-bold tracking-wide",
												children: "GIF"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 1625,
												columnNumber: 17
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1622,
											columnNumber: 15
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1613,
									columnNumber: 13
								}, this),
								gifOpen && /* @__PURE__ */ (void 0)("div", {
									className: "fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5",
									onMouseDown: (event) => {
										if (event.target === event.currentTarget) closeGifPicker();
									},
									children: /* @__PURE__ */ (void 0)("div", {
										role: "dialog",
										"aria-modal": "true",
										"aria-labelledby": "gif-dialog-title",
										className: "flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#17171a] shadow-2xl",
										children: [
											/* @__PURE__ */ (void 0)("div", {
												className: "flex items-center gap-3 border-b border-white/10 p-4",
												children: [/* @__PURE__ */ (void 0)("div", {
													className: "min-w-0 flex-1",
													children: [/* @__PURE__ */ (void 0)("h3", {
														id: "gif-dialog-title",
														className: "font-display text-xl",
														children: "Escolher GIF"
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 1640,
														columnNumber: 23
													}, this), /* @__PURE__ */ (void 0)("p", {
														className: "mt-1 text-xs text-subtle",
														children: "Busque um GIF para anexar ao comentário."
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 1643,
														columnNumber: 23
													}, this)]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 1639,
													columnNumber: 21
												}, this), /* @__PURE__ */ (void 0)("button", {
													type: "button",
													onClick: closeGifPicker,
													className: "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg",
													"aria-label": "Fechar GIFs",
													children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 1649,
														columnNumber: 23
													}, this)
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 1648,
													columnNumber: 21
												}, this)]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 1638,
												columnNumber: 19
											}, this),
											/* @__PURE__ */ (void 0)("div", {
												className: "border-b border-white/10 p-4",
												children: [
													/* @__PURE__ */ (void 0)("input", {
														ref: gifGalleryInputRef,
														type: "file",
														accept: "image/gif,.gif",
														onChange: handleSelectGifFromGallery,
														className: "hidden"
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 1654,
														columnNumber: 21
													}, this),
													/* @__PURE__ */ (void 0)("button", {
														type: "button",
														onClick: () => gifGalleryInputRef.current?.click(),
														disabled: sending || imageUploading,
														className: "mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-bg px-4 text-sm font-medium text-muted transition-colors hover:border-white/20 hover:bg-elevated hover:text-fg disabled:cursor-not-allowed disabled:opacity-50",
														children: [/* @__PURE__ */ (void 0)(Image, { className: "size-4" }, void 0, false, {
															fileName: _jsxFileName,
															lineNumber: 1657,
															columnNumber: 22
														}, this), "Escolher GIF da galeria"]
													}, void 0, true, {
														fileName: _jsxFileName,
														lineNumber: 1656,
														columnNumber: 20
													}, this),
													/* @__PURE__ */ (void 0)("form", {
														onSubmit: (event) => {
															event.preventDefault();
															searchGifs();
														},
														className: "flex gap-2",
														children: [/* @__PURE__ */ (void 0)("div", {
															className: "relative min-w-0 flex-1",
															children: [/* @__PURE__ */ (void 0)(Search, { className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" }, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 1666,
																columnNumber: 25
															}, this), /* @__PURE__ */ (void 0)("input", {
																ref: gifSearchInputRef,
																value: gifSearch,
																onChange: (event) => setGifSearch(event.target.value),
																placeholder: "Buscar GIF...",
																className: "min-h-11 w-full rounded-lg border border-white/5 bg-bg pl-10 pr-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/15"
															}, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 1667,
																columnNumber: 25
															}, this)]
														}, void 0, true, {
															fileName: _jsxFileName,
															lineNumber: 1665,
															columnNumber: 23
														}, this), /* @__PURE__ */ (void 0)(Button, {
															type: "submit",
															size: "sm",
															disabled: gifLoading,
															className: "min-h-11 shrink-0",
															children: gifLoading ? "Buscando..." : "Buscar"
														}, void 0, false, {
															fileName: _jsxFileName,
															lineNumber: 1670,
															columnNumber: 23
														}, this)]
													}, void 0, true, {
														fileName: _jsxFileName,
														lineNumber: 1661,
														columnNumber: 20
													}, this)
												]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 1653,
												columnNumber: 19
											}, this),
											/* @__PURE__ */ (void 0)("div", {
												className: "min-h-0 flex-1 overflow-y-auto p-4",
												children: [
													gifError && /* @__PURE__ */ (void 0)("div", {
														className: "rounded-lg border border-white/5 bg-surface p-4 text-sm text-red-400",
														children: gifError
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 1677,
														columnNumber: 34
													}, this),
													!gifError && gifLoading && gifResults.length === 0 && /* @__PURE__ */ (void 0)("div", {
														className: "py-10 text-center text-sm text-muted",
														children: "Buscando GIFs..."
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 1681,
														columnNumber: 76
													}, this),
													!gifError && !gifLoading && gifResults.length === 0 && /* @__PURE__ */ (void 0)("div", {
														className: "py-10 text-center text-sm text-muted",
														children: "Nenhum GIF encontrado."
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 1685,
														columnNumber: 77
													}, this),
													gifResults.length > 0 && /* @__PURE__ */ (void 0)("div", {
														className: "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4",
														children: gifResults.map((gif) => /* @__PURE__ */ (void 0)("button", {
															type: "button",
															onClick: () => handleSelectGif(gif.url),
															className: "group aspect-square overflow-hidden rounded-lg border border-white/5 bg-bg transition-colors hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20",
															title: gif.title || "GIF",
															children: /* @__PURE__ */ (void 0)("img", {
																src: gif.preview,
																alt: gif.title || "GIF",
																loading: "lazy",
																className: "size-full object-cover transition-transform duration-200 group-hover:scale-105"
															}, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 1691,
																columnNumber: 29
															}, this)
														}, gif.id, false, {
															fileName: _jsxFileName,
															lineNumber: 1690,
															columnNumber: 48
														}, this))
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 1689,
														columnNumber: 47
													}, this),
													/* @__PURE__ */ (void 0)("p", {
														className: "mt-3 text-center text-[10px] text-subtle",
														children: "Powered by GIPHY"
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 1695,
														columnNumber: 21
													}, this)
												]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 1676,
												columnNumber: 19
											}, this)
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1637,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1632,
									columnNumber: 25
								}, this),
								commentImagePreview && /* @__PURE__ */ (void 0)("div", {
									className: "relative mt-3 w-fit max-w-full overflow-hidden rounded-xl border border-white/10 bg-bg",
									children: [/* @__PURE__ */ (void 0)("img", {
										src: commentImagePreview,
										alt: "Prévia da imagem do comentário",
										className: "max-h-64 max-w-full object-contain"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1708,
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
											lineNumber: 1711,
											columnNumber: 19
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1710,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1706,
									columnNumber: 37
								}, this),
								selectedGifUrl && /* @__PURE__ */ (void 0)("div", {
									className: "relative mt-3 w-fit max-w-full overflow-hidden rounded-xl border border-white/10 bg-bg",
									children: [/* @__PURE__ */ (void 0)("img", {
										src: selectedGifUrl,
										alt: "GIF selecionado",
										className: "max-h-64 max-w-full object-contain"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1717,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("button", {
										type: "button",
										onClick: handleRemoveGif,
										disabled: sending || imageUploading,
										"aria-label": "Remover GIF",
										title: "Remover GIF",
										className: "absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm transition-colors hover:bg-black disabled:opacity-50",
										children: /* @__PURE__ */ (void 0)(X, { className: "size-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1720,
											columnNumber: 19
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1719,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1716,
									columnNumber: 32
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
										lineNumber: 1726,
										columnNumber: 15
									}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Marcar como spoiler" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1730,
										columnNumber: 15
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1724,
									columnNumber: 13
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "text-xs text-subtle",
										children: "Enter para enviar · Shift + Enter para quebrar linha"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1738,
										columnNumber: 15
									}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
										type: "button",
										size: "sm",
										onClick: () => void handleComment(),
										disabled: !text.trim() && !commentImage && !selectedGifUrl || sending || imageUploading,
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Send, { className: "size-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 1743,
											columnNumber: 17
										}, this), imageUploading ? "Enviando imagem..." : sending ? "Enviando..." : "Comentar"]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 1742,
										columnNumber: 15
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1736,
									columnNumber: 13
								}, this),
								error && /* @__PURE__ */ (void 0)("p", {
									className: "mt-3 text-sm text-red-400",
									children: error
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1750,
									columnNumber: 23
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1598,
							columnNumber: 11
						}, this),
						moderationSuccess && /* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-lg border border-white/5 bg-surface px-4 py-3 text-sm text-muted",
							children: moderationSuccess
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1760,
							columnNumber: 33
						}, this),
						sortBy === "spoiler" && /* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-lg border border-white/5 bg-surface px-4 py-3 text-sm text-muted",
							children: "Mostrando apenas comentários marcados como spoiler."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1768,
							columnNumber: 36
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mt-5 space-y-3",
							children: loading ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "rounded-xl border border-white/5 bg-surface p-5 text-sm text-muted",
								children: "Carregando comentários..."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1778,
								columnNumber: 24
							}, this) : displayedRootComments.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "rounded-xl border border-white/5 bg-surface p-5 text-center text-sm text-muted",
								children: sortBy === "spoiler" ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
									"Não há comentários com spoiler neste episódio.",
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("br", {}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1784,
										columnNumber: 23
									}, this),
									"Tente outro filtro."
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1782,
									columnNumber: 41
								}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
									"Ainda não há comentários neste episódio.",
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("br", {}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1788,
										columnNumber: 23
									}, this),
									"Seja o primeiro a comentar."
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1786,
									columnNumber: 27
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1780,
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
										lineNumber: 1797,
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
												lineNumber: 1817,
												columnNumber: 26
											}, this);
										})
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1813,
										columnNumber: 46
									}, this)]
								}, comment.id, true, {
									fileName: _jsxFileName,
									lineNumber: 1795,
									columnNumber: 20
								}, this);
							})
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1776,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1512,
					columnNumber: 9
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1510,
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
										lineNumber: 1847,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1845,
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
										lineNumber: 1853,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Altere o texto do seu comentário."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1857,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1851,
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
										lineNumber: 1870,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1863,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1843,
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
							lineNumber: 1875,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-2 flex justify-end",
							children: /* @__PURE__ */ (void 0)("span", {
								className: "text-xs text-subtle",
								children: [editText.length, "/2000"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1879,
								columnNumber: 15
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1877,
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
								lineNumber: 1887,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("span", { children: "Marcar como spoiler" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1889,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1885,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1895,
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
								lineNumber: 1901,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => void handleEdit(),
								disabled: !editText.trim() || editSaving,
								children: [/* @__PURE__ */ (void 0)(PenLine, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1912,
									columnNumber: 17
								}, this), editSaving ? "Salvando..." : "Salvar alterações"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1911,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1899,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1841,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1839,
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
										lineNumber: 1935,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1933,
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
										lineNumber: 1941,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Essa ação não pode ser desfeita."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 1945,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 1939,
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
										lineNumber: 1956,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1951,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1931,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-5 rounded-lg border border-white/5 bg-surface p-3",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "line-clamp-5 whitespace-pre-wrap text-sm text-muted",
								children: deletingComment.content
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1963,
								columnNumber: 15
							}, this), deletingComment.imageUrl && /* @__PURE__ */ (void 0)("img", {
								src: deletingComment.imageUrl,
								alt: "",
								className: "mt-3 max-h-40 rounded-lg object-contain"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 1967,
								columnNumber: 44
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1961,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 1971,
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
								lineNumber: 1977,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => void handleDelete(),
								disabled: deleteSending,
								children: [/* @__PURE__ */ (void 0)(Trash2, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 1986,
									columnNumber: 17
								}, this), deleteSending ? "Excluindo..." : "Excluir comentário"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 1985,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 1975,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1929,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1927,
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
										lineNumber: 2009,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2007,
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
										lineNumber: 2015,
										columnNumber: 17
									}, this), /* @__PURE__ */ (void 0)("p", {
										className: "mt-1 text-sm text-muted",
										children: "Por que você está denunciando este comentário?"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 2019,
										columnNumber: 17
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 2013,
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
										lineNumber: 2031,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2025,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 2005,
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
									lineNumber: 2058,
									columnNumber: 21
								}, this), /* @__PURE__ */ (void 0)("span", { children: item.label }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2060,
									columnNumber: 21
								}, this)]
							}, item.value, true, {
								fileName: _jsxFileName,
								lineNumber: 2056,
								columnNumber: 26
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 2036,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 2068,
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
								lineNumber: 2074,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => {
									if (reportingComment && reportReason) handleModeration(reportingComment.id, "report", reportReason);
								},
								disabled: !reportReason || reportSending || Boolean(moderatingId),
								children: [/* @__PURE__ */ (void 0)(Flag, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2088,
									columnNumber: 17
								}, this), reportSending ? "Enviando..." : "Enviar denúncia"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 2083,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 2072,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("p", {
							className: "mt-4 text-xs leading-5 text-subtle",
							children: "As denúncias ajudam a equipe de moderação a manter a comunidade do Hikari segura."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 2095,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 2003,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 2001,
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
									lineNumber: 2115,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 2113,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (void 0)("h3", {
									id: "spam-dialog-title",
									className: "font-display text-xl",
									children: "Marcar como spam?"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2121,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("p", {
									className: "mt-1 text-sm text-muted",
									children: "Este comentário será sinalizado para análise da moderação."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2125,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 2119,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 2111,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (void 0)("div", {
							className: "mt-4 rounded-lg border border-white/5 bg-surface p-3",
							children: [/* @__PURE__ */ (void 0)("p", {
								className: "line-clamp-4 whitespace-pre-wrap text-sm text-muted",
								children: spamComment.content
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 2135,
								columnNumber: 15
							}, this), spamComment.imageUrl && /* @__PURE__ */ (void 0)("img", {
								src: spamComment.imageUrl,
								alt: "",
								className: "mt-3 max-h-40 rounded-lg object-contain"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 2139,
								columnNumber: 40
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 2133,
							columnNumber: 13
						}, this),
						error && /* @__PURE__ */ (void 0)("p", {
							className: "mt-3 text-sm text-red-400",
							children: error
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 2143,
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
								lineNumber: 2149,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)(Button, {
								type: "button",
								onClick: () => {
									handleModeration(spamComment.id, "spam");
								},
								disabled: Boolean(moderatingId),
								children: [/* @__PURE__ */ (void 0)(Ban, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2160,
									columnNumber: 17
								}, this), moderatingId === spamComment.id ? "Enviando..." : "Marcar como spam"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 2157,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 2147,
							columnNumber: 13
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 2109,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 2107,
				columnNumber: 23
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 1508,
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
					lineNumber: 2244,
					columnNumber: 32
				}, this) : (comment.userName || "U").charAt(0).toUpperCase()
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 2242,
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
									lineNumber: 2262,
									columnNumber: 15
								}, this),
								isReply && replyToName && /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (void 0)("span", {
									className: "text-sm text-subtle",
									children: "→"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2267,
									columnNumber: 21
								}, this), /* @__PURE__ */ (void 0)("span", {
									className: "text-sm font-semibold text-muted",
									children: replyToName
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2271,
									columnNumber: 21
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 2266,
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
									lineNumber: 2276,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 2260,
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
									lineNumber: 2291,
									columnNumber: 17
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 2289,
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
										lineNumber: 2300,
										columnNumber: 25
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Editar comentário" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 2302,
										columnNumber: 25
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 2298,
									columnNumber: 23
								}, this), /* @__PURE__ */ (void 0)("button", {
									type: "button",
									role: "menuitem",
									onClick: onDelete,
									disabled: moderating,
									className: "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50",
									children: [/* @__PURE__ */ (void 0)(Trash2, { className: "size-4 shrink-0" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 2310,
										columnNumber: 25
									}, this), /* @__PURE__ */ (void 0)("span", { children: "Excluir comentário" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 2312,
										columnNumber: 25
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 2308,
									columnNumber: 23
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 2297,
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
											lineNumber: 2320,
											columnNumber: 25
										}, this), /* @__PURE__ */ (void 0)("span", { children: moderating ? "Enviando..." : "Marcar como spoiler" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 2322,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 2318,
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
											lineNumber: 2330,
											columnNumber: 25
										}, this), /* @__PURE__ */ (void 0)("span", { children: "Denunciar comentário" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 2332,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 2328,
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
											lineNumber: 2340,
											columnNumber: 25
										}, this), /* @__PURE__ */ (void 0)("span", { children: "Marcar como spam" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 2342,
											columnNumber: 25
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 2338,
										columnNumber: 23
									}, this)
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 2317,
									columnNumber: 27
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 2295,
								columnNumber: 28
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 2287,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 2258,
						columnNumber: 11
					}, this),
					comment.isSpoiler ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("details", {
						className: "mt-2 rounded-lg border border-white/5 bg-bg/50 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("summary", {
							className: "cursor-pointer text-sm font-medium text-fg",
							children: "⚠️ Mostrar spoiler"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 2361,
							columnNumber: 15
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-2 whitespace-pre-wrap text-sm leading-6 text-muted",
							children: comment.content
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 2365,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 2359,
						columnNumber: 32
					}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-2 whitespace-pre-wrap text-sm leading-6 text-muted",
						children: comment.content
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 2369,
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
								lineNumber: 2380,
								columnNumber: 17
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 2379,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 2377,
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
									lineNumber: 2393,
									columnNumber: 15
								}, this), comment.likes]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 2391,
								columnNumber: 13
							}, this),
							!isReply && /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: onStartReply,
								className: "flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-fg",
								children: [/* @__PURE__ */ (void 0)(MessageCircle, { className: "size-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2401,
									columnNumber: 17
								}, this), "Responder"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 2399,
								columnNumber: 26
							}, this),
							!isReply && replyCount > 0 && /* @__PURE__ */ (void 0)("span", {
								className: "flex items-center gap-1.5 text-xs text-subtle",
								children: [
									/* @__PURE__ */ (void 0)(MessageCircle, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 2409,
										columnNumber: 19
									}, this),
									replyCount,
									" ",
									replyCount === 1 ? "Resposta" : "Respostas"
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 2407,
								columnNumber: 44
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 2389,
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
								lineNumber: 2424,
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
									lineNumber: 2430,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("span", { children: "Marcar como spoiler" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 2434,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 2428,
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
									lineNumber: 2442,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)(Button, {
									type: "button",
									size: "sm",
									onClick: onSendReply,
									disabled: !replyText.trim() || replySending,
									children: [/* @__PURE__ */ (void 0)(Send, { className: "size-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 2447,
										columnNumber: 19
									}, this), replySending ? "Enviando..." : "Responder"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 2446,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 2440,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 2422,
						columnNumber: 26
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 2252,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 2236,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 2234,
		columnNumber: 10
	}, this);
}
//#endregion
export { WatchPage as component };
