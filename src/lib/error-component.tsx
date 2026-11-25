import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import * as Sentry from "@sentry/tanstackstart-react";
import { useEffect } from "react";

const FALLBACK_MESSAGE = "Algo deu errado. Recarregue a página.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

const capturedObjectErrors = new WeakSet<object>();
let lastCapturedPrimitive: unknown = null;

export function AppErrorComponent({ error }: ErrorComponentProps) {
  useEffect(() => {
    if (!error) return;
    if (typeof error === "object") {
      if (capturedObjectErrors.has(error)) return;
      capturedObjectErrors.add(error);
    } else {
      if (lastCapturedPrimitive === error) return;
      lastCapturedPrimitive = error;
    }
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Algo deu errado</h1>
      <p className="max-w-md text-sm break-words text-muted">{errorMessage(error)}</p>
    </main>
  );
}
