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

    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        "Formato inválido. Use MP4, WebM ou MOV.",
      );
    }

    const maxSize = 900 * 1024 * 1024;

    if (file.size > maxSize) {
      throw new Error(
        "O vídeo é muito grande. O limite é de 900 MB.",
      );
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
      const text = await prepareResponse.text().catch(() => "");
      throw new Error(
        text || `Falha ao preparar o upload (${prepareResponse.status}).`,
      );
    }

    const prepareData = (await prepareResponse.json()) as {
      uploadUrl?: string;
      videoUrl?: string;
      key?: string;
    };

    if (!prepareData.uploadUrl) {
      throw new Error(
        "A API não retornou a URL de upload do Backblaze B2.",
      );
    }

    if (!prepareData.videoUrl) {
      throw new Error(
        "A API não retornou a URL do vídeo.",
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
      const text = await uploadResponse.text().catch(() => "");

      throw new Error(
        text
          ? `Falha no upload para o Backblaze B2 (${uploadResponse.status}): ${text}`
          : `Falha no upload para o Backblaze B2 (${uploadResponse.status}).`,
      );
    }

    onDone(prepareData.videoUrl);
  } finally {
    input.remove();
  }
        }
