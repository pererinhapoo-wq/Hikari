import { useState, useMemo } from "react";
import {
  Zap,
  Search,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  Film,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useHikariStore } from "@/lib/store";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isHikariAdmin } from "@/lib/auth/admin";
import type { LocalAnime, Episode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PlayerKey =
  | "videoUrl"
  | "videoUrl2"
  | "videoUrl3"
  | "videoUrl4"
  | "videoUrl5";

export const PLAYER_CONFIGS: {
  id: number;
  key: PlayerKey;
  label: string;
}[] = [
  { id: 1, key: "videoUrl", label: "Player 1" },
  { id: 2, key: "videoUrl2", label: "Player 2" },
  { id: 3, key: "videoUrl3", label: "Player 3" },
  { id: 4, key: "videoUrl4", label: "Player 4" },
  { id: 5, key: "videoUrl5", label: "Player 5" },
];

/**
 * Validação não-presuntiva da URL de vídeo:
 * Exige formato HTTP ou HTTPS estrito com domínio válido.
 */
export function validateHttpVideoUrl(url: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, error: "O endereço de vídeo não pode estar em branco." };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        valid: false,
        error: "Apenas protocolos HTTP ou HTTPS são aceitos.",
      };
    }
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return {
        valid: false,
        error: "O domínio da URL informada é inválido.",
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "A URL inserida é inválida ou malformada." };
  }
}

function resolveAnimeDisplayTitle(a: LocalAnime): string {
  return a.titleEnglish || a.titleRomaji || a.titleNative || "Sem título";
}

