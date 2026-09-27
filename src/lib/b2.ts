export async function uploadVideoToB2(
  onDone: (videoUrl: string) => void,
): Promise<void> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/mp4,video/webm,video/quicktime";

  return new Promise((resolve, reject) => {
    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        reject(new Error("Nenhum vídeo selecionado."));
        return;
      }

      const allowedTypes = [
        "video/mp4",
        "video/webm",
        "video/quicktime",
      ];

      if (!allowedTypes.includes(file.type)) {
        reject(new Error("Formato de vídeo não permitido."));
        return;
      }

      const maxSize = 900 * 1024 * 1024;

      if (file.size > maxSize) {
        reject(new Error("O vídeo não pode ter mais de 900 MB."));
        return;
      }

      try {
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
            `Falha ao preparar o upload (${prepareResponse.status})`,
          );
        }

        const prepareData = (await prepareResponse.json()) as {
          uploadUrl: string;
          videoUrl: string;
          key: string;
        };

        const uploadResponse = await fetch(prepareData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(
            `Falha no upload para o Backblaze B2 (${uploadResponse.status})`,
          );
        }

        onDone(prepareData.videoUrl);
        resolve();
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("Falha no upload."),
        );
      }
    };

    input.onerror = () => {
      reject(new Error("Não foi possível abrir o seletor de vídeo."));
    };

    input.click();
  });
          }
