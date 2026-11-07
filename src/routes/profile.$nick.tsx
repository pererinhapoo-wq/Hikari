import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import { useServerFn } from "@tanstack/react-start";

import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  Heart,
  Lock,
  MessageCircle,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProfileHistorySpace } from "@/components/profile/ProfileHistorySpace";

import {
  blockUser,
  cancelFollowRequest,
  followUser,
  getPublicActivities,
  getPublicComments,
  getPublicProfile,
  unblockUser,
  unfollowUser,
  type PublicProfileComment,
  type UserActivityItem,
} from "@/lib/profile.functions";

export const Route =
  createFileRoute(
    "/profile/$nick",
  )({
    component: PublicProfile,
  });

type PublicComment = PublicProfileComment;

async function getProfileBackgroundColor(
  imageUrl: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();

    image.crossOrigin = "anonymous";

    image.onload = () => {
      try {
        const canvas =
          document.createElement("canvas");

        canvas.width = 32;
        canvas.height = 32;

        const context =
          canvas.getContext("2d");

        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(
          image,
          0,
          0,
          32,
          32,
        );

        const data =
          context.getImageData(
            0,
            0,
            32,
            32,
          ).data;

        let red = 0;
        let green = 0;
        let blue = 0;
        let count = 0;

        for (
          let index = 0;
          index < data.length;
          index += 4
        ) {
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const alpha = data[index + 3];

          if (alpha < 80) {
            continue;
          }

          const brightness =
            (r + g + b) / 3;

          if (brightness > 235) {
            continue;
          }

          red += r;
          green += g;
          blue += b;
          count++;
        }

        if (!count) {
          resolve(null);
          return;
        }

        red = Math.round(
          (red / count) * 0.35,
        );

        green = Math.round(
          (green / count) * 0.35,
        );

        blue = Math.round(
          (blue / count) * 0.35,
        );

        resolve(
          `rgb(${red}, ${green}, ${blue})`,
        );
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
  const { nick } =
    Route.useParams();

  const getPublicProfileFn =
    useServerFn(getPublicProfile);

  const getPublicCommentsFn =
    useServerFn(getPublicComments);

  const getPublicActivitiesFn =
    useServerFn(getPublicActivities);

  const [profile, setProfile] =
    useState<
      Awaited<
        ReturnType<
          typeof getPublicProfileFn
        >
      > | null
    >(null);

  const [activeTab, setActiveTab] =
    useState<"comments" | "activity">("comments");

  // Comentários paginados
  const [comments, setComments] =
    useState<PublicComment[]>([]);
  const [commentsTotal, setCommentsTotal] =
    useState(0);
  const [commentsPage, setCommentsPage] =
    useState(1);
  const [commentsTotalPages, setCommentsTotalPages] =
    useState(1);

  // Atividades paginadas
  const [activities, setActivities] =
    useState<UserActivityItem[]>([]);
  const [activityTotal, setActivityTotal] =
    useState(0);
  const [activityPage, setActivityPage] =
    useState(1);
  const [activityTotalPages, setActivityTotalPages] =
    useState(1);
  const [activityLoading, setActivityLoading] =
    useState(false);
  const [activityError, setActivityError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [
    commentsLoading,
    setCommentsLoading,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    commentsError,
    setCommentsError,
  ] = useState("");

  const [following, setFollowing] =
    useState(false);

  const [
    followersCount,
    setFollowersCount,
  ] = useState(0);

  const [
    followLoading,
    setFollowLoading,
  ] = useState(false);

  const followUserFn = useServerFn(followUser);
  const unfollowUserFn = useServerFn(unfollowUser);
  const cancelFollowRequestFn = useServerFn(cancelFollowRequest);
  const blockUserFn = useServerFn(blockUser);
  const unblockUserFn = useServerFn(unblockUser);

  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [profileBgColor, setProfileBgColor] = useState("#030817");

  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByTarget, setIsBlockedByTarget] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [confirmModalType, setConfirmModalType] = useState<"block" | "unblock" | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setCommentsError("");
    setActivityError("");
    setComments([]);
    setActivities([]);
    setProfileBgColor("#030817");
    setFeedbackMsg(null);

    void getPublicProfileFn({
      data: {
        nick,
      },
    })
      .then(async (result) => {
        if (!active) {
          return;
        }

        setProfile(result);
        setFollowing(result.isFollowing);
        setHasPendingRequest(Boolean(result.hasPendingRequest));
        setFollowersCount(result.followersCount);
        setIsBlockedByMe(Boolean(result.isBlockedByMe));
        setIsBlockedByTarget(Boolean(result.isBlockedByTarget));

        // Define aba padrão: se comentários forem privados mas atividade for pública, foca atividade
        if (!result.canViewComments && result.canViewHistory) {
          setActiveTab("activity");
        } else {
          setActiveTab("comments");
        }

        if (result.image) {
          const color = await getProfileBackgroundColor(result.image);
          if (active && color) {
            setProfileBgColor(color);
          }
        }

        // Carrega comentários se permitido
        if (result.canViewComments && result.canViewContent) {
          setCommentsLoading(true);

          try {
            const res = await getPublicCommentsFn({
              data: {
                userId: result.userId,
                page: 1,
                limit: 15,
              },
            });

            if (!active) return;
            setComments(res.items);
            setCommentsTotal(res.total);
            setCommentsPage(res.page);
            setCommentsTotalPages(res.totalPages);
          } catch {
            if (!active) return;
            setComments([]);
            setCommentsError("Não foi possível carregar os comentários.");
          } finally {
            if (active) {
              setCommentsLoading(false);
            }
          }
        } else {
          setComments([]);
          setCommentsLoading(false);
        }

        // Carrega atividades se permitido
        if (result.canViewHistory && result.canViewContent) {
          setActivityLoading(true);

          try {
            const actRes = await getPublicActivitiesFn({
              data: {
                userId: result.userId,
                page: 1,
                limit: 15,
              },
            });

            if (!active) return;
            setActivities(actRes.items);
            setActivityTotal(actRes.total);
            setActivityPage(actRes.page);
            setActivityTotalPages(actRes.totalPages);
          } catch {
            if (!active) return;
            setActivities([]);
            setActivityError("Não foi possível carregar a atividade.");
          } finally {
            if (active) {
              setActivityLoading(false);
            }
          }
        } else {
          setActivities([]);
          setActivityLoading(false);
        }
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        setProfile(null);
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar o perfil.",
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [nick]);

  const handleCommentsPageChange = async (newPage: number) => {
    if (!profile || newPage < 1 || newPage > commentsTotalPages) return;
    setCommentsLoading(true);
    try {
      const res = await getPublicCommentsFn({
        data: { userId: profile.userId, page: newPage, limit: 15 },
      });
      setComments(res.items);
      setCommentsTotal(res.total);
      setCommentsPage(res.page);
      setCommentsTotalPages(res.totalPages);
    } catch (err) {
      setCommentsError("Não foi possível carregar a página de comentários.");
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleActivityPageChange = async (newPage: number) => {
    if (!profile || newPage < 1 || newPage > activityTotalPages) return;
    setActivityLoading(true);
    try {
      const res = await getPublicActivitiesFn({
        data: { userId: profile.userId, page: newPage, limit: 15 },
      });
      setActivities(res.items);
      setActivityTotal(res.total);
      setActivityPage(res.page);
      setActivityTotalPages(res.totalPages);
    } catch (err) {
      setActivityError("Não foi possível carregar a página de atividades.");
    } finally {
      setActivityLoading(false);
    }
  };

  async function handleFollowAction() {
    if (!profile) return;
    if (followLoading) return;

    setFollowLoading(true);
    setError("");

    try {
      if (following) {
        // Deixar de seguir
        await unfollowUserFn({
          data: { targetUserId: profile.userId },
        });

        const newCount = Math.max(0, followersCount - 1);
        setFollowing(false);
        setHasPendingRequest(false);
        setFollowersCount(newCount);
        setProfile((curr) =>
          curr
            ? {
                ...curr,
                isFollowing: false,
                hasPendingRequest: false,
                relationStatus: "none",
                followersCount: newCount,
                canViewContent: curr.accountType === "public",
              }
            : curr,
        );
      } else if (hasPendingRequest) {
        // Cancelar solicitação pendente
        await cancelFollowRequestFn({
          data: { targetUserId: profile.userId },
        });

        setHasPendingRequest(false);
        setProfile((curr) =>
          curr
            ? {
                ...curr,
                hasPendingRequest: false,
                relationStatus: "none",
              }
            : curr,
        );
      } else {
        // Seguir ou solicitar para seguir
        const res = await followUserFn({
          data: { targetUserId: profile.userId },
        });

        if (res.status === "following") {
          const newCount = followersCount + 1;
          setFollowing(true);
          setHasPendingRequest(false);
          setFollowersCount(newCount);
          setProfile((curr) =>
            curr
              ? {
                  ...curr,
                  isFollowing: true,
                  hasPendingRequest: false,
                  relationStatus: "following",
                  followersCount: newCount,
                  canViewContent: true,
                  canViewLists: curr.privacyLists !== "private",
                  canViewFavorites: curr.privacyFavorites !== "private",
                  canViewHistory: curr.privacyHistory !== "private",
                  canViewComments: curr.privacyComments !== "private",
                  canViewFollowers: curr.privacyFollowers !== "private",
                }
              : curr,
          );

          // Se desbloqueou conteúdo privado, carregar comentários
          if (profile.accountType === "private") {
            setCommentsLoading(true);
            try {
              const freshComments = await getPublicCommentsFn({
                data: { userId: profile.userId },
              });
              setComments(freshComments);
            } catch {
              // ignore
            } finally {
              setCommentsLoading(false);
            }
          }
        } else if (res.status === "requested") {
          setHasPendingRequest(true);
          setFollowing(false);
          setProfile((curr) =>
            curr
              ? {
                  ...curr,
                  hasPendingRequest: true,
                  relationStatus: "requested",
                }
              : curr,
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível completar a ação.",
      );
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleConfirmBlockAction() {
    if (!profile) return;
    if (blockLoading) return;

    setBlockLoading(true);
    setError("");

    try {
      if (confirmModalType === "block") {
        await blockUserFn({
          data: { targetUserId: profile.userId },
        });

        const newFollowersCount = Math.max(0, followersCount - (following ? 1 : 0));
        setIsBlockedByMe(true);
        setFollowing(false);
        setHasPendingRequest(false);
        setFollowersCount(newFollowersCount);
        setComments([]);
        setProfile((curr) =>
          curr
            ? {
                ...curr,
                isFollowing: false,
                hasPendingRequest: false,
                relationStatus: "none",
                isBlocked: true,
                isBlockedByMe: true,
                followersCount: newFollowersCount,
                canViewComments: false,
                canViewFollowers: false,
                canViewLists: false,
                canViewFavorites: false,
                canViewHistory: false,
              }
            : curr,
        );
        setConfirmModalType(null);
        setFeedbackMsg({ text: "Usuário bloqueado com sucesso.", type: "success" });
        setTimeout(() => setFeedbackMsg(null), 4000);
      } else if (confirmModalType === "unblock") {
        await unblockUserFn({
          data: { targetUserId: profile.userId },
        });

        setIsBlockedByMe(false);
        setProfile((curr) =>
          curr
            ? {
                ...curr,
                isBlocked: isBlockedByTarget,
                isBlockedByMe: false,
              }
            : curr,
        );
        setConfirmModalType(null);
        setFeedbackMsg({ text: "Usuário desbloqueado com sucesso.", type: "success" });
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível concluir a ação de bloqueio.",
      );
      setConfirmModalType(null);
    } finally {
      setBlockLoading(false);
    }
  }

  async function toggleCommentLike(
    commentId: string,
  ) {
    try {
      const response =
        await fetch(
          "/api/comments/like",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              commentId,
            }),
          },
        );

      const result =
        (await response.json()) as {
          liked?: boolean;
          likes?: number;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Não foi possível curtir o comentário.",
        );
      }

      setComments(
        (current) =>
          current.map(
            (comment) =>
              comment.id ===
              commentId
                ? {
                    ...comment,
                    liked:
                      Boolean(
                        result.liked,
                      ),
                    likes:
                      Number(
                        result.likes ??
                          0,
                      ),
                  }
                : comment,
          ),
      );
    } catch (err) {
      setCommentsError(
        err instanceof Error
          ? err.message
          : "Não foi possível curtir o comentário.",
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#030817] px-4 py-8 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="h-8 w-24 animate-pulse rounded bg-[#102343]" />

          <div className="mt-6 rounded-3xl border border-[#1c3c70] bg-[#061329] p-6 sm:p-8">
            <div className="h-10 w-56 animate-pulse rounded bg-[#102343]" />

            <div className="mt-3 h-5 w-32 animate-pulse rounded bg-[#102343]" />

            <div className="mt-6 h-4 w-full animate-pulse rounded bg-[#102343]" />

            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-[#102343]" />
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#030817] px-4 py-8 text-white">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-[#9fb2d4] transition hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Link>

          <div className="mt-6 rounded-3xl border border-red-500/20 bg-[#061329] p-8 text-center">
            <Users className="mx-auto size-10 text-red-300" />

            <h1 className="mt-4 text-xl font-semibold">
              Perfil não encontrado
            </h1>

            <p className="mt-2 text-sm text-[#8197ba]">
              {error ||
                "Esse perfil não existe."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const avatarLetter =
    profile.nick
      .charAt(0)
      .toUpperCase();

  return (
    <main
      className="min-h-screen pb-24 pt-5 text-white transition-colors duration-700"
      style={{
        backgroundColor:
          profileBgColor,
      }}
    >
      <div className="w-full">
        <div className="px-5 sm:px-8 lg:px-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-[#d0d9ea] transition hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </div>

        <section className="mt-5 w-full">
          <div className="px-5 pb-7 pt-7 sm:px-8 sm:pt-8 lg:px-10">
            <div>
              <div className="grid size-28 place-items-center overflow-hidden rounded-full border-[5px] border-white/10 bg-[#15284b] text-5xl font-semibold shadow-xl sm:size-32">
                {profile.image ? (
                  <img
                    src={profile.image}
                    alt={`Foto de ${profile.nick}`}
                    className="size-full object-cover"
                  />
                ) : (
                  avatarLetter
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold sm:text-4xl">
                    {profile.nick}
                  </h1>

                  <BadgeCheck className="size-6 fill-violet-500 text-white" />

                  {profile.accountType === "private" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-300">
                      <Lock className="size-3" />
                      Privado
                    </span>
                  )}
                </div>

                <p className="mt-1 text-base text-[#c0cbe0]">
                  @{profile.nick}
                </p>

                {profile.bio && (
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-[#d0d9ea]">
                    {profile.bio}
                  </p>
                )}
              </div>

              {profile.isOwner ? (
                <Link
                  to="/account"
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-600/20 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-600/30"
                >
                  Meu Perfil
                </Link>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Status / Ação de Seguir */}
                  {isBlockedByMe ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                      <UserX className="size-3.5" />
                      <span>Usuário bloqueado</span>
                    </span>
                  ) : isBlockedByTarget ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-400">
                      <Shield className="size-3.5" />
                      <span>Indisponível</span>
                    </span>
                  ) : !profile.allowFollowers && !following && !hasPendingRequest ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-400">
                      <Shield className="size-3.5" />
                      <span>Seguidores desativados</span>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void handleFollowAction()}
                      disabled={followLoading}
                      className={
                        following
                          ? "border border-[#365b91] bg-[#102343] text-white hover:bg-[#163055]"
                          : hasPendingRequest
                            ? "border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                            : "bg-violet-600 text-white hover:bg-violet-500"
                      }
                    >
                      {following ? (
                        <>
                          <UserCheck className="size-4" />
                          {followLoading ? "Atualizando..." : "Seguindo"}
                        </>
                      ) : hasPendingRequest ? (
                        <>
                          <Clock className="size-4" />
                          {followLoading ? "Atualizando..." : "Solicitação enviada (Cancelar)"}
                        </>
                      ) : profile.accountType === "private" ? (
                        <>
                          <UserPlus className="size-4" />
                          {followLoading ? "Atualizando..." : "Solicitar para Seguir"}
                        </>
                      ) : (
                        <>
                          <UserPlus className="size-4" />
                          {followLoading ? "Atualizando..." : "Seguir"}
                        </>
                      )}
                    </Button>
                  )}

                  {/* Ação de Bloqueio / Desbloqueio */}
                  {isBlockedByMe ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmModalType("unblock")}
                      disabled={blockLoading}
                      className="border-violet-500/40 bg-violet-600/15 text-violet-300 hover:bg-violet-600/25 hover:text-white"
                      title="Desbloquear usuário"
                    >
                      <Shield className="size-4" />
                      <span>Desbloquear</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmModalType("block")}
                      disabled={blockLoading}
                      className="border-white/10 bg-white/[0.04] text-zinc-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                      title="Bloquear usuário"
                    >
                      <UserX className="size-4" />
                      <span className="hidden sm:inline">Bloquear</span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {feedbackMsg && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-300 animate-in fade-in">
                <Check className="size-4 shrink-0 text-emerald-400" />
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-black/15 sm:grid-cols-4">
              <PublicStat
                icon={<MessageCircle />}
                value={
                  profile.canViewComments
                    ? String(profile.commentCount)
                    : "—"
                }
                label="Comentários"
              />

              <PublicStat
                icon={<Heart />}
                value="0"
                label="Curtidas"
              />

              <PublicStat
                icon={<Users />}
                value={
                  profile.canViewFollowers
                    ? String(followersCount)
                    : "—"
                }
                label="Seguidores"
              />

              <PublicStat
                icon={<UserPlus />}
                value={
                  profile.canViewFollowers
                    ? String(profile.followingCount)
                    : "—"
                }
                label="Seguindo"
              />
            </div>
          </div>
        </section>

        {!profile.canViewContent ? (
          <section className="mt-8 px-5 sm:px-8 lg:px-10">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-8 sm:p-12 text-center backdrop-blur-md">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 text-violet-300 shadow-inner">
                <Lock className="size-7" />
              </div>
              <h2 className="mt-4 text-xl sm:text-2xl font-bold text-white">Esta conta é privada</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#aab5c9]">
                Apenas seguidores aprovados têm acesso aos comentários, listas e histórico de @{profile.nick}.
              </p>
              {profile.allowFollowers && !following && (
                <div className="mt-6">
                  <Button
                    type="button"
                    onClick={() => void handleFollowAction()}
                    disabled={followLoading}
                    className={
                      hasPendingRequest
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 shadow-lg"
                        : "bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/25"
                    }
                  >
                    {hasPendingRequest ? (
                      <>
                        <Clock className="size-4" />
                        {followLoading ? "Atualizando..." : "Solicitação enviada (Cancelar)"}
                      </>
                    ) : (
                      <>
                        <UserPlus className="size-4" />
                        {followLoading ? "Atualizando..." : "Solicitar para Seguir"}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="mt-8 px-5 sm:px-8 lg:px-10">
            {/* Abas Públicas: Comentários e Atividade */}
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
              <button
                type="button"
                onClick={() => setActiveTab("comments")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  activeTab === "comments"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <MessageCircle className="size-4" />
                <span>Comentários</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums text-zinc-300">
                  {profile.canViewComments ? commentsTotal : "—"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("activity")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  activeTab === "activity"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <Activity className="size-4" />
                <span>Atividade</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums text-zinc-300">
                  {profile.canViewHistory ? activityTotal : "—"}
                </span>
              </button>
            </div>

            {/* Conteúdo da Aba Comentários */}
            {activeTab === "comments" && (
              <div className="mt-5 space-y-4">
                {!profile.canViewComments ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-10 text-center">
                    <Lock className="mx-auto size-8 text-zinc-500" />
                    <p className="mt-3 text-sm text-zinc-400 font-medium">
                      Os comentários deste usuário são privados.
                    </p>
                  </div>
                ) : (
                  <>
                    {commentsError && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {commentsError}
                      </div>
                    )}

                    {commentsLoading ? (
                      <div className="space-y-3">
                        <CommentSkeleton />
                        <CommentSkeleton />
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-10 text-center">
                        <MessageCircle className="mx-auto size-9 text-[#8190ad]" />
                        <p className="mt-3 text-sm text-[#b5c0d5]">
                          Esse usuário ainda não fez comentários.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {comments.map((comment) => (
                          <PublicCommentCard
                            key={comment.id}
                            comment={comment}
                            onLike={() => void toggleCommentLike(comment.id)}
                          />
                        ))}

                        {/* Paginação dos comentários */}
                        {commentsTotalPages > 1 && (
                          <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
                            <span className="text-xs text-zinc-400">
                              Página <strong className="text-white">{commentsPage}</strong> de{" "}
                              <strong className="text-white">{commentsTotalPages}</strong>
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleCommentsPageChange(commentsPage - 1)}
                                disabled={commentsPage <= 1}
                                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none"
                              >
                                <ChevronLeft className="size-4" />
                                <span>Anterior</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleCommentsPageChange(commentsPage + 1)}
                                disabled={commentsPage >= commentsTotalPages}
                                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none"
                              >
                                <span>Próxima</span>
                                <ChevronRight className="size-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Conteúdo da Aba Atividade */}
            {activeTab === "activity" && (
              <div className="mt-5 space-y-4">
                {!profile.canViewHistory ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-10 text-center">
                    <Lock className="mx-auto size-8 text-zinc-500" />
                    <p className="mt-3 text-sm text-zinc-400 font-medium">
                      A atividade deste usuário é privada.
                    </p>
                  </div>
                ) : (
                  <>
                    {activityError && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {activityError}
                      </div>
                    )}

                    <ProfileHistorySpace
                      items={activities}
                      total={activityTotal}
                      page={activityPage}
                      totalPages={activityTotalPages}
                      onPageChange={(p) => void handleActivityPageChange(p)}
                      loading={activityLoading}
                      isOwner={false}
                    />
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* Modal de Confirmação para Bloquear / Desbloquear */}
        {confirmModalType && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0c18] p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                    confirmModalType === "block"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                  }`}
                >
                  {confirmModalType === "block" ? (
                    <UserX className="size-5" />
                  ) : (
                    <Shield className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white text-sm sm:text-base">
                    {confirmModalType === "block"
                      ? `Bloquear @${profile.nick}?`
                      : `Desbloquear @${profile.nick}?`}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    {confirmModalType === "block"
                      ? "Ao bloquear este usuário, vínculos de seguidores e solicitações serão removidos nas duas direções e interações em comentários serão impedidas."
                      : "Após o desbloqueio, vocês poderão voltar a interagir e realizar solicitações conforme as regras de privacidade."}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmModalType(null)}
                  disabled={blockLoading}
                  className="border-white/10 text-zinc-300 hover:bg-white/5 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleConfirmBlockAction()}
                  disabled={blockLoading}
                  className={
                    confirmModalType === "block"
                      ? "bg-red-600 text-white hover:bg-red-500 text-xs font-semibold"
                      : "bg-violet-600 text-white hover:bg-violet-500 text-xs font-semibold"
                  }
                >
                  {blockLoading
                    ? "Processando..."
                    : confirmModalType === "block"
                      ? "Sim, bloquear"
                      : "Sim, desbloquear"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function PublicCommentCard({
  comment,
  onLike,
}: {
  comment: PublicComment;
  onLike: () => void;
}) {
  const avatarLetter =
    comment.userName?.charAt(0).toUpperCase() || "U";

  const dateObj = new Date(comment.createdAt);
  const fullDate = Number.isNaN(dateObj.getTime())
    ? ""
    : dateObj.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  const relativeDate = (() => {
    if (Number.isNaN(dateObj.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Agora mesmo";
    if (diffMin < 60) return `Há ${diffMin} ${diffMin === 1 ? "minuto" : "minutos"}`;
    if (diffHour < 24) return `Há ${diffHour} ${diffHour === 1 ? "hora" : "horas"}`;
    if (diffDay === 1) return "Ontem";
    if (diffDay < 30) return `Há ${diffDay} ${diffDay === 1 ? "dia" : "dias"}`;
    return dateObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  })();

  const epNum =
    comment.episodeId.match(/ep-(?:\d+-)?(\d+)$/i)?.[1] ||
    comment.episodeId.match(/(\d+)$/)?.[1] ||
    "1";

  const hasAnimeInfo = Boolean(
    comment.animeTitle && comment.animeTitle !== "Anime indisponível",
  );

  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5 transition-all hover:border-violet-500/30">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#15284b] text-sm font-semibold text-white">
          {comment.userImage ? (
            <img
              src={comment.userImage}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            avatarLetter
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">
              {comment.userName || "Usuário"}
            </span>

            <span
              className="text-xs text-[#aab5c9] cursor-default"
              title={fullDate}
            >
              {relativeDate}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {comment.animeCover && (
              <img
                src={comment.animeCover}
                alt=""
                className="size-5 rounded object-cover"
              />
            )}

            {hasAnimeInfo ? (
              <Link
                to="/anime/$id"
                params={{ id: comment.animeId }}
                className="text-xs font-semibold text-zinc-200 hover:text-violet-300 transition-colors"
                title={comment.animeTitle}
              >
                {comment.animeTitle}
              </Link>
            ) : (
              <span className="text-xs text-zinc-500 italic">
                Conteúdo arquivado ou indisponível
              </span>
            )}

            <span className="text-zinc-600">•</span>

            <Link
              to="/watch/$id/$ep"
              params={{
                id: comment.animeId,
                ep: `ep-${epNum}`,
              }}
              search={{
                comment: comment.id,
              }}
              className="inline-flex text-xs font-medium text-violet-300 transition hover:text-white"
            >
              Episódio {epNum}
            </Link>

            {comment.parentId && (
              <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
                Resposta
              </span>
            )}
          </div>
        </div>
      </div>

      {comment.isSpoiler ? (
        <details className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-yellow-200">
            ⚠️ Mostrar spoiler
          </summary>

          <p className="border-t border-yellow-500/10 px-4 py-3 text-sm leading-6 text-[#d0d9ea]">
            {comment.content}
          </p>
        </details>
      ) : (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#d0d9ea]">
          {comment.content}
        </p>
      )}

      <div className="mt-4 flex items-center gap-5 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={onLike}
          className={
            comment.liked
              ? "inline-flex items-center gap-2 text-sm text-violet-300 transition hover:text-violet-200"
              : "inline-flex items-center gap-2 text-sm text-[#aab5c9] transition hover:text-white"
          }
        >
          <Heart
            className="size-4"
            fill={comment.liked ? "currentColor" : "none"}
          />
          {comment.likes}
        </button>

        <Link
          to="/watch/$id/$ep"
          params={{
            id: comment.animeId,
            ep: `ep-${epNum}`,
          }}
          search={{
            comment: comment.id,
          }}
          className="inline-flex items-center gap-2 text-sm text-[#aab5c9] transition hover:text-white"
        >
          <MessageCircle className="size-4" />
          Ver no episódio
        </Link>
      </div>
    </article>
  );
}

function CommentSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-full bg-white/10" />

        <div className="flex-1">
          <div className="h-4 w-32 animate-pulse rounded bg-white/10" />

          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-white/10" />
        </div>
      </div>

      <div className="mt-5 h-4 w-full animate-pulse rounded bg-white/10" />

      <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-white/10" />
    </div>
  );
}

function PublicStat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-h-[100px] flex-col items-center justify-center border-b border-white/10 px-3 py-4 text-center sm:border-b-0 sm:border-r last:border-r-0">
      <div className="text-[#b2bfff] [&>svg]:size-5">
        {icon}
      </div>

      <strong className="mt-2 text-xl font-semibold">
        {value}
      </strong>

      <span className="mt-1 text-xs text-[#aab5c9]">
        {label}
      </span>
    </div>
  );
              }
