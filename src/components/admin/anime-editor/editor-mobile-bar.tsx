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
    <div className="fixed bottom-0 left-0 right-0 z-40 block border-t border-white/10 bg-zinc-950/90 p-3 backdrop-blur-xl sm:hidden">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/admin"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-elevated/60 text-zinc-400 hover:text-white"
          title="Voltar ao catálogo"
        >
          <ArrowLeft className="size-4" />
        </Link>

        {canDuplicate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            className="h-10 border-white/10 bg-elevated/60 px-3 text-xs text-zinc-300"
            title="Duplicar como dublado"
          >
            <Copy className="size-3.5 text-purple-400" />
          </Button>
        )}

        <Button
          type="button"
          disabled={isSaving}
          onClick={onSave}
          className="h-10 flex-1 bg-purple-600 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500"
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
