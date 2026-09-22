import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Newspaper,
} from "lucide-react";

export const Route = createFileRoute(
  "/news",
)({
  component: NewsPage,
});

type NewsItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  image: string;
};

const NEWS: NewsItem[] = [
  {
    id: "frieren-trailer",
    type: "TRAILER",
    title:
      'Novo trailer de "Sousou no Frieren" é divulgado',
    description:
      "Um novo trailer foi divulgado, trazendo novas cenas e detalhes da próxima temporada.",
    date: "22 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "one-piece-nova-temporada",
    type: "NOVA TEMPORADA",
    title:
      "One Piece ganha novidades sobre seu próximo arco",
    description:
      "Novas informações sobre a continuação da história foram divulgadas.",
    date: "21 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "anime-filme",
    type: "FILME",
    title:
      "Novo filme de anime recebe data de estreia",
    description:
      "A produção ganhou uma nova atualização e teve sua data de estreia anunciada.",
    date: "20 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "novo-episodio",
    type: "NOVO EPISÓDIO",
    title:
      "Novo episódio de uma das séries mais populares chega esta semana",
    description:
      "O próximo episódio já tem data prevista e novas informações foram divulgadas.",
    date: "19 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=900&q=85",
  },
];

function NewsPage() {
  return (
    <div className="space-y-6 pb-8">
      {/* CABEÇALHO */}
      <section className="space-y-4">
        <Link
          to="/"
          className="
            inline-flex
            items-center
            gap-2
            text-sm
            text-muted
            transition-colors
            hover:text-fg
          "
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>

        <div className="flex items-start gap-3">
          <div
            className="
              flex
              size-11
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-elevated
            "
          >
            <Newspaper className="size-5 text-fg" />
          </div>

          <div className="min-w-0">
            <h1
              className="
                font-display
                text-2xl
                tracking-tight
                text-fg
                sm:text-3xl
              "
            >
              Notícias
            </h1>

            <p className="mt-1 text-sm text-muted">
              Todas as novidades do mundo dos animes,
              em um só lugar.
            </p>
          </div>
        </div>
      </section>

      {/* LISTA DE NOTÍCIAS */}
      <section className="space-y-3">
        {NEWS.map((news) => (
          <Link
            key={news.id}
            to="/"
            className="
              group
              block
              overflow-hidden
              rounded-2xl
              bg-elevated
              shadow-[var(--shadow-border)]
              transition
              hover:bg-surface
            "
          >
            <article
              className="
                flex
                min-w-0
                flex-col
                sm:flex-row
              "
            >
              {/* IMAGEM */}
              <div
                className="
                  relative
                  aspect-video
                  w-full
                  shrink-0
                  overflow-hidden
                  bg-surface
                  sm:aspect-auto
                  sm:h-[170px]
                  sm:w-[290px]
                "
              >
                <img
                  src={news.image}
                  alt=""
                  className="
                    size-full
                    object-cover
                    transition-transform
                    duration-500
                    group-hover:scale-[1.03]
                  "
                />

                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-linear-to-t
                    from-black/35
                    to-transparent
                  "
                />
              </div>

              {/* CONTEÚDO */}
              <div
                className="
                  flex
                  min-w-0
                  flex-1
                  flex-col
                  justify-center
                  p-4
                  sm:p-5
                "
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="
                      inline-flex
                      w-fit
                      rounded-md
                      bg-accent/15
                      px-2
                      py-1
                      text-[9px]
                      font-semibold
                      tracking-[0.12em]
                      text-accent
                      uppercase
                      sm:text-[10px]
                    "
                  >
                    {news.type}
                  </span>

                  <ArrowRight
                    className="
                      size-4
                      shrink-0
                      text-muted
                      transition-transform
                      group-hover:translate-x-1
                      group-hover:text-fg
                    "
                  />
                </div>

                <h2
                  className="
                    mt-3
                    line-clamp-2
                    font-display
                    text-lg
                    leading-snug
                    tracking-tight
                    text-fg
                    sm:text-xl
                  "
                >
                  {news.title}
                </h2>

                <p
                  className="
                    mt-2
                    line-clamp-2
                    text-xs
                    leading-relaxed
                    text-muted
                    sm:text-sm
                  "
                >
                  {news.description}
                </p>

                <div
                  className="
                    mt-3
                    flex
                    items-center
                    gap-1.5
                    text-[11px]
                    text-subtle
                  "
                >
                  <CalendarDays className="size-3.5" />
                  <span>{news.date}</span>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </section>
    </div>
  );
}
