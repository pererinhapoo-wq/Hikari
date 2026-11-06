import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { Database, Layers, ShieldAlert, Sparkles, Tv } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre o Hikari | Catálogo e Plataforma de Animes" },
      {
        name: "description",
        content:
          "Conheça o Hikari: nossa missão, como funciona nosso catálogo integrado ao AniList e nosso compromisso de transparência na reprodução e indexação de animes.",
      },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <LegalPage
      title="Sobre o Hikari"
      subtitle="Conheça a proposta do Hikari, como organizamos nosso catálogo de animações japonesas e os princípios técnicos que orientam nossa plataforma."
      lastUpdated="5 de novembro de 2026"
      badge="Institucional"
    >
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <Sparkles className="size-5" />
          </div>
          <h2 className="!border-none !pt-0 text-xl font-bold text-fg">1. O que é o Hikari</h2>
        </div>
        <p>
          O <strong>Hikari (光)</strong> é uma plataforma digital brasileira desenvolvida por e para entusiastas da cultura pop japonesa e animes. Nosso objetivo primordial é proporcionar uma experiência fluida, moderna e sem ruídos para quem deseja acompanhar os lançamentos da temporada no Japão, descobrir obras clássicas e organizar títulos favoritos em um ambiente veloz e elegante.
        </p>
        <p>
          Inspirado na palavra japonesa para &quot;luz&quot;, o Hikari nasceu da necessidade de entregar uma interface limpa, com design responsivo de alto desempenho, livre de poluição visual e pensada para todos os tipos de telas — de smartphones a televisores e monitores ultrawide.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <Layers className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">2. Como o Catálogo Funciona</h2>
        </div>
        <p>
          A organização do catálogo do Hikari é estruturada em torno do ciclo real da indústria de animação japonesa:
        </p>
        <ul>
          <li>
            <strong>Temporadas Oficiais:</strong> categorização automática em Inverno, Primavera, Verão e Outono de cada ano civil, permitindo navegar pelos animes transmitidos na televisão japonesa a cada trimestre.
          </li>
          <li>
            <strong>Calendário Semanal em Horário Local:</strong> conversão precisa das grades horárias de transmissão de Tóquio para o fuso horário brasileiro (UTC-3), garantindo que os usuários saibam com exatidão o dia e a hora em que novos episódios vão ao ar.
          </li>
          <li>
            <strong>Exploração por Gêneros e Formatos:</strong> filtros dinâmicos que separam séries de TV, longas-metragens para cinema (filmes), OVAs, ONAs e especiais.
          </li>
          <li>
            <strong>Minha Lista e Histórico Pessoal:</strong> ferramentas para marcar obras como &quot;Assistindo&quot;, &quot;Planejo Assistir&quot;, &quot;Completos&quot; ou &quot;Favoritos&quot;, com sincronização em nuvem para usuários cadastrados.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <Database className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">3. Origem dos Metadados (AniList)</h2>
        </div>
        <p>
          A integridade e riqueza de detalhes do nosso acervo de informações é garantida pela integração com a <strong>AniList API</strong>, uma das maiores e mais respeitadas bases de dados abertas sobre anime e mangá do mundo.
        </p>
        <p>
          Por meio dessa integração, mantemos dados sempre atualizados sobre:
        </p>
        <ul>
          <li>Títulos em japonês (kanji/kana), romaji e versões ocidentais adaptadas em português e inglês;</li>
          <li>Sinopses detalhadas, número total de episódios e duração média;</li>
          <li>Ficha técnica completa com estúdios de animação, comitês de produção e autores originais;</li>
          <li>Pontuações globais da comunidade e gráficos de popularidade;</li>
          <li>Pôsteres de capa oficiais e banners promocionais de divulgação.</li>
        </ul>
        <p className="text-xs text-subtle">
          * Todas as imagens, pôsteres e marcas registradas citadas pertencem aos seus respectivos estúdios, produtores e distribuidores de direitos autorais. O Hikari utiliza esses metadados exclusivamente para fins informativos e de catalogação cultural.
        </p>
      </section>

      {/* Caixa de destaque sobre a política de hospedagem */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <ShieldAlert className="size-5" />
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-fg">
              4. O que o Hikari Faz e o que NÃO Faz (Aviso Importante)
            </h3>
            <p className="text-sm leading-relaxed text-zinc-300">
              Para total transparência com nossos usuários, anunciantes e detentores de direitos autorais, esclarecemos as delimitações técnicas do nosso serviço:
            </p>
            <div className="space-y-2 text-sm text-zinc-300">
              <p>
                ❌ <strong>NÃO HOSPEDAMOS VÍDEOS:</strong> O Hikari não possui servidores de armazenamento de vídeo, não faz upload de episódios e não mantém arquivos audiovisuais próprios em sua infraestrutura.
              </p>
              <p>
                🌐 <strong>REPRODUÇÃO POR INCORPORAÇÃO EXTERNA:</strong> Os reprodutores multimídia exibidos em nosso site funcionam por meio de incorporação técnica (iframes/embeds) ou conexões diretas a serviços de armazenamento e provedores de vídeo independentes de terceiros espalhados pela web.
              </p>
              <p>
                ℹ️ <strong>INDEXAÇÃO DE INFORMAÇÕES:</strong> O Hikari opera unicamente como um motor de indexação e agregação de links públicos já existentes na rede mundial de computadores, associando esses links às respectivas fichas técnicas do catálogo AniList.
              </p>
              <p>
                ⚖️ <strong>RESPONSABILIDADE LEGAL:</strong> O controle sobre a disponibilidade, qualidade, remoção ou velocidade dos arquivos de mídia recai exclusivamente sobre as entidades hospedeiras externas. Qualquer solicitação de remoção de links indexados pode ser feita diretamente em nossa página de{" "}
                <Link to="/dmca" className="text-[#c084fc] underline font-medium hover:text-white">
                  DMCA e Direitos Autorais
                </Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
            <Tv className="size-5" />
          </div>
          <h2 className="text-xl font-bold text-fg">5. Experiência de Uso e Comunidade</h2>
        </div>
        <p>
          Buscamos ser o ponto de encontro definitivo para acompanhar suas séries preferidas. Priorizamos:
        </p>
        <ul>
          <li>Carregamento instantâneo com tecnologias web de última geração (React, Vite e Tailwind CSS);</li>
          <li>Sistema de comentários moderado, promovendo discussões sadias sem spoilers desnecessários;</li>
          <li>Respeito integral à privacidade do usuário em estrita conformidade com a Lei Geral de Proteção de Dados (LGPD);</li>
          <li>Publicidade não invasiva, garantindo que o conteúdo e a navegação sejam sempre a prioridade.</li>
        </ul>
        <p>
          Tem sugestões ou dúvidas sobre o funcionamento do Hikari? Fale diretamente com nossa equipe através da página de{" "}
          <Link to="/contato" className="text-[#c084fc] underline">
            Contato
          </Link>.
        </p>
      </section>
    </LegalPage>
  );
}
