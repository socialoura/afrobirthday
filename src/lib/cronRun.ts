import { recordJobRun } from "@/lib/seoDb";

/**
 * Records when a cron actually ran.
 *
 * The implementation notebook recommends replacing fixed schedules with a
 * chain, on the grounds that the host defers scheduled jobs by hours. Measured
 * here first, from the timestamps the crons already leave in the orders table:
 * the median drift is two minutes over the days that could be observed, with
 * one hour-long outlier. The jobs are spaced an hour apart, so they cannot
 * collide, and rewriting nine endpoints into a chain would be work with no
 * measured problem behind it.
 *
 * What was missing is the measurement itself — only one cron left any trace at
 * all. Every pass now records its start, end and outcome, so the drift
 * question can be answered from data in a week rather than argued from a
 * document about a different site.
 */
export async function withCronRun<T>(
  name: string,
  run: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await run();
    // Timing only. The callers return a NextResponse, which serialises to an
    // empty object — recording it would fill the column with "{}".
    // Never let the bookkeeping fail the job it is measuring.
    await recordJobRun(name, true, {
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
    }).catch((err) => console.error(`Failed to record cron run for ${name}:`, err));
    return result;
  } catch (err) {
    await recordJobRun(name, false, {
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => {});
    throw err;
  }
}
