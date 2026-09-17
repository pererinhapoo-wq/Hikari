import { upload } from "@vercel/blob/client";

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

    const blob = await upload(
      `hikari/episodes/${file.name}`,
      file,
      {
        access: "public",
        handleUploadUrl: "/api/upload-video",
        multipart: true,
      },
    );

    onDone(blob.url);
  } finally {
    input.remove();
  }
}
