import { useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getBearerToken } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

interface ProfileReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetNick: string;
  targetName: string;
}

const REPORT_REASONS = [
  { id: "harassment", label: "Assédio ou perseguição" },
  { id: "hate", label: "Ofensas ou discurso abusivo" },
  { id: "spam", label: "Spam ou publicidade indevida" },
  { id: "impersonation", label: "Perfil falso ou tentativa de se passar por outra pessoa" },
  { id: "inappropriate", label: "Conteúdo impróprio" },
  { id: "other", label: "Outro" },
];

export function ProfileReportModal({
  open,
  onOpenChange,
  targetUserId,
  targetNick,
  targetName,
}: ProfileReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("harassment");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successState, setSuccessState] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedReason) {
      setErrorMessage("Por favor, selecione um motivo para a denúncia.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const token = getBearerToken();
      const res = await fetch("/api/profile/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetUserId,
          targetNick,
          reason: selectedReason,
          description: description.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Falha ao enviar denúncia.");
      }

      setSuccessState(true);
      toast.success("Denúncia enviada com sucesso.");
      setTimeout(() => {
        onOpenChange(false);
        setSuccessState(false);
        setSelectedReason("harassment");
        setDescription("");
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar denúncia.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isSubmitting) {
          onOpenChange(isOpen);
          if (!isOpen) {
            setSuccessState(false);
            setErrorMessage(null);
            setDescription("");
          }
        }
      }}
    >
      <DialogContent className="hikari-studio-dialog max-h-[90dvh] overflow-y-auto border border-purple-500/25 bg-[#0f0d18]/98 text-fg shadow-2xl sm:max-w-md">
        <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <DialogTitle className="font-display text-lg font-bold text-fg">
              Denunciar perfil
            </DialogTitle>
            <DialogDescription className="text-xs text-muted">
              @{targetNick} ({targetName})
            </DialogDescription>
          </div>
        </div>

        {successState ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="size-6" />
            </div>
            <p className="text-base font-bold text-fg">Denúncia enviada com sucesso!</p>
            <p className="text-xs text-muted">
              Nossa equipe de moderação irá analisar o perfil reportado com total sigilo.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {errorMessage && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-xs text-rose-200">
                {errorMessage}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-fg">
                Motivo da denúncia <span className="text-rose-400">*</span>
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-xs font-medium cursor-pointer transition-all",
                      selectedReason === r.id
                        ? "border-purple-500/60 bg-purple-500/20 text-white shadow-sm"
                        : "border-white/[0.08] bg-white/[0.02] text-muted hover:border-purple-500/30 hover:bg-white/[0.05] hover:text-fg",
                    )}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.id}
                      checked={selectedReason === r.id}
                      onChange={() => setSelectedReason(r.id)}
                      className="accent-[#a855f7]"
                    />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-fg">
                Descrição adicional <span className="text-subtle font-normal">(Opcional)</span>
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Forneça detalhes adicionais para ajudar a equipe de moderação..."
                rows={3}
                maxLength={1000}
                className="studio-input w-full rounded-xl border border-white/[0.08] bg-black/40 p-3 text-xs text-fg focus:border-purple-500/50 focus:outline-none"
              />
              <div className="text-right text-[10px] text-subtle">
                {description.length}/1000
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
                className="h-9 border-white/[0.08] bg-white/[0.03] text-xs text-muted hover:bg-white/[0.08] hover:text-fg"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-9 bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-700 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar denúncia"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
