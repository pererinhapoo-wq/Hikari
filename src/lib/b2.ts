export async function uploadVideoToB2(
  onDone: (videoUrl: string) => void,
): Promise<void> {
  const input = document.createElement("input");

  input.type = "file";
  input.accept = "video/mp4,video/webm,video/quicktime";

  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
    };

    input.click();
  });

  if (!file) {
    return;
  }

  const allowedTypes = new Set([
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ]);

  if (!allowedTypes.has(file.type)) {
    throw new Error("Formato de vídeo não permitido.");
  }

  const maxSize = 900 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error("O vídeo não pode ter mais de 900 MB.");
  }

  const prepareResponse = await fetch("/api/upload-video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!prepareResponse.ok) {
    throw new Error(
      `Falha ao preparar o upload (${prepareResponse.status}).`,
    );
  }

  const prepareData = (await prepareResponse.json()) as {
    uploadUrl?: string;
    videoUrl?: string;
    key?: string;
  };

  if (!prepareData.uploadUrl || !prepareData.videoUrl) {
    throw new Error("Resposta inválida do servidor de upload.");
  }

  const uploadResponse = await fetch(prepareData.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(
      `Falha no upload para o Backblaze B2 (${uploadResponse.status}).`,
    );
  }

  onDone(prepareData.videoUrl);
}
