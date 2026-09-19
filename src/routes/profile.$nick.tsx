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
  ReturnType<typeof getPublicComments>
>[number];

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

  const [
    profileBgColor,
    setProfileBgColor,
  ] = useState("#030817");

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setCommentsError("");
    setComments([]);
    setProfileBgColor("#030817");

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

        if (result.image) {
          const color =
            await getProfileBackgroundColor(
              result.image,
            );

          if (
            active &&
            color
          ) {
            setProfileBgColor(color);
          }
        }

        setCommentsLoading(true);

        try {
          const publicComments =
            await getPublicCommentsFn({
              data: {
                userId:
                  result.userId,
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
      setFollowLoading(false);
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
      className="min-h-screen px-3 pb-24 pt-5 text-white transition-colors duration-700 sm:px-5 lg:px-8"
      style={{
        backgroundColor:
          profileBgColor,
      }}
    >
      <div className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-[#d0d9ea] transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black/20 shadow-[0_0_50px_rgba(0,0,0,0.18)]">
          <div className="relative px-5 pb-7 pt-7 sm:px-8 sm:pt-8">
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

            <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-black/15 sm:grid-cols-4">
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
            <MessageCircle className="size-5 text-[#b2bfff]" />

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
            <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-10 text-center">
              <MessageCircle className="mx-auto size-9 text-[#8190ad]" />

              <p className="mt-3 text-sm text-[#b5c0d5]">
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
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
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

            <span className="text-xs text-[#aab5c9]">
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
            className="mt-1 inline-flex text-xs text-[#b2bfff] transition hover:text-white"
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
          className="inline-flex items-center gap-2 text-sm text-[#aab5c9] transition hover:text-white"
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
