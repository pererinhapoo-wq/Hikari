import { createFileRoute } from "@tanstack/react-router";
import {
  Bug,
  Filter,
  Film,
  Lightbulb,
  Loader2,
  MessageSquare,
  Tv,
  X,
  Eye,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listAdminFeedbacks, updateFeedbackStatus, type FeedbackItem } from "@/lib/feedback.functions";
import { StudioPageHeader, StudioPanel, StudioStatStrip } from "@/components/admin/studio-ui";

export const Route = createFileRoute("/admin/feedback")({
  component: AdminFeedbackPage,
});

const CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  suggestion: { label: "Sugestão", icon: Lightbulb, color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  bug: { label: "Bug", icon: Bug, color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  anime_request: { label: "Pedido de Anime", icon: Film, color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  episode_issue: { label: "Problema Episódio", icon: Tv, color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  in_review: { label: "Em Análise", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  resolved: { label: "Resolvido", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  archived: { label: "Arquivado", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdminFeedbacks({
        data: {
          category: categoryFilter,
          status: statusFilter,
          limit: 100,
          offset: 0,
        },
      });
      setFeedbacks(data);
    } catch {
      toast.error("Erro ao carregar feedbacks do servidor.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => {
    void loadFeedbacks();
  }, [loadFeedbacks]);

  const handleStatusChange = async (id: number, nextStatus: FeedbackItem["status"]) => {
    setUpdatingId(id);
    try {
      await updateFeedbackStatus({
        data: { id, status: nextStatus },
      });
      setFeedbacks((prev: FeedbackItem[]) =>
        prev.map((f: FeedbackItem) => (f.id === id ? { ...f, status: nextStatus } : f)),
      );
      if (selectedFeedback?.id === id) {
        setSelectedFeedback((prev: FeedbackItem | null) => (prev ? { ...prev, status: nextStatus } : null));
      }
      toast.success("Status atualizado com sucesso!");
    } catch {
      toast.error("Erro ao atualizar status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const totalCount = feedbacks.length;
  const pendingCount = feedbacks.filter((f: FeedbackItem) => f.status === "pending").length;
  const inReviewCount = feedbacks.filter((f: FeedbackItem) => f.status === "in_review").length;
  const resolvedCount = feedbacks.filter((f: FeedbackItem) => f.status === "resolved").length;

  return (
    <div className="space-y-6">
      <StudioPageHeader
        kicker="Comunidade & Atendimento"
        title="Gerenciamento de Feedback"
        description="Visualize e gerencie sugestões, bugs, pedidos de animes e problemas em episódios enviados pelos usuários."
        backTo="/admin"
        backLabel="Voltar ao Painel"
      />

      <StudioStatStrip
        columns={4}
        items={[
          { label: "Total", value: totalCount.toLocaleString("pt-BR") },
          { label: "Pendentes", value: pendingCount.toLocaleString("pt-BR") },
          { label: "Em Análise", value: inReviewCount.toLocaleString("pt-BR") },
          { label: "Resolvidos", value: resolvedCount.toLocaleString("pt-BR") },
        ]}
      />

      <StudioPanel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-purple-400" />
              <span className="text-xs font-bold text-zinc-300 uppercase">Categoria:</span>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-purple-500/25 bg-black/50 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todas as Categorias</option>
              <option value="suggestion">Sugestão</option>
              <option value="bug">Bug</option>
              <option value="anime_request">Pedido de Anime</option>
              <option value="episode_issue">Problema em Episódio</option>
            </select>

            <div className="flex items-center gap-2 ml-0 sm:ml-4">
              <span className="text-xs font-bold text-zinc-300 uppercase">Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-purple-500/25 bg-black/50 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendente</option>
              <option value="in_review">Em Análise</option>
              <option value="resolved">Resolvido</option>
              <option value="archived">Arquivado</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void loadFeedbacks()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/15 px-3.5 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-500/25 transition-colors cursor-pointer"
          >
            Atualizar Lista
          </button>
        </div>
      </StudioPanel>

      <StudioPanel>
        {loading ? (
          <div className="flex min-h-60 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-purple-400" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center text-center">
            <MessageSquare className="size-10 text-zinc-600 mb-3" />
            <p className="text-sm font-bold text-white">Nenhum feedback encontrado</p>
            <p className="text-xs text-zinc-400 mt-1">Os envios dos usuários aparecerão aqui.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {feedbacks.map((f: FeedbackItem) => {
              const catMeta = CATEGORY_LABELS[f.category] || { label: f.category, icon: MessageSquare, color: "bg-zinc-500/15 text-zinc-300" };
              const statMeta = STATUS_LABELS[f.status] || { label: f.status, color: "bg-zinc-500/15 text-zinc-300" };
              const Icon = catMeta.icon;

              return (
                <div key={f.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", catMeta.color)}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase", catMeta.color)}>
                          {catMeta.label}
                        </span>
                        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase", statMeta.color)}>
                          {statMeta.label}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          #{f.id} • {new Date(f.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white truncate">{f.title}</h3>
                      <p className="text-xs text-zinc-400 line-clamp-1">{f.description}</p>
                      {f.animeName && (
                        <p className="text-xs font-medium text-purple-300">
                          Anime: {f.animeName} {f.episodeNumber ? `• Ep. ${f.episodeNumber}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <select
                      value={f.status}
                      disabled={updatingId === f.id}
                      onChange={(e) => handleStatusChange(f.id, e.target.value as FeedbackItem["status"])}
                      className="rounded-lg border border-purple-500/25 bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="pending">Pendente</option>
                      <option value="in_review">Em Análise</option>
                      <option value="resolved">Resolvido</option>
                      <option value="archived">Arquivado</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setSelectedFeedback(f)}
                      className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1] hover:text-white transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </StudioPanel>

      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-purple-500/30 bg-[#0d0b18] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Detalhes do Feedback #{selectedFeedback.id}</h3>
                  <p className="text-xs text-zinc-400">
                    Enviado em {new Date(selectedFeedback.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="my-6 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">Categoria</span>
                  <p className="mt-0.5 text-sm font-semibold text-white">
                    {CATEGORY_LABELS[selectedFeedback.category]?.label || selectedFeedback.category}
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">Status</span>
                  <p className="mt-0.5 text-sm font-semibold text-white">
                    {STATUS_LABELS[selectedFeedback.status]?.label || selectedFeedback.status}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Usuário Remetente</span>
                <p className="mt-0.5 text-sm font-medium text-white">
                  {selectedFeedback.userEmail ? `${selectedFeedback.userName || "Usuário"} (${selectedFeedback.userEmail})` : "Visitante Anônimo"}
                </p>
              </div>

              {selectedFeedback.animeName && (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">Anime / Episódio</span>
                  <p className="mt-0.5 text-sm font-medium text-white">
                    {selectedFeedback.animeName} {selectedFeedback.episodeNumber ? `— Episódio ${selectedFeedback.episodeNumber}` : ""}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Título</span>
                <h4 className="text-base font-bold text-white">{selectedFeedback.title}</h4>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Descrição Detalhada</span>
                <div className="rounded-xl border border-purple-500/20 bg-black/40 p-4 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {selectedFeedback.description}
                </div>
              </div>

              {selectedFeedback.referenceLink && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">Link de Referência</span>
                  <a
                    href={selectedFeedback.referenceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 underline underline-offset-4"
                  >
                    <span>{selectedFeedback.referenceLink}</span>
                  </a>
                </div>
              )}

              {selectedFeedback.pageUrl && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">Página de Ocorrência</span>
                  <p className="text-xs text-zinc-300">{selectedFeedback.pageUrl}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
