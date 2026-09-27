export async function uploadVideoToCloudinary(
  onDone: (url: string) => void,
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Navegador necessário.");
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/mp4,video/webm,video/quicktime";
  input.style.display = "none";

  document.body.appendChild(input);

  try {
    const file = await new Promise<File>((resolve, reject) => {
      input.onchange = () => {
        const selectedFile = input.files?.[0];

        if (!selectedFile) {
          reject(new Error("Nenhum vídeo selecionado."));
          return;
        }

        resolve(selectedFile);
      };

      input.click();
    });

    if (file.size > 900 * 1024 * 1024) {
      throw new Error("O vídeo ultrapassa o limite de 900 MB.");
    }

    const contentType =
      file.type || "application/octet-stream";

    const prepareResponse = await fetch("/api/upload-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: file.name,
        contentType,
        size: file.size,
      }),
    });

    const prepareData = (await prepareResponse.json()) as {
      uploadUrl?: string;
      videoUrl?: string;
      error?: string;
    };

    if (!prepareResponse.ok || !prepareData.uploadUrl) {
      throw new Error(
        prepareData.error || "Não foi possível preparar o upload.",
      );
    }

    const uploadResponse = await fetch(prepareData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => "");
      console.error("Erro no upload para o Backblaze:", errorText);

      throw new Error(
        `Falha no upload para o Backblaze (${uploadResponse.status}).`,
      );
    }

    if (!prepareData.videoUrl) {
      throw new Error("O Backblaze não retornou a URL do vídeo.");
    }

    onDone(prepareData.videoUrl);
  } finally {
    input.remove();
  }
}
