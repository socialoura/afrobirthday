import { revalidateTag, unstable_cache } from "next/cache";
import { getPricingSettings, getSql, type PricingSettings } from "@/lib/db";
import { getPriceTestDefinition, type PriceTest } from "@/lib/priceTest";
import { ensureFaqTable, type FaqEntry } from "@/lib/faqContent";

/**
 * Database reads used while rendering public pages, cached across requests.
 * Pages are statically generated and revalidated (ISR), so visitors are served
 * from the CDN and never wait on the SSH-tunnelled database; the admin routes
 * that change this content call revalidatePublicContent() to refresh it.
 */

export const PRICING_TAG = "pricing";
export const FAQ_TAG = "faq";
const REVALIDATE_SECONDS = 300;
// At build time ~100 pages render in parallel workers, each opening its own
// tunnel, so reads are much slower than a single background regeneration.
const READ_TIMEOUT_MS = process.env.NEXT_PHASE === "phase-production-build" ? 30_000 : 4_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), READ_TIMEOUT_MS)
    ),
  ]);
}

const cachedPricing = unstable_cache(
  () => withTimeout(getPricingSettings(), "pricing read"),
  ["pricing-settings"],
  { revalidate: REVALIDATE_SECONDS, tags: [PRICING_TAG] }
);

const cachedPriceTest = unstable_cache(
  () => withTimeout(getPriceTestDefinition(), "price test read"),
  ["price-test-definition"],
  { revalidate: REVALIDATE_SECONDS, tags: [PRICING_TAG] }
);

// Throws on failure (unlike getPublishedFaq) so an outage is never cached as
// "no published entries".
const cachedFaq = unstable_cache(
  async (locale: string) =>
    withTimeout(
      (async () => {
        await ensureFaqTable();
        const sql = getSql();
        const rows = await sql<FaqEntry[]>`
          SELECT question, answer
          FROM faq_entries
          WHERE locale = ${locale} AND published = true
          ORDER BY position ASC, id ASC
        `;
        return rows.map((r) => ({ question: r.question, answer: r.answer }));
      })(),
      "faq read"
    ),
  ["published-faq"],
  { revalidate: REVALIDATE_SECONDS, tags: [FAQ_TAG] }
);

export async function getCachedPricingSettings(): Promise<PricingSettings | null> {
  try {
    return await cachedPricing();
  } catch (err) {
    console.error("Cached pricing read failed:", err);
    return null;
  }
}

export async function getCachedPriceTest(): Promise<PriceTest | null> {
  try {
    return await cachedPriceTest();
  } catch (err) {
    console.error("Cached price test read failed:", err);
    return null;
  }
}

export async function getCachedPublishedFaq(locale: string): Promise<FaqEntry[]> {
  try {
    return await cachedFaq(locale);
  } catch (err) {
    console.error(`Cached FAQ read failed for ${locale}:`, err);
    return [];
  }
}

export function revalidatePublicContent(tag: typeof PRICING_TAG | typeof FAQ_TAG) {
  try {
    revalidateTag(tag, { expire: 0 });
  } catch (err) {
    console.error(`revalidateTag(${tag}) failed:`, err);
  }
}
