import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  ImageIcon,
  Link2,
  Pencil,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { triggerProfileSaveNotification } from "@/components/profile/ProfileSaveNotification";
import { useScrollLock } from "@/lib/scroll-lock";
import { uploadImageFile } from "@/lib/storage/image-storage-client";

interface ProfileEditModalProps {
  isOpen: boolean;
  initialName?: string;
  initialNick: string;
  initialBio: string;
  initialImage?: string | null;
  initialBannerUrl?: string | null;
  initialFavorites: string[];
  onClose: () => void;
  onSave: (data: {
    name: string;
    nick: string;
    bio: string;
    image: string | null;
    bannerUrl: string | null;
    favorites: string[];
  }) => Promise<void>;
}

/**
 * Valida formato e tamanho, e otimiza a imagem no cliente via Canvas.
 * Produz uma imagem WebP leve de alta fidelidade sem inflar o banco de dados.
 */
async function _processImageFile(
  file: File,
  type: "avatar" | "banner",
): Promise<string> {
  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (!validTypes.includes(file.type)) {
    throw new Error("Formato não suportado. Utilize PNG, JPG, WebP ou GIF.");
  }

  // Limite de segurança de 5 MB por arquivo
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("O arquivo selecionado deve ter no máximo 5 MB.");
  }

  // GIFs animados são preservados diretamente se tiverem até 2.5 MB
  if (file.type === "image/gif") {
    if (file.size > 2.5 * 1024 * 1024) {
      throw new Error("O GIF animado pode ter no máximo 2,5 MB.");
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo GIF."));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let targetWidth: number;
          let targetHeight: number;

          if (type === "avatar") {
            const maxDim = 320;
            const aspect = img.width / img.height;
            if (aspect > 1) {
              targetWidth = Math.min(img.width, maxDim);
              targetHeight = Math.round(targetWidth / aspect);
            } else {
              targetHeight = Math.min(img.height, maxDim);
              targetWidth = Math.round(targetHeight * aspect);
            }
          } else {
            const maxWidth = 1200;
            if (img.width > maxWidth) {
              targetWidth = maxWidth;
              targetHeight = Math.round((img.height * maxWidth) / img.width);
            } else {
              targetWidth = img.width;
              targetHeight = img.height;
            }
          }

          canvas.width = Math.max(1, targetWidth);
          canvas.height = Math.max(1, targetHeight);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return reject(new Error("Não foi possível processar a imagem no navegador."));
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/webp", 0.88);
          resolve(dataUrl);
        } catch {
          reject(new Error("Erro ao otimizar a imagem selecionada."));
        }
      };
      img.onerror = () => reject(new Error("O arquivo de imagem selecionado é inválido."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo no dispositivo."));
    reader.readAsDataURL(file);
  });
}

