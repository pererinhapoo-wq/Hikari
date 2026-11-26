import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { buildCleanCanonical, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { Cookie, Eye, Lock, ShieldCheck, UserCheck } from "lucide-react";

export const Route = createFileRoute("/privacidade")({
  head: () => {
    const canonicalUrl = buildCleanCanonical("/privacidade");
    const title = "Política de Privacidade e Cookies (LGPD) | Hikari";
    const description =
      "Política de Privacidade e Proteção de Dados do Hikari em conformidade com a LGPD. Saiba como tratamos seus dados, o uso de cookies pelo Google e como exercer seus direitos.";
    return {
      links: [
        {
          rel: "canonical",
          href: canonicalUrl,
        },
      ],
      meta: [
        { title },
        {
          name: "description",
          content: description,
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: description,
        },
        { property: "og:url", content: canonicalUrl },
        { property: "og:image", content: DEFAULT_OG_IMAGE },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:site_name", content: "HIKARI" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: DEFAULT_OG_IMAGE },
      ],
    };
  },
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade e Tratamento de Dados"
      subtitle="Nosso compromisso com a sua privacidade, segurança das informações e total conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)."
      lastUpdated="5 de novembro de 2026"
      badge="LGPD & Cookies"
    >
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <ShieldCheck className="size-5" />
          </div>
          <h2 className="!border-none !pt-0 text-xl font-bold text-fg">1. Introdução e Princípios</h2>
        </div>
        <p>
          O <strong>Hikari</strong> respeita profundamente a privacidade de seus usuários e visitantes. Esta Política de Privacidade descreve de forma clara, objetiva e transparente como coletamos, utilizamos, armazenamos e protegemos seus dados pessoais ao utilizar nossa plataforma, em consonância irrestrita com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD - Lei Federal nº 13.709/2018)</strong> e o <strong>Marco Civil da Internet (Lei Federal nº 12.965/2014)</strong>.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <Eye className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">2. Quais Dados Pessoais Coletamos</h2>
        </div>
        <p>
          Adotamos o princípio da minimização de dados: coletamos apenas o estritamente necessário para prestar um serviço estável, personalizado e seguro.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-surface/80 p-5 space-y-2">
            <h3 className="text-base font-bold text-fg">Dados de Cadastro e Autenticação</h3>
            <ul className="text-xs sm:text-sm space-y-1.5 text-muted">
              <li><strong>Endereço de E-mail:</strong> utilizado unicamente para identificar a conta, recuperação de acesso e envio de notificações solicitadas pelo próprio usuário.</li>
              <li><strong>Nome / Apelido (Nick):</strong> exibido publicamente para identificá-lo em comentários e interações na comunidade.</li>
              <li><strong>Senha de Acesso:</strong> armazenada exclusivamente na forma de hash criptográfico unidirecional seguro (nunca em texto simples).</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-surface/80 p-5 space-y-2">
            <h3 className="text-base font-bold text-fg">Dados de Utilização e Interação</h3>
            <ul className="text-xs sm:text-sm space-y-1.5 text-muted">
              <li><strong>Comentários e Reações:</strong> textos e curtidas voluntariamente publicados em páginas de animes ou episódios.</li>
              <li><strong>Minha Lista e Histórico:</strong> registros dos animes favoritados e episódios marcados como assistidos, para que sua sincronização funcione em qualquer dispositivo.</li>
              <li><strong>Registros de Conexão:</strong> endereço IP, data e hora de acesso, em cumprimento ao Art. 15 do Marco Civil da Internet.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <Cookie className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">3. Uso de Cookies e Armazenamento Local</h2>
        </div>
        <p>
          Cookies são pequenos arquivos de texto gravados no seu navegador para registrar preferências e sessões de navegação. O Hikari utiliza:
        </p>
        <ul>
          <li>
            <strong>Cookies Essenciais de Sessão:</strong> necessários para manter você conectado à sua conta Hikari com segurança durante a navegação;
          </li>
          <li>
            <strong>Armazenamento Local (localStorage):</strong> gravação no próprio dispositivo de preferências visuais (volume preferido, idioma de legendas padrão e filtros de catálogo);
          </li>
          <li>
            <strong>Cookies Analíticos e de Desempenho:</strong> auxiliam a medir métricas anônimas de tráfego e latência de carregamento para aprimoramento contínuo dos servidores.
          </li>
        </ul>
      </section>



      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <UserCheck className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">5. Direitos do Titular sob a LGPD e Como Exercê-los</h2>
        </div>
        <p>
          O Artigo 18 da Lei Geral de Proteção de Dados Pessoais confere ao titular direitos fundamentais e inalienáveis, os quais o Hikari assegura de maneira irrestrita e facilitada:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-elevated/50 p-4">
            <h4 className="font-semibold text-fg text-sm">Confirmação e Acesso</h4>
            <p className="text-xs text-muted mt-1">Saber se realizamos o tratamento de seus dados e obter cópia das informações sob custódia.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-elevated/50 p-4">
            <h4 className="font-semibold text-fg text-sm">Correção e Atualização</h4>
            <p className="text-xs text-muted mt-1">Solicitar a correção imediata de dados cadastrais incompletos, inexatos ou desatualizados.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-elevated/50 p-4">
            <h4 className="font-semibold text-fg text-sm">Eliminação e Esquecimento</h4>
            <p className="text-xs text-muted mt-1">Excluir permanentemente sua conta, comentários e histórico dos nossos bancos de dados.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-elevated/50 p-4">
            <h4 className="font-semibold text-fg text-sm">Revogação de Consentimento</h4>
            <p className="text-xs text-muted mt-1">Retirar o consentimento previamente fornecido a qualquer momento, sem ônus.</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-purple-500/20 bg-surface/90 p-5 space-y-3">
          <h3 className="text-base font-bold text-fg">Canal Direto do Encarregado de Dados (DPO)</h3>
          <p className="text-sm text-muted">
            Para exercer qualquer um dos seus direitos, solicitar relatórios de dados ou requerer a exclusão completa de sua conta, basta enviar uma solicitação ao nosso canal de privacidade:
          </p>
          <a
            href="mailto:hikaritv209@gmail.com?subject=Solicitacao%20de%20Direitos%20LGPD%20-%20Hikari"
            className="inline-flex items-center gap-2 rounded-xl bg-[#a855f7] px-4 py-2 text-sm font-semibold text-white shadow transition-all hover:bg-[#9333ea] !no-underline"
          >
            <span>hikaritv209@gmail.com</span>
          </a>
          <p className="text-xs text-subtle">
            Atendimento gratuito, com resposta formal fornecida em até 15 dias corridos, conforme preconiza a legislação brasileira.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <Lock className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">6. Segurança da Informação e Compartilhamento</h2>
        </div>
        <p>
          O Hikari implementa medidas técnicas e organizacionais rígidas para salvaguardar suas informações:
        </p>
        <ul>
          <li>
            <strong>Tráfego Criptografado (HTTPS/TLS):</strong> toda comunicação entre seu navegador e nossos servidores é criptografada com certificados de segurança modernos;
          </li>
          <li>
            <strong>Não Comercialização de Dados:</strong> nós <strong>jamais</strong> vendemos, alugamos ou comercializamos listas de e-mails ou dados pessoais com terceiros para quaisquer fins comerciais;
          </li>
          <li>
            <strong>Compartilhamento Restrito:</strong> o compartilhamento de dados ocorre exclusivamente com provedores de infraestrutura estritamente necessários para o funcionamento da plataforma (hospedagem e computação em nuvem), todos submetidos a acordos de confidencialidade rigorosos.
          </li>
        </ul>
      </section>
    </LegalPage>
  );
}
