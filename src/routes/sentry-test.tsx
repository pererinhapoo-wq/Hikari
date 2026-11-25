import * as Sentry from "@sentry/tanstackstart-react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

const TEST_MESSAGE = "HIKARI_PREVIEW_CONTROLLED_TEST";

const getPreviewSentryTestAvailability = createServerFn({ method: "GET" }).handler(
  async () => ({
    isPreview: process.env.VERCEL_ENV === "preview",
  }),
);

export const Route = createFileRoute("/sentry-test")({
  staleTime: 0,
  gcTime: 0,
  loader: async () => getPreviewSentryTestAvailability(),
  head: () => ({
    meta: [
      { title: "Teste Controlado Sentry | Hikari" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SentryTestPage,
});

type TestResultState = {
  status: "idle" | "sending" | "sent" | "error";
  eventId: string | null;
  passedBeforeSend: boolean | null;
  transportStatusCode: number | null;
  flushed: boolean | null;
  summary: string;
};

function SentryTestPage() {
  const { isPreview } = Route.useLoaderData();
  const [hydrated, setHydrated] = useState(false);
  const [sdkInitialized, setSdkInitialized] = useState(false);
  const [sdkEnabled, setSdkEnabled] = useState(false);
  const [result, setResult] = useState<TestResultState>({
    status: "idle",
    eventId: null,
    passedBeforeSend: null,
    transportStatusCode: null,
    flushed: null,
    summary: "Aguardando acionamento manual.",
  });
  const sendingRef = useRef(false);

  useEffect(() => {
    setHydrated(true);
    if (!isPreview) return;
    setSdkInitialized(Sentry.isInitialized());
    setSdkEnabled(Sentry.isEnabled());
  }, [isPreview]);

  if (!isPreview) {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 pb-16 text-fg">
        <section className="space-y-3 rounded-2xl border border-white/10 bg-elevated p-6">
          <h1 className="text-lg font-semibold">Teste Sentry indisponível</h1>
          <p className="text-sm text-muted">
            Este mecanismo temporário funciona exclusivamente no ambiente Preview e permanece
            desativado em Production e em outros ambientes.
          </p>
        </section>
      </main>
    );
  }

  async function handleSendTest() {
    if (!isPreview || sendingRef.current || result.status === "sent") {
      return;
    }

    const client = Sentry.getClient();
    const initialized = Sentry.isInitialized();
    const enabled = Sentry.isEnabled();
    setSdkInitialized(initialized);
    setSdkEnabled(enabled);

    if (!client || !initialized || !enabled) {
      setResult({
        status: "error",
        eventId: null,
        passedBeforeSend: null,
        transportStatusCode: null,
        flushed: null,
        summary:
          "SDK Sentry não inicializado ou transporte desativado neste build (verifique VITE_SENTRY_DSN no Preview).",
      });
      return;
    }

    sendingRef.current = true;
    setResult({
      status: "sending",
      eventId: null,
      passedBeforeSend: null,
      transportStatusCode: null,
      flushed: null,
      summary: "Enviando evento de teste controlado ao Sentry...",
    });

    let targetEventId = "";
    let beforeSendConfirmed = false;
    let resolvedStatusCode: number | null = null;
    let resolveAfterSend: (() => void) | null = null;

    const afterSendPromise = new Promise<void>((resolve) => {
      resolveAfterSend = resolve;
    });

    const unsubBeforeSend = client.on("beforeSendEvent", (event) => {
      if (
        (targetEventId && event.event_id === targetEventId) ||
        event.message === TEST_MESSAGE
      ) {
        const hasUser = "user" in event && event.user != null;
        beforeSendConfirmed = !hasUser;
      }
    });

    const unsubAfterSend = client.on("afterSendEvent", (event, sendResponse) => {
      if (
        (targetEventId && event.event_id === targetEventId) ||
        event.message === TEST_MESSAGE
      ) {
        if (typeof sendResponse?.statusCode === "number") {
          resolvedStatusCode = sendResponse.statusCode;
        }
        resolveAfterSend?.();
      }
    });

    try {
      targetEventId = Sentry.captureMessage(TEST_MESSAGE, "info");

      const flushed = await Sentry.flush(5000);
      await Promise.race([
        afterSendPromise,
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 400);
        }),
      ]);

      let summary = "Event ID gerado; verifique o recebimento no painel Issues do Sentry.";
      if (!beforeSendConfirmed) {
        summary =
          "Event ID gerado, mas o evento foi descartado pelo beforeSend/sanitizeSentryEvent ou não foi enviado.";
      } else if (resolvedStatusCode !== null && resolvedStatusCode >= 200 && resolvedStatusCode < 300) {
        summary = `Transporte HTTP confirmou entrega (status ${resolvedStatusCode}). Confirme a Issue "${TEST_MESSAGE}" no painel Sentry.`;
      } else if (resolvedStatusCode !== null) {
        summary = `Falha na transmissão HTTP ao Sentry (status ${resolvedStatusCode}).`;
      } else if (flushed) {
        summary =
          "Flush concluído após beforeSend; confirme a chegada no painel Issues do Sentry (status HTTP não informado pelo transporte).";
      }

      const deliveredOk =
        beforeSendConfirmed &&
        (resolvedStatusCode === null
          ? flushed
          : resolvedStatusCode >= 200 && resolvedStatusCode < 300);

      setResult({
        status: deliveredOk ? "sent" : "error",
        eventId: targetEventId || null,
        passedBeforeSend: beforeSendConfirmed,
        transportStatusCode: resolvedStatusCode,
        flushed,
        summary,
      });
    } catch {
      setResult({
        status: "error",
        eventId: targetEventId || null,
        passedBeforeSend: beforeSendConfirmed,
        transportStatusCode: resolvedStatusCode,
        flushed: false,
        summary: "Falha inesperada ao acionar o envio do evento de teste.",
      });
    } finally {
      unsubBeforeSend();
      unsubAfterSend();
      sendingRef.current = false;
    }
  }

  const buttonDisabled =
    !hydrated ||
    !sdkInitialized ||
    !sdkEnabled ||
    result.status === "sending" ||
    result.status === "sent";

  return (
    <main className="mx-auto max-w-md px-4 pt-24 pb-16 text-fg">
      <section className="space-y-5 rounded-2xl border border-white/10 bg-elevated p-6">
        <header className="space-y-1">
          <p className="text-xs font-semibold tracking-wider text-purple-300 uppercase">
            Ambiente Preview • Temporário
          </p>
          <h1 className="text-lg font-bold">Teste Controlado do Sentry</h1>
          <p className="text-xs text-muted">
            Disparo manual único da mensagem sintética <code>{TEST_MESSAGE}</code> via instância
            já inicializada do navegador.
          </p>
        </header>

        <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted">Ambiente Preview validado (servidor):</span>
            <span className="font-semibold text-emerald-400">Sim</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">SDK inicializado no navegador:</span>
            <span className="font-semibold">
              {!hydrated ? "Verificando..." : sdkInitialized ? "Sim" : "Não"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Transporte habilitado:</span>
            <span className="font-semibold">
              {!hydrated ? "Verificando..." : sdkEnabled ? "Sim" : "Não"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSendTest()}
          disabled={buttonDisabled}
          className="min-h-12 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {result.status === "sending"
            ? "Enviando..."
            : result.status === "sent"
              ? "Evento enviado"
              : "Enviar evento de teste ao Sentry"}
        </button>

        <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-4 text-xs">
          <p className="font-semibold text-fg">Resultado</p>
          <p className="text-muted">{result.summary}</p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted">Event ID (SDK):</span>
            <span className="font-mono font-semibold text-purple-300">
              {result.eventId ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Passou por beforeSend/sanitização:</span>
            <span className="font-semibold">
              {result.passedBeforeSend === null
                ? "—"
                : result.passedBeforeSend
                  ? "Sim"
                  : "Não / Descartado"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Status HTTP do transporte:</span>
            <span className="font-mono font-semibold">
              {result.transportStatusCode !== null ? String(result.transportStatusCode) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Flush concluído:</span>
            <span className="font-semibold">
              {result.flushed === null ? "—" : result.flushed ? "Sim" : "Não"}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted">
          Nota: o Event ID confirma apenas a criação local pelo SDK. A validação final depende da
          confirmação no painel Issues do Sentry com a mensagem exata e sem dados sensíveis.
        </p>
      </section>
    </main>
  );
}
