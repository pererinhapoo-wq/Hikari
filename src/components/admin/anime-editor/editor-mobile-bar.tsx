import { Save, RefreshCw, ArrowLeft, Copy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

interface EditorMobileBarProps {
  title: string;
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  canDuplicate: boolean;
  onDuplicate: () => void;
}

export function EditorMobileBar({
  title,
  isSaving,
  onSave,
  canDuplicate,
  onDuplicate,
}: EditorMobileBarProps) {
  return (
    <div
      aria-label={`Barra rápida de ${title}`}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0811]/95 px-3 py-2.5 backdrop-blur-lg sm:hidden"
    >
      <div className="flex items-center gap-2">
        <Link
          to="/admin"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[var(--studio-panel-alt)] text-[var(--color-muted)] hover:text-white"
          title="Voltar ao catálogo"
          aria-label="Voltar ao catálogo"
        >
          <ArrowLeft className="size-4" />
        </Link>

        {canDuplicate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            className="size-10 shrink-0 border-white/10 bg-[var(--studio-panel-alt)] p-0 text-[var(--color-fg)]"
            title="Duplicar como dublado"
            aria-label="Duplicar como dublado"
          >
            <Copy className="size-4 text-purple-400" />
          </Button>
        )}

        <Button
          type="button"
          disabled={isSaving}
          onClick={onSave}
          className="h-10 flex-1 bg-purple-600 text-xs font-semibold text-white hover:bg-purple-500"
        >
          {isSaving ? (
            <>
              <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
              <span>Salvando…</span>
            </>
          ) : (
            <>
              <Save className="mr-1.5 size-3.5" />
              <span className="truncate">Salvar Alterações</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
