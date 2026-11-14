import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Cpu,
  FileText,
  History,
  Loader2,
  MessageSquareWarning,
  Settings,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { reviewHikariAINews } from "./api-hikari-ai-review";
import { fetchAutomaticNews } from "@/lib/news-api";

export const Route = createFileRoute("/admin/hikari-ai")({
  component: HikariAIPage,
});

function HikariAIPage() {
  const [testing, setTesting] = useState<"gemini" | "groq" | null>(null);
  const [testResult, setTestResult] = useState<{
    approved: boolean;
    isAnime: boolean;
    isGameNews: boolean;
    isDuplicate: boolean;
    label: string;
    animeName: string;
    title: string;
    description: string;
    reason: string;
    provider?: "Gemini" | "Groq" | "Fallback";
  } | null>(null);

  async function handleTestAI(provider: "gemini" | "groq") {
    setTesting(provider);
    setTestResult(null);

    try {
      const news = await fetchAutomaticNews();

      const realNews = news.find(
        (item) =>
          typeof item.sourceUrl === "string" &&
          item.sourceUrl.trim().length > 0,
      );

      if (!realNews) {
        setTestResult({
          approved: false,
          isAnime: false,
          isGameNews: false,
          isDuplicate: false,
          label: "Erro",
          animeName: "",
          title: "",
          description: "",
          reason:
            "Nenhuma notícia externa disponível no momento para testar a Hikari AI.",
          provider: "Fallback",
        });
        return;
      }

      const result = await reviewHikariAINews({
        data: {
          title: realNews.title,
          description: realNews.description,
          source: realNews.source ?? "",
          sourceUrl: realNews.sourceUrl ?? "",
          animeName: "",
          provider,
        },
      });

      setTestResult(result);
    } catch (error) {
      setTestResult({
        approved: false,
        isAnime: false,
        isGameNews: false,
        isDuplicate: false,
        label: "Erro",
        animeName: "",
        title: "",
        description: "",
        reason:
          error instanceof Error
            ? error.message
            : "Não foi possível executar o teste.",
        provider: "Fallback",
      });
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="studio-enter space-y-6 pb-12 pt-2">
      {/* Cabeçalho */}
      <header className="studio-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              to="/admin"
              className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              <ArrowLeft className="size-3.5" />
              Voltar ao painel
            </Link>

            <div className="mt-3 flex items-center gap-3.5">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-purple-500/30 bg-purple-500/15 text-purple-300">
                <Bot className="size-5" />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-300">
                  Inteligência artificial
                </p>

                <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-fg)] sm:text-3xl">
                  Hikari AI
                </h1>
              </div>
            </div>

            <p className="mt-2.5 max-w-2xl text-sm text-[var(--color-muted)]">
              Central de inteligência artificial para revisão de notícias,
              moderação e tarefas administrativas do Hikari.
            </p>
          </div>

          <div className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-300">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            <span>Configurada</span>
          </div>
        </div>
      </header>

      {/* Status & Provedores */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="studio-panel flex flex-col justify-between rounded-2xl p-5 sm:p-6 lg:col-span-5">
          <div className="flex items-start gap-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-purple-500/25 bg-purple-500/12 text-purple-300">
              <Sparkles className="size-5" />
            </div>

            <div>
              <h2 className="font-display text-lg font-semibold text-[var(--color-fg)]">
                Status da Hikari AI
              </h2>

              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
                A estrutura do sistema está pronta e a conexão com o provedor
                pode ser testada abaixo sem publicar ou alterar notícias reais.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-4 text-xs">
            <div className="studio-panel-alt rounded-xl p-3">
              <p className="text-[var(--color-muted)]">Pipeline ativo</p>
              <p className="mt-1 font-medium text-[var(--color-fg)]">
                Revisão Editorial
              </p>
            </div>
            <div className="studio-panel-alt rounded-xl p-3">
              <p className="text-[var(--color-muted)]">Credenciais</p>
              <p className="mt-1 font-medium text-emerald-300">
                Server-side env
              </p>
            </div>
          </div>
        </section>

        <section className="studio-panel rounded-2xl p-5 sm:p-6 lg:col-span-7">
          <div className="flex items-center gap-2.5">
            <Cpu className="size-4 text-purple-400" />
            <h2 className="font-display text-lg font-semibold text-[var(--color-fg)]">
              Provedores da Hikari AI
            </h2>
          </div>

          <p className="mt-1 text-sm text-[var(--color-muted)]">
            O Hikari usa estes provedores na análise automática das notícias.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="studio-panel-alt rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                    Provedor principal
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-[var(--color-fg)]">
                    Gemini
                  </p>
                </div>
                <span className="rounded-md border border-purple-500/30 bg-purple-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-200">
                  Principal
                </span>
              </div>
              <p className="studio-mono mt-3 text-xs text-[var(--color-muted)]">
                Gemini 3.5 Flash Lite
              </p>
            </div>

            <div className="studio-panel-alt rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                    Provedor de reserva
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-[var(--color-fg)]">
                    Groq
                  </p>
                </div>
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Fallback
                </span>
              </div>
              <p className="studio-mono mt-3 text-xs text-[var(--color-muted)]">
                GPT-OSS 120B
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Teste Ao Vivo */}
      <section className="studio-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--color-fg)]">
              Testar Hikari AI
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
              Pega uma notícia externa real do Hikari e envia para a Hikari AI
              analisar. Nenhuma notícia será publicada ou alterada.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              type="button"
              onClick={() => void handleTestAI("gemini")}
              disabled={testing !== null}
              className="h-10 gap-2 bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500"
            >
              {testing === "gemini" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bot className="size-4" />
              )}
              Testar Gemini
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleTestAI("groq")}
              disabled={testing !== null}
              className="h-10 gap-2 border-white/15 bg-[var(--studio-panel-alt)] px-4 text-xs font-medium hover:bg-white/[0.06]"
            >
              {testing === "groq" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bot className="size-4" />
              )}
              Testar Groq
            </Button>
          </div>
        </div>

        {testResult && (
          <div className="studio-panel-alt mt-5 space-y-4 rounded-xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3.5">
              <div className="flex items-center gap-2.5 text-sm font-medium">
                {testResult.approved ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="size-4 shrink-0 text-rose-400" />
                )}
                <span
                  className={
                    testResult.approved ? "text-emerald-200" : "text-rose-200"
                  }
                >
                  {testResult.approved
                    ? "Hikari AI aprovou a notícia"
                    : "Hikari AI não aprovou a notícia"}
                </span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[var(--studio-panel)] px-2.5 py-1 text-xs">
                <span
                  className={
                    testResult.provider === "Fallback"
                      ? "font-bold text-rose-400"
                      : "font-bold text-emerald-400"
                  }
                  aria-hidden="true"
                >
                  {testResult.provider === "Fallback" ? "✕" : "✓"}
                </span>
                <span className="text-[var(--color-muted)]">
                  IA utilizada:{" "}
                  <strong className="text-[var(--color-fg)]">
                    {testResult.provider === "Fallback"
                      ? "Nenhuma (falha)"
                      : testResult.provider}
                  </strong>
                </span>
              </div>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <ResultMetric
                label="Anime identificado"
                value={testResult.animeName || "Nenhum"}
              />
              <ResultMetric label="Classificação" value={testResult.label} />
              <ResultMetric
                label="É notícia de anime?"
                value={testResult.isAnime ? "Sim" : "Não"}
              />
              <ResultMetric
                label="É notícia de jogo?"
                value={testResult.isGameNews ? "Sim" : "Não"}
              />
            </div>

            {testResult.title && (
              <div className="rounded-xl border border-white/[0.06] bg-[var(--studio-panel)] p-3.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                  Título revisado
                </span>
                <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--color-fg)]">
                  {testResult.title}
                </p>
              </div>
            )}

            {testResult.description && (
              <div className="rounded-xl border border-white/[0.06] bg-[var(--studio-panel)] p-3.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                  Descrição revisada
                </span>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
                  {testResult.description}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-white/[0.06] bg-[var(--studio-panel)] p-3.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                Motivo
              </span>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg)]">
                {testResult.reason}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Recursos */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-fg)]">
            Recursos da Hikari AI
          </h2>

          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Estrutura preparada para os recursos de inteligência artificial do
            painel administrativo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="studio-panel rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[var(--studio-panel-alt)] text-purple-300">
                <FileText className="size-5" />
              </div>

              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--color-subtle)]">
                Em breve
              </span>
            </div>

            <h3 className="mt-4 font-display text-lg font-semibold text-[var(--color-fg)]">
              Revisão de notícias
            </h3>

            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
              A IA poderá analisar automaticamente as notícias antes da
              publicação, verificar o conteúdo e identificar informações
              relacionadas a animes.
            </p>

            <ul className="mt-4 space-y-2 text-xs text-[var(--color-muted)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-purple-400" />
                Identificação do anime
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-purple-400" />
                Revisão do título
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-purple-400" />
                Revisão da descrição
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-purple-400" />
                Detecção de conteúdo de jogos
              </li>
            </ul>
          </div>

          <div className="studio-panel rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[var(--studio-panel-alt)] text-purple-300">
                <ShieldCheck className="size-5" />
              </div>

              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--color-subtle)]">
                Em breve
              </span>
            </div>

            <h3 className="mt-4 font-display text-lg font-semibold text-[var(--color-fg)]">
              Moderação inteligente
            </h3>

            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
              A IA poderá auxiliar na análise de comentários, denúncias e
              conteúdos enviados pelos usuários.
            </p>

            <ul className="mt-4 space-y-2 text-xs text-[var(--color-muted)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-purple-400" />
                Análise de denúncias
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-purple-400" />
                Detecção de conteúdo inadequado
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-purple-400" />
                Auxílio aos moderadores
              </li>
            </ul>
          </div>

          <div className="studio-panel rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[var(--studio-panel-alt)] text-purple-300">
                <MessageSquareWarning className="size-5" />
              </div>

              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--color-subtle)]">
                Em breve
              </span>
            </div>

            <h3 className="mt-4 font-display text-lg font-semibold text-[var(--color-fg)]">
              Detecção de duplicatas
            </h3>

            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
              A IA poderá comparar novas notícias com conteúdos existentes para
              evitar publicações repetidas.
            </p>
          </div>

          <div className="studio-panel rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[var(--studio-panel-alt)] text-purple-300">
                <History className="size-5" />
              </div>

              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--color-subtle)]">
                Em breve
              </span>
            </div>

            <h3 className="mt-4 font-display text-lg font-semibold text-[var(--color-fg)]">
              Histórico da IA
            </h3>

            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
              Registro das análises realizadas pela Hikari AI e das decisões
              tomadas pelo administrador.
            </p>
          </div>
        </div>
      </section>

      {/* Configuração */}
      <section className="studio-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[var(--studio-panel-alt)] text-[var(--color-muted)]">
              <Settings className="size-5" />
            </div>

            <div>
              <h2 className="font-display text-lg font-semibold text-[var(--color-fg)]">
                Configuração da IA
              </h2>

              <p className="mt-1 text-sm text-[var(--color-muted)]">
                O provedor de inteligência artificial é configurado através das
                variáveis de ambiente do servidor.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled
            className="h-10 border-white/15 bg-[var(--studio-panel-alt)] text-xs"
          >
            Configurar
          </Button>
        </div>

        <div className="studio-panel-alt mt-5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-fg)]">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>Provedor de IA configurado no servidor</span>
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">
            As chaves do Gemini e do Groq permanecem protegidas nas variáveis de
            ambiente e não são enviadas para o navegador.
          </p>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-bold text-emerald-400" aria-hidden="true">
                ✓
              </span>
              Funcionando / aprovado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-bold text-rose-400" aria-hidden="true">
                ✕
              </span>
              Falha / não aprovado
            </span>
          </div>
        </div>
      </section>

      {/* Voltar */}
      <div className="flex justify-start">
        <Button
          asChild
          variant="outline"
          className="h-10 gap-2 border-white/15 bg-[var(--studio-panel)] px-4 text-xs hover:bg-white/[0.06]"
        >
          <Link to="/admin">
            <ArrowLeft className="size-4" />
            Voltar ao Admin
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[var(--studio-panel)] p-3">
      <span className="text-[11px] font-medium text-[var(--color-subtle)]">
        {label}
      </span>
      <p className="mt-1 text-sm font-medium text-[var(--color-fg)]">{value}</p>
    </div>
  );
}
