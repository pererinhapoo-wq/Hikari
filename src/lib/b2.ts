import { getBearerToken } from "@/lib/auth/client";

export async function uploadVideoToB2(
  onDone: (videoUrl: string, file?: File) => void,
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
        const token = getBearerToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const prepareResponse = await fetch("/api/upload-video-player4", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
          }),
        });

        if (!prepareResponse.ok) {
          let errorMsg = `Falha ao preparar o upload (${prepareResponse.status})`;
          try {
            const errData = (await prepareResponse.json()) as { error?: string };
            if (errData?.error) errorMsg = errData.error;
          } catch {
            /* ignore parse error */
          }
          throw new Error(errorMsg);
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

        onDone(prepareData.videoUrl, file);
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
