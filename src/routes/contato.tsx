import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { Clock, HelpCircle, Mail, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato | Fale com a Equipe Hikari" },
      {
        name: "description",
        content:
          "Entre em contato com os responsáveis pelo Hikari. Canais de e-mail direto para suporte técnico, remoção de conteúdo, dúvidas de privacidade e sugestões.",
      },
    ],
  }),
  component: ContatoPage,
});

function ContatoPage() {
  return (
    <LegalPage
      title="Fale Conosco"
      subtitle="Canais oficiais de comunicação direta com a equipe de desenvolvimento e administração do Hikari."
      lastUpdated="5 de novembro de 2026"
      badge="Atendimento"
    >
      <section className="space-y-4">
        <p>
          Valorizamos o diálogo aberto e transparente com nossa comunidade, parceiros e detentores de direitos. Como prezamos pela confiabilidade e agilidade no atendimento sem dependência de formulários suscetíveis a falhas de backend ou spam, todo o nosso suporte é centralizado em contas de e-mail corporativas monitoradas diariamente.
        </p>
      </section>

      {/* Caixa principal de contato com mailto */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col justify-between rounded-2xl border border-purple-500/20 bg-surface/90 p-6 shadow-lg">
          <div className="space-y-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#a855f7]/15 text-[#c084fc]">
              <Mail className="size-6" />
            </div>
            <h3 className="text-lg font-bold text-fg">Atendimento Geral & Suporte</h3>
            <p className="text-xs sm:text-sm text-muted">
              Para dúvidas de uso, sugestões de novos recursos, relato de erros técnicos ou problemas no carregamento de capas e episódios:
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5">
            <a
              href="mailto:contato@hikari.app"
              className="inline-flex items-center gap-2 rounded-xl bg-[#a855f7] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#9333ea] hover:shadow-[0_0_18px_rgba(168,85,247,0.4)] !no-underline"
            >
              <Mail className="size-4" />
              <span>contato@hikari.app</span>
            </a>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-surface/90 p-6 shadow-lg">
          <div className="space-y-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <ShieldCheck className="size-6" />
            </div>
            <h3 className="text-lg font-bold text-fg">Direitos Autorais (DMCA) & LGPD</h3>
            <p className="text-xs sm:text-sm text-muted">
              Para notificações legais de remoção de links indexados por infração autoral ou solicitações de titulares de dados pessoais sob a LGPD:
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5">
            <a
              href="mailto:dmca@hikari.app?subject=Notificacao%20Legal%20-%20Hikari"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-elevated px-4 py-2.5 text-sm font-semibold text-fg transition-all hover:border-[#a855f7]/40 hover:bg-[#a855f7]/15 !no-underline"
            >
              <Mail className="size-4 text-[#c084fc]" />
              <span>dmca@hikari.app</span>
            </a>
          </div>
        </div>
      </section>

      {/* Prazo de resposta */}
      <section className="rounded-2xl border border-purple-500/15 bg-gradient-to-r from-purple-950/20 via-surface to-surface p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#a855f7]/15 text-[#c084fc]">
            <Clock className="size-5" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-fg">Prazo de Resposta Garantido</h3>
            <p className="text-sm text-muted">
              Nossa equipe operacional responde a todas as mensagens enviadas em até <strong>24 a 48 horas úteis</strong> (de segunda a sexta-feira, em horário comercial). Pedidos com caráter de urgência legal comprovada (como notificações de infração de direitos autorais documentadas) são priorizados na fila de triagem.
            </p>
          </div>
        </div>
      </section>

      {/* Dicas para agilizar o contato */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <HelpCircle className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">Como agilizar seu atendimento</h2>
        </div>
        <p>
          Para que possamos compreender e solucionar sua demanda no menor tempo possível, sugerimos incluir as seguintes informações no corpo do e-mail:
        </p>
        <ol>
          <li>
            <strong>Assunto claro:</strong> descreva brevemente o motivo (ex: <em>&quot;[Erro no Player] Episódio 4 de Solo Leveling&quot;</em> ou <em>&quot;[LGPD] Exclusão de perfil&quot;</em>);
          </li>
          <li>
            <strong>URL do link afetado:</strong> inclua o link exato da página em questão no Hikari (ex: <code>https://.../anime/21</code> ou <code>/watch/21?ep=1</code>);
          </li>
          <li>
            <strong>Dispositivo e navegador:</strong> mencione se você está utilizando smartphone (Android/iOS) ou computador (Chrome, Firefox, Safari, Edge);
          </li>
          <li>
            <strong>Captura de tela (opcional):</strong> anexe imagens caso observe falhas visuais ou mensagens de erro no reprodutor.
          </li>
        </ol>
      </section>

      <section className="space-y-4 pt-4 border-t border-white/5">
        <h2 className="text-xl font-bold text-fg">Políticas Complementares</h2>
        <p>
          Antes de entrar em contato, verifique se a sua dúvida já se encontra esclarecida em nossos documentos institucionais:
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/sobre"
            className="rounded-xl border border-white/10 bg-elevated px-4 py-2 text-xs font-semibold text-fg hover:border-[#a855f7]/40 hover:text-[#c084fc] !no-underline"
          >
            Sobre o Hikari
          </Link>
          <Link
            to="/termos"
            className="rounded-xl border border-white/10 bg-elevated px-4 py-2 text-xs font-semibold text-fg hover:border-[#a855f7]/40 hover:text-[#c084fc] !no-underline"
          >
            Termos de Uso
          </Link>
          <Link
            to="/privacidade"
            className="rounded-xl border border-white/10 bg-elevated px-4 py-2 text-xs font-semibold text-fg hover:border-[#a855f7]/40 hover:text-[#c084fc] !no-underline"
          >
            Política de Privacidade (LGPD)
          </Link>
          <Link
            to="/dmca"
            className="rounded-xl border border-white/10 bg-elevated px-4 py-2 text-xs font-semibold text-fg hover:border-[#a855f7]/40 hover:text-[#c084fc] !no-underline"
          >
            DMCA / Remoção de Conteúdo
          </Link>
        </div>
      </section>
    </LegalPage>
  );
}
