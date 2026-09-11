import { getSetting } from "@/lib/db";

/**
 * The running price test, defined by one settings row.
 *
 * One row does three jobs: it records when the price changed (the report's
 * before/after boundary), which currencies were left alone as the control
 * group, and what PayPal used to charge them. Keeping all three together means
 * they cannot drift apart — and ending the test is removing, or stamping
 * endedAt on, a single row.
 */

export const PRICE_TEST_SETTING = "price_test";

export type PricePoint = {
  base: number;
  customSong: number;
  expressDelivery: number;
  danceExtended: number;
};

export type PriceTest = {
  id: string;
  /** ISO timestamp of the price change. */
  startedAt: string;
  /** Set when the test is over; the definition stays readable for the report. */
  endedAt?: string;
  description: string;
  /** Currencies whose price was deliberately left unchanged. */
  controlCurrencies: string[];
  /**
   * The dollar price list in force before the test. PayPal bills in dollars
   * whatever the customer was shown, so without this the control group's
   * PayPal payers — a fifth of them — would quietly be charged the new price.
   */
  legacyUsdPricing: PricePoint;
};

function isPricePoint(value: unknown): value is PricePoint {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return ["base", "customSong", "expressDelivery", "danceExtended"].every(
    (k) => typeof v[k] === "number" && Number.isFinite(v[k] as number) && (v[k] as number) >= 0
  );
}

/** The test definition, ended or not. Never throws. */
export async function getPriceTestDefinition(): Promise<PriceTest | null> {
  try {
    const raw = await getSetting(PRICE_TEST_SETTING);
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<PriceTest>;
    if (
      typeof t.id !== "string" ||
      typeof t.startedAt !== "string" ||
      Number.isNaN(Date.parse(t.startedAt)) ||
      !Array.isArray(t.controlCurrencies) ||
      !isPricePoint(t.legacyUsdPricing)
    ) {
      return null;
    }
    return {
      id: t.id,
      startedAt: t.startedAt,
      endedAt: typeof t.endedAt === "string" ? t.endedAt : undefined,
      description: typeof t.description === "string" ? t.description : "",
      controlCurrencies: t.controlCurrencies.map((c) => String(c).toUpperCase()),
      legacyUsdPricing: t.legacyUsdPricing,
    };
  } catch {
    // A malformed row must not take checkout down with it.
    return null;
  }
}

/** The test currently in force, or null. Never throws. */
export async function getActivePriceTest(): Promise<PriceTest | null> {
  const test = await getPriceTestDefinition();
  return test && !test.endedAt ? test : null;
}

export function isControlCurrency(test: PriceTest, currency: string): boolean {
  return test.controlCurrencies.includes(currency.toUpperCase());
}
