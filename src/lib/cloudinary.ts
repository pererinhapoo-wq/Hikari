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

    const MAX_FILE_SIZE = 900 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("O vídeo ultrapassa o limite de 900 MB.");
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

    if (!prepareData.videoUrl) {
      throw new Error("A URL do vídeo não foi gerada.");
    }

    const uploadResponse = await fetch(prepareData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => "");

      throw new Error(
        errorText || `Falha no upload do vídeo (${uploadResponse.status}).`,
      );
    }

    onDone(prepareData.videoUrl);
  } finally {
    input.remove();
  }
      }
