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
  Heart,
  MessageCircle,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  getPublicComments,
  getPublicProfile,
} from "@/lib/profile.functions";

export const Route =
  createFileRoute(
    "/profile/$nick",
  )({
    component: PublicProfile,
  });

type PublicComment = Awaited<
  ReturnType<
    typeof getPublicComments
  >
>[number];

function PublicProfile() {
  const { nick } =
    Route.useParams();

  const getPublicProfileFn =
    useServerFn(
      getPublicProfile,
    );

  const getPublicCommentsFn =
    useServerFn(
      getPublicComments,
    );

  const [profile, setProfile] =
    useState<
      Awaited<
        ReturnType<
          typeof getPublicProfileFn
        >
      > | null
    >(null);

  const [comments, setComments] =
    useState<PublicComment[]>([]);

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

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setCommentsError("");
    setComments([]);

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

        setFollowing(
          result.isFollowing,
        );

        setFollowersCount(
          result.followersCount,
        );

        setCommentsLoading(true);

        try {
          const publicComments =
            await getPublicCommentsFn({
              data: {
                userId: result.userId,
              },
            });

          if (!active) {
            return;
          }

          setComments(
            publicComments,
          );
        } catch {
          if (!active) {
            return;
          }

          setComments([]);

          setCommentsError(
            "Não foi possível carregar os comentários.",
          );
        } finally {
          if (active) {
            setCommentsLoading(false);
          }
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

  async function toggleFollow() {
    if (!profile) {
      return;
    }

    if (followLoading) {
      return;
    }

    setFollowLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/profile/follow",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              targetUserId:
                profile.userId,
            }),
          },
        );

      const result =
        (await response.json()) as {
          following?: boolean;
          followersCount?: number;
          followingCount?: number;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Não foi possível alterar o seguimento.",
        );
      }

      const newFollowing =
        Boolean(
          result.following,
        );

      const newFollowersCount =
        Number(
          result.followersCount ??
            0,
        );

      setFollowing(
        newFollowing,
      );

      setFollowersCount(
        newFollowersCount,
      );

      setProfile(
        (current) =>
          current
            ? {
                ...current,

                isFollowing:
                  newFollowing,

                followersCount:
                  newFollowersCount,
              }
            : current,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar o seguimento.",
      );
    } finally {
      setFollowLoading(
        false,
      );
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
    <main className="min-h-screen bg-[#030817] px-3 pb-24 pt-5 text-white sm:px-5 lg:px-8">

      <div className="mx-auto max-w-5xl">

        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-[#9fb2d4] transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl border border-[#1c3c70] bg-[#061329] shadow-[0_0_50px_rgba(38,70,180,0.12)]">

          <div className="relative h-48 overflow-hidden sm:h-64">

            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 120%, rgba(88,54,255,0.95) 0%, rgba(39,48,145,0.75) 35%, rgba(6,19,41,0.3) 70%), linear-gradient(135deg, #152f72 0%, #4025a3 45%, #741bc7 100%)",
              }}
            />

            <div className="absolute -left-20 top-10 size-[260px] rounded-full bg-blue-500/20 blur-3xl" />

            <div className="absolute right-0 top-0 size-[300px] rounded-full bg-purple-500/20 blur-3xl" />

            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#061329]" />

          </div>

          <div className="relative px-5 pb-7 sm:px-8">

            <div className="-mt-14 sm:-mt-16">

              <div className="grid size-28 place-items-center rounded-full border-[5px] border-[#061329] bg-[#15284b] text-5xl font-semibold shadow-xl sm:size-32">
                {avatarLetter}
              </div>

            </div>

            <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <h1 className="text-3xl font-semibold sm:text-4xl">
                    {profile.nick}
                  </h1>

                  <BadgeCheck className="size-6 fill-violet-500 text-white" />

                </div>

                <p className="mt-1 text-base text-[#9fb2d4]">
                  @{profile.nick}
                </p>

                {profile.bio && (
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c4d1e8]">
                    {profile.bio}
                  </p>
                )}

              </div>

              <Button
                type="button"
                onClick={() =>
                  void toggleFollow()
                }
                disabled={
                  followLoading
                }
                className={
                  following
                    ? "border border-[#365b91] bg-[#102343] text-white hover:bg-[#163055]"
                    : "bg-violet-600 text-white hover:bg-violet-500"
                }
              >

                {following ? (
                  <>
                    <UserCheck className="size-4" />

                    {followLoading
                      ? "Atualizando..."
                      : "Seguindo"}
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4" />

                    {followLoading
                      ? "Atualizando..."
                      : "Seguir"}
                  </>
                )}

              </Button>

            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-2xl border border-[#1b3762] bg-[#07152b] sm:grid-cols-4">

              <PublicStat
                icon={<MessageCircle />}
                value={String(
                  profile.commentCount,
                )}
                label="Comentários"
              />

              <PublicStat
                icon={<Heart />}
                value="0"
                label="Curtidas"
              />

              <PublicStat
                icon={<Users />}
                value={String(
                  followersCount,
                )}
                label="Seguidores"
              />

              <PublicStat
                icon={<UserPlus />}
                value={String(
                  profile.followingCount,
                )}
                label="Seguindo"
              />

            </div>

          </div>
        </section>

        <section className="mt-6">

          <div className="mb-4 flex items-center gap-2">

            <MessageCircle className="size-5 text-[#91a8ff]" />

            <h2 className="text-xl font-semibold">
              Comentários de{" "}
              {profile.nick}
            </h2>

          </div>

          {commentsError && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {commentsError}
            </div>
          )}

          {commentsLoading ? (
            <div className="space-y-3">

              <CommentSkeleton />

              <CommentSkeleton />

            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-2xl border border-[#1b3762] bg-[#061329] px-5 py-10 text-center">

              <MessageCircle className="mx-auto size-9 text-[#526b99]" />

              <p className="mt-3 text-sm text-[#8197ba]">
                Esse usuário ainda não fez comentários.
              </p>

            </div>
          ) : (
            <div className="space-y-3">

              {comments.map(
                (comment) => (
                  <PublicCommentCard
                    key={comment.id}
                    comment={comment}
                    onLike={() =>
                      void toggleCommentLike(
                        comment.id,
                      )
                    }
                  />
                ),
              )}

            </div>
          )}

        </section>

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
    comment.userName
      ?.charAt(0)
      .toUpperCase() || "U";

  const createdAt =
    new Date(
      comment.createdAt,
    ).toLocaleDateString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    );

  return (
    <article className="rounded-2xl border border-[#1b3762] bg-[#061329] p-4 sm:p-5">

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
              {comment.userName ||
                "Usuário"}
            </span>

            <span className="text-xs text-[#7186aa]">
              {createdAt}
            </span>

          </div>

          <Link
            to="/watch/$id"
            params={{
              id: comment.animeId,
            }}
            search={{
              ep: comment.episodeId,
            }}
            className="mt-1 inline-flex text-xs text-[#91a8ff] transition hover:text-white"
          >
            Episódio{" "}
            {comment.episodeId}
          </Link>

        </div>

      </div>

      {comment.isSpoiler ? (
        <details className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">

          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-yellow-200">
            ⚠️ Mostrar spoiler
          </summary>

          <p className="border-t border-yellow-500/10 px-4 py-3 text-sm leading-6 text-[#c4d1e8]">
            {comment.content}
          </p>

        </details>
      ) : (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#c4d1e8]">
          {comment.content}
        </p>
      )}

      <div className="mt-4 flex items-center gap-5 border-t border-[#142b4d] pt-3">

        <button
          type="button"
          onClick={onLike}
          className={
            comment.liked
              ? "inline-flex items-center gap-2 text-sm text-violet-300 transition hover:text-violet-200"
              : "inline-flex items-center gap-2 text-sm text-[#8197ba] transition hover:text-white"
          }
        >

          <Heart
            className="size-4"
            fill={
              comment.liked
                ? "currentColor"
                : "none"
            }
          />

          {comment.likes}

        </button>

        <Link
          to="/watch/$id"
          params={{
            id: comment.animeId,
          }}
          search={{
            ep: comment.episodeId,
          }}
          className="inline-flex items-center gap-2 text-sm text-[#8197ba] transition hover:text-white"
        >
          <MessageCircle className="size-4" />
          Comentário
        </Link>

      </div>

    </article>
  );
}

function CommentSkeleton() {
  return (
    <div className="rounded-2xl border border-[#1b3762] bg-[#061329] p-5">

      <div className="flex items-center gap-3">

        <div className="size-10 animate-pulse rounded-full bg-[#102343]" />

        <div className="flex-1">

          <div className="h-4 w-32 animate-pulse rounded bg-[#102343]" />

          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-[#102343]" />

        </div>

      </div>

      <div className="mt-5 h-4 w-full animate-pulse rounded bg-[#102343]" />

      <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-[#102343]" />

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
    <div className="flex min-h-[100px] flex-col items-center justify-center border-b border-[#1b3762] px-3 py-4 text-center sm:border-b-0 sm:border-r last:border-r-0">

      <div className="text-[#91a8ff] [&>svg]:size-5">
        {icon}
      </div>

      <strong className="mt-2 text-xl font-semibold">
        {value}
      </strong>

      <span className="mt-1 text-xs text-[#7186aa]">
        {label}
      </span>

    </div>
  );
      }
