const SCRIPT_URL = "https://upload-widget.cloudinary.com/global/all.js";

type CloudinaryWidget = { open: () => void; destroy: () => void };
type CloudinaryGlobal = {
  createUploadWidget: (options: Record<string, unknown>, callback: (error: unknown, result: any) => void) => CloudinaryWidget;
};

declare global {
  interface Window { cloudinary?: CloudinaryGlobal; }
}

function loadWidgetScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Navegador necessário."));
  if (window.cloudinary) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Não foi possível carregar o upload de vídeo.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Não foi possível carregar o upload de vídeo."));
    document.head.appendChild(script);
  });
}

export async function uploadVideoToCloudinary(onDone: (url: string) => void): Promise<void> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || "emz91qt5";
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || "vídeo hikari";
  await loadWidgetScript();
  if (!window.cloudinary) throw new Error("Upload de vídeo indisponível.");

  const widget = window.cloudinary.createUploadWidget(
    {
      cloudName,
      uploadPreset,
      resourceType: "video",
      multiple: false,
      clientAllowedFormats: ["mp4", "webm", "mov", "mkv"],
      maxFileSize: 5_000_000_000,
      sources: ["local"],
      folder: "hikari/episodes",
      showAdvancedOptions: false,
      showPoweredBy: false,
    },
    (error, result) => {
      if (error) {
        widget.destroy();
        return;
      }
      if (result?.event === "success" && result.info?.secure_url) {
        onDone(result.info.secure_url);
        widget.destroy();
      }
    },
  );
  widget.open();
}
