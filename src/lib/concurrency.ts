export const EPISODE_SAVE_CONCURRENCY = 3;
export const SOURCE_SYNC_CONCURRENCY = 2;

export async function runWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const total = tasks.length;
  if (total === 0) return [];

  const limit = Math.max(
    1,
    Number.isFinite(concurrency) ? Math.floor(concurrency) : 1,
  );
  const results = new Array<T>(total);
  let nextIndex = 0;
  let firstError: unknown = null;
  let hasError = false;

  const workerCount = Math.min(limit, total);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      if (hasError) return;
      const currentIndex = nextIndex;
      if (currentIndex >= total) return;
      nextIndex += 1;

      try {
        results[currentIndex] = await tasks[currentIndex]!();
      } catch (err) {
        if (!hasError) {
          hasError = true;
          firstError = err;
        }
        return;
      }
    }
  });

  await Promise.all(workers);

  if (hasError) {
    throw firstError;
  }

  return results;
}
