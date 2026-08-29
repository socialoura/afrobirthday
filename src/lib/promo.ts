import type { PromoCode } from "@/lib/db";
import {
  ZERO_DECIMAL_CURRENCIES,
  toStripeMinor,
  toUsdEquivalent,
  type ResolvedCharge,
} from "@/lib/currency";

type PromoDiscount = Pick<PromoCode, "discount_type" | "discount_value">;

/** discount_value is a percentage (0-100) for 'percentage' codes, or a flat USD amount for 'fixed' codes. */
export function discountedUsdTotal(totalUsd: number, promo: PromoDiscount): number {
  const value = Number(promo.discount_value);
  const discounted =
    promo.discount_type === "percentage" ? totalUsd * (1 - value / 100) : totalUsd - value;
  return Math.max(0, Math.round(discounted * 100) / 100);
}

export function usdDiscountAmount(totalUsd: number, promo: PromoDiscount): number {
  return Math.round((totalUsd - discountedUsdTotal(totalUsd, promo)) * 100) / 100;
}

/**
 * Applies the same USD-denominated discount to an already-localized Stripe
 * charge, converting a 'fixed' discount using the charge's own USD rate so it
 * reduces the local amount by the equivalent value.
 */
export function applyPromoToCharge(charge: ResolvedCharge, promo: PromoDiscount): ResolvedCharge {
  const value = Number(promo.discount_value);
  const discountedLocal = Math.max(
    0,
    promo.discount_type === "percentage"
      ? charge.localAmount * (1 - value / 100)
      : charge.localAmount - value * charge.rate
  );

  const stripeAmount = toStripeMinor(discountedLocal, charge.currency);
  const localAmount = ZERO_DECIMAL_CURRENCIES.has(charge.currency)
    ? stripeAmount
    : stripeAmount / 100;

  // Recomputed rather than carried over: the spread would otherwise keep the
  // pre-discount USD figure on a discounted charge.
  return {
    ...charge,
    localAmount,
    stripeAmount,
    usdEquivalent: toUsdEquivalent(localAmount, charge.rate),
  };
}
