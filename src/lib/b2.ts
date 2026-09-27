export async function uploadVideoToB2(
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

    const prepareData = (await prepareResponse.json()) as {
      uploadUrl?: string;
      videoUrl?: string;
      error?: string;
    };

    if (
      !prepareResponse.ok ||
      !prepareData.uploadUrl ||
      !prepareData.videoUrl
    ) {
      throw new Error(
        prepareData.error || "Não foi possível preparar o upload.",
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
      throw new Error(
        `Falha no upload para o Backblaze B2 (${uploadResponse.status}).`,
      );
    }

    onDone(prepareData.videoUrl);
  } finally {
    input.remove();
  }
}
