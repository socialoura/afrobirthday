/**
 * A/B test of Apple Pay / Google Pay buttons on the payment step.
 *
 * Abandonment at that step is almost all on mobile and never a card decline
 * (Oct 2026: 0 declines in 30 days), so wallets are the obvious candidate. The
 * full Payment Element was removed in Aug 2026 after card conversion fell
 * (commit 7398aeb), hence a measured test of the wallet buttons alone, with
 * the card button unchanged in both arms.
 *
 * The arm is derived from the session order id, so it is stable for the whole
 * form session and stored on the order (orders.checkout_variant) for analysis.
 */

export type CheckoutVariant = "wallets" | "control";

/** Set to false to stop the test: everyone gets "control". */
export const WALLET_TEST_ENABLED = true;

export function checkoutVariantFor(orderId: string | null | undefined): CheckoutVariant {
  if (!WALLET_TEST_ENABLED || !orderId) return "control";
  // Last hex digit of a random UUID: uniform, so parity splits 50/50.
  const last = Number.parseInt(orderId.replace(/-/g, "").slice(-1), 16);
  return Number.isNaN(last) || last % 2 === 0 ? "control" : "wallets";
}

export function parseCheckoutVariant(value: unknown): CheckoutVariant | undefined {
  return value === "wallets" || value === "control" ? value : undefined;
}
