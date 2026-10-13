import { i as createServerFn } from "./ssr.mjs";
import { Ft as string, Mt as object, wt as _enum } from "../_libs/@better-auth/core+[...].mjs";
import { t as createServerRpc } from "./createServerRpc--phiu8Av.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-hikari-ai-review-HI76G24l.js
var GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";
var GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
var GROQ_MODEL = "openai/gpt-oss-120b";
var reviewSchema = object({
	title: string().trim().min(1).max(1e3),
	description: string().trim().max(1e4).default(""),
	source: string().trim().max(500).default(""),
	sourceUrl: string().trim().max(2e3).default(""),
	animeName: string().trim().max(500).default(""),
	provider: _enum(["gemini", "groq"]).optional()
});
function fallbackResult(title, description, reason) {
	return {
		approved: false,
		isAnime: false,
		isGameNews: false,
		isDuplicate: false,
		label: "Anúncio",
		animeName: "",
		title,
		description,
		reason
	};
}
function extractGeminiResponseText(json) {
	if (!json || typeof json !== "object") return "";
	const value = json;
	if (!Array.isArray(value.candidates)) return "";
	for (const candidate of value.candidates) {
		const parts = candidate.content?.parts;
		if (!Array.isArray(parts)) continue;
		for (const part of parts) if (typeof part.text === "string" && part.text.trim()) return part.text.trim();
	}
	return "";
}
function extractGroqResponseText(json) {
	if (!json || typeof json !== "object") return "";
	const value = json;
	if (!Array.isArray(value.choices)) return "";
	for (const choice of value.choices) {
		const content = choice.message?.content;
		if (typeof content === "string" && content.trim()) return content.trim();
	}
	return "";
}
function parseJsonResult(text) {
	try {
		const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
		const parsed = JSON.parse(cleaned);
		if (typeof parsed.approved !== "boolean" || typeof parsed.isAnime !== "boolean" || typeof parsed.isGameNews !== "boolean" || typeof parsed.isDuplicate !== "boolean" || typeof parsed.animeName !== "string" || typeof parsed.title !== "string" || typeof parsed.description !== "string" || typeof parsed.reason !== "string") return null;
		const label = [
			"Confirmado",
			"Rumor",
			"Trailer/PV",
			"Nova temporada",
			"Anúncio"
		].includes(parsed.label) ? parsed.label : "Anúncio";
		return {
			approved: parsed.approved,
			isAnime: parsed.isAnime,
			isGameNews: parsed.isGameNews,
			isDuplicate: parsed.isDuplicate,
			label,
			animeName: parsed.animeName,
			title: parsed.title,
			description: parsed.description,
			reason: parsed.reason
		};
	} catch {
		return null;
	}
}
function buildReviewPrompt(data) {
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
async function requestGemini(apiKey, prompt) {
	try {
		const response = await fetch(GEMINI_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": apiKey
			},
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: {
					responseMimeType: "application/json",
					temperature: .1
				}
			}),
			signal: AbortSignal.timeout(3e4)
		});
		if (!response.ok) {
			const errorText = await response.text();
			return {
				result: null,
				reason: `Gemini retornou HTTP ${response.status}: ${errorText.slice(0, 300)}`
			};
		}
		const text = extractGeminiResponseText(await response.json());
		if (!text) return {
			result: null,
			reason: "A Hikari AI não recebeu uma resposta válida do Gemini."
		};
		const result = parseJsonResult(text);
		if (!result) return {
			result: null,
			reason: "A resposta do Gemini não estava no formato esperado."
		};
		return {
			result,
			reason: "Gemini"
		};
	} catch (error) {
		return {
			result: null,
			reason: `Falha na Hikari AI: ${error instanceof Error ? error.message : "Erro desconhecido ao consultar o Gemini."}`
		};
	}
}
async function requestGroq(apiKey, prompt) {
	try {
		const response = await fetch(GROQ_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: GROQ_MODEL,
				messages: [{
					role: "system",
					content: "Você é a Hikari AI. Responda somente com JSON válido seguindo exatamente o formato solicitado."
				}, {
					role: "user",
					content: prompt
				}],
				temperature: .1,
				max_tokens: 1200,
				response_format: { type: "json_object" }
			}),
			signal: AbortSignal.timeout(3e4)
		});
		if (!response.ok) {
			const errorText = await response.text();
			return {
				result: null,
				reason: `Groq retornou HTTP ${response.status}: ${errorText.slice(0, 300)}`
			};
		}
		const text = extractGroqResponseText(await response.json());
		if (!text) return {
			result: null,
			reason: "A Hikari AI não recebeu uma resposta válida do Groq."
		};
		const result = parseJsonResult(text);
		if (!result) return {
			result: null,
			reason: "A resposta do Groq não estava no formato esperado."
		};
		return {
			result,
			reason: "Groq"
		};
	} catch (error) {
		return {
			result: null,
			reason: `Falha na Hikari AI com Groq: ${error instanceof Error ? error.message : "Erro desconhecido ao consultar o Groq."}`
		};
	}
}
var reviewHikariAINews_createServerFn_handler = createServerRpc({
	id: "28120bd7f92385b37288069e3333647052b92abeaf32b458973e6fe4ac2d4356",
	name: "reviewHikariAINews",
	filename: "src/routes/api-hikari-ai-review.ts"
}, (opts) => reviewHikariAINews.__executeServer(opts));
var reviewHikariAINews = createServerFn({ method: "POST" }).inputValidator(reviewSchema).handler(reviewHikariAINews_createServerFn_handler, async ({ data }) => {
	const prompt = buildReviewPrompt(data);
	const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
	const groqApiKey = process.env.GROQ_API_KEY?.trim();
	if (data.provider === "gemini") {
		if (!geminiApiKey) return fallbackResult(data.title, data.description, "GEMINI_API_KEY ainda não está configurada no servidor.");
		const gemini = await requestGemini(geminiApiKey, prompt);
		if (gemini.result) return {
			...gemini.result,
			provider: "Gemini"
		};
		return fallbackResult(data.title, data.description, gemini.reason);
	}
	if (data.provider === "groq") {
		if (!groqApiKey) return fallbackResult(data.title, data.description, "GROQ_API_KEY ainda não está configurada no servidor.");
		const groq = await requestGroq(groqApiKey, prompt);
		if (groq.result) return {
			...groq.result,
			provider: "Groq"
		};
		return fallbackResult(data.title, data.description, groq.reason);
	}
	let geminiReason = "";
	if (geminiApiKey) {
		const gemini = await requestGemini(geminiApiKey, prompt);
		if (gemini.result) return {
			...gemini.result,
			provider: "Gemini"
		};
		geminiReason = gemini.reason;
	} else geminiReason = "GEMINI_API_KEY ainda não está configurada no servidor.";
	if (groqApiKey) {
		const groq = await requestGroq(groqApiKey, prompt);
		if (groq.result) return {
			...groq.result,
			provider: "Groq"
		};
		return fallbackResult(data.title, data.description, `${geminiReason} | ${groq.reason}`);
	}
	return fallbackResult(data.title, data.description, `${geminiReason} | GROQ_API_KEY ainda não está configurada no servidor.`);
});
//#endregion
export { reviewHikariAINews_createServerFn_handler };
