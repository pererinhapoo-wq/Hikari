/**
 * Hikari Telemetry Module
 * 
 * Fornece instrumentação leve e não-bloqueante para Server Functions e operações críticos
 * do Hikari principal, medindo duração via performance.now() e registrando eventos
 * em JSON estruturado para os Runtime Logs da Vercel.
 */

export const SLOW_OPERATION_THRESHOLD_MS = 5000;
export const SUCCESS_SAMPLING_RATE = 0.05; // 5% de amostragem para sucessos rápidos

interface TelemetryOptions {
  name: string;
  slowThresholdMs?: number;
  successSamplingRate?: number;
}

/**
 * Envolve uma Server Function com telemetria de duração e status.
 * 
 * - Mede o tempo com performance.now().
 * - Registra 100% dos erros com a categoria segura (error.name).
 * - Registra operações lentas acima de SLOW_OPERATION_THRESHOLD_MS.
 * - Aplica amostragem em sucessos rápidos.
 * - Nunca propaga erros de logging nem altera o resultado/erro original.
 */
export async function traceServerFn<T>(
  name: string,
  fn: () => Promise<T>,
  options?: Partial<TelemetryOptions>
): Promise<T> {
  const start = performance.now();
  const slowThreshold = options?.slowThresholdMs ?? SLOW_OPERATION_THRESHOLD_MS;
  const samplingRate = options?.successSamplingRate ?? SUCCESS_SAMPLING_RATE;

  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);

    try {
      const isSlow = durationMs >= slowThreshold;
      const shouldSampleSuccess = isSlow || Math.random() < samplingRate;

      if (shouldSampleSuccess) {
        console.log(
          JSON.stringify({
            telemetry: true,
            op: "server_fn",
            name,
            durationMs,
            status: isSlow ? "slow_success" : "success",
          })
        );
      }
    } catch {
      // Ignora falhas de logging para nunca afetar o fluxo principal
    }

    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);

    try {
      const errorName = err instanceof Error ? err.name : "UnknownError";
      console.error(
        JSON.stringify({
          telemetry: true,
          op: "server_fn",
          name,
          durationMs,
          status: "error",
          error: errorName,
        })
      );
    } catch {
      // Ignora falhas de logging
    }

    throw err;
  }
}
