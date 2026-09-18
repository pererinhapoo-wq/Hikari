import { useEffect, useState } from "react";

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
  getPublicProfile,
} from "@/lib/profile.functions";

export const Route =
  createFileRoute(
    "/profile/$nick",
  )({
    component:
      PublicProfile,
  });

function PublicProfile() {
  const { nick } =
    Route.useParams();

  const getPublicProfileFn =
    useServerFn(
      getPublicProfile,
    );

  const [profile, setProfile] =
    useState<
      Awaited<
        ReturnType<
          typeof getPublicProfileFn
        >
      > | null
    >(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

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

    void getPublicProfileFn({
      data: {
        nick,
      },
    })
      .then((result) => {
        if (!active) return;

        setProfile(result);

        setFollowing(
          result.isFollowing,
        );

        setFollowersCount(
          result.followersCount,
        );
      })
      .catch((err) => {
        if (!active) return;

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

      setFollowing(
        Boolean(
          result.following,
        ),
      );

      setFollowersCount(
        Number(
          result.followersCount ??
            0,
        ),
      );

      setProfile(
        (current) =>
          current
            ? {
                ...current,

                isFollowing:
                  Boolean(
                    result.following,
                  ),

                followersCount:
                  Number(
                    result.followersCount ??
                      0,
                  ),
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

        {/* VOLTAR */}

        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-[#9fb2d4] transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>

        {/* PERFIL */}

        <section className="mt-5 overflow-hidden rounded-3xl border border-[#1c3c70] bg-[#061329] shadow-[0_0_50px_rgba(38,70,180,0.12)]">

          {/* CAPA */}

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

          {/* DADOS */}

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

              {/* BOTÃO SEGUIR */}

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

            {/* ESTATÍSTICAS */}

            <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-2xl border border-[#1b3762] bg-[#07152b] sm:grid-cols-4">

              <PublicStat
                icon={
                  <MessageCircle />
                }
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
                icon={
                  <UserPlus />
                }
                value={String(
                  profile.followingCount,
                )}
                label="Seguindo"
              />

            </div>

          </div>
        </section>
      </div>
    </main>
  );
}

function PublicStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
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
