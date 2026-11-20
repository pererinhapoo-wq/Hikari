export async function traceServerFn<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const timestamp = Date.now();
  try {
    console.warn(
      JSON.stringify({
        telemetry: true,
        phase: "start",
        op: "server_fn",
        name,
        timestamp,
      })
    );
  } catch {
    // Ignora falhas de logging
  }

  const start = performance.now();
  try {
    const res = await fn();
    const durationMs = Math.round(performance.now() - start);
    try {
      console.warn(
        JSON.stringify({
          telemetry: true,
          phase: "end",
          op: "server_fn",
          name,
          durationMs,
          status: "success",
        })
      );
    } catch {
      // Ignora falhas de logging
    }
    return res;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    try {
      const errorName = err instanceof Error ? err.name : "UnknownError";
      console.warn(
        JSON.stringify({
          telemetry: true,
          phase: "end",
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
