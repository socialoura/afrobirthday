import {
  CURRENCY_RATES,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from "@/lib/utils";

/**
 * Stripe "zero-decimal" currencies: their smallest unit is the currency itself,
 * so the amount must NOT be multiplied by 100. Only the ones we actually support
 * are listed here. See https://stripe.com/docs/currencies#zero-decimal
 */
export const ZERO_DECIMAL_CURRENCIES = new Set<CurrencyCode>(["JPY"]);

export function isSupportedCurrency(code: unknown): code is CurrencyCode {
  return (
    typeof code === "string" &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
  );
}

/**
 * Fetches live USD-based exchange rates server-side (Frankfurter), falling back
 * to the static CURRENCY_RATES table when the provider is unavailable. This is
 * the authoritative source used to charge the customer — the client-sent amount
 * is never trusted.
 */
export async function getServerExchangeRates(): Promise<
  Record<CurrencyCode, number>
> {
  const symbols = SUPPORTED_CURRENCIES.filter((c) => c !== "USD").join(",");
  const url = `https://api.frankfurter.app/latest?from=USD&to=${symbols}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as { rates?: Record<string, number> };

    const rates: Record<CurrencyCode, number> = { ...CURRENCY_RATES };
    for (const code of SUPPORTED_CURRENCIES) {
      if (code === "USD") continue;
      const val = data.rates?.[code];
      if (typeof val === "number" && Number.isFinite(val) && val > 0) {
        rates[code] = val;
      }
    }
    return rates;
  } catch (err) {
    console.error("getServerExchangeRates error:", err);
    return { ...CURRENCY_RATES };
  }
}

/** Converts a decimal amount already expressed in `currency` to Stripe's smallest unit. */
export function toStripeMinor(localAmount: number, currency: CurrencyCode): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency)
    ? Math.round(localAmount)
    : Math.round(localAmount * 100);
}

export type PriceComponents = {
  base: number;
  customSong: number;
  expressDelivery: number;
};

/** Per-currency manual price overrides; any subset of components may be set. */
export type CurrencyOverride = Partial<PriceComponents>;

export type ResolvedCharge = {
  /** Validated currency that will be charged. */
  currency: CurrencyCode;
  /** USD -> currency rate actually used (1 for overridden components). */
  rate: number;
  /** Human-readable local amount, e.g. 18.39 (EUR) or 2999 (JPY). */
  localAmount: number;
  /** Integer amount in the currency's smallest unit, ready for Stripe. */
  stripeAmount: number;
};

/**
 * Resolves the amount to charge in the customer's local currency.
 *
 * For each price component (base / customSong / expressDelivery) a manual
 * override for that currency wins; otherwise the USD price is converted with
 * the live rate. This lets the admin pin clean local prices (e.g. 19,99 €) while
 * other currencies fall back to automatic conversion.
 */
export function resolveLocalCharge(params: {
  usdPricing: PriceComponents;
  hasCustomSong: boolean;
  isExpress: boolean;
  currency: CurrencyCode;
  rates: Record<CurrencyCode, number>;
  override?: CurrencyOverride;
}): ResolvedCharge {
  const { usdPricing, hasCustomSong, isExpress, currency, rates, override } = params;
  const rate = rates[currency] ?? CURRENCY_RATES[currency] ?? 1;

  const component = (key: keyof PriceComponents): number => {
    const ov = override?.[key];
    if (typeof ov === "number" && Number.isFinite(ov) && ov >= 0) return ov;
    return usdPricing[key] * rate;
  };

  let local = component("base");
  if (hasCustomSong) local += component("customSong");
  if (isExpress) local += component("expressDelivery");

  const stripeAmount = toStripeMinor(local, currency);
  const localAmount = ZERO_DECIMAL_CURRENCIES.has(currency)
    ? stripeAmount
    : stripeAmount / 100;

  return { currency, rate, localAmount, stripeAmount };
}

/** Formats a Stripe (smallest-unit) amount back to a decimal string for display. */
export function formatStripeAmount(
  amount: number,
  currency: string
): string {
  const code = currency.toUpperCase();
  const isZeroDecimal = (ZERO_DECIMAL_CURRENCIES as Set<string>).has(code);
  const value = isZeroDecimal ? amount : amount / 100;
  return `${value.toFixed(isZeroDecimal ? 0 : 2)} ${code}`;
}
