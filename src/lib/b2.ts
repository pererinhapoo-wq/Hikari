const MAX_VIDEO_SIZE = 900 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

type PrepareUploadResponse = {
  uploadUrl: string;
  videoUrl: string;
  key: string;
};

export async function uploadVideoToB2(
  onDone: (videoUrl: string) => void,
): Promise<void> {
  const input = document.createElement("input");

  input.type = "file";
  input.accept = "video/mp4,video/webm,video/quicktime";
  input.style.display = "none";

  document.body.appendChild(input);

  try {
    const file = await new Promise<File | null>((resolve) => {
      input.onchange = () => {
        resolve(input.files?.[0] ?? null);
      };

      input.click();
    });

    if (!file) {
      return;
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error(
        "Formato de vídeo não permitido. Use MP4, WebM ou MOV.",
      );
    }

    if (file.size > MAX_VIDEO_SIZE) {
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
      const message = await prepareResponse.text().catch(() => "");

      throw new Error(
        message ||
          `Falha ao preparar o upload (${prepareResponse.status}).`,
      );
    }

    const prepareData =
      (await prepareResponse.json()) as PrepareUploadResponse;

    if (!prepareData.uploadUrl || !prepareData.videoUrl) {
      throw new Error(
        "O servidor não retornou as URLs necessárias para o upload.",
      );
    }

    const uploadResponse = await fetch(prepareData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const message = await uploadResponse.text().catch(() => "");

      throw new Error(
        message ||
          `Falha no upload para o Backblaze B2 (${uploadResponse.status}).`,
      );
    }

    onDone(prepareData.videoUrl);
  } finally {
    input.remove();
  }
}
