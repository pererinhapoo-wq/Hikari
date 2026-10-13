import { Y as notFound, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { A as Play, Ct as ArrowLeft, F as Newspaper, gt as CalendarDays, ot as Clapperboard, u as Tv } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { c as NEWS, s as Route$17 } from "./router-Dx2-dd95.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news_._id-oDhse4E8.js
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/routes/news_.$id.tsx?tsr-split=component";
function automaticToNewsItem(item, anime) {
	let content = "";
	if (item.type === "NOVO EPISÓDIO") content = `Este episódio faz parte da programação atual de ${anime?.name ?? "este anime"}. Acompanhe a página do anime para encontrar os episódios disponíveis no Hikari.`;
	else if (item.type === "TRAILER") content = `O trailer foi identificado automaticamente a partir dos dados disponíveis para ${anime?.name ?? "este anime"}. Novas informações poderão aparecer conforme os dados forem atualizados.`;
	else content = `${anime?.name ?? item.title} faz parte da programação atual de animes. Novas informações poderão aparecer conforme os dados da temporada forem atualizados.`;
	return {
		id: item.id,
		type: item.type,
		title: item.title,
		description: item.description,
		content,
		date: item.date,
		time: "time" in item && typeof item.time === "string" ? item.time : void 0,
		image: item.image,
		animeId: item.animeId,
		trailerUrl: item.trailerUrl,
		isAdult: item.isAdult === true,
		source: "source" in item && typeof item.source === "string" ? item.source : void 0,
		articleImages: "articleImages" in item && Array.isArray(item.articleImages) ? item.articleImages : [],
		mentionedHentai: "mentionedHentai" in item && Array.isArray(item.mentionedHentai) ? item.mentionedHentai : [],
		anime: anime ?? void 0
	};
}
function formatRelativeNewsTime(dateValue, timeValue) {
	if (!dateValue) return "";
	const normalized = dateValue.trim();
	let date = null;
	const numericMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (numericMatch) {
		const [, day, month, year] = numericMatch;
		date = new Date(Number(year), Number(month) - 1, Number(day));
	} else {
		const parsed = Date.parse(normalized);
		if (!Number.isNaN(parsed)) date = new Date(parsed);
	}
	if (!date) return "";
	if (timeValue) {
		const timeMatch = timeValue.trim().match(/^(\d{1,2}):(\d{2})$/);
		if (timeMatch) date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
	}
	const diffMs = Math.max(0, (/* @__PURE__ */ new Date()).getTime() - date.getTime());
	const minutes = Math.floor(diffMs / 6e4);
	if (minutes < 1) return "Há menos de 1 minuto";
	if (minutes < 60) return `Há ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `Há ${hours} ${hours === 1 ? "hora" : "horas"}`;
	const days = Math.floor(hours / 24);
	return `Há ${days} ${days === 1 ? "dia" : "dias"}`;
}
function NewsDetailsPage() {
	const { id } = Route$17.useParams();
	const { page } = Route$17.useSearch();
	const { automaticNews, automaticAnime, isAdultNews } = Route$17.useLoaderData();
	const automaticItem = automaticNews.find((item) => item.id === id);
	const automaticNewsItem = automaticItem ? automaticToNewsItem(automaticItem, automaticAnime) : null;
	const staticNews = NEWS.find((item) => item.id === id);
	const news = automaticNewsItem ?? staticNews;
	if (!news) throw notFound();
	const filteredNews = [...NEWS, ...automaticNews.map((item) => {
		if (item.id === automaticItem?.id) return automaticToNewsItem(item, automaticAnime);
		return automaticToNewsItem(item, void 0);
	})].filter((item) => isAdultNews ? item.isAdult === true : item.isAdult !== true);
	const currentNewsIndex = filteredNews.findIndex((item) => item.id === news.id);
	const relatedNews = [];
	if (filteredNews.length > 1) {
		const startIndex = currentNewsIndex >= 0 ? currentNewsIndex + 1 : 0;
		for (let offset = 0; offset < filteredNews.length && relatedNews.length < 3; offset++) {
			const item = filteredNews[(startIndex + offset) % filteredNews.length];
			if (item.id !== news.id) relatedNews.push(item);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "space-y-6 pb-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
				to: isAdultNews ? "/adult/news" : "/news",
				search: { page },
				className: "\n          relative\n          top-2\n          inline-flex\n          w-fit\n          items-center\n          gap-2\n          rounded-lg\n          px-2.5\n          py-2\n          text-sm\n          font-medium\n          text-muted\n          transition-all\n          duration-200\n          hover:bg-elevated\n          hover:text-fg\n          active:scale-[0.97]\n        ",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ArrowLeft, { className: "size-4 shrink-0" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 176,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Voltar para notícias" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 178,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 155,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("article", {
				className: "\n          overflow-hidden\n          rounded-2xl\n          bg-elevated\n          shadow-[var(--shadow-border)]\n        ",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "\n            relative\n            aspect-video\n            w-full\n            overflow-hidden\n            bg-black\n          ",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
							src: news.image,
							alt: "",
							className: "\n              size-full\n              object-contain\n            "
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 198,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "\n              pointer-events-none\n              absolute\n              inset-0\n              bg-linear-to-t\n              from-black/70\n              via-black/20\n              to-transparent\n            " }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 203,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "\n              absolute\n              bottom-0\n              left-0\n              right-0\n              p-5\n              sm:p-8\n            ",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "\n                inline-flex\n                rounded-md\n                bg-accent/15\n                px-2\n                py-1\n                text-[10px]\n                font-semibold\n                tracking-[0.12em]\n                text-accent\n                uppercase\n              ",
								children: news.type
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 221,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
								className: "\n                mt-3\n                max-w-4xl\n                font-display\n                text-2xl\n                leading-tight\n                tracking-tight\n                text-white\n                sm:text-4xl\n              ",
								children: news.title
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 236,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 213,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 191,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "p-5 sm:p-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "\n              flex\n              items-center\n              gap-2\n              text-xs\n              text-subtle\n            ",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CalendarDays, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 260,
								columnNumber: 13
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [
								news.date,
								" · ",
								formatRelativeNewsTime(news.date, news.time)
							] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 262,
								columnNumber: 13
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 253,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mt-6",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "\n                text-sm\n                leading-7\n                text-muted\n                sm:text-base\n              ",
								children: news.description
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 268,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 267,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mt-6 space-y-4",
							children: news.content.split("\n\n").map((paragraph, index) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "\n                      text-sm\n                      leading-7\n                      text-muted\n                      sm:text-base\n                    ",
								children: paragraph
							}, index, false, {
								fileName: _jsxFileName,
								lineNumber: 280,
								columnNumber: 67
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 279,
							columnNumber: 11
						}, this),
						news.mentionedHentai && news.mentionedHentai.length > 0 && /* @__PURE__ */ (void 0)("section", {
							className: "\n                  mt-8\n                  space-y-4\n                ",
							children: [/* @__PURE__ */ (void 0)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (void 0)(Clapperboard, { className: "size-5 text-accent" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 296,
									columnNumber: 19
								}, this), /* @__PURE__ */ (void 0)("h2", {
									className: "\n                      font-display\n                      text-lg\n                      tracking-tight\n                      text-fg\n                    ",
									children: "Hentai citados na notícia"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 298,
									columnNumber: 19
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 295,
								columnNumber: 17
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "\n                    grid\n                    grid-cols-1\n                    gap-4\n                    sm:grid-cols-2\n                  ",
								children: news.mentionedHentai.map((hentai) => /* @__PURE__ */ (void 0)("div", {
									className: "\n                          overflow-hidden\n                          rounded-2xl\n                          bg-black\n                          shadow-[var(--shadow-border)]\n                        ",
									children: [/* @__PURE__ */ (void 0)("img", {
										src: hentai.image,
										alt: hentai.title,
										loading: "lazy",
										className: "\n                            aspect-video\n                            h-auto\n                            w-full\n                            object-contain\n                          "
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 320,
										columnNumber: 25
									}, this), /* @__PURE__ */ (void 0)("div", {
										className: "\n                            px-4\n                            py-3\n                            text-sm\n                            font-medium\n                            leading-6\n                            text-fg\n                          ",
										children: hentai.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 327,
										columnNumber: 25
									}, this)]
								}, `${hentai.title}-${hentai.image}`, true, {
									fileName: _jsxFileName,
									lineNumber: 314,
									columnNumber: 55
								}, this))
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 308,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 291,
							columnNumber: 71
						}, this),
						news.articleImages && news.articleImages.length > 0 && /* @__PURE__ */ (void 0)("section", {
							className: "\n                  mt-8\n                  space-y-4\n                ",
							children: [
								/* @__PURE__ */ (void 0)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (void 0)(Newspaper, { className: "size-5 text-accent" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 347,
										columnNumber: 19
									}, this), /* @__PURE__ */ (void 0)("h2", {
										className: "\n                      font-display\n                      text-lg\n                      tracking-tight\n                      text-fg\n                    ",
										children: "Imagens da notícia"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 349,
										columnNumber: 19
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 346,
									columnNumber: 17
								}, this),
								/* @__PURE__ */ (void 0)("div", {
									className: "\n                    grid\n                    grid-cols-1\n                    gap-4\n                    sm:grid-cols-2\n                  ",
									children: news.articleImages.map((image, index) => /* @__PURE__ */ (void 0)("div", {
										className: "\n                          overflow-hidden\n                          rounded-2xl\n                          bg-black\n                          shadow-[var(--shadow-border)]\n                        ",
										children: /* @__PURE__ */ (void 0)("img", {
											src: image,
											alt: `${news.title} — imagem ${index + 1}`,
											loading: "lazy",
											className: "\n                            h-auto\n                            max-h-[520px]\n                            w-full\n                            object-contain\n                          "
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 371,
											columnNumber: 25
										}, this)
									}, `${image}-${index}`, false, {
										fileName: _jsxFileName,
										lineNumber: 365,
										columnNumber: 61
									}, this))
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 359,
									columnNumber: 17
								}, this),
								news.source && /* @__PURE__ */ (void 0)("p", {
									className: "\n                      text-xs\n                      text-muted\n                    ",
									children: ["Fonte: ", news.source]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 380,
									columnNumber: 33
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 342,
							columnNumber: 67
						}, this),
						news.type === "TRAILER" && news.trailerUrl && /* @__PURE__ */ (void 0)("section", {
							id: "trailer",
							className: "\n                  mt-8\n                  scroll-mt-6\n                  space-y-4\n                ",
							children: [
								/* @__PURE__ */ (void 0)("div", {
									className: "\n                    flex\n                    flex-col\n                    gap-3\n                    sm:flex-row\n                    sm:items-center\n                    sm:justify-between\n                  ",
									children: [/* @__PURE__ */ (void 0)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (void 0)(Play, { className: "size-5 fill-current text-accent" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 403,
											columnNumber: 21
										}, this), /* @__PURE__ */ (void 0)("h2", {
											className: "\n                        font-display\n                        text-lg\n                        tracking-tight\n                        text-fg\n                      ",
											children: "Trailer"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 405,
											columnNumber: 21
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 402,
										columnNumber: 19
									}, this), /* @__PURE__ */ (void 0)("a", {
										href: "#trailer-player",
										className: "\n                      inline-flex\n                      w-fit\n                      items-center\n                      gap-2\n                      rounded-lg\n                      bg-accent\n                      px-4\n                      py-2\n                      text-sm\n                      font-semibold\n                      text-white\n                      transition-all\n                      hover:opacity-90\n                      active:scale-[0.97]\n                    ",
										children: [/* @__PURE__ */ (void 0)(Play, { className: "size-4 fill-current" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 431,
											columnNumber: 21
										}, this), /* @__PURE__ */ (void 0)("span", { children: "Assistir trailer" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 433,
											columnNumber: 21
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 415,
										columnNumber: 19
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 394,
									columnNumber: 17
								}, this),
								/* @__PURE__ */ (void 0)("div", {
									id: "trailer-player",
									className: "\n                    overflow-hidden\n                    rounded-xl\n                    bg-black\n                    shadow-[var(--shadow-border)]\n                  ",
									children: /* @__PURE__ */ (void 0)("div", {
										className: "\n                      relative\n                      aspect-video\n                      w-full\n                    ",
										children: /* @__PURE__ */ (void 0)("iframe", {
											src: news.trailerUrl,
											title: `Trailer - ${news.title}`,
											className: "\n                        absolute\n                        inset-0\n                        size-full\n                      ",
											loading: "lazy",
											allow: "\n                        accelerometer;\n                        autoplay;\n                        clipboard-write;\n                        encrypted-media;\n                        gyroscope;\n                        picture-in-picture;\n                        web-share\n                      ",
											allowFullScreen: true
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 450,
											columnNumber: 21
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 445,
										columnNumber: 19
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 439,
									columnNumber: 17
								}, this),
								/* @__PURE__ */ (void 0)("p", {
									className: "\n                    text-xs\n                    leading-5\n                    text-subtle\n                  ",
									children: "Trailer disponível através do link fornecido pelos dados da notícia."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 466,
									columnNumber: 17
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 389,
							columnNumber: 58
						}, this),
						news.anime && /* @__PURE__ */ (void 0)("section", {
							className: "\n                mt-8\n                overflow-hidden\n                rounded-2xl\n                bg-surface\n                shadow-[var(--shadow-border)]\n              ",
							children: [/* @__PURE__ */ (void 0)("div", {
								className: "\n                  flex\n                  items-center\n                  gap-2\n                  border-b\n                  border-border\n                  p-4\n                  sm:p-5\n                ",
								children: [/* @__PURE__ */ (void 0)(Tv, { className: "size-5 text-accent" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 495,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("h2", {
									className: "\n                    font-display\n                    text-lg\n                    tracking-tight\n                    text-fg\n                  ",
									children: "Anime relacionado"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 497,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 486,
								columnNumber: 15
							}, this), /* @__PURE__ */ (void 0)("div", {
								className: "\n                  grid\n                  gap-5\n                  p-4\n                  sm:p-5\n                  md:grid-cols-[180px_1fr]\n                ",
								children: [/* @__PURE__ */ (void 0)("div", {
									className: "\n                    mx-auto\n                    w-full\n                    max-w-[180px]\n                    overflow-hidden\n                    rounded-xl\n                    bg-elevated\n                  ",
									children: /* @__PURE__ */ (void 0)("img", {
										src: news.anime.image,
										alt: news.anime.name,
										className: "\n                      aspect-[2/3]\n                      w-full\n                      object-cover\n                    "
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 522,
										columnNumber: 19
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 514,
									columnNumber: 17
								}, this), /* @__PURE__ */ (void 0)("div", {
									className: "min-w-0",
									children: [
										/* @__PURE__ */ (void 0)("div", {
											className: "\n                      flex\n                      flex-col\n                      gap-3\n                      sm:flex-row\n                      sm:items-start\n                      sm:justify-between\n                    ",
											children: [/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("h3", {
												className: "\n                          font-display\n                          text-xl\n                          tracking-tight\n                          text-fg\n                        ",
												children: news.anime.name
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 539,
												columnNumber: 23
											}, this), /* @__PURE__ */ (void 0)("p", {
												className: "mt-1 text-sm text-subtle",
												children: "Anime relacionado à notícia"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 548,
												columnNumber: 23
											}, this)] }, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 538,
												columnNumber: 21
											}, this), /* @__PURE__ */ (void 0)(Link, {
												to: "/anime/$id",
												params: { id: news.anime.id },
												className: "\n                        inline-flex\n                        w-fit\n                        shrink-0\n                        items-center\n                        gap-2\n                        rounded-lg\n                        bg-accent\n                        px-4\n                        py-2\n                        text-sm\n                        font-semibold\n                        text-white\n                        transition-all\n                        hover:opacity-90\n                        active:scale-[0.97]\n                      ",
												children: [/* @__PURE__ */ (void 0)(Play, { className: "size-4 fill-current" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 573,
													columnNumber: 23
												}, this), /* @__PURE__ */ (void 0)("span", { children: "Assistir anime" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 575,
													columnNumber: 23
												}, this)]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 554,
												columnNumber: 21
											}, this)]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 530,
											columnNumber: 19
										}, this),
										/* @__PURE__ */ (void 0)("div", {
											className: "\n                      mt-5\n                      grid\n                      grid-cols-1\n                      gap-3\n                      sm:grid-cols-3\n                    ",
											children: [
												/* @__PURE__ */ (void 0)("div", {
													className: "\n                        rounded-lg\n                        bg-elevated\n                        p-3\n                      ",
													children: [/* @__PURE__ */ (void 0)("div", {
														className: "\n                          flex\n                          items-center\n                          gap-2\n                          text-xs\n                          text-subtle\n                        ",
														children: [/* @__PURE__ */ (void 0)(Clapperboard, { className: "size-4" }, void 0, false, {
															fileName: _jsxFileName,
															lineNumber: 600,
															columnNumber: 25
														}, this), /* @__PURE__ */ (void 0)("span", { children: "Temporada" }, void 0, false, {
															fileName: _jsxFileName,
															lineNumber: 602,
															columnNumber: 25
														}, this)]
													}, void 0, true, {
														fileName: _jsxFileName,
														lineNumber: 593,
														columnNumber: 23
													}, this), /* @__PURE__ */ (void 0)("p", {
														className: "\n                          mt-1\n                          text-sm\n                          font-medium\n                          text-fg\n                        ",
														children: news.anime.season
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 607,
														columnNumber: 23
													}, this)]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 588,
													columnNumber: 21
												}, this),
												/* @__PURE__ */ (void 0)("div", {
													className: "\n                        rounded-lg\n                        bg-elevated\n                        p-3\n                      ",
													children: [/* @__PURE__ */ (void 0)("div", {
														className: "\n                          flex\n                          items-center\n                          gap-2\n                          text-xs\n                          text-subtle\n                        ",
														children: [/* @__PURE__ */ (void 0)(CalendarDays, { className: "size-4" }, void 0, false, {
															fileName: _jsxFileName,
															lineNumber: 629,
															columnNumber: 25
														}, this), /* @__PURE__ */ (void 0)("span", { children: "Lançamento" }, void 0, false, {
															fileName: _jsxFileName,
															lineNumber: 631,
															columnNumber: 25
														}, this)]
													}, void 0, true, {
														fileName: _jsxFileName,
														lineNumber: 622,
														columnNumber: 23
													}, this), /* @__PURE__ */ (void 0)("p", {
														className: "\n                          mt-1\n                          text-sm\n                          font-medium\n                          text-fg\n                        ",
														children: news.anime.releaseDate
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 636,
														columnNumber: 23
													}, this)]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 617,
													columnNumber: 21
												}, this),
												/* @__PURE__ */ (void 0)("div", {
													className: "\n                        rounded-lg\n                        bg-elevated\n                        p-3\n                      ",
													children: [/* @__PURE__ */ (void 0)("div", {
														className: "\n                          flex\n                          items-center\n                          gap-2\n                          text-xs\n                          text-subtle\n                        ",
														children: [/* @__PURE__ */ (void 0)(Tv, { className: "size-4" }, void 0, false, {
															fileName: _jsxFileName,
															lineNumber: 658,
															columnNumber: 25
														}, this), /* @__PURE__ */ (void 0)("span", { children: "Episódios" }, void 0, false, {
															fileName: _jsxFileName,
															lineNumber: 660,
															columnNumber: 25
														}, this)]
													}, void 0, true, {
														fileName: _jsxFileName,
														lineNumber: 651,
														columnNumber: 23
													}, this), /* @__PURE__ */ (void 0)("p", {
														className: "\n                          mt-1\n                          text-sm\n                          font-medium\n                          text-fg\n                        ",
														children: news.anime.episodes ?? "Não informado"
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 665,
														columnNumber: 23
													}, this)]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 646,
													columnNumber: 21
												}, this)
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 581,
											columnNumber: 19
										}, this),
										/* @__PURE__ */ (void 0)("div", {
											className: "mt-5",
											children: [/* @__PURE__ */ (void 0)("h4", {
												className: "\n                        text-sm\n                        font-semibold\n                        text-fg\n                      ",
												children: "Sinopse"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 677,
												columnNumber: 21
											}, this), /* @__PURE__ */ (void 0)("p", {
												className: "\n                        mt-2\n                        text-sm\n                        leading-7\n                        text-muted\n                      ",
												children: news.anime.synopsis
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 685,
												columnNumber: 21
											}, this)]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 676,
											columnNumber: 19
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 529,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 507,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 479,
							columnNumber: 26
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 252,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 184,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Newspaper, { className: "size-5 text-accent" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 703,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
						className: "\n              font-display\n              text-xl\n              tracking-tight\n              text-fg\n              sm:text-2xl\n            ",
						children: "Mais notícias"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 705,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 702,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "\n            grid\n            gap-4\n            md:grid-cols-3\n          ",
					children: relatedNews.map((item) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/news/$id",
						params: { id: item.id },
						search: { page },
						className: "\n                  group\n                  overflow-hidden\n                  rounded-xl\n                  bg-elevated\n                  shadow-[var(--shadow-border)]\n                  transition-all\n                  duration-200\n                  hover:-translate-y-0.5\n                  hover:bg-elevated/80\n                ",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "\n                    relative\n                    aspect-video\n                    w-full\n                    overflow-hidden\n                    bg-black\n                  ",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
									src: item.image,
									alt: "",
									className: "\n                      size-full\n                      object-contain\n                      transition-transform\n                      duration-300\n                      group-hover:scale-105\n                    "
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 743,
									columnNumber: 19
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "\n                      pointer-events-none\n                      absolute\n                      inset-0\n                      bg-linear-to-t\n                      from-black/70\n                      via-black/10\n                      to-transparent\n                    " }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 751,
									columnNumber: 19
								}, this),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "\n                      absolute\n                      bottom-3\n                      left-3\n                      rounded-md\n                      bg-black/60\n                      px-2\n                      py-1\n                      text-[9px]\n                      font-semibold\n                      tracking-[0.1em]\n                      text-white\n                      uppercase\n                      backdrop-blur-sm\n                    ",
									children: item.type
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 761,
									columnNumber: 19
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 736,
							columnNumber: 17
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "p-4",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
								className: "\n                      line-clamp-2\n                      text-sm\n                      font-semibold\n                      leading-6\n                      text-fg\n                      transition-colors\n                      group-hover:text-accent\n                    ",
								children: item.title
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 781,
								columnNumber: 19
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "\n                      mt-3\n                      flex\n                      items-center\n                      gap-2\n                      text-[11px]\n                      text-subtle\n                    ",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CalendarDays, { className: "size-3.5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 801,
									columnNumber: 21
								}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: item.date }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 803,
									columnNumber: 21
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 793,
								columnNumber: 19
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 780,
							columnNumber: 17
						}, this)]
					}, item.id, true, {
						fileName: _jsxFileName,
						lineNumber: 721,
						columnNumber: 36
					}, this))
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 716,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 701,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 153,
		columnNumber: 10
	}, this);
}
//#endregion
export { NewsDetailsPage as component };
