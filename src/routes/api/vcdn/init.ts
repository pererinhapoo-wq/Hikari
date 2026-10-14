import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { isHikariAdmin } from "@/lib/auth/admin";

const VCDN_BASE_URL = "https://cdn.vcdn.me";
const MAX_STRING_LENGTH = 300;

async function handlePost({ request }: { request: Request }) {
  try {
    // 1. Autenticação e autorização estrita de administrador
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    const email = session?.user?.email ?? null;

    if (!session?.user?.id || !isHikariAdmin(email)) {
      return Response.json(
        {
          error: "Acesso permitido somente ao administrador.",
        },
        { status: 403 },
      );
    }

    // 2. Leitura segura da chave de API no servidor
    const apiKey = process.env.VCDN_API_KEY?.trim();

    if (!apiKey) {
      return Response.json(
        {
          error: "VCDN_API_KEY não configurada no servidor.",
        },
        { status: 500 },
      );
    }

    // 3. Validação do corpo da requisição
    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return Response.json(
        {
          error: "Corpo da requisição deve ser um JSON válido.",
        },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return Response.json(
        {
          error: "Corpo da requisição inválido.",
        },
        { status: 400 },
      );
    }

    const filename =
      typeof body.filename === "string" ? body.filename.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!filename) {
      return Response.json(
        {
          error: "O campo 'filename' é obrigatório.",
        },
        { status: 400 },
      );
    }

    if (filename.length > MAX_STRING_LENGTH) {
      return Response.json(
        {
          error: `O campo 'filename' excede o limite de ${MAX_STRING_LENGTH} caracteres.`,
        },
        { status: 400 },
      );
    }

    if (!title) {
      return Response.json(
        {
          error: "O campo 'title' é obrigatório.",
        },
        { status: 400 },
      );
    }

    if (title.length > MAX_STRING_LENGTH) {
      return Response.json(
        {
          error: `O campo 'title' excede o limite de ${MAX_STRING_LENGTH} caracteres.`,
        },
        { status: 400 },
      );
    }

    // 4. Chamada à API da VCDN com cabeçalho exclusivo Authorization: Bearer
    let vcdnResponse: globalThis.Response;

    try {
      vcdnResponse = await fetch(`${VCDN_BASE_URL}/api/v1/upload/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          filename,
          title,
        }),
      });
    } catch {
      return Response.json(
        {
          error: "Não foi possível conectar ao servidor da VCDN.",
        },
        { status: 502 },
      );
    }

    let responseData: Record<string, unknown> | null = null;

    try {
      responseData = (await vcdnResponse.json()) as Record<string, unknown>;
    } catch {
      return Response.json(
        {
          error: "Resposta da VCDN não pôde ser interpretada.",
        },
        { status: 502 },
      );
    }

    if (!vcdnResponse.ok || !responseData) {
      return Response.json(
        {
          error: "A VCDN não conseguiu inicializar o upload.",
        },
        {
          status:
            vcdnResponse.status >= 400 && vcdnResponse.status < 600
              ? vcdnResponse.status
              : 502,
        },
      );
    }

    // 5. Validação da resposta: exige upload_id não vazio
    const uploadId =
      typeof responseData.upload_id === "string"
        ? responseData.upload_id.trim()
        : "";

    if (!uploadId) {
      return Response.json(
        {
          error: "A VCDN não retornou um 'upload_id' válido.",
        },
        { status: 502 },
      );
    }

    // 6. Retorno seguro contendo exclusivamente os metadados necessários
    return Response.json({
      upload_id: uploadId,
      ...(typeof responseData.video_id === "string" && {
        video_id: responseData.video_id,
      }),
    });
  } catch {
    return Response.json(
      {
        error: "Erro interno no servidor ao inicializar upload.",
      },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/vcdn/init")({
  server: {
    handlers: {
      POST: handlePost,
    },
  },
});
