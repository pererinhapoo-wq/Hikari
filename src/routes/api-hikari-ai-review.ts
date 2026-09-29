import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODEL = "openai/gpt-oss-120b";

const reviewSchema = z.object({
  title: z.string().trim().min(1).max(1000),
  description: z.string().trim().max(10000).default(""),
  source: z.string().trim().max(500).default(""),
  sourceUrl: z.string().trim().max(2000).default(""),
  animeName: z.string().trim().max(500).default(""),
  provider: z.enum(["auto", "gemini", "groq"]).optional(),
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
  provider?: "Gemini" | "Groq";
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

function extractGeminiResponseText(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const value = json as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  if (!Array.isArray(value.candidates)) return "";
  for (const candidate of value.candidates) {
    const parts = candidate.content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (typeof part.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }
  return "";
}

function extractGroqResponseText(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const value = json as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  if (!Array.isArray(value.choices)) return "";
  for (const choice of value.choices) {
    const content = choice.message?.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
  }
  return "";
}

function parseJsonResult(text: string): HikariAIReviewResult | null {
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
    ) return null;

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

function buildReviewPrompt(data: {
  title: string;
  description: string;
  source: string;
  sourceUrl: string;
  animeName: string;
}) {
  return `
Você é a Hikari AI, responsável pela revisão automática
de notícias do site Hikari.

Analise a notícia abaixo e devolva SOMENTE um JSON válido.

REGRAS:

1. A notícia deve ser sobre anime, mangá ou uma franquia
   diretamente relacionada a anime.

2. Notícias exclusivamente sobre jogos devem ser rejeitadas.

3. O nome do anime deve permanecer em inglês oficial ou romaji.
   Nunca transforme o nome do anime em português.

4. Nunca use o título japonês em caracteres nativos quando
   existir um nome oficial em inglês ou romaji.

5. O restante do título deve ficar em português.

6. A descrição deve ficar em português.

7. Classifique a notícia em apenas uma categoria:
   - Confirmado
   - Rumor
   - Trailer/PV
   - Nova temporada
   - Anúncio

8. Se a fonte for claramente um vazamento, leak ou conta de
   rumores, trate como "Rumor", salvo quando houver confirmação
   oficial verificável.

9. Não invente informações.

10. Se não for possível identificar corretamente um anime,
    não invente um nome.

11. A decisão "approved" deve ser false se:
    - não for notícia de anime ou mangá;
    - for notícia exclusivamente sobre jogo;
    - houver informação insuficiente;
    - houver forte indício de conteúdo duplicado.

12. "isDuplicate" deve ser false nesta primeira versão quando
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

DEVOLVA EXATAMENTE ESTE FORMATO JSON:

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
}

async function requestGemini(apiKey: string, prompt: string) {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        result: null,
        reason: `Gemini retornou HTTP ${response.status}: ${errorText.slice(0, 300)}`,
      };
    }

    const json = (await response.json()) as unknown;
    const text = extractGeminiResponseText(json);
    if (!text) {
      return {
        result: null,
        reason: "A Hikari AI não recebeu uma resposta válida do Gemini.",
      };
    }

    const result = parseJsonResult(text);
    if (!result) {
      return {
        result: null,
        reason: "A resposta do Gemini não estava no formato esperado.",
      };
    }

    return { result, reason: "Gemini" };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao consultar o Gemini.";
    return { result: null, reason: `Falha na Hikari AI: ${reason}` };
  }
}

async function requestGroq(apiKey: string, prompt: string) {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Você é a Hikari AI. Responda somente com JSON válido seguindo exatamente o formato solicitado.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        result: null,
        reason: `Groq retornou HTTP ${response.status}: ${errorText.slice(0, 300)}`,
      };
    }

    const json = (await response.json()) as unknown;
    const text = extractGroqResponseText(json);
    if (!text) {
      return {
        result: null,
        reason: "A Hikari AI não recebeu uma resposta válida do Groq.",
      };
    }

    const result = parseJsonResult(text);
    if (!result) {
      return {
        result: null,
        reason: "A resposta do Groq não estava no formato esperado.",
      };
    }

    return { result, reason: "Groq" };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao consultar o Groq.";
    return {
      result: null,
      reason: `Falha na Hikari AI com Groq: ${reason}`,
    };
  }
}

export const reviewHikariAINews = createServerFn({
  method: "POST",
})
  .inputValidator(reviewSchema)
  .handler(async ({ data }) => {
    const prompt = buildReviewPrompt(data);
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
    const groqApiKey = process.env.GROQ_API_KEY?.trim();

    if (data.provider === "gemini") {
      if (!geminiApiKey) {
        return fallbackResult(
          data.title,
          data.description,
          "GEMINI_API_KEY ainda não está configurada no servidor.",
        );
      }

      const gemini = await requestGemini(geminiApiKey, prompt);

      if (gemini.result) {
        return { ...gemini.result, provider: "Gemini" as const };
      }

      return fallbackResult(
        data.title,
        data.description,
        gemini.reason,
      );
    }

    if (data.provider === "groq") {
      if (!groqApiKey) {
        return fallbackResult(
          data.title,
          data.description,
          "GROQ_API_KEY ainda não está configurada no servidor.",
        );
      }

      const groq = await requestGroq(groqApiKey, prompt);

      if (groq.result) {
        return { ...groq.result, provider: "Groq" as const };
      }

      return fallbackResult(
        data.title,
        data.description,
        groq.reason,
      );
    }

    if (data.provider === "auto") {
      if (!geminiApiKey) {
        return fallbackResult(
          data.title,
          data.description,
          "GEMINI_API_KEY ainda não está configurada no servidor.",
        );
      }

      // Teste controlado: usa uma chave inválida somente nesta chamada,
      // sem alterar a GEMINI_API_KEY real do servidor.
      const gemini = await requestGemini(
        `${geminiApiKey}-fallback-test`,
        prompt,
      );

      if (gemini.result) {
        return { ...gemini.result, provider: "Gemini" as const };
      }

      if (!groqApiKey) {
        return fallbackResult(
          data.title,
          data.description,
          `${gemini.reason} | GROQ_API_KEY ainda não está configurada no servidor.`,
        );
      }

      const groq = await requestGroq(groqApiKey, prompt);

      if (groq.result) {
        return { ...groq.result, provider: "Groq" as const };
      }

      return fallbackResult(
        data.title,
        data.description,
        `${gemini.reason} | ${groq.reason}`,
      );
    }

    let geminiReason = "";

    if (geminiApiKey) {
      const gemini = await requestGemini(geminiApiKey, prompt);
      if (gemini.result) {
        return { ...gemini.result, provider: "Gemini" as const };
      }
      geminiReason = gemini.reason;
    } else {
      geminiReason =
        "GEMINI_API_KEY ainda não está configurada no servidor.";
    }

    if (groqApiKey) {
      const groq = await requestGroq(groqApiKey, prompt);
      if (groq.result) {
        return { ...groq.result, provider: "Groq" as const };
      }
      return fallbackResult(
        data.title,
        data.description,
        `${geminiReason} | ${groq.reason}`,
      );
    }

    return fallbackResult(
      data.title,
      data.description,
      `${geminiReason} | GROQ_API_KEY ainda não está configurada no servidor.`,
    );
  });
