import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent";

const reviewSchema = z.object({
  title: z.string().trim().min(1).max(1000),
  description: z.string().trim().max(10000).default(""),
  source: z.string().trim().max(500).default(""),
  sourceUrl: z.string().trim().max(2000).default(""),
  animeName: z.string().trim().max(500).default(""),
});

type HikariAIReviewResult = {
  approved: boolean;
  isAnime: boolean;
  isGameNews: boolean;
  isDuplicate: boolean;
  label:
    | "Confirmado"
    | "Rumor"
    | "Trailer/PV"
    | "Nova temporada"
    | "Anúncio";
  animeName: string;
  title: string;
  description: string;
  reason: string;
};

function fallbackResult(
  title: string,
  description: string,
  reason: string,
): HikariAIReviewResult {
  return {
    approved: false,
    isAnime: false,
    isGameNews: false,
    isDuplicate: false,
    label: "Anúncio",
    animeName: "",
    title,
    description,
    reason,
  };
}

function extractResponseText(json: unknown): string {
  if (!json || typeof json !== "object") {
    return "";
  }

  const value = json as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  if (!Array.isArray(value.candidates)) {
    return "";
  }

  for (const candidate of value.candidates) {
    const parts = candidate.content?.parts;

    if (!Array.isArray(parts)) {
      continue;
    }

    for (const part of parts) {
      if (
        typeof part.text === "string" &&
        part.text.trim()
      ) {
        return part.text.trim();
      }
    }
  }

  return "";
}

function parseJsonResult(
  text: string,
): HikariAIReviewResult | null {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as Partial<HikariAIReviewResult>;

    if (
      typeof parsed.approved !== "boolean" ||
      typeof parsed.isAnime !== "boolean" ||
      typeof parsed.isGameNews !== "boolean" ||
      typeof parsed.isDuplicate !== "boolean" ||
      typeof parsed.animeName !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.description !== "string" ||
      typeof parsed.reason !== "string"
    ) {
      return null;
    }

    const labels = [
      "Confirmado",
      "Rumor",
      "Trailer/PV",
      "Nova temporada",
      "Anúncio",
    ] as const;

    const label = labels.includes(
      parsed.label as (typeof labels)[number],
    )
      ? (parsed.label as (typeof labels)[number])
      : "Anúncio";

    return {
      approved: parsed.approved,
      isAnime: parsed.isAnime,
      isGameNews: parsed.isGameNews,
      isDuplicate: parsed.isDuplicate,
      label,
      animeName: parsed.animeName,
      title: parsed.title,
      description: parsed.description,
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}

export const reviewHikariAINews = createServerFn({
  method: "POST",
})
  .inputValidator(reviewSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return fallbackResult(
        data.title,
        data.description,
        "GEMINI_API_KEY ainda não está configurada no servidor.",
      );
    }

    const prompt = `
Você é a Hikari AI, responsável pela revisão automática
de notícias do site Hikari.

Analise a notícia abaixo e devolva SOMENTE um JSON válido.

REGRAS:

1. A notícia deve ser sobre anime, mangá ou uma franquia
   diretamente relacionada a anime.

2. Notícias exclusivamente sobre jogos devem ser rejeitadas.

3. O nome do anime deve permanecer em inglês oficial ou romaji.
   Nunca transforme o nome do anime em português.
   Nunca use o título japonês em caracteres nativos quando
   existir um nome em inglês ou romaji.

4. O restante do título deve ficar em português.

5. A descrição deve ficar em português.

6. Classifique a notícia em apenas uma categoria:
   - Confirmado
   - Rumor
   - Trailer/PV
   - Nova temporada
   - Anúncio

7. Se a fonte for claramente um vazamento, leak ou conta de
   rumores, trate como "Rumor", salvo quando a própria notícia
   apresentar confirmação oficial verificável.

8. Não invente informações que não estejam presentes na notícia.

9. Se não for possível identificar um anime, não invente um nome.

10. A decisão "approved" deve ser false se:
    - não for notícia de anime/mangá;
    - for notícia de jogo;
    - houver informação insuficiente para identificar
      corretamente o conteúdo;
    - houver forte indício de conteúdo duplicado.

11. "isDuplicate" nesta primeira versão deve ser false quando
    não houver evidência de duplicação no conteúdo recebido.
    A comparação com o banco de notícias será adicionada
    posteriormente.

DADOS DA NOTÍCIA:

Título:
${data.title}

Descrição:
${data.description || "(sem descrição)"}

Anime identificado anteriormente:
${data.animeName || "(nenhum)"}

Fonte:
${data.source || "(desconhecida)"}

URL da fonte:
${data.sourceUrl || "(não informada)"}

JSON OBRIGATÓRIO:

{
  "approved": true,
  "isAnime": true,
  "isGameNews": false,
  "isDuplicate": false,
  "label": "Confirmado",
  "animeName": "Nome oficial em inglês ou romaji",
  "title": "Título revisado em português",
  "description": "Descrição revisada em português",
  "reason": "Motivo curto da decisão"
}
`;

    try {
      const response = await fetch(
        `${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();

        return fallbackResult(
          data.title,
          data.description,
          `Gemini retornou HTTP ${response.status}: ${errorText.slice(
            0,
            300,
          )}`,
        );
      }

      const json = (await response.json()) as unknown;

      const text = extractResponseText(json);

      if (!text) {
        return fallbackResult(
          data.title,
          data.description,
          "A Hikari AI não recebeu uma resposta válida do Gemini.",
        );
      }

      const result = parseJsonResult(text);

      if (!result) {
        return fallbackResult(
          data.title,
          data.description,
          "A resposta da Hikari AI não estava no formato esperado.",
        );
      }

      return result;
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao consultar o Gemini.";

      return fallbackResult(
        data.title,
        data.description,
        `Falha na Hikari AI: ${reason}`,
      );
    }
  });
