import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
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

export const Route = createFileRoute("/admin/hikari-ai")({
  component: HikariAIPage,
});

function HikariAIPage() {
  const [testing, setTesting] = useState(false);
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
  } | null>(null);

  async function handleTestAI() {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await reviewHikariAINews({
        data: {
          title:
            "One Piece anuncia novidades para o próximo arco do anime",
          description:
            "O anime de One Piece recebeu novas informações sobre seus próximos episódios e produção.",
          source: "Hikari AI Teste",
          sourceUrl: "https://example.com",
          animeName: "One Piece",
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
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 pt-6">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/admin"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Voltar ao painel
          </Link>

          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-elevated shadow-[var(--shadow-border)]">
              <Bot className="size-5" />
            </div>

            <div>
              <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
                Inteligência artificial
              </p>

              <h1 className="font-display text-3xl tracking-tight">
                Hikari AI
              </h1>
            </div>
          </div>

          <p className="mt-2 max-w-2xl text-sm text-muted">
            Central de inteligência artificial para revisão de notícias,
            moderação e tarefas administrativas do Hikari.
          </p>
        </div>
      </header>

      {/* Status */}
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-elevated">
              <Sparkles className="size-5" />
            </div>

            <div>
              <h2 className="font-display text-lg">
                Status da Hikari AI
              </h2>

              <p className="mt-1 text-sm text-muted">
                A estrutura do sistema está pronta e a conexão com o
                provedor pode ser testada abaixo.
              </p>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-elevated px-3 py-1.5 text-xs text-muted">
            <CheckCircle2 className="size-3.5" />
            Configurada
          </div>
        </div>
      </section>

      {/* Teste */}
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl">
              Testar Hikari AI
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Executa uma notícia de teste através da API da Hikari AI.
              Nenhuma notícia real será publicada ou alterada.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleTestAI}
            disabled={testing}
          >
            {testing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Bot className="size-4" />
                Testar Hikari AI
              </>
            )}
          </Button>
        </div>

        {testResult && (
          <div className="mt-5 rounded-lg bg-elevated p-4">
            <div className="flex items-center gap-2 text-sm">
              {testResult.approved ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <XCircle className="size-4" />
              )}

              <span>
                {testResult.approved
                  ? "Hikari AI aprovou a notícia de teste"
                  : "Hikari AI não aprovou a notícia de teste"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-xs text-muted">
                  Anime identificado
                </span>
                <p className="mt-1">
                  {testResult.animeName || "Nenhum"}
                </p>
              </div>

              <div>
                <span className="text-xs text-muted">
                  Classificação
                </span>
                <p className="mt-1">{testResult.label}</p>
              </div>

              <div>
                <span className="text-xs text-muted">
                  É notícia de anime?
                </span>
                <p className="mt-1">
                  {testResult.isAnime ? "Sim" : "Não"}
                </p>
              </div>

              <div>
                <span className="text-xs text-muted">
                  É notícia de jogo?
                </span>
                <p className="mt-1">
                  {testResult.isGameNews ? "Sim" : "Não"}
                </p>
              </div>
            </div>

            {testResult.title && (
              <div className="mt-4">
                <span className="text-xs text-muted">
                  Título revisado
                </span>

                <p className="mt-1 text-sm leading-6">
                  {testResult.title}
                </p>
              </div>
            )}

            {testResult.description && (
              <div className="mt-4">
                <span className="text-xs text-muted">
                  Descrição revisada
                </span>

                <p className="mt-1 text-sm leading-6 text-muted">
                  {testResult.description}
                </p>
              </div>
            )}

            <div className="mt-4 rounded-lg bg-surface p-3">
              <span className="text-xs text-muted">
                Motivo
              </span>

              <p className="mt-1 text-sm leading-6">
                {testResult.reason}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Recursos */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl">
            Recursos da Hikari AI
          </h2>

          <p className="mt-1 text-sm text-muted">
            Estrutura preparada para os recursos de inteligência artificial
            do painel administrativo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Notícias */}
          <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated">
                <FileText className="size-5" />
              </div>

              <span className="rounded-full bg-elevated px-2.5 py-1 text-[10px] text-muted">
                Em breve
              </span>
            </div>

            <h3 className="mt-4 font-display text-lg">
              Revisão de notícias
            </h3>

            <p className="mt-1 text-sm leading-6 text-muted">
              A IA poderá analisar automaticamente as notícias antes da
              publicação, verificar o conteúdo e identificar informações
              relacionadas a animes.
            </p>

            <ul className="mt-4 space-y-2 text-xs text-muted">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5" />
                Identificação do anime
              </li>

              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5" />
                Revisão do título
              </li>

              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5" />
                Revisão da descrição
              </li>

              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5" />
                Detecção de conteúdo de jogos
              </li>
            </ul>
          </div>

          {/* Moderação */}
          <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated">
                <ShieldCheck className="size-5" />
              </div>

              <span className="rounded-full bg-elevated px-2.5 py-1 text-[10px] text-muted">
                Em breve
              </span>
            </div>

            <h3 className="mt-4 font-display text-lg">
              Moderação inteligente
            </h3>

            <p className="mt-1 text-sm leading-6 text-muted">
              A IA poderá auxiliar na análise de comentários, denúncias e
              conteúdos enviados pelos usuários.
            </p>

            <ul className="mt-4 space-y-2 text-xs text-muted">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5" />
                Análise de denúncias
              </li>

              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5" />
                Detecção de conteúdo inadequado
              </li>

              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5" />
                Auxílio aos moderadores
              </li>
            </ul>
          </div>

          {/* Duplicatas */}
          <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated">
                <MessageSquareWarning className="size-5" />
              </div>

              <span className="rounded-full bg-elevated px-2.5 py-1 text-[10px] text-muted">
                Em breve
              </span>
            </div>

            <h3 className="mt-4 font-display text-lg">
              Detecção de duplicatas
            </h3>

            <p className="mt-1 text-sm leading-6 text-muted">
              A IA poderá comparar novas notícias com conteúdos existentes
              para evitar publicações repetidas.
            </p>
          </div>

          {/* Histórico */}
          <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated">
                <History className="size-5" />
              </div>

              <span className="rounded-full bg-elevated px-2.5 py-1 text-[10px] text-muted">
                Em breve
              </span>
            </div>

            <h3 className="mt-4 font-display text-lg">
              Histórico da IA
            </h3>

            <p className="mt-1 text-sm leading-6 text-muted">
              Registro das análises realizadas pela Hikari AI e das decisões
              tomadas pelo administrador.
            </p>
          </div>
        </div>
      </section>

      {/* Configuração */}
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated">
              <Settings className="size-5" />
            </div>

            <div>
              <h2 className="font-display text-lg">
                Configuração da IA
              </h2>

              <p className="mt-1 text-sm text-muted">
                O provedor de inteligência artificial é configurado através
                das variáveis de ambiente do servidor.
              </p>
            </div>
          </div>

          <Button type="button" variant="outline" disabled>
            Configurar
          </Button>
        </div>

        <div className="mt-5 rounded-lg bg-elevated p-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4" />
            <span>Provedor de IA configurado no servidor</span>
          </div>

          <p className="mt-1 text-xs leading-5 text-muted">
            A chave da OpenAI permanece protegida nas variáveis de ambiente
            e não é enviada para o navegador.
          </p>
        </div>
      </section>

      {/* Voltar */}
      <div className="flex justify-start pb-4">
        <Button asChild variant="outline">
          <Link to="/admin">
            <ArrowLeft className="size-4" />
            Voltar ao Admin
          </Link>
        </Button>
      </div>
    </div>
  );
            }
