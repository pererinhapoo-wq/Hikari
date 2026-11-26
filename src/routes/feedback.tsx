import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  Film,
  Lightbulb,
  Loader2,
  MessageSquare,
  Send,
  Tv,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { submitFeedback, type SubmitFeedbackInput } from "@/lib/feedback.functions";

export const Route = createFileRoute("/feedback")({
  component: FeedbackPage,
});

const CATEGORIES = [
  {
    id: "suggestion" as const,
    title: "Sugestão",
    description: "Ideias para melhorar o site, novas funcionalidades ou melhorias na interface.",
    icon: Lightbulb,
    badgeColor: "from-amber-500/20 to-amber-900/10 border-amber-500/30 text-amber-300",
  },
  {
    id: "bug" as const,
    title: "Bug",
    description: "Problemas, erros inesperados ou funcionalidades que não estão funcionando corretamente.",
    icon: Bug,
    badgeColor: "from-rose-500/20 to-rose-900/10 border-rose-500/30 text-rose-300",
  },
  {
    id: "anime_request" as const,
    title: "Pedido de Anime",
    description: "Solicitar a inclusão de um novo anime ou temporada ausente no catálogo.",
    icon: Film,
    badgeColor: "from-purple-500/20 to-purple-900/10 border-purple-500/30 text-purple-300",
  },
  {
    id: "episode_issue" as const,
    title: "Problema em Episódio",
    description: "Informar episódio com vídeo indisponível, link quebrado ou erro de reprodução.",
    icon: Tv,
    badgeColor: "from-cyan-500/20 to-cyan-900/10 border-cyan-500/30 text-cyan-300",
  },
];

