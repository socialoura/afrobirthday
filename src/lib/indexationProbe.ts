import { inspectUrl, isGscConfigured } from "@/lib/gsc";
import { pickUrlsToInspect, upsertUrlInspection } from "@/lib/seoDb";
import { allIndexableUrls } from "@/lib/seoUrls";

/**
 * How many URLs one nightly pass inspects.
 *
 * The quota would allow the whole site at once, but a rotating batch keeps the
 * load flat and means one failed night leaves no hole in the series. At this
 * size the whole catalogue is covered in about four days.
 */
const BATCH_SIZE = 20;

export type IndexationStats = {
  inspected: number;
  failed: number;
  notIndexed: string[];
  skipped?: string;
};

export async function runIndexationProbe(): Promise<IndexationStats> {
  if (!isGscConfigured()) {
    return { inspected: 0, failed: 0, notIndexed: [], skipped: "GSC not configured" };
  }

  const batch = await pickUrlsToInspect(allIndexableUrls(), BATCH_SIZE);

  let inspected = 0;
  let failed = 0;
  const notIndexed: string[] = [];

  for (const url of batch) {
    try {
      const result = await inspectUrl(url);
      await upsertUrlInspection(result);
      inspected++;
      // PASS is the only verdict that means "in the index". Everything else is
      // worth surfacing with Google's own wording attached.
      if (result.verdict !== "PASS") {
        notIndexed.push(`${url} — ${result.coverageState ?? result.verdict ?? "unknown"}`);
      }
    } catch (err) {
      // One URL failing must not lose the rest of the batch.
      failed++;
      console.error(`Indexation probe failed for ${url}:`, err);
    }
  }

  return { inspected, failed, notIndexed };
}
