import { createFileRoute } from "@tanstack/react-router";
import {
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

import {
  StudioPageHeader,
  StudioPanel,
} from "@/components/admin/studio-ui";
import { Button } from "@/components/ui/button";
import { fetchAutomaticNews } from "@/lib/news-api";
import { reviewHikariAINews } from "./api-hikari-ai-review";

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
    <div className="studio-enter space-y-6 pb-12">
      <StudioPageHeader
        kicker="Comunidade & IA"
        title="Hikari AI"
        description="Central de inteligência artificial para revisão editorial de notícias, validação de provedores e verificação de pipeline no servidor."
        backTo="/admin"
        status={
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Configurada no servidor
          </span>
        }
      />

      {/* Status & Provedores */}
      <div className="grid gap-6 lg:grid-cols-12">
        <StudioPanel
          title="Status da Hikari AI"
          description="Pronta para revisão automática no ambiente server-side."
          icon={<Sparkles className="size-4" />}
          className="lg:col-span-5"
        >
          <p className="text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
            A estrutura do sistema está operacional e a conexão com os
            provedores pode ser validada abaixo sem publicar ou alterar
            notícias reais.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--studio-line)] pt-4 text-xs">
            <div className="studio-panel-alt rounded-lg p-3">
              <p className="studio-label">Pipeline ativo</p>
              <p className="mt-1 font-medium text-[var(--color-fg)]">
                Revisão Editorial
              </p>
            </div>
            <div className="studio-panel-alt rounded-lg p-3">
              <p className="studio-label">Credenciais</p>
              <p className="mt-1 font-medium text-emerald-400">
                Variáveis Server-side
              </p>
            </div>
          </div>
        </StudioPanel>

        <StudioPanel
          title="Provedores da Hikari AI"
          description="Modelos configurados para análise e fallback automático."
          icon={<Cpu className="size-4" />}
          className="lg:col-span-7"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="studio-panel-alt rounded-lg p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="studio-label">Provedor principal</p>
                  <p className="mt-1 font-display text-lg font-bold text-[var(--color-fg)]">
                    Gemini
                  </p>
                </div>
                <span className="rounded border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                  Principal
                </span>
              </div>
              <p className="studio-mono mt-3 text-xs text-[var(--color-muted)]">
                Gemini 3.5 Flash Lite
              </p>
            </div>

            <div className="studio-panel-alt rounded-lg p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="studio-label">Provedor de reserva</p>
                  <p className="mt-1 font-display text-lg font-bold text-[var(--color-fg)]">
                    Groq
                  </p>
                </div>
                <span className="rounded border border-[var(--studio-line)] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Fallback
                </span>
              </div>
              <p className="studio-mono mt-3 text-xs text-[var(--color-muted)]">
                GPT-OSS 120B
              </p>
            </div>
          </div>
        </StudioPanel>
      </div>

      {/* Teste Ao Vivo */}
      <StudioPanel
        title="Testar Hikari AI ao Vivo"
        description="Envia uma notícia externa real do feed para análise sem publicar ou modificar registros."
        icon={<Bot className="size-4" />}
        right={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void handleTestAI("gemini")}
              disabled={testing !== null}
              className="h-9 gap-2 bg-violet-600 px-3.5 text-xs font-semibold text-white hover:bg-violet-500"
            >
              {testing === "gemini" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Bot className="size-3.5" />
              )}
              Testar Gemini
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleTestAI("groq")}
              disabled={testing !== null}
              className="h-9 gap-2 border-[var(--studio-line-strong)] bg-[var(--studio-panel-alt)] px-3.5 text-xs font-medium hover:bg-white/[0.06]"
            >
              {testing === "groq" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Bot className="size-3.5" />
              )}
              Testar Groq
            </Button>
          </div>
        }
      >
        {!testResult ? (
          <p className="text-xs text-[var(--color-muted)]">
            Clique em <strong>Testar Gemini</strong> ou{" "}
            <strong>Testar Groq</strong> acima para validar a latência e a saída
            estruturada de classificação editorial.
          </p>
        ) : (
          <div className="studio-panel-alt space-y-4 rounded-lg p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--studio-line)] pb-3.5">
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

              <div className="inline-flex items-center gap-2 rounded-md border border-[var(--studio-line)] bg-[var(--studio-panel)] px-2.5 py-1 text-xs">
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
              <div className="rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] p-3.5">
                <span className="studio-label">Título revisado</span>
                <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--color-fg)]">
                  {testResult.title}
                </p>
              </div>
            )}

            {testResult.description && (
              <div className="rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] p-3.5">
                <span className="studio-label">Descrição revisada</span>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
                  {testResult.description}
                </p>
              </div>
            )}

            <div className="rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] p-3.5">
              <span className="studio-label">Motivo</span>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg)]">
                {testResult.reason}
              </p>
            </div>
          </div>
        )}
      </StudioPanel>

      {/* Recursos */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-fg)]">
            Capacidades &amp; Roadmap da Hikari AI
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)] sm:text-sm">
            Arquitetura preparada para assistência editorial e operacional no
            painel administrativo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="studio-panel rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-violet-300">
                <FileText className="size-5" />
              </div>
              <span className="rounded border border-[var(--studio-line)] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--color-subtle)]">
                Ativo no feed
              </span>
            </div>

            <h3 className="mt-4 font-display text-base font-semibold text-[var(--color-fg)]">
              Revisão de notícias
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
              Analisa notícias antes da publicação, verifica relevância e
              identifica automaticamente obras e jogos.
            </p>

            <ul className="mt-4 space-y-1.5 text-xs text-[var(--color-muted)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-violet-400" />
                Identificação do anime
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-violet-400" />
                Revisão do título e descrição
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-violet-400" />
                Detecção de conteúdo de jogos
              </li>
            </ul>
          </div>

          <div className="studio-panel rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-violet-300">
                <ShieldCheck className="size-5" />
              </div>
              <span className="rounded border border-[var(--studio-line)] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--color-subtle)]">
                Planejado
              </span>
            </div>

            <h3 className="mt-4 font-display text-base font-semibold text-[var(--color-fg)]">
              Moderação inteligente
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
              Suporte auxiliar na triagem de comentários denunciados e
              priorização de fila crítica.
            </p>

            <ul className="mt-4 space-y-1.5 text-xs text-[var(--color-muted)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-violet-400" />
                Análise de denúncias
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-violet-400" />
                Detecção de conteúdo inadequado
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-violet-400" />
                Auxílio aos moderadores
              </li>
            </ul>
          </div>

          <div className="studio-panel rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-violet-300">
                <MessageSquareWarning className="size-5" />
              </div>
              <span className="rounded border border-[var(--studio-line)] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--color-subtle)]">
                Planejado
              </span>
            </div>

            <h3 className="mt-4 font-display text-base font-semibold text-[var(--color-fg)]">
              Detecção de duplicatas
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
              Comparação semântica com notícias existentes para evitar
              publicações repetidas no portal.
            </p>
          </div>

          <div className="studio-panel rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-violet-300">
                <History className="size-5" />
              </div>
              <span className="rounded border border-[var(--studio-line)] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--color-subtle)]">
                Planejado
              </span>
            </div>

            <h3 className="mt-4 font-display text-base font-semibold text-[var(--color-fg)]">
              Histórico da IA
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
              Registro auditável das análises executadas pela Hikari AI e das
              decisões editoriais associadas.
            </p>
          </div>
        </div>
      </section>

      {/* Configuração */}
      <StudioPanel
        title="Segurança & Variáveis de Ambiente"
        description="As chaves do Gemini e do Groq permanecem protegidas exclusivamente no servidor."
        icon={<Settings className="size-4" />}
        right={
          <Button
            type="button"
            variant="outline"
            disabled
            className="h-9 border-[var(--studio-line-strong)] bg-[var(--studio-panel-alt)] text-xs"
          >
            Gerenciado via Ambiente
          </Button>
        }
      >
        <div className="studio-panel-alt rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-fg)] sm:text-sm">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>Provedor de IA configurado no servidor</span>
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">
            Nenhuma credencial de API é exposta ao navegador; todas as chamadas
            passam pelas Server Functions protegidas do Hikari Studio.
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
      </StudioPanel>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] p-3">
      <span className="studio-label">{label}</span>
      <p className="mt-1 text-sm font-medium text-[var(--color-fg)]">{value}</p>
    </div>
  );
}
