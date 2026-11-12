import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Check,
  Clock,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { FollowRequestItem, ProfileUser } from "@/lib/profile.functions";
import { useScrollLock } from "@/lib/scroll-lock";

interface ProfileConnectionsModalProps {
  isOpen: boolean;
  initialTab?: "followers" | "following" | "requests";
  activeTab: "followers" | "following" | "requests";
  onTabChange: (tab: "followers" | "following" | "requests") => void;
  followers: ProfileUser[];
  following: ProfileUser[];
  requests?: FollowRequestItem[];
  followersCount: number;
  followingCount: number;
  requestsCount?: number;
  loading: boolean;
  onClose: () => void;
  onAcceptRequest?: (requesterId: string) => Promise<void>;
  onRejectRequest?: (requesterId: string) => Promise<void>;
  onFollowBack?: (userId: string) => Promise<void>;
  onRemoveFollower?: (followerId: string) => Promise<void>;
  currentUserId?: string | null;
  profileOwnerId?: string | null;
}

export function ProfileConnectionsModal({
  isOpen,
  activeTab,
  onTabChange,
  followers,
  following,
  requests = [],
  followersCount,
  followingCount,
  requestsCount = 0,
  loading,
  onClose,
  onAcceptRequest,
  onRejectRequest,
  onFollowBack,
  onRemoveFollower,
  currentUserId,
  profileOwnerId,
}: ProfileConnectionsModalProps) {
  useScrollLock(isOpen);
  const [followingActionId, setFollowingActionId] = useState<string | null>(null);
  const [removingFollowerId, setRemovingFollowerId] = useState<string | null>(null);

  if (!isOpen) return null;

  const isViewerTheProfileOwner = Boolean(
    currentUserId && profileOwnerId && currentUserId === profileOwnerId,
  );

  const handleFollowBack = async (userId: string) => {
    if (!onFollowBack || followingActionId) return;
    setFollowingActionId(userId);
    try {
      await onFollowBack(userId);
    } finally {
      setFollowingActionId(null);
    }
  };

  const handleRemoveFollower = async (followerId: string) => {
    if (!onRemoveFollower || removingFollowerId || !isViewerTheProfileOwner) return;
    setRemovingFollowerId(followerId);
    try {
      await onRemoveFollower(followerId);
    } finally {
      setRemovingFollowerId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0c18] p-5 sm:p-6 shadow-2xl">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-violet-400" />
            <h2 className="font-display text-base sm:text-lg font-bold text-white">
              Conexões da Comunidade
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar janela"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Abas Seguidores vs Seguindo vs Solicitações */}
        <div className={`mt-4 grid ${requestsCount > 0 || activeTab === "requests" ? "grid-cols-3" : "grid-cols-2"} gap-2 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]`}>
          <button
            type="button"
            onClick={() => onTabChange("followers")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "followers"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Seguidores</span>
            <span className="rounded-full bg-white/15 px-1.5 py-0.2 text-[10px] tabular-nums">
              {followersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange("following")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "following"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Seguindo</span>
            <span className="rounded-full bg-white/15 px-1.5 py-0.2 text-[10px] tabular-nums">
              {followingCount}
            </span>
          </button>

          {(requestsCount > 0 || activeTab === "requests") && (
            <button
              type="button"
              onClick={() => onTabChange("requests")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "requests"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-amber-400 hover:text-amber-300"
              }`}
            >
              <span>Solicitações</span>
              <span className="rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.2 text-[10px] tabular-nums font-bold">
                {requestsCount}
              </span>
            </button>
          )}
        </div>

        {/* Lista de Membros / Solicitações com Rolagem interna preservada */}
        <div className="mt-4 min-h-[220px] flex-1 overflow-y-auto no-scrollbar space-y-2.5 pr-1">
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-16 animate-pulse rounded-2xl bg-white/[0.04]"
                />
              ))}
            </div>
          ) : activeTab === "requests" ? (
            requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Clock className="size-8 text-zinc-600 mb-2" />
                <p className="text-sm font-semibold text-zinc-300">
                  Nenhuma solicitação pendente
                </p>
                <p className="mt-1 max-w-xs text-xs text-zinc-500">
                  Quando outros usuários solicitarem seguir sua conta privada, você poderá aceitar ou recusar aqui.
                </p>
              </div>
            ) : (
              requests.map((req) => {
                const avatarLetter = (req.nick || req.name || "U")
                  .charAt(0)
                  .toUpperCase();

                return (
                  <div
                    key={req.requesterId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-violet-500/30 hover:bg-white/[0.04]"
                  >
                    <Link
                      to="/profile/$nick"
                      params={{ nick: req.nick }}
                      onClick={onClose}
                      className="flex items-center gap-3 min-w-0 flex-1 group"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#161424] font-semibold text-sm text-violet-300 ring-1 ring-white/10">
                        {req.image ? (
                          <img
                            src={req.image}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-full object-cover"
                          />
                        ) : (
                          <span>{avatarLetter}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs sm:text-sm font-semibold text-zinc-100 transition-colors group-hover:text-violet-300">
                          {req.name || req.nick}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          @{req.nick}
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onAcceptRequest && (
                        <button
                          type="button"
                          onClick={() => void onAcceptRequest(req.requesterId)}
                          className="flex size-8 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 shadow-sm cursor-pointer"
                          title="Aceitar solicitação"
                        >
                          <Check className="size-4" />
                        </button>
                      )}

                      {onRejectRequest && (
                        <button
                          type="button"
                          onClick={() => void onRejectRequest(req.requesterId)}
                          className="flex size-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 cursor-pointer"
                          title="Recusar solicitação"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (activeTab === "followers" ? followers : following).length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Users className="size-8 text-zinc-600 mb-2" />
              <p className="text-sm font-semibold text-zinc-300">
                {activeTab === "followers"
                  ? "Nenhum seguidor ainda"
                  : "Você ainda não segue nenhum membro"}
              </p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500">
                {activeTab === "followers"
                  ? "Quando outros membros seguirem seu perfil, eles aparecerão aqui."
                  : "Explore comentários e perfis na comunidade para seguir outros fãs."}
              </p>
            </div>
          ) : (
            (activeTab === "followers" ? followers : following).map((person) => {
              const avatarLetter = (person.nick || person.name || "U")
                .charAt(0)
                .toUpperCase();

              return (
                <div
                  key={person.userId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-violet-500/30 hover:bg-white/[0.04]"
                >
                  <Link
                    to="/profile/$nick"
                    params={{ nick: person.nick }}
                    onClick={onClose}
                    className="flex items-center gap-3 min-w-0 flex-1 group"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#161424] font-semibold text-sm text-violet-300 ring-1 ring-white/10">
                      {person.image ? (
                        <img
                          src={person.image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      ) : (
                        <span>{avatarLetter}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs sm:text-sm font-semibold text-zinc-100 transition-colors group-hover:text-violet-300">
                          {person.name || person.nick}
                        </p>
                        {person.isVerified && (
                          <BadgeCheck className="size-3.5 text-violet-400 shrink-0 fill-violet-500/20" />
                        )}
                      </div>
                      <p className="truncate text-[11px] text-zinc-500">
                        @{person.nick}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Relacionamento: Seguindo / Solicitado / Seguir de volta / Seguir */}
                    {(() => {
                      // 1. Não mostrar botão de seguir para a própria conta
                      if (currentUserId && person.userId === currentUserId) {
                        return null;
                      }

                      // 2. Não exibir ação de seguir se houver bloqueio ativo
                      if (person.isBlocked) {
                        return null;
                      }

                      // 3. Mostrar "Seguindo" quando o visitante já segue a pessoa exibida
                      if (person.isFollowing) {
                        return (
                          <span className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                            Seguindo
                          </span>
                        );
                      }

                      // 4. Mostrar "Solicitado" quando já existe solicitação pendente (perfil privado)
                      if (person.hasPendingRequest) {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                            <Clock className="size-3" />
                            <span>Solicitado</span>
                          </span>
                        );
                      }

                      if (!currentUserId || !onFollowBack) {
                        return null;
                      }

                      // 5. Determinar se a pessoa listada já segue o visitante
                      const personFollowsViewer =
                        (isViewerTheProfileOwner && activeTab === "followers") ||
                        Boolean(person.followsViewer);

                      if (personFollowsViewer) {
                        return (
                          <button
                            type="button"
                            disabled={followingActionId === person.userId}
                            onClick={() => void handleFollowBack(person.userId)}
                            className="flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-600/20 px-3 py-1.5 text-[11px] font-semibold text-violet-300 transition-all hover:bg-violet-600 hover:text-white disabled:opacity-50 cursor-pointer shadow-sm"
                            title="Seguir este membro de volta"
                          >
                            <UserPlus className="size-3.5" />
                            <span>
                              {followingActionId === person.userId
                                ? "Seguindo..."
                                : "Seguir de volta"}
                            </span>
                          </button>
                        );
                      }

                      // Ao visitar o perfil de outra pessoa, mostrar "Seguir" quando a pessoa listada não segue o visitante
                      if (!isViewerTheProfileOwner) {
                        return (
                          <button
                            type="button"
                            disabled={followingActionId === person.userId}
                            onClick={() => void handleFollowBack(person.userId)}
                            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-violet-500 disabled:opacity-50 cursor-pointer shadow-sm"
                            title="Seguir este membro"
                          >
                            <UserPlus className="size-3.5" />
                            <span>
                              {followingActionId === person.userId
                                ? "Seguindo..."
                                : "Seguir"}
                            </span>
                          </button>
                        );
                      }

                      return null;
                    })()}

                    {/* Botão "X" exclusivo do dono do perfil para remover seguidor */}
                    {activeTab === "followers" &&
                      isViewerTheProfileOwner &&
                      Boolean(onRemoveFollower) &&
                      !(currentUserId && person.userId === currentUserId) && (
                        <button
                          type="button"
                          disabled={removingFollowerId === person.userId}
                          onClick={() => void handleRemoveFollower(person.userId)}
                          className="flex size-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 disabled:opacity-50 cursor-pointer"
                          title="Remover seguidor"
                          aria-label={`Remover seguidor ${person.name || person.nick}`}
                        >
                          <X className="size-4" />
                        </button>
                      )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