export function QuickPlayerUpdate() {
  const { user, isPending } = useCurrentUserState();
  const animes = useHikariStore((s) => s.animes);
  const upsertAnime = useHikariStore((s) => s.upsertAnime);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>("");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>("");
  const [selectedPlayerNumber, setSelectedPlayerNumber] = useState<number | null>(
    null,
  );
  const [urlInput, setUrlInput] = useState("");

  // Verificação estrita de autorização de administrador
  if (isPending) return null;
  if (!user || !isHikariAdmin(user.primaryEmail)) {
    return null;
  }

  // Filtro de animes pelo termo de busca
  const matchingAnimes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return animes;
    return animes.filter((a) => {
      const full = `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`.toLowerCase();
      return full.includes(q);
    });
  }, [animes, searchQuery]);

  // Anime atualmente selecionado
  const currentAnime = useMemo(() => {
    if (!selectedAnimeId) return null;
    return animes.find((a) => a.id === selectedAnimeId) ?? null;
  }, [animes, selectedAnimeId]);

  // Temporadas do anime selecionado
  const seasons = useMemo(() => {
    return currentAnime?.seasons ?? [];
  }, [currentAnime]);

  // Temporada atualmente selecionada
  const currentSeason = useMemo(() => {
    if (!selectedSeasonId) return null;
    return seasons.find((s) => s.id === selectedSeasonId) ?? null;
  }, [seasons, selectedSeasonId]);

  // Episódios da temporada selecionada
  const episodes = useMemo(() => {
    return currentSeason?.episodes ?? [];
  }, [currentSeason]);

  // Episódio atualmente selecionado
  const currentEpisode = useMemo(() => {
    if (!selectedEpisodeId) return null;
    return episodes.find((e) => e.id === selectedEpisodeId) ?? null;
  }, [episodes, selectedEpisodeId]);

  // Configuração do player selecionado
  const activePlayerConfig = useMemo(() => {
    if (selectedPlayerNumber === null) return null;
    return (
      PLAYER_CONFIGS.find((p) => p.id === selectedPlayerNumber) ?? null
    );
  }, [selectedPlayerNumber]);

  // URL atual registrada para o player selecionado
  const currentRegisteredUrl = useMemo(() => {
    if (!currentEpisode || !activePlayerConfig) return "";
    return currentEpisode[activePlayerConfig.key] ?? "";
  }, [currentEpisode, activePlayerConfig]);

  // Manipuladores de seleção que preservam a integridade e limpam estados dependentes
  const handleSelectAnime = (id: string) => {
    setSelectedAnimeId(id);
    const targetAnime = animes.find((a) => a.id === id);
    const firstSeason = targetAnime?.seasons?.[0];
    if (firstSeason) {
      setSelectedSeasonId(firstSeason.id);
      setSelectedEpisodeId(firstSeason.episodes?.[0]?.id ?? "");
    } else {
      setSelectedSeasonId("");
      setSelectedEpisodeId("");
    }
    setSelectedPlayerNumber(null);
    setUrlInput("");
  };

  const handleSelectSeason = (sid: string) => {
    setSelectedSeasonId(sid);
    const targetSeason = seasons.find((s) => s.id === sid);
    setSelectedEpisodeId(targetSeason?.episodes?.[0]?.id ?? "");
    setSelectedPlayerNumber(null);
    setUrlInput("");
  };

  const handleSelectEpisode = (eid: string) => {
    setSelectedEpisodeId(eid);
    setSelectedPlayerNumber(null);
    setUrlInput("");
  };

  const handleSelectPlayer = (playerNum: number) => {
    setSelectedPlayerNumber(playerNum);
    const cfg = PLAYER_CONFIGS.find((p) => p.id === playerNum);
    if (cfg && currentEpisode) {
      setUrlInput(currentEpisode[cfg.key] ?? "");
    } else {
      setUrlInput("");
    }
  };

  // Leitura assistida da área de transferência com fallback seguro
  const handlePasteClipboard = async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.readText !== "function"
    ) {
      toast.info(
        "Acesso à área de transferência não suportado neste navegador. Cole manualmente no campo.",
      );
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (!trimmed) {
        toast.info("A área de transferência está vazia.");
        return;
      }
      setUrlInput(trimmed);
      const validation = validateHttpVideoUrl(trimmed);
      if (validation.valid) {
        toast.success("URL colada com sucesso!");
      } else {
        toast.warning(`Texto colado, mas atenção: ${validation.error}`);
      }
    } catch {
      toast.info(
        "Permissão da área de transferência negada. Cole o link manualmente no campo de texto.",
      );
    }
  };

  // Salvamento pontual e seguro
  const handleSave = () => {
    if (!currentAnime) {
      toast.error("Selecione um anime.");
      return;
    }
    if (!selectedSeasonId) {
      toast.error("Selecione uma temporada.");
      return;
    }
    if (!selectedEpisodeId || !currentEpisode) {
      toast.error("Selecione um episódio.");
      return;
    }
    if (selectedPlayerNumber === null || !activePlayerConfig) {
      toast.error(
        "Selecione explicitamente o player que deseja atualizar (Player 1 a 5).",
      );
      return;
    }

    const trimmedUrl = urlInput.trim();
    const validation = validateHttpVideoUrl(trimmedUrl);
    if (!validation.valid) {
      toast.error(validation.error || "Endereço de vídeo inválido.");
      return;
    }

    const playerKey = activePlayerConfig.key;

    // Mutação imutável que preserva todos os outros players, episódios, temporadas e animes
    const updatedAnime: LocalAnime = {
      ...currentAnime,
      seasons: currentAnime.seasons.map((s) => {
        if (s.id !== selectedSeasonId) return s;
        return {
          ...s,
          episodes: s.episodes.map((ep) => {
            if (ep.id !== selectedEpisodeId) return ep;
            return {
              ...ep,
              [playerKey]: trimmedUrl,
            };
          }),
        };
      }),
      updatedAt: Date.now(),
    };

    upsertAnime(updatedAnime);

    toast.success(
      `${activePlayerConfig.label} do Episódio ${currentEpisode.number} atualizado com sucesso!`,
    );
  };

  return (
    <section className="rounded-xl bg-surface p-4 sm:p-5 shadow-[var(--shadow-border)] border border-primary/20">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 sm:size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary border border-primary/25">
            <Zap className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-fg">
                Atualização Rápida de Players
              </h2>
              <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                Rápido
              </span>
            </div>
            <p className="text-xs text-muted">
              Atualize instantaneamente links capturados pelo sniffer sem rolar o
              formulário completo.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {/* ETAPA 1: Localizar Anime */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
            1. Localizar Anime ({matchingAnimes.length} disponíveis)
          </label>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nome do anime..."
                className="pl-9 h-10 text-sm"
              />
            </div>

            <select
              value={selectedAnimeId}
              onChange={(e) => handleSelectAnime(e.target.value)}
              className="w-full h-11 rounded-md bg-elevated px-3 text-sm text-fg border border-white/10 shadow-[var(--shadow-border)] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">-- Escolha um anime no catálogo --</option>
              {matchingAnimes.map((a) => (
                <option key={a.id} value={a.id}>
                  {resolveAnimeDisplayTitle(a)} (
                  {a.seasons.reduce((acc, s) => acc + s.episodes.length, 0)}{" "}
                  eps)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ETAPA 2: Seleção de Temporada e Episódio */}
        {currentAnime && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/5">
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                2. Temporada
              </label>
              <select
                value={selectedSeasonId}
                onChange={(e) => handleSelectSeason(e.target.value)}
                className="w-full h-11 rounded-md bg-elevated px-3 text-sm text-fg border border-white/10 shadow-[var(--shadow-border)] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || `Temporada ${s.number}`} ({s.episodes.length} eps)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                3. Episódio
              </label>
              <select
                value={selectedEpisodeId}
                onChange={(e) => handleSelectEpisode(e.target.value)}
                disabled={episodes.length === 0}
                className="w-full h-11 rounded-md bg-elevated px-3 text-sm text-fg border border-white/10 shadow-[var(--shadow-border)] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
              >
                {episodes.length === 0 ? (
                  <option value="">Nenhum episódio nesta temporada</option>
                ) : (
                  episodes.map((ep) => {
                    const activeP = [
                      ep.videoUrl ? "P1" : null,
                      ep.videoUrl2 ? "P2" : null,
                      ep.videoUrl3 ? "P3" : null,
                      ep.videoUrl4 ? "P4" : null,
                      ep.videoUrl5 ? "P5" : null,
                    ]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <option key={ep.id} value={ep.id}>
                        #{ep.number} — {ep.title || `Episódio ${ep.number}`}
                        {activeP ? ` [${activeP}]` : " [Sem vídeo]"}
                      </option>
                    );
                  })
                )}
              </select>
            </div>
          </div>
        )}

        {/* ETAPA 3: Seleção Explícita de Player */}
        {currentEpisode && (
          <div className="pt-2 border-t border-white/5">
            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">
              4. Selecione o Player para Atualizar (Seleção Explícita Obrigatória)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PLAYER_CONFIGS.map((cfg) => {
                const isSelected = selectedPlayerNumber === cfg.id;
                const hasExistingLink = Boolean(currentEpisode[cfg.key]?.trim());

                return (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={() => handleSelectPlayer(cfg.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer text-center",
                      isSelected
                        ? "border-primary bg-primary/15 text-white ring-1 ring-primary shadow-sm"
                        : "border-white/10 bg-elevated text-fg hover:border-white/20 hover:bg-elevated/80",
                    )}
                  >
                    <span className="font-semibold text-sm">{cfg.label}</span>
                    <span
                      className={cn(
                        "mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-normal",
                        hasExistingLink
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-white/5 text-muted",
                      )}
                    >
                      {hasExistingLink ? "Configurado" : "Vazio"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ETAPA 4: Entrada do Endereço de Vídeo e Ações */}
        {currentEpisode && activePlayerConfig && (
          <div className="pt-3 border-t border-white/5 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted uppercase tracking-wider">
                  5. Nova URL para {activePlayerConfig.label} (Episódio{" "}
                  {currentEpisode.number})
                </label>
                {currentRegisteredUrl && (
                  <span className="text-[11px] text-muted truncate max-w-[200px] sm:max-w-[320px]">
                    Atual:{" "}
                    <span className="text-white/70 font-mono">
                      {currentRegisteredUrl.slice(0, 36)}...
                    </span>
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Cole a URL do vídeo (https://.../video.mp4 ou .m3u8)"
                    className="font-mono text-xs sm:text-sm h-11"
                  />
                  {urlInput && (
                    <button
                      type="button"
                      onClick={() => setUrlInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg text-xs"
                      title="Limpar campo"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePasteClipboard}
                  className="shrink-0 h-11 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Colar da área de transferência"
                >
                  <ClipboardPaste className="size-4 text-primary" />
                  <span>Colar</span>
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-subtle leading-relaxed">
                Apenas o <strong className="text-fg">{activePlayerConfig.label}</strong> do{" "}
                <strong className="text-fg">
                  Episódio {currentEpisode.number}
                </strong>{" "}
                será alterado. Todos os outros dados serão preservados.
              </p>

              <div className="flex gap-2 w-full sm:w-auto">
                {currentRegisteredUrl && urlInput !== currentRegisteredUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setUrlInput(currentRegisteredUrl)}
                    className="flex items-center gap-1 text-xs"
                  >
                    <RotateCcw className="size-3.5" />
                    Restaurar original
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={handleSave}
                  className="w-full sm:w-auto h-11 px-6 font-semibold"
                >
                  <CheckCircle2 className="size-4" />
                  Salvar Alteração
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default QuickPlayerUpdate;
