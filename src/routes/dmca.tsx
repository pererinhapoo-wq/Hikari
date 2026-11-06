import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { AlertCircle, CheckSquare, Clock, FileWarning, Mail, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/dmca")({
  head: () => ({
    links: [
      {
        rel: "canonical",
        href: "https://grokhikari.vercel.app/dmca",
      },
    ],
    meta: [
      { title: "DMCA e Notificação de Direitos Autorais | Hikari" },
      {
        name: "description",
        content:
          "Procedimento formal para envio de notificações de remoção de conteúdo (DMCA / Takedown Notice) no Hikari. Diretrizes, informações exigidas e prazos.",
      },
      { property: "og:title", content: "DMCA e Notificação de Direitos Autorais | Hikari" },
      {
        property: "og:description",
        content:
          "Procedimento formal para envio de notificações de remoção de conteúdo (DMCA / Takedown Notice) no Hikari. Diretrizes, informações exigidas e prazos.",
      },
      { property: "og:url", content: "https://grokhikari.vercel.app/dmca" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "HIKARI" },
    ],
  }),
  component: DmcaPage,
});

function DmcaPage() {
  return (
    <LegalPage
      title="Aviso de Direitos Autorais e Notificação DMCA"
      subtitle="Diretrizes formais e procedimento célere para solicitação de desindexação ou remoção de links para titulares de direitos autorais."
      lastUpdated="5 de novembro de 2026"
      badge="Propriedade Intelectual"
    >
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <ShieldAlert className="size-5" />
          </div>
          <h2 className="!border-none !pt-0 text-xl font-bold text-fg">1. Declaração de Conformidade com o DMCA</h2>
        </div>
        <p>
          O <strong>Hikari</strong> respeita a propriedade intelectual de terceiros e espera que seus usuários façam o mesmo. É nossa política estrita responder prontamente a notificações claras de supostas infrações aos direitos autorais que estejam em estrita conformidade com o <strong>Digital Millennium Copyright Act de 1998 (&quot;DMCA&quot;, 17 U.S.C. § 512)</strong> e com a <strong>Lei de Direitos Autorais do Brasil (Lei nº 9.610/1998)</strong>.
        </p>
      </section>

      {/* Caixa de esclarecimento sobre a natureza técnica */}
      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-3">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <AlertCircle className="size-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-fg">Natureza Técnica da Plataforma Hikari</h3>
            <p className="text-sm text-zinc-300">
              Ressaltamos expressamente que o Hikari opera exclusivamente como um <strong>indexador e agregador de links e metadados culturais</strong>. Não mantemos, não armazenamos e não fazemos upload de nenhum arquivo de mídia de vídeo em nossos próprios servidores. Os reprodutores incorporados apontam para serviços de terceiros e provedores externos independentes na internet.
            </p>
            <p className="text-xs text-zinc-400">
              Ao receber uma notificação válida, a ação do Hikari consiste em <strong>desindexar e remover imediatamente o link de reprodução</strong> de nossa base de dados. Caso deseje que o arquivo fonte seja excluído da internet, recomendamos que a notificação seja também remetida ao servidor de hospedagem que armazena a mídia original.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <CheckSquare className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">2. O que Incluir no Pedido de Remoção (Notificação Formal)</h2>
        </div>
        <p>
          Para que uma notificação de infração seja considerada juridicamente válida e possa ser processada pela nossa equipe de conformidade, ela deve conter os seguintes elementos obrigatórios:
        </p>
        <ol className="space-y-3">
          <li>
            <strong>Identificação da Obra Protegida:</strong> Descrição clara e detalhada do trabalho protegido por direitos autorais que você alega ter sido violado (título oficial da obra, estúdio detentor e comitê de produção).
          </li>
          <li>
            <strong>Localização Precisa (URL no Hikari):</strong> A(s) URL(s) exata(s) da página no Hikari onde o link ou conteúdo questionado se encontra (por exemplo: <code>https://.../anime/191656</code> ou <code>https://.../watch/191656/ep-2</code>). Solicitações genéricas que não indiquem o endereço exato não poderão ser localizadas.
          </li>
          <li>
            <strong>Dados de Contato do Notificante:</strong> Nome completo, endereço físico, telefone corporativo e endereço de e-mail oficial do titular ou de seu representante legal autorizado.
          </li>
          <li>
            <strong>Declaração de Boa-Fé:</strong> Uma declaração formal de que você acredita, de boa-fé, que o uso do material na forma reclamada não foi autorizado pelo proprietário dos direitos autorais, por seu agente ou pela lei.
          </li>
          <li>
            <strong>Declaração sob Pena de Perjúrio:</strong> Uma declaração, sob as penas cabíveis da lei e de perjúrio, de que as informações fornecidas na notificação são precisas e verdadeiras, e de que você é o proprietário dos direitos autorais ou possui procuração expressa para agir em nome do titular.
          </li>
          <li>
            <strong>Assinatura do Titular:</strong> Assinatura física ou eletrônica válida da pessoa autorizada a agir em nome do proprietário do direito exclusivo que supostamente foi violado.
          </li>
        </ol>
      </section>

      {/* Caixa de envio com mailto */}
      <section className="rounded-2xl border border-purple-500/20 bg-surface/90 p-6 sm:p-7 space-y-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#a855f7]/15 text-[#c084fc]">
            <Mail className="size-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-fg">Canal Designado de Notificações DMCA</h3>
            <p className="text-xs sm:text-sm text-muted">
              Envie a notificação formal completa para o e-mail oficial do nosso departamento jurídico:
            </p>
          </div>
        </div>

        <div className="pt-2">
          <a
            href="mailto:dmca@hikari.app?subject=DMCA%20Takedown%20Notice%20-%20Hikari"
            className="inline-flex items-center gap-2 rounded-xl bg-[#a855f7] px-5 py-3 text-sm font-semibold text-white shadow transition-all hover:bg-[#9333ea] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] !no-underline"
          >
            <Mail className="size-4" />
            <span>dmca@hikari.app</span>
          </a>
        </div>
      </section>

      {/* Prazo de resposta */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <Clock className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">3. Prazo de Processamento e Resposta</h2>
        </div>
        <p>
          Notificações formais que contenham todos os requisitos legais listados acima recebem tratamento prioritário. O prazo padrão para triagem, desindexação e remoção efetiva dos links apontados é de <strong>24 a 48 horas úteis</strong> contadas a partir do recebimento do e-mail.
        </p>
        <p>
          Após o processamento da solicitação, o notificante receberá uma confirmação de resposta no mesmo endereço de e-mail informando sobre a conclusão da remoção do link do catálogo.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <FileWarning className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">4. Notificações Falsas ou Abusivas</h2>
        </div>
        <p>
          De acordo com o Artigo 512(f) do DMCA e com os preceitos de responsabilidade civil da legislação brasileira, qualquer pessoa que, de forma consciente e intencional, declare falsamente que determinado material está infringindo direitos autorais pode ser responsabilizada judicialmente por perdas, danos, custas processuais e honorários advocatícios incorridos.
        </p>
        <p>
          Pedimos que utilize este canal com a devida responsabilidade e precisão técnica. Dúvidas institucionais gerais devem ser direcionadas ao canal de{" "}
          <Link to="/contato">Contato</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
