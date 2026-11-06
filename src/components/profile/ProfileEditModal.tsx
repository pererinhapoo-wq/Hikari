import {
  AlertCircle,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface ProfileEditModalProps {
  isOpen: boolean;
  initialNick: string;
  initialBio: string;
  initialFavorites: string[];
  onClose: () => void;
  onSave: (data: {
    nick: string;
    bio: string;
    favorites: string[];
  }) => Promise<void>;
}

export function ProfileEditModal({
  isOpen,
  initialNick,
  initialBio,
  initialFavorites,
  onClose,
  onSave,
}: ProfileEditModalProps) {
  const [nick, setNick] = useState(initialNick);
  const [bio, setBio] = useState(initialBio);
  const [favoritesStr, setFavoritesStr] = useState(
    initialFavorites.join(", "),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setNick(initialNick);
      setBio(initialBio);
      setFavoritesStr(initialFavorites.join(", "));
      setError("");
      setSaving(false);
    }
  }, [isOpen, initialNick, initialBio, initialFavorites]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nick.trim().toLowerCase().replace(/^@+/, "");

    if (!cleanNick) {
      setError("O Nick é obrigatório.");
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(cleanNick)) {
      setError(
        "O Nick deve ter entre 3 e 30 caracteres e usar apenas letras, números ou _.",
      );
      return;
    }

    const cleanFavorites = favoritesStr
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setSaving(true);
      setError("");
      await onSave({
        nick: cleanNick,
        bio: bio.trim(),
        favorites: cleanFavorites,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível salvar o perfil.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0d0c18] p-6 sm:p-8 shadow-2xl">
        {/* Luz decorativa suave */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-violet-600/15 blur-3xl"
          aria-hidden="true"
        />

        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <Pencil className="size-4" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Personalizar Perfil
              </h2>
              <p className="text-xs text-zinc-400">
                Ajuste sua identidade visível para a comunidade.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex size-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Fechar janela"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Campo Nick */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300">
              Username (@handle)
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                @
              </span>
              <input
                type="text"
                value={nick}
                onChange={(e) => {
                  setNick(e.target.value.toLowerCase());
                  setError("");
                }}
                maxLength={30}
                placeholder="seu_nick"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-8 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-violet-500/80 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              3 a 30 caracteres. Use apenas letras, números ou sublinhado (_).
            </p>
          </div>

          {/* Campo Bio */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300">
                Biografia
              </label>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                {bio.length}/500
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                setError("");
              }}
              maxLength={500}
              rows={3}
              placeholder="Fale sobre seus gostos, animes favoritos ou gênero predileto..."
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-violet-500/80 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          {/* Campo Favoritos em Destaque */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300">
              Títulos em Destaque (separados por vírgula)
            </label>
            <input
              type="text"
              value={favoritesStr}
              onChange={(e) => {
                setFavoritesStr(e.target.value);
                setError("");
              }}
              placeholder="Ex: One Piece, Bleach, Frieren, Jujutsu Kaisen"
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-violet-500/80 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Exibidos como insígnias no topo do seu perfil pessoal.
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs sm:text-sm font-semibold text-zinc-300 transition-all hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all hover:bg-violet-500 active:scale-95 disabled:opacity-50"
            >
              <Save className="size-4" />
              <span>{saving ? "Salvando..." : "Salvar Alterações"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
