//#region node_modules/.nitro/vite/services/ssr/assets/labels-BsexCKFj.js
var GENRE_PT = {
	Action: "Ação",
	Adventure: "Aventura",
	Comedy: "Comédia",
	Drama: "Drama",
	Ecchi: "Ecchi",
	Fantasy: "Fantasia",
	Horror: "Terror",
	MahouShoujo: "Mahou Shoujo",
	"Mahou Shoujo": "Mahou Shoujo",
	Mecha: "Mecha",
	Music: "Música",
	Mystery: "Mistério",
	Psychological: "Psicológico",
	Romance: "Romance",
	"Sci-Fi": "Ficção científica",
	"Slice of Life": "Slice of Life",
	Sports: "Esportes",
	Supernatural: "Sobrenatural",
	Thriller: "Suspense",
	Hentai: "Hentai"
};
var FORMAT_PT = {
	TV: "Série",
	TV_SHORT: "TV Short",
	MOVIE: "Filme",
	SPECIAL: "Especial",
	OVA: "OVA",
	ONA: "ONA",
	MUSIC: "Música",
	MANGA: "Mangá",
	NOVEL: "Light novel",
	ONE_SHOT: "One-shot"
};
var STATUS_PT = {
	FINISHED: "Encerrado",
	RELEASING: "Em exibição",
	NOT_YET_RELEASED: "Em breve",
	CANCELLED: "Cancelado",
	HIATUS: "Hiato"
};
var SEASON_PT = {
	WINTER: "Inverno",
	SPRING: "Primavera",
	SUMMER: "Verão",
	FALL: "Outono"
};
var SORT_OPTIONS = [
	{
		value: "TRENDING_DESC",
		label: "Em alta"
	},
	{
		value: "POPULARITY_DESC",
		label: "Popularidade"
	},
	{
		value: "SCORE_DESC",
		label: "Nota"
	},
	{
		value: "START_DATE_DESC",
		label: "Mais recentes"
	},
	{
		value: "TITLE_ROMAJI",
		label: "Título A–Z"
	}
];
function genreLabel(genre) {
	return GENRE_PT[genre] ?? genre;
}
function formatLabel(format) {
	if (!format) return "";
	return FORMAT_PT[format] ?? format;
}
function statusLabel(status) {
	if (!status) return "";
	return STATUS_PT[status] ?? status;
}
function seasonLabel(season, year) {
	if (!season) return year ? String(year) : "";
	const s = SEASON_PT[season] ?? season;
	return year ? `${s} ${year}` : s;
}
function scoreLabel(score) {
	if (score == null || Number.isNaN(score)) return "—";
	return (score / 10).toFixed(1);
}
//#endregion
export { STATUS_PT as a, scoreLabel as c, SORT_OPTIONS as i, seasonLabel as l, GENRE_PT as n, formatLabel as o, SEASON_PT as r, genreLabel as s, FORMAT_PT as t, statusLabel as u };
