import { timingSafeEqual } from "crypto";
import Stripe from "stripe";

/**
 * Synthetic orders: the daily end-to-end purchase check run from the VPS.
 *
 * A request carrying the secret header goes through the real production
 * checkout (same routes, same database, same validation), but its payment is
 * made in Stripe TEST mode and its order lives under its own statuses. Those
 * statuses are never 'pending' or 'paid', so nothing that watches orders
 * (abandoned-cart and review crons, stats, Telegram, the pinned counter) ever
 * sees it, and no email, notification or ad conversion is sent. The checker
 * deletes the order once it has verified it.
 */

export const SYNTHETIC_HEADER = "x-synthetic-order";
export const SYNTHETIC_PENDING = "synthetic_pending";
export const SYNTHETIC_PAID = "synthetic_paid";

export function isSyntheticStatus(status: string | null | undefined): boolean {
  return status === SYNTHETIC_PENDING || status === SYNTHETIC_PAID;
}

/** True only when the header matches SYNTHETIC_ORDER_SECRET (constant-time). */
export function isSyntheticRequest(request: Request): boolean {
  const expected = process.env.SYNTHETIC_ORDER_SECRET;
  const given = request.headers.get(SYNTHETIC_HEADER);
  if (!expected || expected.length < 32 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

let testStripe: Stripe | null = null;

/** Stripe client in TEST mode; refuses to start with anything but a test key. */
export function syntheticStripe(): Stripe {
  const key = process.env.STRIPE_TEST_SECRET_KEY;
  if (!key || !key.startsWith("sk_test_")) {
    throw new Error("STRIPE_TEST_SECRET_KEY is missing or is not a test key");
  }
  testStripe ??= new Stripe(key, { apiVersion: "2024-06-20" });
  return testStripe;
}
