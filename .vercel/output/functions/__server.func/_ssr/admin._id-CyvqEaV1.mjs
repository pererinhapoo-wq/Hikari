import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useHikariStore, t as animeToLocal } from "./types-CX6YV1cu.mjs";
import { a as youtubeIdFrom, t as cn } from "./utils-Cws_m9jY.mjs";
import { a as STATUS_PT, r as SEASON_PT, t as FORMAT_PT } from "./labels-BsexCKFj.mjs";
import { k as Plus, p as Trash2 } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as Route$30 } from "./router-Dx2-dd95.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
import { t as Input } from "./input-DWrO9Aym.mjs";
import { t as Label } from "./label-BgLaS0nV.mjs";
import { t as NativeSelect } from "./native-select-DtoSTrFt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin._id-CyvqEaV1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
async function uploadVideoToB2(onDone) {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = "video/mp4,video/webm,video/quicktime";
	return new Promise((resolve, reject) => {
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) {
				reject(/* @__PURE__ */ new Error("Nenhum vídeo selecionado."));
				return;
			}
			if (![
				"video/mp4",
				"video/webm",
				"video/quicktime"
			].includes(file.type)) {
				reject(/* @__PURE__ */ new Error("Formato de vídeo não permitido."));
				return;
			}
			if (file.size > 943718400) {
				reject(/* @__PURE__ */ new Error("O vídeo não pode ter mais de 900 MB."));
				return;
			}
			try {
				const prepareResponse = await fetch("/api/upload-video", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						filename: file.name,
						contentType: file.type,
						size: file.size
					})
				});
				if (!prepareResponse.ok) throw new Error(`Falha ao preparar o upload (${prepareResponse.status})`);
				const prepareData = await prepareResponse.json();
				const uploadResponse = await fetch(prepareData.uploadUrl, {
					method: "PUT",
					headers: { "Content-Type": file.type },
					body: file
				});
				if (!uploadResponse.ok) throw new Error(`Falha no upload para o Backblaze B2 (${uploadResponse.status})`);
				onDone(prepareData.videoUrl);
				resolve();
			} catch (error) {
				reject(error instanceof Error ? error : /* @__PURE__ */ new Error("Falha no upload."));
			}
		};
		input.onerror = () => {
			reject(/* @__PURE__ */ new Error("Não foi possível abrir o seletor de vídeo."));
		};
		input.click();
	});
}
var _jsxFileName$1 = "/app/applet/src/components/ui/textarea.tsx";
var Textarea = (0, import_react.forwardRef)(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("textarea", {
	ref,
	className: cn("min-h-28 w-full rounded-lg bg-elevated px-3 py-2.5 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle", "transition-[box-shadow] duration-150 focus:outline-none focus:shadow-[var(--shadow-border-hover)]", className),
	...props
}, void 0, false, {
	fileName: _jsxFileName$1,
	lineNumber: 8,
	columnNumber: 3
}, void 0));
Textarea.displayName = "Textarea";
var _jsxFileName = "/app/applet/src/routes/admin.$id.tsx?tsr-split=component";
function emptyLocal() {
	const now = Date.now();
	return {
		id: `local-${crypto.randomUUID()}`,
		titleRomaji: "",
		titleEnglish: "",
		titleNative: "",
		cover: "",
		banner: "",
		synopsis: "",
		score: null,
		genres: [],
		format: "TV",
		status: "FINISHED",
		episodesCount: null,
		season: null,
		year: (/* @__PURE__ */ new Date()).getFullYear(),
		trailerId: null,
		hidden: false,
		seasons: [{
			id: `s-${crypto.randomUUID()}`,
			number: 1,
			title: "Temporada 1",
			episodes: []
		}],
		createdAt: now,
		updatedAt: now
	};
}
function AdminEditor() {
	const { id } = Route$30.useParams();
	const { importId } = Route$30.useSearch();
	const { remote } = Route$30.useLoaderData();
	const navigate = useNavigate();
	const stored = useHikariStore((s) => s.animes);
	const hydrated = useHikariStore((s) => s.hydrated);
	const upsertAnime = useHikariStore((s) => s.upsertAnime);
	const removeAnime = useHikariStore((s) => s.removeAnime);
	const [form, setForm] = (0, import_react.useState)(null);
	const [genreText, setGenreText] = (0, import_react.useState)("");
	const [uploadingEpisode, setUploadingEpisode] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		const locals = useHikariStore.getState().animes;
		const next = (locals.find((a) => a.id === id) || (remote?.anilistId ? locals.find((a) => a.anilistId === remote.anilistId) : void 0)) ?? (remote ? animeToLocal(remote) : emptyLocal());
		setForm(next);
		setGenreText(next.genres.join(", "));
	}, [
		hydrated,
		id,
		remote
	]);
	if (!form) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-64 animate-pulse rounded-xl bg-elevated" }, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 72,
		columnNumber: 12
	}, this);
	const current = form;
	function set(key, value) {
		setForm((f) => f ? {
			...f,
			[key]: value
		} : f);
	}
	function save() {
		const genres = genreText.split(",").map((g) => g.trim()).filter(Boolean);
		const next = {
			...current,
			genres,
			trailerId: youtubeIdFrom(current.trailerId) ?? (current.trailerId || null),
			updatedAt: Date.now()
		};
		if (!next.titleRomaji && !next.titleEnglish && !next.titleNative) {
			toast.error("Dê um título ao anime.");
			return;
		}
		upsertAnime(next);
		toast.success("Salvo neste dispositivo.");
		navigate({
			to: "/admin/$id",
			params: { id: next.id }
		});
	}
	function addSeason() {
		const n = current.seasons.length + 1;
		setForm((f) => f ? {
			...f,
			seasons: [...f.seasons, {
				id: `s-${crypto.randomUUID()}`,
				number: n,
				title: `Temporada ${n}`,
				episodes: []
			}]
		} : f);
	}
	function patchSeason(sid, patch) {
		setForm((f) => f ? {
			...f,
			seasons: f.seasons.map((s) => s.id === sid ? {
				...s,
				...patch
			} : s)
		} : f);
	}
	function removeSeason(sid) {
		setForm((f) => f ? {
			...f,
			seasons: f.seasons.filter((s) => s.id !== sid)
		} : f);
	}
	function addEpisode(sid) {
		setForm((f) => f ? {
			...f,
			seasons: f.seasons.map((s) => {
				if (s.id !== sid) return s;
				const number = (s.episodes.at(-1)?.number ?? 0) + 1;
				const ep = {
					id: `e-${crypto.randomUUID()}`,
					number,
					title: `Episódio ${number}`
				};
				return {
					...s,
					episodes: [...s.episodes, ep]
				};
			})
		} : f);
	}
	function patchEpisode(sid, eid, patch) {
		setForm((f) => f ? {
			...f,
			seasons: f.seasons.map((s) => s.id === sid ? {
				...s,
				episodes: s.episodes.map((e) => e.id === eid ? {
					...e,
					...patch
				} : e)
			} : s)
		} : f);
	}
	function removeEpisode(sid, eid) {
		setForm((f) => f ? {
			...f,
			seasons: f.seasons.map((s) => s.id === sid ? {
				...s,
				episodes: s.episodes.filter((e) => e.id !== eid)
			} : s)
		} : f);
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-8 pt-6 pb-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("header", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/admin",
					className: "text-xs text-muted hover:text-fg",
					children: "← Painel"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 171,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
					className: "mt-1 font-display text-3xl tracking-tight",
					children: id === "new" && !importId ? "Novo anime" : "Editar anime"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 175,
					columnNumber: 11
				}, this)] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 170,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex gap-2",
					children: [id !== "new" && stored.some((a) => a.id === current.id) && /* @__PURE__ */ (void 0)(Button, {
						type: "button",
						variant: "ghost",
						onClick: () => {
							removeAnime(current.id);
							toast.success("Excluído.");
							navigate({ to: "/admin" });
						},
						children: "Excluir"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 181,
						columnNumber: 69
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
						type: "button",
						onClick: save,
						children: "Salvar"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 191,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 180,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 169,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "grid gap-6 lg:grid-cols-[12rem_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "space-y-3",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "overflow-hidden rounded-lg bg-elevated shadow-[var(--shadow-border)]",
						children: form.cover ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
							src: form.cover,
							alt: "",
							className: "aspect-2/3 w-full object-cover"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 200,
							columnNumber: 27
						}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex aspect-2/3 items-center justify-center text-xs text-subtle",
							children: "Sem capa"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 200,
							columnNumber: 104
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 199,
						columnNumber: 11
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 198,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "grid gap-4 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Título (romaji)",
							className: "sm:col-span-2",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
								value: form.titleRomaji,
								onChange: (e) => set("titleRomaji", e.target.value)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 208,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 207,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Título em inglês",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
								value: form.titleEnglish,
								onChange: (e) => set("titleEnglish", e.target.value)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 212,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 211,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Título original",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
								value: form.titleNative,
								onChange: (e) => set("titleNative", e.target.value)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 216,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 215,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "URL da capa",
							className: "sm:col-span-2",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
								value: form.cover,
								onChange: (e) => set("cover", e.target.value)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 220,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 219,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "URL do banner",
							className: "sm:col-span-2",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
								value: form.banner,
								onChange: (e) => set("banner", e.target.value)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 224,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 223,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Sinopse",
							className: "sm:col-span-2",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Textarea, {
								value: form.synopsis,
								onChange: (e) => set("synopsis", e.target.value)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 228,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 227,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Gêneros (vírgula)",
							className: "sm:col-span-2",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
								value: genreText,
								onChange: (e) => setGenreText(e.target.value)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 232,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 231,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Nota (0–100)",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
								type: "number",
								min: 0,
								max: 100,
								value: form.score ?? "",
								onChange: (e) => set("score", e.target.value === "" ? null : Number(e.target.value))
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 236,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 235,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Ano",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
								type: "number",
								value: form.year ?? "",
								onChange: (e) => set("year", e.target.value === "" ? null : Number(e.target.value))
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 240,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 239,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Formato",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(NativeSelect, {
								value: form.format,
								onChange: (e) => set("format", e.target.value),
								children: Object.entries(FORMAT_PT).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
									value: k,
									children: v
								}, k, false, {
									fileName: _jsxFileName,
									lineNumber: 245,
									columnNumber: 58
								}, this))
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 244,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 243,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Status",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(NativeSelect, {
								value: form.status,
								onChange: (e) => set("status", e.target.value),
								children: Object.entries(STATUS_PT).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
									value: k,
									children: v
								}, k, false, {
									fileName: _jsxFileName,
									lineNumber: 253,
									columnNumber: 58
								}, this))
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 252,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 251,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Temporada",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(NativeSelect, {
								value: form.season ?? "",
								onChange: (e) => set("season", e.target.value || null),
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
									value: "",
									children: "—"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 261,
									columnNumber: 15
								}, this), Object.entries(SEASON_PT).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("option", {
									value: k,
									children: v
								}, k, false, {
									fileName: _jsxFileName,
									lineNumber: 263,
									columnNumber: 58
								}, this))]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 260,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 259,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
							label: "Trailer (YouTube URL ou ID)",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
								value: form.trailerId ?? "",
								onChange: (e) => set("trailerId", e.target.value || null)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 270,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 269,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("label", {
							className: "flex h-11 items-center gap-2 text-sm text-muted sm:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("input", {
								type: "checkbox",
								checked: form.hidden,
								onChange: (e) => set("hidden", e.target.checked),
								className: "size-4 accent-primary"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 274,
								columnNumber: 13
							}, this), "Ocultar do catálogo público"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 273,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 206,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 197,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
						className: "font-display text-2xl",
						children: "Temporadas e episódios"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 283,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
						type: "button",
						variant: "outline",
						size: "sm",
						onClick: addSeason,
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Plus, { className: "size-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 288,
							columnNumber: 13
						}, this), "Temporada"]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 287,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 282,
					columnNumber: 9
				}, this), form.seasons.map((season) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex flex-col gap-3 sm:flex-row",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
									label: "Nome",
									className: "flex-1",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
										value: season.title,
										onChange: (e) => patchSeason(season.id, { title: e.target.value })
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 296,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 295,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
									label: "Nº",
									className: "w-24",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
										type: "number",
										value: season.number,
										onChange: (e) => patchSeason(season.id, { number: Number(e.target.value) })
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 302,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 301,
									columnNumber: 15
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
									type: "button",
									variant: "ghost",
									size: "icon",
									className: "self-end",
									"aria-label": "Remover temporada",
									onClick: () => removeSeason(season.id),
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Trash2, { className: "size-4 text-danger" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 308,
										columnNumber: 17
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 307,
									columnNumber: 15
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 294,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("ul", {
							className: "mt-4 space-y-3",
							children: season.episodes.map((ep) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", {
								className: "rounded-lg bg-elevated p-3",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "grid gap-2 sm:grid-cols-12",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
											label: "#",
											className: "sm:col-span-1",
											children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
												type: "number",
												value: ep.number,
												onChange: (e) => patchEpisode(season.id, ep.id, { number: Number(e.target.value) })
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 316,
												columnNumber: 23
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 315,
											columnNumber: 21
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
											label: "Título",
											className: "sm:col-span-5",
											children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
												value: ep.title,
												onChange: (e) => patchEpisode(season.id, ep.id, { title: e.target.value })
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 322,
												columnNumber: 23
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 321,
											columnNumber: 21
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
											label: "Duração",
											className: "sm:col-span-2",
											children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
												value: ep.duration ?? "",
												onChange: (e) => patchEpisode(season.id, ep.id, { duration: e.target.value }),
												placeholder: "24 min"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 328,
												columnNumber: 23
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 327,
											columnNumber: 21
										}, this),
										[
											{
												key: "videoUrl",
												label: "Player 1"
											},
											{
												key: "videoUrl2",
												label: "Player 2"
											},
											{
												key: "videoUrl3",
												label: "Player 3"
											}
										].map(({ key, label }) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
											label: `${label} — URL do vídeo`,
											className: "sm:col-span-4",
											children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
												className: "flex gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
													value: ep[key] ?? "",
													onChange: (e) => patchEpisode(season.id, ep.id, { [key]: e.target.value }),
													placeholder: "URL do vídeo"
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 347,
													columnNumber: 27
												}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
													type: "button",
													variant: "outline",
													className: "shrink-0",
													disabled: uploadingEpisode === `${ep.id}-${key}`,
													onClick: async () => {
														const uploadId = `${ep.id}-${key}`;
														setUploadingEpisode(uploadId);
														try {
															await uploadVideoToB2((url) => {
																patchEpisode(season.id, ep.id, { [key]: url });
																toast.success(`${label} enviado com sucesso.`);
															});
														} catch (error) {
															toast.error(error instanceof Error ? error.message : "Falha no upload.");
														} finally {
															setUploadingEpisode(null);
														}
													},
													children: uploadingEpisode === `${ep.id}-${key}` ? "Abrindo…" : "Enviar"
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 351,
													columnNumber: 27
												}, this)]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 346,
												columnNumber: 25
											}, this)
										}, key, false, {
											fileName: _jsxFileName,
											lineNumber: 345,
											columnNumber: 21
										}, this)),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Field, {
											label: "Thumb",
											className: "sm:col-span-11",
											children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Input, {
												value: ep.thumbnail ?? "",
												onChange: (e) => patchEpisode(season.id, ep.id, { thumbnail: e.target.value })
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 373,
												columnNumber: 23
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 372,
											columnNumber: 21
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
											type: "button",
											variant: "ghost",
											size: "icon",
											className: "sm:col-span-1 sm:self-end",
											"aria-label": "Remover episódio",
											onClick: () => removeEpisode(season.id, ep.id),
											children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Trash2, { className: "size-4 text-danger" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 379,
												columnNumber: 23
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 378,
											columnNumber: 21
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 314,
									columnNumber: 19
								}, this)
							}, ep.id, false, {
								fileName: _jsxFileName,
								lineNumber: 313,
								columnNumber: 42
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 312,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							className: "mt-3",
							onClick: () => addEpisode(season.id),
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Plus, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 386,
								columnNumber: 15
							}, this), "Episódio"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 385,
							columnNumber: 13
						}, this)
					]
				}, season.id, true, {
					fileName: _jsxFileName,
					lineNumber: 293,
					columnNumber: 37
				}, this))]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 281,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 168,
		columnNumber: 10
	}, this);
}
function Field({ label, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("label", {
		className,
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Label, {
			className: "mb-1.5 block",
			children: label
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 403,
			columnNumber: 7
		}, this), children]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 402,
		columnNumber: 10
	}, this);
}
//#endregion
export { AdminEditor as component };