export function ProfileEditModal({
  isOpen,
  initialName = "",
  initialNick,
  initialBio,
  initialImage = null,
  initialBannerUrl = null,
  initialFavorites,
  onClose,
  onSave,
}: ProfileEditModalProps) {
  useScrollLock(isOpen);
  // Estados dos campos
  const [name, setName] = useState(initialName);
  const [nick, setNick] = useState(initialNick);
  const [bio, setBio] = useState(initialBio);
  const [image, setImage] = useState<string | null>(initialImage);
  const [bannerUrl, setBannerUrl] = useState<string | null>(initialBannerUrl);
  const [favoritesStr, setFavoritesStr] = useState(initialFavorites.join(", "));

  // Modos de entrada por URL direta (opcional para quem prefere links)
  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);
  const [tempAvatarUrl, setTempAvatarUrl] = useState("");
  const [showBannerUrlInput, setShowBannerUrlInput] = useState(false);
  const [tempBannerUrl, setTempBannerUrl] = useState("");

  // Estados de controle e feedback
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");
  const [imageProcessing, setImageProcessing] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  // Refs de arquivos
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  // Acessibilidade: ids únicos estáveis para labels e inputs
  const nameInputId = useId();
  const nickInputId = useId();
  const bioInputId = useId();
  const tagsInputId = useId();

  // Resetar campos ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setName(initialName || "");
      setNick(initialNick || "");
      setBio(initialBio || "");
      setImage(initialImage || null);
      setBannerUrl(initialBannerUrl || null);
      setFavoritesStr(initialFavorites.join(", "));
      setError("");
      setSaving(false);
      setSaveSuccess(false);
      setConfirmDiscardOpen(false);
      setShowAvatarUrlInput(false);
      setTempAvatarUrl("");
      setShowBannerUrlInput(false);
      setTempBannerUrl("");
    }
  }, [
    isOpen,
    initialName,
    initialNick,
    initialBio,
    initialImage,
    initialBannerUrl,
    initialFavorites,
  ]);

  if (!isOpen) return null;

  // Verificação de alterações não salvas (dirty state)
  const isDirty =
    (name.trim() !== (initialName || "").trim() && !(name === "" && initialName === "")) ||
    nick.trim().toLowerCase().replace(/^@+/, "") !== (initialNick || "").trim().toLowerCase().replace(/^@+/, "") ||
    bio.trim() !== (initialBio || "").trim() ||
    image !== (initialImage || null) ||
    bannerUrl !== (initialBannerUrl || null) ||
    favoritesStr.trim() !== initialFavorites.join(", ").trim();

  // Tentativa segura de fechamento do modal
  const handleRequestClose = () => {
    if (saving) return;
    if (isDirty) {
      setConfirmDiscardOpen(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setConfirmDiscardOpen(false);
    onClose();
  };

  // Upload e processamento do Avatar para armazenamento permanente
  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageProcessing("avatar");
      setError("");
      const permanentUrl = await uploadImageFile(file, "profile-avatars");
      setImage(permanentUrl);
      setShowAvatarUrlInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a foto de perfil.");
    } finally {
      setImageProcessing(null);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };

  // Upload e processamento do Banner para armazenamento permanente
  const handleBannerFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageProcessing("banner");
      setError("");
      const permanentUrl = await uploadImageFile(file, "profile-banners");
      setBannerUrl(permanentUrl);
      setShowBannerUrlInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o banner.");
    } finally {
      setImageProcessing(null);
      if (bannerInputRef.current) {
        bannerInputRef.current.value = "";
      }
    }
  };

  // Aplicação de link de URL direto para foto
  const handleApplyAvatarUrl = () => {
    const trimmed = tempAvatarUrl.trim();
    if (!trimmed) {
      setShowAvatarUrlInput(false);
      return;
    }
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError("A URL da foto deve começar com http:// ou https://");
      return;
    }
    setImage(trimmed);
    setTempAvatarUrl("");
    setShowAvatarUrlInput(false);
    setError("");
  };

  // Aplicação de link de URL direto para banner
  const handleApplyBannerUrl = () => {
    const trimmed = tempBannerUrl.trim();
    if (!trimmed) {
      setShowBannerUrlInput(false);
      return;
    }
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError("A URL do banner deve começar com http:// ou https://");
      return;
    }
    setBannerUrl(trimmed);
    setTempBannerUrl("");
    setShowBannerUrlInput(false);
    setError("");
  };

  // Submissão do formulário com validações
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const cleanNick = nick.trim().toLowerCase().replace(/^@+/, "");
    const cleanName = name.trim();

    if (!cleanNick) {
      setError("O Nome de usuário (@username) é obrigatório.");
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(cleanNick)) {
      setError(
        "O Username deve ter entre 3 e 30 caracteres e conter exclusivamente letras, números ou sublinhado (_).",
      );
      return;
    }

    if (cleanName.length > 50) {
      setError("O Nome de exibição deve ter no máximo 50 caracteres.");
      return;
    }

    const cleanFavorites = favoritesStr
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);

    try {
      setSaving(true);
      setError("");

      await onSave({
        name: cleanName,
        nick: cleanNick,
        bio: bio.trim(),
        image,
        bannerUrl,
        favorites: cleanFavorites,
      });

      triggerProfileSaveNotification(
        "Perfil atualizado com sucesso.",
        "Alterações salvas",
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível salvar o perfil.",
      );
    } finally {
      setSaving(false);
    }
  };

  // Pré-visualização de tags em tempo real
  const previewTags = favoritesStr
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);

  const initialLetter = (nick || name || "U").charAt(0).toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-5 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) {
          handleRequestClose();
        }
      }}
    >
      <div className="relative flex flex-col w-full max-w-2xl h-full max-h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[90vh] overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0d0c18] shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
        {/* Luzes decorativas sutis de fundo */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-violet-600/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-20 size-60 rounded-full bg-purple-900/15 blur-3xl"
          aria-hidden="true"
        />

        {/* 1. Cabeçalho Fixo do Modal */}
        <div className="relative shrink-0 flex items-center justify-between px-3.5 sm:px-7 py-2.5 sm:py-4 border-b border-white/[0.08] bg-[#0d0c18] z-20">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-violet-500/30 bg-violet-500/15 text-violet-300 shadow-[0_0_15px_rgba(168,85,247,0.25)]">
              <Pencil className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 id="profile-edit-modal-title" className="font-display text-sm sm:text-lg font-bold text-white truncate">
                  Editar Perfil
                </h2>
                {isDirty && !saveSuccess && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-amber-300">
                    Não salvo
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                Personalize sua identidade visível para a comunidade Hikari.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            disabled={saving}
            className="flex size-7 sm:size-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 ml-2"
            aria-label="Fechar janela de edição"
          >
            <X className="size-4 sm:size-5" />
          </button>
        </div>

        {/* 2. Conteúdo Rolável */}
        <div className="relative flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-7 py-3 sm:py-5 pb-8 sm:pb-6 space-y-3.5 sm:space-y-6 overscroll-contain">
          {/* Mensagens de Erro */}

          {error && (
            <div className="flex items-start gap-2 rounded-xl sm:rounded-2xl border border-rose-500/30 bg-rose-500/10 p-2.5 sm:p-3.5 text-xs text-rose-300 animate-in fade-in duration-200">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* PRÉ-VISUALIZAÇÃO AO VIVO DO CABEÇALHO */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/[0.08] bg-[#090812] shadow-inner">
            <div className="px-3 sm:px-3.5 py-1.5 sm:py-2 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-[10px] sm:text-[11px] text-zinc-400">
              <span className="font-semibold uppercase tracking-wider text-zinc-400">
                Pré-visualização do Perfil
              </span>
              <span className="text-zinc-500 text-[10px] sm:text-[11px]">Tempo real</span>
            </div>

            {/* Banner Preview */}
            <div className="relative h-20 sm:h-36 w-full overflow-hidden bg-gradient-to-r from-[#170e2e] via-[#20103b] to-[#0d0918]">
              {bannerUrl ? (
                <>
                  <img
                    src={bannerUrl}
                    alt="Pré-visualização do Banner"
                    className="size-full object-cover"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090812] via-black/20 to-transparent"
                    aria-hidden="true"
                  />
                </>
              ) : (
                <>
                  <div className="pointer-events-none absolute -left-10 -top-10 size-40 rounded-full bg-violet-500/25 blur-[50px]" />
                  <div className="pointer-events-none absolute right-8 top-0 size-48 rounded-full bg-purple-600/20 blur-[60px]" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(168,85,247,0.15),transparent_70%)]" />
                </>
              )}

              {/* Botão de Atalho Rápido para Trocar Banner Sobreposto */}
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={saving || Boolean(imageProcessing)}
                className="absolute right-2 top-2 sm:right-2.5 sm:top-2.5 z-10 inline-flex items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border border-white/20 bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-white backdrop-blur-md transition-all hover:bg-black/80 hover:border-violet-500/50"
                title="Alterar imagem do banner"
              >
                <Camera className="size-3 text-violet-300" />
                <span>{bannerUrl ? "Substituir Banner" : "Adicionar Banner"}</span>
              </button>
            </div>

            {/* Avatar & Informações do Header Sobrepostos */}
            <div className="relative px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
              <div className="flex items-end gap-2.5 sm:gap-3.5 -mt-7 sm:-mt-12">
                {/* Avatar Preview */}
                <div className="relative shrink-0">
                  <div className="size-16 sm:size-24 overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#1c1830] to-[#0c0a17] p-1 shadow-[0_8px_25px_rgba(0,0,0,0.8)] ring-2 ring-[#090812]">
                    <div className="relative size-full overflow-hidden rounded-[10px] sm:rounded-[13px] bg-[#141220]">
                      {image ? (
                        <img
                          src={image}
                          alt="Pré-visualização do Avatar"
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center font-display text-2xl sm:text-3xl font-bold text-violet-300 select-none">
                          {initialLetter}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botão de Atalho para Avatar */}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={saving || Boolean(imageProcessing)}
                    className="absolute -bottom-1 -right-1 flex size-6 sm:size-7 items-center justify-center rounded-lg sm:rounded-xl border border-white/20 bg-violet-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                    title="Alterar foto de perfil"
                  >
                    <Camera className="size-3 sm:size-3.5" />
                  </button>
                </div>

                {/* Nome e Handle */}
                <div className="min-w-0 flex-1 pb-0.5 sm:pb-1">
                  <div className="font-display text-sm sm:text-lg font-bold text-white truncate">
                    {name.trim() || nick.trim() || "Seu Nome"}
                  </div>
                  <div className="text-[11px] sm:text-xs font-mono text-violet-300 truncate">
                    @{nick.trim().toLowerCase().replace(/^@+/, "") || "username"}
                  </div>
                </div>
              </div>

              {/* Pré-visualização de Tags */}
              {previewTags.length > 0 && (
                <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 sm:gap-1.5">
                  {previewTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="rounded-md border border-white/[0.06] bg-white/[0.04] px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CONTROLES DE IMAGEM: AVATAR & BANNER */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Bloco Foto de Perfil */}
            <div className="rounded-xl sm:rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 sm:p-4 space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">
                  Foto de Perfil (Avatar)
                </span>
                {image && (
                  <span className="text-[10px] text-emerald-400 font-medium">
                    Personalizada
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={saving || Boolean(imageProcessing)}
                  className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-violet-500/30 bg-violet-600/20 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-violet-200 transition-all hover:bg-violet-600/30 active:scale-95 disabled:opacity-50"
                >
                  <Upload className="size-3.5" />
                  <span>{image ? "Substituir foto" : "Selecionar foto"}</span>
                </button>

                {image && (
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    disabled={saving || Boolean(imageProcessing)}
                    className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-rose-500/20 bg-rose-500/10 px-2 sm:px-2.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium text-rose-300 transition-all hover:bg-rose-500/20 active:scale-95 disabled:opacity-50"
                    title="Remover foto e usar inicial padrão"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Remover</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowAvatarUrlInput((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] sm:text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <Link2 className="size-3" />
                  <span>Inserir link</span>
                </button>
              </div>

              {/* Input por link URL direto */}
              {showAvatarUrlInput && (
                <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                  <input
                    type="url"
                    value={tempAvatarUrl}
                    onChange={(e) => setTempAvatarUrl(e.target.value)}
                    placeholder="https://exemplo.com/avatar.jpg"
                    className="h-8 sm:h-9 flex-1 rounded-lg sm:rounded-xl border border-white/10 bg-white/[0.04] px-2.5 sm:px-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyAvatarUrl}
                    className="h-8 sm:h-9 rounded-lg sm:rounded-xl bg-violet-600 px-3 text-xs font-medium text-white hover:bg-violet-500"
                  >
                    OK
                  </button>
                </div>
              )}

              <p className="text-[10px] sm:text-[11px] text-zinc-500 leading-tight">
                PNG, JPG, WebP ou GIF (máx. 5 MB). Otimizado automaticamente.
              </p>

              {/* Input oculto */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarFileChange}
                className="hidden"
                aria-label="Upload de foto de perfil"
              />
            </div>

            {/* Bloco Banner do Perfil */}
            <div className="rounded-xl sm:rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 sm:p-4 space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">
                  Banner do Perfil
                </span>
                {bannerUrl && (
                  <span className="text-[10px] text-emerald-400 font-medium">
                    Personalizado
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={saving || Boolean(imageProcessing)}
                  className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-purple-500/30 bg-purple-600/20 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-purple-200 transition-all hover:bg-purple-600/30 active:scale-95 disabled:opacity-50"
                >
                  <ImageIcon className="size-3.5" />
                  <span>{bannerUrl ? "Substituir banner" : "Selecionar banner"}</span>
                </button>

                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerUrl(null)}
                    disabled={saving || Boolean(imageProcessing)}
                    className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-rose-500/20 bg-rose-500/10 px-2 sm:px-2.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium text-rose-300 transition-all hover:bg-rose-500/20 active:scale-95 disabled:opacity-50"
                    title="Remover banner e usar gradiente padrão"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Remover</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowBannerUrlInput((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] sm:text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <Link2 className="size-3" />
                  <span>Inserir link</span>
                </button>
              </div>

              {/* Input por link URL direto */}
              {showBannerUrlInput && (
                <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                  <input
                    type="url"
                    value={tempBannerUrl}
                    onChange={(e) => setTempBannerUrl(e.target.value)}
                    placeholder="https://exemplo.com/banner.jpg"
                    className="h-8 sm:h-9 flex-1 rounded-lg sm:rounded-xl border border-white/10 bg-white/[0.04] px-2.5 sm:px-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBannerUrl}
                    className="h-8 sm:h-9 rounded-lg sm:rounded-xl bg-violet-600 px-3 text-xs font-medium text-white hover:bg-violet-500"
                  >
                    OK
                  </button>
                </div>
              )}

              <p className="text-[10px] sm:text-[11px] text-zinc-500 leading-tight">
                Panorâmico (3:1). PNG, JPG ou WebP (máx. 5 MB).
              </p>

              {/* Input oculto */}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleBannerFileChange}
                className="hidden"
                aria-label="Upload de banner do perfil"
              />
            </div>
          </div>

          {/* FORMULÁRIO DE TEXTO */}
          <form id="profile-edit-form" onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* Nome de Exibição */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor={nameInputId} className="block text-xs font-semibold text-zinc-300">
                  Nome de Exibição
                </label>
                <span className="text-[10px] sm:text-[11px] text-zinc-500 tabular-nums">
                  {name.length}/50
                </span>
              </div>
              <input
                id={nameInputId}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                maxLength={50}
                placeholder="Ex: Elizabeth Liones, Luffy, Frieren"
                className="mt-1 h-10 sm:h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 sm:px-3.5 text-xs sm:text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-violet-500/80 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20"
              />
              <p className="mt-1 text-[10px] sm:text-[11px] text-zinc-500">
                Como seu nome aparecerá para os outros membros nas discussões e no perfil.
              </p>
            </div>

            {/* Username (@handle) */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor={nickInputId} className="block text-xs font-semibold text-zinc-300">
                  Nome de Usuário (@username)
                </label>
                <span className="text-[10px] sm:text-[11px] text-zinc-500 tabular-nums">
                  {nick.replace(/^@+/, "").length}/30
                </span>
              </div>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-semibold text-violet-400">
                  @
                </span>
                <input
                  id={nickInputId}
                  type="text"
                  value={nick.replace(/^@+/, "")}
                  onChange={(e) => {
                    setNick(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                    setError("");
                  }}
                  maxLength={30}
                  placeholder="seu_username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-10 sm:h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-7 pr-3 sm:pl-8 sm:pr-4 text-xs sm:text-sm font-mono text-white outline-none transition-all placeholder:text-zinc-600 focus:border-violet-500/80 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <p className="mt-1 text-[10px] sm:text-[11px] text-zinc-500">
                Identificador exclusivo de 3 a 30 caracteres (letras, números ou _).
              </p>
            </div>

            {/* Biografia */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor={bioInputId} className="block text-xs font-semibold text-zinc-300">
                  Biografia
                </label>
                <span className="text-[10px] sm:text-[11px] text-zinc-500 tabular-nums">
                  {bio.length}/500
                </span>
              </div>
              <textarea
                id={bioInputId}
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  setError("");
                }}
                maxLength={500}
                rows={2}
                placeholder="Fale um pouco sobre seus animes favoritos, gêneros que acompanha ou sua jornada no Hikari..."
                className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-2.5 sm:p-3 text-xs sm:text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-violet-500/80 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20 sm:rows-3"
              />
            </div>

            {/* Frase de Destaque / Tags Pessoais */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor={tagsInputId} className="block text-xs font-semibold text-zinc-300">
                  Frase de Destaque ou Tags de Interesses
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-violet-400">
                  <Sparkles className="size-3" />
                  <span>Destaques</span>
                </span>
              </div>
              <input
                id={tagsInputId}
                type="text"
                value={favoritesStr}
                onChange={(e) => {
                  setFavoritesStr(e.target.value);
                  setError("");
                }}
                placeholder="Ex: Shounen, Frieren, Ficção Científica, Wit Studio"
                className="mt-1 h-10 sm:h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 sm:px-3.5 text-xs sm:text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-violet-500/80 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20"
              />
              <p className="mt-1 text-[10px] sm:text-[11px] text-zinc-500">
                Separe os termos com vírgulas. Eles aparecem como insígnias no cabeçalho do seu perfil.
              </p>
            </div>
          </form>
        </div>

        {/* 3. Rodapé Fixo com Botões de Ação */}
        <div className="relative shrink-0 flex items-center justify-between px-3.5 sm:px-7 py-2.5 sm:py-4 border-t border-white/[0.08] bg-[#0d0c18] z-20 gap-2 shadow-[0_-8px_20px_rgba(0,0,0,0.5)]">
          <div className="text-[11px] sm:text-xs text-zinc-500 truncate max-w-[130px] sm:max-w-none">
            {isDirty ? (
              <span className="text-amber-300/90 font-medium">
                Alterações pendentes
              </span>
            ) : (
              <span>Nenhuma alteração</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-zinc-300 transition-all hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="profile-edit-form"
              disabled={saving || !isDirty}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="size-3.5 sm:size-4" />
              <span>{saving ? "Salvando..." : "Salvar Alterações"}</span>
            </button>
          </div>
        </div>

        {/* DIÁLOGO INTERNO DE CONFIRMAÇÃO DE DESCARTE (Evita perda silenciosa de dados) */}
        {confirmDiscardOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl border border-amber-500/30 bg-[#121020] p-5 shadow-2xl">
              <div className="flex items-center gap-3 text-amber-400">
                <AlertTriangle className="size-5 shrink-0" />
                <h3 className="font-display font-bold text-sm sm:text-base text-white">
                  Descartar alterações?
                </h3>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-300">
                Você possui modificações não salvas no seu perfil. Se sair agora, todas as edições serão perdidas.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDiscardOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/[0.1]"
                >
                  Continuar editando
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-500"
                >
                  Descartar e fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
