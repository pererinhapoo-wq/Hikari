import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  FileCheck2,
  FileJson,
  HardDriveDownload,
  Layers,
  Loader2,
  Lock,
  Shield,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getBearerToken } from "@/lib/auth/client";

export const Route = createFileRoute("/admin/backup")({
  component: AdminBackupPage,
});

interface PreviewResult {
  valid: boolean;
  counts: {
    animes: number;
    seasons: number;
    episodes: number;
    settings: number;
  };
  version: string;
  exportedAt: string | null;
}

function AdminBackupPage() {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Estados de Importação
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<unknown | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Executa download direto de um tipo de exportação
  const handleExport = async (type: "catalog" | "settings" | "full") => {
    if (isExporting) return;
    setIsExporting(type);

    try {
      const token = getBearerToken();
      const res = await fetch(`/api/admin/backup?type=${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Falha ao gerar exportação.");
      }

      // Converte para blob e aciona o download
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      let filename = `hikari-${type}-backup.json`;
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match?.[1]) {
        filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Download de "${filename}" iniciado!`);
    } catch (err) {
      console.error("[admin.backup] Erro de exportação:", err);
      toast.error(
        err instanceof Error ? err.message : "Erro ao exportar dados.",
      );
    } finally {
      setIsExporting(null);
    }
  };

  // Leitura e validação prévia (Dry-Run) do arquivo JSON selecionado
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setPreviewResult(null);
    setIsValidating(true);

    try {
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("O arquivo selecionado não contém um JSON válido.");
      }

      setFileContent(json);

      // Envia ao servidor para validação de schema e contagem prévia
      const token = getBearerToken();
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "preview",
          content: json,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data?.error || "Estrutura do arquivo de backup inválida.");
      }

      setPreviewResult(data);
      toast.success("Arquivo de backup validado com sucesso!");
    } catch (err) {
      setUploadedFile(null);
      setFileContent(null);
      toast.error(
        err instanceof Error ? err.message : "Erro ao processar arquivo.",
      );
    } finally {
      setIsValidating(false);
      // Limpa input para permitir reseleção do mesmo arquivo se necessário
      e.target.value = "";
    }
  };

  // Execução final da importação com confirmação
  const handleExecuteImport = async () => {
    if (!fileContent || isImporting) return;
    setIsImporting(true);

    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "import",
          confirmed: true,
          content: fileContent,
        }),
      });

      const resJson = await res.json();

      if (!res.ok) {
        throw new Error(resJson?.error || "Falha na importação.");
      }

      toast.success(
        resJson.message || "Dados importados com sucesso no PostgreSQL!",
      );
      setConfirmModalOpen(false);
      setUploadedFile(null);
      setFileContent(null);
      setPreviewResult(null);
    } catch (err) {
      console.error("[admin.backup] Erro na importação:", err);
      toast.error(
        err instanceof Error ? err.message : "Erro ao importar dados.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              Backup e Dados
            </h1>
            <span className="studio-mono rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-300">
              PostgreSQL
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Exporte o catálogo editorial e as preferências do sistema em JSON, ou restaure dados com validação prévia (dry-run) e confirmação obrigatória.
          </p>
        </div>
      </div>

      {/* Banner Explicativo do Escopo & Segurança */}
      <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-purple-500/35 bg-purple-500/15 text-purple-300">
            <Shield className="size-4" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-white">
              Escopo e Garantias de Isolamento dos Backups
            </h3>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              O módulo de backup do Hikari Studio opera estritamente sobre o catálogo editorial e as preferências globais do sistema.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1 border-t border-white/[0.06] text-xs">
          <div className="flex items-start gap-2 rounded-lg bg-emerald-950/20 border border-emerald-500/25 p-2.5 text-emerald-200">
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Incluído no Backup:</strong>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">
                Catálogo de Animes, Temporadas, Episódios, Players de Vídeo e Configurações Globais (admin_settings).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-purple-950/20 border border-purple-500/25 p-2.5 text-purple-200">
            <Lock className="size-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Preservado & Seguro:</strong>
              <p className="text-[11px] text-purple-200/80 mt-0.5">
                Contas de usuários, credenciais, sessões, favoritos, histórico e comentários permanecem 100% intocados.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Seção 1: Exportação de Dados */}
      <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-5 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
          <div className="grid size-8 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
            <ArrowDownToLine className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-[var(--color-fg)]">
              Exportação de Dados (Download JSON)
            </h2>
            <p className="text-xs text-[var(--color-subtle)]">
              Gere arquivos JSON estruturados para salvaguarda externa ou replicação
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Card 1: Catálogo */}
          <div className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Layers className="size-4 text-purple-400" />
                <span>Catálogo Completo</span>
              </div>
              <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                Todos os animes, temporadas cadastradas e episódios com players configurados em formato hierárquico.
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => void handleExport("catalog")}
              disabled={isExporting !== null}
              className="w-full bg-white/[0.06] hover:bg-white/10 text-white text-xs border border-white/10 font-semibold"
            >
              {isExporting === "catalog" ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileJson className="size-3.5 mr-1.5 text-purple-400" />
              )}
              Exportar Catálogo
            </Button>
          </div>

          {/* Card 2: Configurações */}
          <div className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <SlidersHorizontal className="size-4 text-blue-400" />
                <span>Configurações Globais</span>
              </div>
              <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                Todas as chaves da tabela admin_settings (nome, slogan, avisos, preferências de reprodução e módulos).
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => void handleExport("settings")}
              disabled={isExporting !== null}
              className="w-full bg-white/[0.06] hover:bg-white/10 text-white text-xs border border-white/10 font-semibold"
            >
              {isExporting === "settings" ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileJson className="size-3.5 mr-1.5 text-blue-400" />
              )}
              Exportar Configurações
            </Button>
          </div>

          {/* Card 3: Backup Unificado */}
          <div className="flex flex-col justify-between rounded-xl border border-purple-500/30 bg-purple-950/15 p-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-200">
                <HardDriveDownload className="size-4 text-purple-400" />
                <span>Backup Unificado (Full)</span>
              </div>
              <p className="text-[11px] text-purple-200/80 leading-relaxed">
                Pacote unificado contendo todo o catálogo e as configurações gerais em um único arquivo de restauração.
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => void handleExport("full")}
              disabled={isExporting !== null}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md"
            >
              {isExporting === "full" ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <ArrowDownToLine className="size-3.5 mr-1.5" />
              )}
              Baixar Backup Completo
            </Button>
          </div>
        </div>
      </div>

      {/* Seção 2: Importação de Dados */}
      <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-5 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
          <div className="grid size-8 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <ArrowUpFromLine className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-[var(--color-fg)]">
              Importação & Restauração de Dados
            </h2>
            <p className="text-xs text-[var(--color-subtle)]">
              Restaure backups com validação de esquema em tempo real antes de qualquer gravação
            </p>
          </div>
        </div>

        {/* Zona de Drop/Seleção de Arquivo */}
        <div className="rounded-xl border-2 border-dashed border-white/15 bg-black/20 p-6 text-center hover:border-purple-500/40 transition-colors">
          <input
            type="file"
            id="backup-upload-input"
            accept=".json,application/json"
            onChange={(e) => void handleFileSelect(e)}
            className="hidden"
          />

          <label
            htmlFor="backup-upload-input"
            className="flex flex-col items-center justify-center cursor-pointer space-y-2"
          >
            <div className="grid size-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-purple-400">
              <Upload className="size-6" />
            </div>

            <div>
              <p className="text-xs font-semibold text-white">
                Clique aqui para selecionar o arquivo de backup (.json)
              </p>
              <p className="text-[11px] text-[var(--color-subtle)] mt-0.5">
                Suporta exportações de catálogo, configurações ou backup unificado do Hikari
              </p>
            </div>
          </label>
        </div>

        {isValidating && (
          <div className="flex items-center justify-center gap-2 p-4 text-xs text-purple-300">
            <Loader2 className="size-4 animate-spin" />
            <span>Validando estrutura do arquivo de backup (dry-run)...</span>
          </div>
        )}

        {/* Card de Diagnóstico do Arquivo / Preview */}
        {previewResult && uploadedFile && (
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-2 text-emerald-300">
                <FileCheck2 className="size-4" />
                <span className="font-semibold text-xs">
                  Arquivo Válido: {uploadedFile.name}
                </span>
                <span className="studio-mono text-[10px] text-emerald-400/80">
                  ({(uploadedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUploadedFile(null);
                  setFileContent(null);
                  setPreviewResult(null);
                }}
                className="text-emerald-400/80 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Contadores Detectados */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                  Animes Detectados
                </span>
                <div className="mt-1 studio-tabular text-lg font-bold text-white">
                  {previewResult.counts.animes}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                  Temporadas
                </span>
                <div className="mt-1 studio-tabular text-lg font-bold text-white">
                  {previewResult.counts.seasons}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                  Episódios & Players
                </span>
                <div className="mt-1 studio-tabular text-lg font-bold text-white">
                  {previewResult.counts.episodes}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                  Configurações
                </span>
                <div className="mt-1 studio-tabular text-lg font-bold text-white">
                  {previewResult.counts.settings}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-emerald-200/80">
                A validação prévia foi concluída sem conflitos estruturais.
              </p>

              <Button
                size="sm"
                onClick={() => setConfirmModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Prosseguir para Restauração
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmação Obrigatória de Restauração */}
      {confirmModalOpen && previewResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[var(--studio-panel)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-300">
              <div className="grid size-9 place-items-center rounded-lg border border-amber-500/35 bg-amber-500/15">
                <AlertTriangle className="size-5" />
              </div>
              <h3 className="font-semibold text-base text-white">
                Confirmar Importação no PostgreSQL
              </h3>
            </div>

            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Você está prestes a aplicar os dados do arquivo de backup no banco de dados. Os títulos existentes correspondentes aos IDs do arquivo serão atualizados via upsert transacional.
            </p>

            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-subtle)]">Animes a gravar:</span>
                <span className="font-bold text-white studio-tabular">{previewResult.counts.animes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-subtle)]">Temporadas:</span>
                <span className="font-bold text-white studio-tabular">{previewResult.counts.seasons}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-subtle)]">Episódios:</span>
                <span className="font-bold text-white studio-tabular">{previewResult.counts.episodes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-subtle)]">Configurações globais:</span>
                <span className="font-bold text-white studio-tabular">{previewResult.counts.settings}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isImporting}
                onClick={() => setConfirmModalOpen(false)}
                className="border-white/10 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isImporting}
                onClick={() => void handleExecuteImport()}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                {isImporting && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                Confirmar e Gravar no Banco
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminBackupPage;
