import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { AlertTriangle, BookOpen, CheckCircle2, FileText, Shield, UserX } from "lucide-react";

export const Route = createFileRoute("/termos")({
  head: () => ({
    links: [
      {
        rel: "canonical",
        href: "https://grokhikari.vercel.app/termos",
      },
    ],
    meta: [
      { title: "Termos de Uso | Hikari" },
      {
        name: "description",
        content:
          "Leia os Termos de Uso do Hikari. Condições para utilização da plataforma, normas de conduta da comunidade, isenção sobre reprodutores externos e direitos autorais.",
      },
      { property: "og:title", content: "Termos de Uso | Hikari" },
      {
        property: "og:description",
        content:
          "Leia os Termos de Uso do Hikari. Condições para utilização da plataforma, normas de conduta da comunidade, isenção sobre reprodutores externos e direitos autorais.",
      },
      { property: "og:url", content: "https://grokhikari.vercel.app/termos" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "HIKARI" },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <LegalPage
      title="Termos de Uso e Condições Gerais"
      subtitle="Estes termos regulam o acesso e a utilização dos serviços, catálogo e ferramentas oferecidos pela plataforma Hikari."
      lastUpdated="5 de novembro de 2026"
      badge="Termos Oficiais"
    >
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <BookOpen className="size-5" />
          </div>
          <h2 className="!border-none !pt-0 text-xl font-bold text-fg">1. Aceitação dos Termos</h2>
        </div>
        <p>
          Ao acessar, navegar ou criar uma conta na plataforma <strong>Hikari</strong>, você expressa sua concordância irrevogável com todos os termos, condições e diretrizes estipulados neste documento e em nossa{" "}
          <Link to="/privacidade">Política de Privacidade</Link>, em estrita observância à legislação brasileira, em especial o <strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong> e a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</strong>.
        </p>
        <p>
          Caso você não concorde com qualquer disposição aqui contida, solicitamos que não utilize os serviços, o catálogo ou qualquer funcionalidade oferecida pelo Hikari.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <CheckCircle2 className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">2. Uso Permitido e Finalidade da Plataforma</h2>
        </div>
        <p>
          O Hikari é disponibilizado exclusivamente para fins de entretenimento pessoal, consulta informativa de cultura pop e organização pessoal sem fins comerciais. O usuário tem autorização para:
        </p>
        <ul>
          <li>Consultar dados e cronogramas de lançamento de séries e filmes de animação japonesa;</li>
          <li>Criar e manter listas individuais de acompanhamento (&quot;Minha Lista&quot; e &quot;Histórico&quot;);</li>
          <li>Participar dos espaços comunitários através de comentários e reações em episódios.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <UserX className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">3. Cadastro, Segurança e Normas de Conduta</h2>
        </div>
        <p>
          O usuário é inteiramente responsável por zelar pela confidencialidade de sua senha de acesso e por todas as operações executadas em seu perfil. É estritamente vedado:
        </p>
        <ul>
          <li>
            <strong>Disseminação de Conteúdo Abusivo:</strong> publicar comentários, imagens de perfil ou textos que contenham ofensas, discurso de ódio, assédio, racismo, discriminação de qualquer natureza, ameaças ou apologia a atos ilícitos;
          </li>
          <li>
            <strong>Spoilers Indevidos:</strong> revelar acontecimentos cruciais da trama de obras sem a devida sinalização ou com a intenção explícita de prejudicar a experiência de outros espectadores;
          </li>
          <li>
            <strong>Spam e Links Maliciosos:</strong> veicular links com intenção de phishing, malware, esquemas financeiros ou propaganda não autorizada;
          </li>
          <li>
            <strong>Interferência Técnica:</strong> realizar ataques de negação de serviço (DoS/DDoS), scraping massivo não autorizado ou qualquer engenharia reversa que sobrecarregue os servidores do Hikari.
          </li>
        </ul>
        <p>
          A administração do Hikari reserva-se o direito soberano de suspender, banir ou remover perfis e comentários que violem estas regras, sem necessidade de aviso prévio.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <AlertTriangle className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">4. Isenção sobre Disponibilidade de Episódios e Provedores Externos</h2>
        </div>
        <p>
          Conforme detalhado em nossa página institucional{" "}
          <Link to="/sobre">Sobre</Link>, o Hikari <strong>não realiza armazenamento de mídia de vídeo</strong> em servidores proprietários.
        </p>
        <div className="rounded-xl border border-white/10 bg-surface/80 p-5 space-y-3">
          <p className="text-sm text-zinc-300">
            <strong>Condições de Funcionamento do Reprodutor:</strong>
          </p>
          <ul className="text-sm space-y-2">
            <li>
              Os vídeos e reprodutores exibidos no site consistem em incorporações técnicas (embeds) disponibilizadas e operadas por servidores de terceiros espalhados pela internet.
            </li>
            <li>
              O Hikari <strong>não garante</strong> a estabilidade ininterrupta, taxa de transmissão, resolução contínua ou permanência no ar de nenhum episódio ou player específico, já que a manutenção de tais links depende exclusivamente dos provedores terceiros externos.
            </li>
            <li>
              Falhas temporárias de conexão, travamentos decorrentes da largura de banda do hospedeiro terceiro ou remoção de links externos não constituem inadimplemento ou falha dos serviços do Hikari.
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <Shield className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">5. Propriedade Intelectual, Marcas e Imagens</h2>
        </div>
        <p>
          Reconhecemos e respeitamos o trabalho primordial dos criadores de conteúdo:
        </p>
        <ul>
          <li>
            <strong>Obras Audiovisuais, Personagens e Marcas:</strong> todos os nomes de animes, sinopses originais, logotipos de estúdios (como Toei, MAPPA, Bones, Madhouse, Ufotable, etc.), cartazes promocionais e reproduções gráficas são marcas registradas e propriedade intelectual de seus respectivos detentores de direitos, estúdios produtores e comitês de produção no Japão e no exterior.
          </li>
          <li>
            <strong>Plataforma Hikari:</strong> o design visual da interface, código-fonte front-end, estilos, ícones proprietários, logomarca oficial do Hikari e arquitetura de navegação pertencem aos desenvolvedores da plataforma, sendo protegidos pela legislação de software e direito de autor (Lei nº 9.609/1998 e Lei nº 9.610/1998).
          </li>
        </ul>
        <p>
          Caso qualquer titular de direitos identifique a presença de links que julgue infringentes em nosso diretório, colocamos à disposição o procedimento formal e rápido de notificação em nossa página de{" "}
          <Link to="/dmca">DMCA / Remoção de Conteúdo</Link>.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <FileText className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">6. Alterações nos Termos e Legislação Aplicável</h2>
        </div>
        <p>
          O Hikari poderá atualizar estes Termos de Uso periodicamente para refletir aprimoramentos técnicos, novas exigências regulatórias ou mudanças nas funcionalidades da plataforma. Quaisquer modificações substanciais entrarão em vigor a partir da data de publicação indicada no cabeçalho desta página. O uso continuado da plataforma após tal publicação constitui aceitação plena das condições revisadas.
        </p>
        <p>
          Estes termos são regidos e interpretados em conformidade com as leis da República Federativa do Brasil, elegendo-se o foro competente para dirimir quaisquer eventuais controvérsias decorrentes da utilização da plataforma.
        </p>
      </section>
    </LegalPage>
  );
}
