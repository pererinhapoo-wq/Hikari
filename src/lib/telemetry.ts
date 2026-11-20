export async function traceServerFn<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const res = await fn();
    const durationMs = Math.round(performance.now() - start);
    console.log(JSON.stringify({ telemetry: true, op: "server_fn", name, durationMs, status: "success" }));
    return res;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    console.error(JSON.stringify({ telemetry: true, op: "server_fn", name, durationMs, status: "error", error: err instanceof Error ? err.name : "UnknownError" }));
    throw err;
  }
}