function FeedbackPage() {
  const [selectedCategory, setSelectedCategory] = useState<SubmitFeedbackInput["category"] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [animeName, setAnimeName] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState<string>("");
  const [referenceLink, setReferenceLink] = useState("");
  const [pageUrl, setPageUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) {
      setErrorMsg("Selecione uma categoria de feedback.");
      return;
    }
    if (!title.trim()) {
      setErrorMsg("O título é obrigatório.");
      return;
    }
    if (!description.trim()) {
      setErrorMsg("A descrição detalhada é obrigatória.");
      return;
    }

    if (selectedCategory === "anime_request" && !animeName.trim()) {
      setErrorMsg("Informe o nome do anime solicitado.");
      return;
    }

    if (selectedCategory === "episode_issue" && (!animeName.trim() || !episodeNumber)) {
      setErrorMsg("Informe o nome do anime e o número do episódio.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const parsedEp = episodeNumber ? parseInt(episodeNumber, 10) : null;
      const res = await submitFeedback({
        data: {
          category: selectedCategory,
          title: title.trim(),
          description: description.trim(),
          animeName: animeName.trim() || null,
          episodeNumber: Number.isNaN(parsedEp) ? null : parsedEp,
          referenceLink: referenceLink.trim() || null,
          pageUrl: pageUrl.trim() || null,
        },
      });

      if (res?.success) {
        setSuccessId(res.id ?? 1);
        toast.success("Feedback enviado com sucesso! Obrigado por colaborar com o Hikari.");
      } else {
        throw new Error("Não foi possível registrar o feedback.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar feedback.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCategory(null);
    setTitle("");
    setDescription("");
    setAnimeName("");
    setEpisodeNumber("");
    setReferenceLink("");
    setPageUrl("");
    setSuccessId(null);
    setErrorMsg(null);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Cabeçalho */}
      <div className="mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300 uppercase tracking-widest">
          <MessageSquare className="size-3.5" />
          <span>Central de Comunicação</span>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Feedback Hikari
        </h1>
        <p className="max-w-2xl text-sm text-[var(--color-muted)] leading-relaxed">
          Ajude-nos a melhorar a sua experiência. Envie sugestões, reporte bugs, solicite animes ou informe problemas de reprodução.
        </p>
      </div>

      {successId ? (
        /* Estado de Sucesso */
        <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#120f24] to-[#0a0814] p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Feedback Enviado com Sucesso!</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)] max-w-md mx-auto leading-relaxed">
            Sua mensagem foi registrada em nosso sistema (Protocolo #{successId}). Nossa equipe analisará sua solicitação em breve.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/20 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 hover:bg-purple-500/30 transition-colors cursor-pointer"
            >
              Enviar Outro Feedback
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              Voltar ao Início
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. Seleção de Categoria */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold tracking-wide text-zinc-300 uppercase">
              1. Selecione a Categoria
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setErrorMsg(null);
                    }}
                    className={cn(
                      "group relative flex items-start gap-4 rounded-2xl border p-4 text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-purple-400/60 bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent shadow-[0_0_24px_rgba(168,85,247,0.25)] ring-1 ring-purple-400/40"
                        : "border-purple-500/15 bg-white/[0.02] hover:border-purple-500/30 hover:bg-white/[0.05]",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-md transition-colors",
                        isSelected
                          ? "border-purple-400/50 bg-purple-500/30 text-white shadow-purple-500/20"
                          : "border-white/10 bg-white/[0.04] text-purple-300 group-hover:bg-purple-500/20",
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className={cn("text-base font-bold transition-colors", isSelected ? "text-white" : "text-zinc-200")}>
                          {cat.title}
                        </h3>
                        {isSelected && (
                          <span className="inline-flex items-center rounded-full bg-purple-500/25 px-2 py-0.5 text-[10px] font-bold text-purple-200 border border-purple-400/40">
                            Selecionado
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
                        {cat.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Formulário Inteligente */}
          {selectedCategory && (
            <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-purple-500/20 bg-[#0c0a17]/90 p-6 sm:p-8 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Detalhes do {CATEGORIES.find((c) => c.id === selectedCategory)?.title}
                  </h2>
                  <p className="text-xs text-[var(--color-muted)]">
                    Preencha as informações abaixo para que possamos analisar com precisão.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-semibold text-purple-300 hover:text-white underline underline-offset-4"
                >
                  Trocar categoria
                </button>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-300">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Campos específicos por categoria */}
              {(selectedCategory === "anime_request" || selectedCategory === "episode_issue") && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold tracking-wide text-zinc-300 uppercase">
                    Nome do Anime <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={animeName}
                    onChange={(e) => setAnimeName(e.target.value)}
                    placeholder="Ex: Solo Leveling Season 2"
                    maxLength={150}
                    className="w-full rounded-xl border border-purple-500/25 bg-black/40 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
              )}

              {selectedCategory === "episode_issue" && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold tracking-wide text-zinc-300 uppercase">
                    Número do Episódio <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value)}
                    placeholder="Ex: 4"
                    className="w-full rounded-xl border border-purple-500/25 bg-black/40 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
              )}

              {/* Campos Gerais */}
              <div className="space-y-2">
                <label className="block text-xs font-bold tracking-wide text-zinc-300 uppercase">
                  Título <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Resumo direto do seu feedback"
                  maxLength={150}
                  className="w-full rounded-xl border border-purple-500/25 bg-black/40 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold tracking-wide text-zinc-300 uppercase">
                  Descrição Detalhada <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva detalhadamente sua sugestão, o erro ocorrido ou o problema no episódio..."
                  maxLength={2000}
                  className="w-full rounded-xl border border-purple-500/25 bg-black/40 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-y custom-scrollbar"
                />
                <div className="text-right text-[11px] text-zinc-500">
                  {description.length}/2000 caracteres
                </div>
              </div>

              {(selectedCategory === "anime_request" || selectedCategory === "episode_issue" || selectedCategory === "bug") && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold tracking-wide text-zinc-300 uppercase">
                    {selectedCategory === "bug" ? "Página / URL Onde Ocorreu (Opcional)" : "Link de Referência / MyAnimeList (Opcional)"}
                  </label>
                  <input
                    type="url"
                    value={selectedCategory === "bug" ? pageUrl : referenceLink}
                    onChange={(e) => (selectedCategory === "bug" ? setPageUrl(e.target.value) : setReferenceLink(e.target.value))}
                    placeholder="https://..."
                    maxLength={500}
                    className="w-full rounded-xl border border-purple-500/25 bg-black/40 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
              )}

              {/* Botão de Envio */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-600/30 hover:from-purple-500 hover:to-indigo-500 transition-all cursor-pointer",
                    submitting && "opacity-70 cursor-not-allowed",
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      <span>Enviar Feedback</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
