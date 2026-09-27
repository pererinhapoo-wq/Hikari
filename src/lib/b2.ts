export function uploadVideoToB2(onDone: (videoUrl: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "video/mp4,video/webm,video/quicktime";

    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        resolve();
        return;
      }

      try {
        const maxSize = 900 * 1024 * 1024;

        if (file.size > maxSize) {
          throw new Error("O vídeo não pode ter mais de 900 MB.");
        }

        const allowedTypes = [
          "video/mp4",
          "video/webm",
          "video/quicktime",
        ];

        if (!allowedTypes.includes(file.type)) {
          throw new Error("Formato de vídeo não permitido.");
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
          uploadUrl: string;
          videoUrl: string;
          key: string;
        };

        if (!prepareData.uploadUrl || !prepareData.videoUrl) {
          throw new Error("O servidor não retornou a URL do upload.");
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
        resolve();
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("Falha no upload do vídeo."),
        );
      }
    };

    input.oncancel = () => {
      resolve();
    };

    input.click();
  });
            }
