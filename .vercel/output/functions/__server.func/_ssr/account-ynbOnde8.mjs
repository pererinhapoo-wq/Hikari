import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { b as Navigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as signOut } from "./client-cOaGlUWb.mjs";
import { a as useHikariStore } from "./types-CX6YV1cu.mjs";
import { B as MessageCircle, G as Lock, O as Save, Q as Heart, St as BadgeCheck, W as LogOut, _ as Sparkles, ht as Camera, i as Users, j as Pencil, nt as Ellipsis, o as UserPlus, q as Link$1, s as UserCheck, t as X, vt as Bookmark, w as Settings, x as ShieldCheck } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
import { A as getMyComments, B as useServerFn, I as updateProfile, L as useCurrentUserState, M as getProfileFollowers, N as getProfileFollowing, R as isHikariAdmin, j as getProfile } from "./router-BPjBsLK8.mjs";
import { t as Button } from "./button-Dn0-AY8s.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/account-ynbOnde8.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName$1 = "/app/applet/src/lib/auth/gates.tsx";
/**
* Auth state components — plain wrappers around `useCurrentUserState()`.
*
* With auth on, visitors are signed out until they authenticate — in the sandbox
* live preview too, which does real sign-in. The shared dev user appears only
* when auth is disabled (`VITE_AUTH_ENABLED=false`, the shipped default).
* While the session is still resolving, gates that care about signed-out state
* render nothing so there's no signed-out flash on hard reload.
*/
/** Where `RedirectToSignIn` sends signed-out visitors. Create this route. */
var SIGN_IN_PATH = "/login";
/**
* Client-side redirect to the sign-in route (TanStack `<Navigate>` — NOT a full
* `window.location` reload). A hard navigation re-bootstraps the SPA and re-runs
* session loading, which feels like a second "Loading…" on /login.
*
* Guard routes by waiting out `isPending` first (see `use-current-user`), then
* render this.
*/
function RedirectToSignIn({ to = SIGN_IN_PATH }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Navigate, { to }, void 0, false, {
		fileName: _jsxFileName$1,
		lineNumber: 49,
		columnNumber: 10
	}, this);
}
var _jsxFileName = "/app/applet/src/routes/account.tsx?tsr-split=component";
function Account() {
	const { user, isPending } = useCurrentUserState();
	const myList = useHikariStore((s) => s.myList);
	const getProfileFn = useServerFn(getProfile);
	const updateProfileFn = useServerFn(updateProfile);
	const getFollowersFn = useServerFn(getProfileFollowers);
	const getFollowingFn = useServerFn(getProfileFollowing);
	const [nick, setNick] = (0, import_react.useState)("");
	const [bio, setBio] = (0, import_react.useState)("");
	const [favorites, setFavorites] = (0, import_react.useState)("");
	const [commentCount, setCommentCount] = (0, import_react.useState)(0);
	const [followersCount, setFollowersCount] = (0, import_react.useState)(0);
	const [followingCount, setFollowingCount] = (0, import_react.useState)(0);
	const [editing, setEditing] = (0, import_react.useState)(false);
	const [activeTab, setActiveTab] = (0, import_react.useState)("comments");
	const [peopleTab, setPeopleTab] = (0, import_react.useState)(null);
	const [followers, setFollowers] = (0, import_react.useState)([]);
	const [following, setFollowing] = (0, import_react.useState)([]);
	const [peopleLoading, setPeopleLoading] = (0, import_react.useState)(false);
	const [peopleError, setPeopleError] = (0, import_react.useState)("");
	const [loadingProfile, setLoadingProfile] = (0, import_react.useState)(true);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [saved, setSaved] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!user?.id) return;
		let active = true;
		setLoadingProfile(true);
		getProfileFn().then((profile) => {
			if (!active) return;
			setNick(profile.nick);
			setBio(profile.bio);
			setFavorites(profile.favorites.join(", "));
			setCommentCount(profile.commentCount);
			setFollowersCount(profile.followersCount);
			setFollowingCount(profile.followingCount);
			setError("");
		}).catch(() => {
			if (!active) return;
			setNick("");
			setBio("");
			setFavorites("");
			setCommentCount(0);
			setFollowersCount(0);
			setFollowingCount(0);
			setError("Não foi possível carregar seu perfil.");
		}).finally(() => {
			if (active) setLoadingProfile(false);
		});
		return () => {
			active = false;
		};
	}, [user?.id]);
	if (isPending) return null;
	if (!user) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(RedirectToSignIn, { to: "/login" }, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 78,
		columnNumber: 12
	}, this);
	const admin = isHikariAdmin(user.primaryEmail);
	const email = user.primaryEmail ?? "";
	const avatarLetter = (nick || user.displayName || "Usuário").charAt(0).toUpperCase();
	const favoriteList = favorites.split(",").map((item) => item.trim()).filter(Boolean);
	async function saveProfile() {
		setSaving(true);
		setSaved(false);
		setError("");
		try {
			const profile = await updateProfileFn({ data: {
				nick,
				bio,
				favorites: favoriteList
			} });
			setNick(profile.nick);
			setBio(profile.bio);
			setFavorites(profile.favorites.join(", "));
			setCommentCount(profile.commentCount);
			setFollowersCount(profile.followersCount);
			setFollowingCount(profile.followingCount);
			setSaved(true);
			setEditing(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Não foi possível salvar o perfil.");
		} finally {
			setSaving(false);
		}
	}
	async function shareProfile() {
		setMenuOpen(false);
		try {
			if (navigator.share) await navigator.share({
				title: nick ? `${nick} — HIKARI` : "Perfil HIKARI",
				text: nick ? `Confira o perfil de @${nick} no HIKARI.` : "Confira este perfil no HIKARI.",
				url: `${window.location.origin}/profile/${encodeURIComponent(nick)}`
			});
			else if (navigator.clipboard) await navigator.clipboard.writeText(`${window.location.origin}/profile/${encodeURIComponent(nick)}`);
		} catch {}
	}
	async function openPeople(tab) {
		setPeopleTab(tab);
		setPeopleLoading(true);
		setPeopleError("");
		try {
			if (tab === "followers") {
				const result = await getFollowersFn();
				setFollowers(result);
			} else {
				const result = await getFollowingFn();
				setFollowing(result);
			}
		} catch {
			setPeopleError("Não foi possível carregar essa lista.");
		} finally {
			setPeopleLoading(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("main", {
		className: "min-h-screen bg-[#030817] text-white",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mx-auto w-full max-w-[1500px] px-3 pb-24 pt-4 sm:px-5 lg:px-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
						className: "min-w-0 overflow-hidden rounded-2xl border border-[#1c3c70] bg-[#061329] shadow-[0_0_40px_rgba(38,70,180,0.12)]",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "relative h-[250px] overflow-hidden sm:h-[300px] lg:h-[340px]",
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "absolute inset-0",
										style: { background: "radial-gradient(circle at 50% 115%, rgba(88,54,255,0.95) 0%, rgba(39,48,145,0.75) 34%, rgba(6,19,41,0.25) 70%), linear-gradient(135deg, #152f72 0%, #4025a3 45%, #741bc7 100%)" }
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 156,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute -left-20 top-10 size-[280px] rounded-full bg-blue-500/20 blur-3xl" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 160,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute right-0 top-0 size-[330px] rounded-full bg-purple-500/25 blur-3xl" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 162,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute -right-20 -top-40 size-[520px] rounded-full border border-white/10" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 164,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute -right-10 -top-32 size-[430px] rounded-full border border-white/5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 166,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute left-20 -bottom-48 size-[480px] rounded-full border border-white/5" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 168,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(1,8,22,0.12)_60%,rgba(1,8,22,0.78)_100%)]" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 170,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "absolute bottom-[-70px] left-1/2 h-[280px] w-[300px] -translate-x-1/2 opacity-50",
										children: [
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute left-1/2 top-0 h-[210px] w-[145px] -translate-x-1/2 rounded-t-[80px] bg-[#050918] shadow-[0_0_60px_rgba(0,0,0,0.7)]" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 174,
												columnNumber: 17
											}, this),
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute left-1/2 top-[75px] h-[170px] w-[230px] -translate-x-1/2 rounded-t-[110px] bg-[#071126]" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 176,
												columnNumber: 17
											}, this),
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute left-1/2 top-[45px] h-[130px] w-[70px] -translate-x-1/2 rounded-full bg-[#111b35]" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 178,
												columnNumber: 17
											}, this)
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 172,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "absolute right-5 top-6 text-right sm:right-8 sm:top-8",
										children: [
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
												className: "text-xl font-medium tracking-[0.45em] text-white/90 sm:text-2xl",
												children: "好きなことで"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 184,
												columnNumber: 17
											}, this),
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
												className: "text-xl font-medium tracking-[0.45em] text-white/90 sm:text-2xl",
												children: "生きていく"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 188,
												columnNumber: 17
											}, this),
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
												className: "mt-1 text-xs text-white/60",
												children: "Viver do que ama"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 192,
												columnNumber: 17
											}, this)
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 182,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "absolute bottom-5 left-5 hidden items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 backdrop-blur-md sm:flex",
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "size-4 text-violet-300" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 200,
											columnNumber: 17
										}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "text-xs font-medium tracking-[0.18em] text-white/80",
											children: "PERFIL HIKARI"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 202,
											columnNumber: 17
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 198,
										columnNumber: 15
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 154,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "relative px-5 pb-5 sm:px-8 lg:px-10",
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "-mt-16 sm:-mt-20",
										children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
											className: "relative inline-block",
											children: [user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
												src: user.profileImageUrl,
												alt: "",
												className: "size-32 rounded-full border-[5px] border-[#061329] bg-[#09172f] object-cover shadow-[0_8px_35px_rgba(0,0,0,0.55)] sm:size-40"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 217,
												columnNumber: 43
											}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
												className: "grid size-32 place-items-center rounded-full border-[5px] border-[#061329] bg-[#15284b] font-display text-5xl shadow-[0_8px_35px_rgba(0,0,0,0.55)] sm:size-40",
												children: avatarLetter
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 217,
												columnNumber: 224
											}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
												type: "button",
												className: "absolute bottom-1 right-1 grid size-10 place-items-center rounded-full border-2 border-[#061329] bg-[#101f3c] text-white shadow-lg",
												"aria-label": "Alterar foto",
												children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Camera, { className: "size-4" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 222,
													columnNumber: 21
												}, this)
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 221,
												columnNumber: 19
											}, this)]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 215,
											columnNumber: 17
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 213,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
											className: "min-w-0",
											children: loadingProfile ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-9 w-48 animate-pulse rounded-lg bg-[#102343]" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 234,
													columnNumber: 23
												}, this),
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-5 w-32 animate-pulse rounded bg-[#102343]" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 236,
													columnNumber: 23
												}, this),
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-4 h-4 w-64 animate-pulse rounded bg-[#102343]" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 238,
													columnNumber: 23
												}, this)
											] }, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 233,
												columnNumber: 37
											}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
													className: "flex flex-wrap items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
														className: "text-3xl font-semibold tracking-tight sm:text-4xl",
														children: nick || "Defina seu Nick"
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 242,
														columnNumber: 25
													}, this), nick && /* @__PURE__ */ (void 0)(BadgeCheck, { className: "size-6 fill-violet-500 text-white" }, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 246,
														columnNumber: 34
													}, this)]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 240,
													columnNumber: 23
												}, this),
												nick && /* @__PURE__ */ (void 0)("p", {
													className: "mt-1 text-base text-[#9fb2d4] sm:text-lg",
													children: ["@", nick]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 250,
													columnNumber: 32
												}, this),
												bio && /* @__PURE__ */ (void 0)("p", {
													className: "mt-4 max-w-2xl text-sm leading-6 text-[#c4d1e8]",
													children: bio
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 254,
													columnNumber: 31
												}, this)
											] }, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 239,
												columnNumber: 27
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 231,
											columnNumber: 17
										}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
											className: "relative flex shrink-0 items-center gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
													type: "button",
													variant: "outline",
													onClick: () => {
														setSaved(false);
														setError("");
														setEditing(true);
														setMenuOpen(false);
													},
													className: "border-[#294674] bg-[#0a1932] text-white hover:bg-[#102343]",
													children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Pencil, { className: "size-4" }, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 271,
														columnNumber: 21
													}, this), "Editar perfil"]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 265,
													columnNumber: 19
												}, this),
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
													type: "button",
													onClick: () => setMenuOpen((value) => !value),
													className: "grid size-10 place-items-center rounded-xl border border-[#294674] bg-[#0a1932] text-[#b6c8e5] transition hover:bg-[#102343]",
													"aria-label": "Mais opções",
													"aria-expanded": menuOpen,
													children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Ellipsis, { className: "size-5" }, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 276,
														columnNumber: 21
													}, this)
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 275,
													columnNumber: 19
												}, this),
												menuOpen && /* @__PURE__ */ (void 0)("div", {
													className: "absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-2xl border border-[#294674] bg-[#07152b] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)]",
													children: [
														/* @__PURE__ */ (void 0)("button", {
															type: "button",
															onClick: () => {
																setSaved(false);
																setError("");
																setEditing(true);
																setMenuOpen(false);
															},
															className: "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white transition hover:bg-[#102343]",
															children: [/* @__PURE__ */ (void 0)(Pencil, { className: "size-4 text-[#9fb2ff]" }, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 287,
																columnNumber: 25
															}, this), /* @__PURE__ */ (void 0)("span", { children: "Editar perfil" }, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 289,
																columnNumber: 25
															}, this)]
														}, void 0, true, {
															fileName: _jsxFileName,
															lineNumber: 281,
															columnNumber: 23
														}, this),
														/* @__PURE__ */ (void 0)("button", {
															type: "button",
															onClick: () => void shareProfile(),
															className: "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white transition hover:bg-[#102343]",
															children: [/* @__PURE__ */ (void 0)(Link$1, { className: "size-4 text-[#9fb2ff]" }, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 295,
																columnNumber: 25
															}, this), /* @__PURE__ */ (void 0)("span", { children: "Compartilhar perfil" }, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 297,
																columnNumber: 25
															}, this)]
														}, void 0, true, {
															fileName: _jsxFileName,
															lineNumber: 294,
															columnNumber: 23
														}, this),
														/* @__PURE__ */ (void 0)("button", {
															type: "button",
															onClick: () => {
																setMenuOpen(false);
																setActiveTab("about");
															},
															className: "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white transition hover:bg-[#102343]",
															children: [/* @__PURE__ */ (void 0)(Settings, { className: "size-4 text-[#9fb2ff]" }, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 306,
																columnNumber: 25
															}, this), /* @__PURE__ */ (void 0)("span", { children: "Configurações" }, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 308,
																columnNumber: 25
															}, this)]
														}, void 0, true, {
															fileName: _jsxFileName,
															lineNumber: 302,
															columnNumber: 23
														}, this),
														/* @__PURE__ */ (void 0)("div", { className: "my-1.5 border-t border-[#1c3c70]" }, void 0, false, {
															fileName: _jsxFileName,
															lineNumber: 313,
															columnNumber: 23
														}, this),
														/* @__PURE__ */ (void 0)("button", {
															type: "button",
															onClick: () => {
																setMenuOpen(false);
																signOut("/");
															},
															className: "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-200 transition hover:bg-red-500/10",
															children: [/* @__PURE__ */ (void 0)(LogOut, { className: "size-4" }, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 319,
																columnNumber: 25
															}, this), /* @__PURE__ */ (void 0)("span", { children: "Sair da conta" }, void 0, false, {
																fileName: _jsxFileName,
																lineNumber: 321,
																columnNumber: 25
															}, this)]
														}, void 0, true, {
															fileName: _jsxFileName,
															lineNumber: 315,
															columnNumber: 23
														}, this)
													]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 279,
													columnNumber: 32
												}, this)
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 263,
											columnNumber: 17
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 229,
										columnNumber: 15
									}, this),
									error && /* @__PURE__ */ (void 0)("div", {
										className: "mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200",
										children: error
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 332,
										columnNumber: 25
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#7186aa]",
										children: [email && /* @__PURE__ */ (void 0)("span", { children: email }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 339,
											columnNumber: 27
										}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "size-3.5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 344,
												columnNumber: 19
											}, this), "Membro da comunidade HIKARI"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 343,
											columnNumber: 17
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 337,
										columnNumber: 15
									}, this),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-[#1b3762] bg-[#07152b] sm:grid-cols-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Stat, {
												icon: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, {}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 354,
													columnNumber: 29
												}, this),
												value: String(commentCount),
												label: "Comentários"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 354,
												columnNumber: 17
											}, this),
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Stat, {
												icon: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Heart, {}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 356,
													columnNumber: 29
												}, this),
												value: "0",
												label: "Curtidas"
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 356,
												columnNumber: 17
											}, this),
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
												type: "button",
												onClick: () => void openPeople("followers"),
												className: "group",
												children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Stat, {
													icon: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Users, {}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 359,
														columnNumber: 31
													}, this),
													value: String(followersCount),
													label: "Seguidores"
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 359,
													columnNumber: 19
												}, this)
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 358,
												columnNumber: 17
											}, this),
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
												type: "button",
												onClick: () => void openPeople("following"),
												className: "group",
												children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Stat, {
													icon: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(UserPlus, {}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 363,
														columnNumber: 31
													}, this),
													value: String(followingCount),
													label: "Seguindo"
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 363,
													columnNumber: 19
												}, this)
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 362,
												columnNumber: 17
											}, this)
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 352,
										columnNumber: 15
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 211,
								columnNumber: 13
							}, this),
							peopleTab && /* @__PURE__ */ (void 0)("section", {
								className: "border-t border-[#1b3762] bg-[#041024] p-5 sm:p-7 lg:p-8",
								children: [
									/* @__PURE__ */ (void 0)("div", {
										className: "flex items-center justify-between gap-4",
										children: [/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("h2", {
											className: "text-xl font-semibold",
											children: peopleTab === "followers" ? "Seguidores" : "Seguindo"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 377,
											columnNumber: 21
										}, this), /* @__PURE__ */ (void 0)("p", {
											className: "mt-1 text-sm text-[#8197ba]",
											children: peopleTab === "followers" ? "Pessoas que seguem você." : "Pessoas que você segue."
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 381,
											columnNumber: 21
										}, this)] }, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 375,
											columnNumber: 19
										}, this), /* @__PURE__ */ (void 0)("button", {
											type: "button",
											onClick: () => setPeopleTab(null),
											className: "grid size-9 place-items-center rounded-lg text-[#8fa5c7] transition hover:bg-[#102343] hover:text-white",
											"aria-label": "Fechar lista",
											children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 388,
												columnNumber: 21
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 387,
											columnNumber: 19
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 373,
										columnNumber: 17
									}, this),
									/* @__PURE__ */ (void 0)("div", {
										className: "mt-5 flex gap-2",
										children: [/* @__PURE__ */ (void 0)("button", {
											type: "button",
											onClick: () => void openPeople("followers"),
											className: `rounded-xl px-4 py-2 text-sm transition ${peopleTab === "followers" ? "bg-violet-600 text-white" : "bg-[#0b1c38] text-[#8197ba] hover:text-white"}`,
											children: [
												"Seguidores",
												" ",
												followersCount
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 395,
											columnNumber: 19
										}, this), /* @__PURE__ */ (void 0)("button", {
											type: "button",
											onClick: () => void openPeople("following"),
											className: `rounded-xl px-4 py-2 text-sm transition ${peopleTab === "following" ? "bg-violet-600 text-white" : "bg-[#0b1c38] text-[#8197ba] hover:text-white"}`,
											children: [
												"Seguindo",
												" ",
												followingCount
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 400,
											columnNumber: 19
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 393,
										columnNumber: 17
									}, this),
									peopleError && /* @__PURE__ */ (void 0)("div", {
										className: "mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200",
										children: peopleError
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 407,
										columnNumber: 33
									}, this),
									peopleLoading ? /* @__PURE__ */ (void 0)("div", {
										className: "mt-5 space-y-3",
										children: [
											/* @__PURE__ */ (void 0)(PeopleSkeleton, {}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 413,
												columnNumber: 21
											}, this),
											/* @__PURE__ */ (void 0)(PeopleSkeleton, {}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 415,
												columnNumber: 21
											}, this),
											/* @__PURE__ */ (void 0)(PeopleSkeleton, {}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 417,
												columnNumber: 21
											}, this)
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 411,
										columnNumber: 34
									}, this) : /* @__PURE__ */ (void 0)(PeopleList, { people: peopleTab === "followers" ? followers : following }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 419,
										columnNumber: 28
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 371,
								columnNumber: 27
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "border-t border-[#1b3762] px-3 sm:px-6",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "grid grid-cols-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ProfileTabButton, {
											active: activeTab === "comments",
											onClick: () => setActiveTab("comments"),
											children: "Comentários"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 428,
											columnNumber: 17
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ProfileTabButton, {
											active: activeTab === "favorites",
											onClick: () => setActiveTab("favorites"),
											children: "Favoritos"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 432,
											columnNumber: 17
										}, this),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ProfileTabButton, {
											active: activeTab === "about",
											onClick: () => setActiveTab("about"),
											children: "Sobre"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 436,
											columnNumber: 17
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 426,
									columnNumber: 15
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 424,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "p-5 sm:p-7 lg:p-8",
								children: [
									activeTab === "comments" && /* @__PURE__ */ (void 0)(CommentsTab, { nick }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 447,
										columnNumber: 44
									}, this),
									activeTab === "favorites" && /* @__PURE__ */ (void 0)(FavoritesTab, { favoriteList }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 449,
										columnNumber: 45
									}, this),
									activeTab === "about" && /* @__PURE__ */ (void 0)(AboutTab, {
										bio,
										email,
										myListLength: myList.length
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 451,
										columnNumber: 41
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 445,
								columnNumber: 13
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 151,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("aside", {
						className: "space-y-4 lg:pt-0",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(SideCard, { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Users, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 465,
									columnNumber: 19
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 464,
								columnNumber: 17
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
								className: "font-medium text-white",
								children: "Conta aberta"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 470,
								columnNumber: 19
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-xs leading-5 text-[#8fa5c7]",
								children: "Qualquer pessoa pode seguir você."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 474,
								columnNumber: 19
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 468,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 462,
							columnNumber: 15
						}, this) }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 460,
							columnNumber: 13
						}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(SideCard, { children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Lock, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 489,
									columnNumber: 19
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 488,
								columnNumber: 17
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
								className: "font-medium",
								children: "Conta privada"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 494,
								columnNumber: 19
							}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "mt-1 text-xs leading-5 text-[#8fa5c7]",
								children: "Futuramente você poderá controlar quem pode acompanhar seu perfil."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 498,
								columnNumber: 19
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 492,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 486,
							columnNumber: 15
						}, this) }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 484,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 458,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 148,
					columnNumber: 9
				}, this),
				editing && /* @__PURE__ */ (void 0)("div", {
					className: "fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm",
					children: /* @__PURE__ */ (void 0)("div", {
						className: "max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[#294674] bg-[#07152b] p-5 shadow-2xl sm:p-6",
						children: [/* @__PURE__ */ (void 0)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("p", {
								className: "text-xs uppercase tracking-[0.2em] text-[#7186aa]",
								children: "Perfil Hikari"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 521,
								columnNumber: 19
							}, this), /* @__PURE__ */ (void 0)("h2", {
								className: "mt-1 text-2xl font-semibold",
								children: "Editar perfil"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 525,
								columnNumber: 19
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 519,
								columnNumber: 17
							}, this), /* @__PURE__ */ (void 0)("button", {
								type: "button",
								onClick: () => {
									setError("");
									setEditing(false);
								},
								className: "grid size-9 place-items-center rounded-lg text-[#8fa5c7] hover:bg-[#102343]",
								children: /* @__PURE__ */ (void 0)(X, { className: "size-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 535,
									columnNumber: 19
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 531,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 517,
							columnNumber: 15
						}, this), /* @__PURE__ */ (void 0)("div", {
							className: "mt-6 space-y-5",
							children: [
								/* @__PURE__ */ (void 0)("div", { children: [
									/* @__PURE__ */ (void 0)("label", {
										className: "text-sm font-medium text-white",
										children: "Nick"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 544,
										columnNumber: 19
									}, this),
									/* @__PURE__ */ (void 0)("input", {
										type: "text",
										value: nick,
										onChange: (e) => {
											setNick(e.target.value.toLowerCase());
											setError("");
										},
										maxLength: 30,
										placeholder: "pererinha",
										autoCapitalize: "none",
										autoCorrect: "off",
										spellCheck: false,
										className: "mt-2 h-12 w-full rounded-xl border border-[#294674] bg-[#030b19] px-4 text-sm text-white outline-none placeholder:text-[#536988] focus:border-violet-400"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 548,
										columnNumber: 19
									}, this),
									/* @__PURE__ */ (void 0)("p", {
										className: "mt-1.5 text-xs text-[#7186aa]",
										children: "3 a 30 caracteres. Use apenas letras, números ou _."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 553,
										columnNumber: 19
									}, this)
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 542,
									columnNumber: 17
								}, this),
								/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("label", {
									className: "text-sm font-medium text-white",
									children: "Bio"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 561,
									columnNumber: 19
								}, this), /* @__PURE__ */ (void 0)("textarea", {
									value: bio,
									onChange: (e) => {
										setBio(e.target.value);
										setError("");
									},
									maxLength: 500,
									rows: 4,
									placeholder: "Conte um pouco sobre você...",
									className: "mt-2 w-full resize-none rounded-xl border border-[#294674] bg-[#030b19] p-4 text-sm text-white outline-none placeholder:text-[#536988] focus:border-violet-400"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 565,
									columnNumber: 19
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 559,
									columnNumber: 17
								}, this),
								/* @__PURE__ */ (void 0)("div", { children: [
									/* @__PURE__ */ (void 0)("label", {
										className: "text-sm font-medium text-white",
										children: "Animes favoritos"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 574,
										columnNumber: 19
									}, this),
									/* @__PURE__ */ (void 0)("input", {
										type: "text",
										value: favorites,
										onChange: (e) => {
											setFavorites(e.target.value);
											setError("");
										},
										placeholder: "One Piece, Naruto, Jujutsu Kaisen...",
										className: "mt-2 h-12 w-full rounded-xl border border-[#294674] bg-[#030b19] px-4 text-sm text-white outline-none placeholder:text-[#536988] focus:border-violet-400"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 578,
										columnNumber: 19
									}, this),
									/* @__PURE__ */ (void 0)("p", {
										className: "mt-1.5 text-xs text-[#7186aa]",
										children: "Separe os títulos por vírgula."
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 583,
										columnNumber: 19
									}, this)
								] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 572,
									columnNumber: 17
								}, this),
								error && /* @__PURE__ */ (void 0)("div", {
									className: "rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200",
									children: error
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 589,
									columnNumber: 27
								}, this),
								/* @__PURE__ */ (void 0)("div", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ (void 0)(Button, {
										type: "button",
										onClick: () => void saveProfile(),
										disabled: saving,
										className: "bg-violet-600 text-white hover:bg-violet-500",
										children: [/* @__PURE__ */ (void 0)(Save, { className: "size-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 596,
											columnNumber: 21
										}, this), saving ? "Salvando..." : "Salvar"]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 595,
										columnNumber: 19
									}, this), /* @__PURE__ */ (void 0)(Button, {
										type: "button",
										variant: "outline",
										onClick: () => {
											setError("");
											setEditing(false);
										},
										disabled: saving,
										className: "border-[#294674] bg-transparent text-white hover:bg-[#102343]",
										children: [/* @__PURE__ */ (void 0)(X, { className: "size-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 605,
											columnNumber: 21
										}, this), "Cancelar"]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 601,
										columnNumber: 19
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 593,
									columnNumber: 17
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 540,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 515,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 513,
					columnNumber: 21
				}, this),
				admin && /* @__PURE__ */ (void 0)("section", {
					className: "mt-5 rounded-2xl border border-violet-500/20 bg-[#07152b] p-5 shadow-[0_0_35px_rgba(92,55,255,0.08)]",
					children: /* @__PURE__ */ (void 0)("div", {
						className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
						children: [/* @__PURE__ */ (void 0)("div", { children: [/* @__PURE__ */ (void 0)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (void 0)(ShieldCheck, { className: "size-5 text-violet-300" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 627,
								columnNumber: 19
							}, this), /* @__PURE__ */ (void 0)("h2", {
								className: "font-semibold",
								children: "Administrador HIKARI"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 629,
								columnNumber: 19
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 625,
							columnNumber: 17
						}, this), /* @__PURE__ */ (void 0)("p", {
							className: "mt-1 text-sm text-[#8fa5c7]",
							children: "Seu acesso ao painel de administração está liberado."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 635,
							columnNumber: 17
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 623,
							columnNumber: 15
						}, this), /* @__PURE__ */ (void 0)(Button, {
							asChild: true,
							className: "bg-violet-600 text-white hover:bg-violet-500",
							children: /* @__PURE__ */ (void 0)(Link, {
								to: "/admin",
								children: "Abrir Admin"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 642,
								columnNumber: 17
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 641,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 621,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 619,
					columnNumber: 19
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "mt-5 flex flex-wrap items-center gap-2 pb-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							type: "button",
							variant: "outline",
							onClick: () => void signOut("/"),
							className: "border-[#294674] bg-[#07152b] text-white hover:bg-[#102343]",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(LogOut, { className: "size-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 655,
								columnNumber: 13
							}, this), "Sair da conta"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 654,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Button, {
							asChild: true,
							variant: "ghost",
							className: "text-[#9eb1d1] hover:bg-[#102343] hover:text-white",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
								to: "/",
								children: "Voltar ao início"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 661,
								columnNumber: 13
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 660,
							columnNumber: 11
						}, this),
						saved && /* @__PURE__ */ (void 0)("span", {
							className: "text-xs text-[#8197ba]",
							children: "Perfil salvo."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 666,
							columnNumber: 21
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 652,
					columnNumber: 9
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 146,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 145,
		columnNumber: 10
	}, this);
}
function PeopleList({ people }) {
	if (people.length === 0) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "mt-5 rounded-2xl border border-dashed border-[#294674] bg-[#07152b] p-8 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Users, { className: "mx-auto size-8 text-[#526b99]" }, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 694,
			columnNumber: 9
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
			className: "mt-3 text-sm text-[#8197ba]",
			children: "Nenhuma pessoa nesta lista ainda."
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 696,
			columnNumber: 9
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 692,
		columnNumber: 12
	}, this);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "mt-5 space-y-3",
		children: people.map((person) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex items-center gap-3 rounded-2xl border border-[#1b3762] bg-[#07152b] p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/profile/$nick",
					params: { nick: person.nick },
					className: "grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#15284b] text-sm font-semibold text-white",
					children: person.image ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
						src: person.image,
						alt: "",
						className: "size-full object-cover"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 709,
						columnNumber: 29
					}, this) : person.nick.charAt(0).toUpperCase()
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 706,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
						to: "/profile/$nick",
						params: { nick: person.nick },
						className: "block truncate font-medium text-white transition hover:text-violet-300",
						children: person.nick
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 714,
						columnNumber: 13
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "mt-0.5 truncate text-xs text-[#7186aa]",
						children: ["@", person.nick]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 720,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 712,
					columnNumber: 11
				}, this),
				person.isFollowing ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
					className: "inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#365b91] bg-[#102343] px-3 py-2 text-xs text-white",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(UserCheck, { className: "size-3.5" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 727,
						columnNumber: 15
					}, this), "Seguindo"]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 726,
					columnNumber: 33
				}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
					className: "inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs text-white",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(UserPlus, { className: "size-3.5" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 730,
						columnNumber: 15
					}, this), "Seguir"]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 729,
					columnNumber: 23
				}, this)
			]
		}, person.userId, true, {
			fileName: _jsxFileName,
			lineNumber: 704,
			columnNumber: 29
		}, this))
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 702,
		columnNumber: 10
	}, this);
}
function PeopleSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "flex items-center gap-3 rounded-2xl border border-[#1b3762] bg-[#07152b] p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "size-11 animate-pulse rounded-full bg-[#102343]" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 741,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-4 w-32 animate-pulse rounded bg-[#102343]" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 745,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-3 w-20 animate-pulse rounded bg-[#102343]" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 747,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 743,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-9 w-20 animate-pulse rounded-xl bg-[#102343]" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 751,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 739,
		columnNumber: 10
	}, this);
}
function Stat({ icon, value, label }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "flex min-h-[100px] flex-col items-center justify-center border-b border-[#1b3762] px-3 py-4 text-center transition sm:border-b-0 sm:border-r last:border-r-0 group-hover:bg-[#0b1c38]",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "text-[#91a8ff] [&>svg]:size-5",
				children: icon
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 771,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("strong", {
				className: "mt-2 text-xl font-semibold",
				children: value
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 775,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
				className: "mt-1 text-xs text-[#7186aa]",
				children: label
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 779,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 769,
		columnNumber: 10
	}, this);
}
function CommentsTab({ nick }) {
	const getMyCommentsFn = useServerFn(getMyComments);
	const [comments, setComments] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		let active = true;
		setLoading(true);
		setError("");
		getMyCommentsFn().then((result) => {
			if (!active) return;
			setComments(result);
		}).catch(() => {
			if (!active) return;
			setComments([]);
			setError("Não foi possível carregar seus comentários.");
		}).finally(() => {
			if (active) setLoading(false);
		});
		return () => {
			active = false;
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
			className: "text-xl font-semibold",
			children: [
				"Comentários de",
				" ",
				nick || "você"
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 821,
			columnNumber: 7
		}, this),
		/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
			className: "mt-1 text-sm text-[#8197ba]",
			children: "Suas atividades nos episódios do HIKARI."
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 826,
			columnNumber: 7
		}, this),
		loading && /* @__PURE__ */ (void 0)("div", {
			className: "mt-6 space-y-3",
			children: [
				/* @__PURE__ */ (void 0)(CommentSkeleton, {}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 832,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (void 0)(CommentSkeleton, {}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 834,
					columnNumber: 11
				}, this),
				/* @__PURE__ */ (void 0)(CommentSkeleton, {}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 836,
					columnNumber: 11
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 830,
			columnNumber: 19
		}, this),
		!loading && error && /* @__PURE__ */ (void 0)("div", {
			className: "mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200",
			children: error
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 840,
			columnNumber: 29
		}, this),
		!loading && !error && comments.length === 0 && /* @__PURE__ */ (void 0)("div", {
			className: "mt-6 rounded-2xl border border-[#294674] bg-[#07152b] p-8 text-center sm:p-12",
			children: [
				/* @__PURE__ */ (void 0)("div", {
					className: "mx-auto grid size-16 place-items-center rounded-full bg-[#102343] text-[#8da4ff]",
					children: /* @__PURE__ */ (void 0)(MessageCircle, { className: "size-8" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 847,
						columnNumber: 15
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 846,
					columnNumber: 13
				}, this),
				/* @__PURE__ */ (void 0)("h3", {
					className: "mt-5 font-semibold",
					children: "Você ainda não fez comentários"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 850,
					columnNumber: 13
				}, this),
				/* @__PURE__ */ (void 0)("p", {
					className: "mx-auto mt-2 max-w-md text-sm leading-6 text-[#7186aa]",
					children: "Quando você comentar em um episódio do HIKARI, seus comentários aparecerão aqui."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 854,
					columnNumber: 13
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 844,
			columnNumber: 55
		}, this),
		!loading && !error && comments.length > 0 && /* @__PURE__ */ (void 0)("div", {
			className: "mt-6 space-y-4",
			children: comments.map((comment) => /* @__PURE__ */ (void 0)(ProfileCommentCard, { comment }, comment.id, false, {
				fileName: _jsxFileName,
				lineNumber: 862,
				columnNumber: 38
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 860,
			columnNumber: 53
		}, this)
	] }, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 819,
		columnNumber: 10
	}, this);
}
function CommentSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "rounded-2xl border border-[#294674] bg-[#07152b] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "h-4 w-32 animate-pulse rounded bg-[#102343]" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 876,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-4 h-4 w-full animate-pulse rounded bg-[#102343]" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 878,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-2 h-4 w-4/5 animate-pulse rounded bg-[#102343]" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 880,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "mt-5 h-3 w-24 animate-pulse rounded bg-[#102343]" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 882,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 874,
		columnNumber: 10
	}, this);
}
function ProfileCommentCard({ comment }) {
	const date = new Date(comment.createdAt);
	const formattedDate = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	});
	const formattedTime = Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("pt-BR", {
		hour: "2-digit",
		minute: "2-digit"
	});
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("article", {
		className: "rounded-2xl border border-[#294674] bg-[#07152b] p-5 transition hover:border-[#365b91]",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-start gap-3",
				children: [comment.userImage ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("img", {
					src: comment.userImage,
					alt: "",
					className: "size-10 shrink-0 rounded-full object-cover"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 910,
					columnNumber: 30
				}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "grid size-10 shrink-0 place-items-center rounded-full bg-[#15284b] text-sm font-semibold text-[#b7c7e5]",
					children: comment.userName.charAt(0).toUpperCase()
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 910,
					columnNumber: 126
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "font-medium text-white",
							children: comment.userName
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 918,
							columnNumber: 13
						}, this), comment.parentId && /* @__PURE__ */ (void 0)("span", {
							className: "rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-200",
							children: "Resposta"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 922,
							columnNumber: 34
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 916,
						columnNumber: 11
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "mt-1 flex flex-wrap items-center gap-2 text-xs text-[#7186aa]",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
								to: "/watch/$id",
								params: { id: comment.animeId },
								search: { ep: comment.episodeId },
								className: "transition hover:text-white",
								children: [
									"Episódio",
									" ",
									comment.episodeId
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 930,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "•" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 939,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: formattedDate }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 941,
								columnNumber: 13
							}, this),
							formattedTime && /* @__PURE__ */ (void 0)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (void 0)("span", { children: "•" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 946,
								columnNumber: 17
							}, this), /* @__PURE__ */ (void 0)("span", { children: formattedTime }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 948,
								columnNumber: 17
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 945,
								columnNumber: 31
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 928,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 914,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 908,
				columnNumber: 7
			}, this),
			comment.isSpoiler ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-xs font-medium uppercase tracking-[0.14em] text-amber-300",
					children: "Spoiler"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 961,
					columnNumber: 11
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "mt-2 text-sm leading-6 text-[#c4d1e8]",
					children: comment.content
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 965,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 959,
				columnNumber: 28
			}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-4 whitespace-pre-wrap text-sm leading-6 text-[#c4d1e8]",
				children: comment.content
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 969,
				columnNumber: 18
			}, this),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "mt-5 flex items-center gap-4 border-t border-[#1b3762] pt-4 text-xs text-[#8197ba]",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					type: "button",
					onClick: async () => {
						try {
							const response = await fetch("/api/comments/like", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ commentId: comment.id })
							});
							if (!response.ok) return;
							await response.json();
						} catch {}
					},
					className: "flex items-center gap-1.5 transition hover:text-white",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Heart, { className: "size-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 998,
							columnNumber: 11
						}, this),
						comment.likes,
						comment.likes === 1 ? " curtida" : " curtidas"
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 975,
					columnNumber: 9
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Link, {
					to: "/watch/$id",
					params: { id: comment.animeId },
					search: { ep: comment.episodeId },
					className: "flex items-center gap-1.5 transition hover:text-white",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageCircle, { className: "size-4" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1010,
						columnNumber: 11
					}, this), comment.parentId ? "Resposta" : "Comentário"]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1005,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 973,
				columnNumber: 7
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 906,
		columnNumber: 10
	}, this);
}
function FavoritesTab({ favoriteList }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
			className: "text-xl font-semibold",
			children: "Animes favoritos"
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 1031,
			columnNumber: 7
		}, this),
		/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
			className: "mt-1 text-sm text-[#8197ba]",
			children: "Os títulos que você escolheu como favoritos."
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 1035,
			columnNumber: 7
		}, this),
		favoriteList.length > 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mt-6 flex flex-wrap gap-2",
			children: favoriteList.map((item) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
				className: "rounded-full border border-[#294674] bg-[#0b1c38] px-4 py-2 text-sm text-[#c6d4ec]",
				children: item
			}, item, false, {
				fileName: _jsxFileName,
				lineNumber: 1041,
				columnNumber: 37
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 1039,
			columnNumber: 34
		}, this) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mt-6 rounded-2xl border border-dashed border-[#294674] bg-[#07152b] p-8 text-center",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Bookmark, { className: "mx-auto size-7 text-[#667ea9]" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1047,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-3 text-sm text-[#8197ba]",
				children: "Você ainda não adicionou animes favoritos."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1049,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 1045,
			columnNumber: 18
		}, this)
	] }, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 1029,
		columnNumber: 10
	}, this);
}
function AboutTab({ bio, email, myListLength }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
		className: "text-xl font-semibold",
		children: "Sobre"
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 1073,
		columnNumber: 7
	}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "mt-6 space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "rounded-2xl border border-[#294674] bg-[#07152b] p-5",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "text-xs uppercase tracking-[0.16em] text-[#7186aa]",
				children: "Bio"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1081,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "mt-3 text-sm leading-6 text-[#b4c5df]",
				children: bio || "Este usuário ainda não adicionou uma descrição."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1085,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 1079,
			columnNumber: 9
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "rounded-2xl border border-[#294674] bg-[#07152b] p-5",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "text-xs uppercase tracking-[0.16em] text-[#7186aa]",
				children: "Minha conta"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 1093,
				columnNumber: 11
			}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "mt-4 space-y-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "text-[#8197ba]",
						children: "Animes na minha lista"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1101,
						columnNumber: 15
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("strong", { children: myListLength }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1105,
						columnNumber: 15
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1099,
					columnNumber: 13
				}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "text-[#8197ba]",
						children: "E-mail"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1113,
						columnNumber: 15
					}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "max-w-[60%] truncate text-[#b4c5df]",
						children: email
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 1117,
						columnNumber: 15
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 1111,
					columnNumber: 13
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 1097,
				columnNumber: 11
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 1091,
			columnNumber: 9
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 1077,
		columnNumber: 7
	}, this)] }, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 1071,
		columnNumber: 10
	}, this);
}
function SideCard({ children }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("section", {
		className: "rounded-2xl border border-[#1c3c70] bg-[#061329] p-5 shadow-[0_0_30px_rgba(28,60,112,0.08)]",
		children
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 1141,
		columnNumber: 10
	}, this);
}
function ProfileTabButton({ active, children, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
		type: "button",
		onClick,
		className: `relative min-h-14 px-3 text-sm font-medium transition ${active ? "text-white" : "text-[#7186aa] hover:text-[#c7d5ec]"}`,
		children: [children, active && /* @__PURE__ */ (void 0)("span", { className: "absolute bottom-0 left-1/2 h-0.5 w-20 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#5366ff] to-[#a855f7] shadow-[0_0_12px_rgba(100,80,255,0.8)]" }, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 1162,
			columnNumber: 18
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 1159,
		columnNumber: 10
	}, this);
}
//#endregion
export { Account as component };
