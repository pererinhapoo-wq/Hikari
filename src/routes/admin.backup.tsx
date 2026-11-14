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
import {
  StudioPageHeader,
  StudioPanel,
  StudioStatStrip,
} from "@/components/admin/studio-ui";

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

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<unknown | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

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
      e.target.value = "";
    }
  };

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
    <div className="studio-enter space-y-6">
      <StudioPageHeader
        kicker="Sistema & Infra"
        title="Backup e Dados"
        description="Exporte o catálogo editorial e as preferências do sistema em JSON, ou restaure dados com validação prévia (dry-run) e confirmação obrigatória."
        backTo="/admin"
        backLabel="Voltar à Central"
        status={<span className="studio-mono font-semibold text-violet-300">PostgreSQL</span>}
      />

      {/* Escopo & Segurança */}
      <StudioPanel
        title="Escopo e Garantias de Isolamento dos Backups"
        description="O módulo de backup opera estritamente sobre o catálogo editorial e as preferências globais."
        icon={<Shield className="size-4" />}
      >
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3.5 text-emerald-200">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            <div>
              <strong className="text-white">Incluído no Backup:</strong>
              <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-200/80">
                Catálogo de Animes, Temporadas, Episódios, Players de Vídeo e Configurações Globais (admin_settings).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] p-3.5 text-violet-200">
            <Lock className="mt-0.5 size-4 shrink-0 text-violet-300" />
            <div>
              <strong className="text-white">Preservado &amp; Seguro:</strong>
              <p className="mt-0.5 text-[11px] leading-relaxed text-violet-200/80">
                Contas de usuários, credenciais, sessões, favoritos, histórico e comentários permanecem 100% intocados.
              </p>
            </div>
          </div>
        </div>
      </StudioPanel>

      {/* Seção 1: Exportação de Dados */}
      <StudioPanel
        title="Exportação de Dados (Download JSON)"
        description="Gere arquivos JSON estruturados para salvaguarda externa ou replicação."
        icon={<ArrowDownToLine className="size-4" />}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col justify-between space-y-4 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Layers className="size-4 text-violet-300" />
                <span>Catálogo Completo</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
                Todos os animes, temporadas cadastradas e episódios com players configurados em formato hierárquico.
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => void handleExport("catalog")}
              disabled={isExporting !== null}
              className="h-9 w-full border border-[var(--studio-line)] bg-[var(--studio-panel)] text-xs font-semibold text-white hover:bg-white/10"
            >
              {isExporting === "catalog" ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <FileJson className="mr-1.5 size-3.5 text-violet-300" />
              )}
              Exportar Catálogo
            </Button>
          </div>

          <div className="flex flex-col justify-between space-y-4 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <SlidersHorizontal className="size-4 text-sky-300" />
                <span>Configurações Globais</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
                Todas as chaves da tabela admin_settings (nome, slogan, avisos, preferências de reprodução e módulos).
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => void handleExport("settings")}
              disabled={isExporting !== null}
              className="h-9 w-full border border-[var(--studio-line)] bg-[var(--studio-panel)] text-xs font-semibold text-white hover:bg-white/10"
            >
              {isExporting === "settings" ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <FileJson className="mr-1.5 size-3.5 text-sky-300" />
              )}
              Exportar Configurações
            </Button>
          </div>

          <div className="flex flex-col justify-between space-y-4 rounded-xl border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] p-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-violet-200">
                <HardDriveDownload className="size-4 text-violet-300" />
                <span>Backup Unificado (Full)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-violet-200/80">
                Pacote unificado contendo todo o catálogo e as configurações gerais em um único arquivo de restauração.
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => void handleExport("full")}
              disabled={isExporting !== null}
              className="h-9 w-full bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500"
            >
              {isExporting === "full" ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <ArrowDownToLine className="mr-1.5 size-3.5" />
              )}
              Baixar Backup Completo
            </Button>
          </div>
        </div>
      </StudioPanel>

      {/* Seção 2: Importação de Dados */}
      <StudioPanel
        title="Importação & Restauração de Dados"
        description="Restaure backups com validação de esquema em tempo real antes de qualquer gravação."
        icon={<ArrowUpFromLine className="size-4" />}
        bodyClassName="space-y-5"
      >
        <div className="rounded-xl border-2 border-dashed border-[var(--studio-line-strong)] bg-[var(--studio-panel-alt)] p-6 text-center transition-colors hover:border-[var(--studio-accent-border)]">
          <input
            type="file"
            id="backup-upload-input"
            accept=".json,application/json"
            onChange={(e) => void handleFileSelect(e)}
            className="hidden"
          />

          <label
            htmlFor="backup-upload-input"
            className="flex cursor-pointer flex-col items-center justify-center space-y-2.5"
          >
            <div className="grid size-12 place-items-center rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel)] text-violet-300">
              <Upload className="size-6" />
            </div>

            <div>
              <p className="text-xs font-semibold text-white">
                Clique aqui para selecionar o arquivo de backup (.json)
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--color-subtle)]">
                Suporta exportações de catálogo, configurações ou backup unificado do Hikari
              </p>
            </div>
          </label>
        </div>

        {isValidating && (
          <div className="flex items-center justify-center gap-2 p-4 text-xs text-violet-300">
            <Loader2 className="size-4 animate-spin" />
            <span>Validando estrutura do arquivo de backup (dry-run)...</span>
          </div>
        )}

        {previewResult && uploadedFile && (
          <div className="space-y-4 rounded-xl border border-emerald-500/35 bg-emerald-950/15 p-4">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <div className="flex min-w-0 items-center gap-2 text-emerald-300">
                <FileCheck2 className="size-4 shrink-0" />
                <span className="truncate text-xs font-semibold">
                  Arquivo Válido: {uploadedFile.name}
                </span>
                <span className="studio-mono shrink-0 text-[10px] text-emerald-400/80">
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
                aria-label="Descartar arquivo selecionado"
              >
                <X className="size-4" />
              </button>
            </div>

            <StudioStatStrip
              columns={4}
              items={[
                {
                  label: "Animes Detectados",
                  value: previewResult.counts.animes.toLocaleString("pt-BR"),
                },
                {
                  label: "Temporadas",
                  value: previewResult.counts.seasons.toLocaleString("pt-BR"),
                },
                {
                  label: "Episódios & Players",
                  value: previewResult.counts.episodes.toLocaleString("pt-BR"),
                },
                {
                  label: "Configurações",
                  value: previewResult.counts.settings.toLocaleString("pt-BR"),
                },
              ]}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-emerald-200/80">
                A validação prévia foi concluída sem conflitos estruturais.
              </p>

              <Button
                size="sm"
                onClick={() => setConfirmModalOpen(true)}
                className="h-9 bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Prosseguir para Restauração
              </Button>
            </div>
          </div>
        )}
      </StudioPanel>

      {/* Modal de Confirmação Obrigatória de Restauração */}
      {confirmModalOpen && previewResult && (
        <div
          className="hikari-studio-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="studio-scroll max-h-[88dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[var(--studio-line-strong)] bg-[var(--studio-panel)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-300">
              <div className="grid size-9 place-items-center rounded-lg border border-amber-500/35 bg-amber-500/15">
                <AlertTriangle className="size-5" />
              </div>
              <h3 className="text-base font-semibold text-white">
                Confirmar Importação no PostgreSQL
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              Você está prestes a aplicar os dados do arquivo de backup no banco de dados. Os títulos existentes correspondentes aos IDs do arquivo serão atualizados via upsert transacional.
            </p>

            <div className="space-y-1.5 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-subtle)]">Animes a gravar:</span>
                <span className="studio-tabular font-bold text-white">{previewResult.counts.animes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-subtle)]">Temporadas:</span>
                <span className="studio-tabular font-bold text-white">{previewResult.counts.seasons}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-subtle)]">Episódios:</span>
                <span className="studio-tabular font-bold text-white">{previewResult.counts.episodes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-subtle)]">Configurações globais:</span>
                <span className="studio-tabular font-bold text-white">{previewResult.counts.settings}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isImporting}
                onClick={() => setConfirmModalOpen(false)}
                className="border-[var(--studio-line)] text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isImporting}
                onClick={() => void handleExecuteImport()}
                className="bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500"
              >
                {isImporting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
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
