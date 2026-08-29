import { createUnsubscribeToken } from "@/lib/auth";
import { type Order, getOptedOutEmails, normalizeEmail } from "@/lib/db";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * Opt-out plumbing shared by every automated marketing email: the signed
 * unsubscribe link, the RFC 8058 headers that go with it, and the helpers the
 * cron jobs use to decide who is still allowed to receive one.
 */



/** The nullable "sent_at" column each automated email uses as its guard. */
export type MarketingEmailField =
  | "review_email_sent_at"
  | "abandoned_cart_email_sent_at"
  | "cross_sell_email_sent_at"
  | "annual_reminder_email_sent_at"
  | "referral_email_sent_at";

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function buildUnsubscribeUrl(email: string): string {
  const normalized = normalizeEmail(email);
  const e = base64UrlEncode(normalized);
  const t = createUnsubscribeToken(normalized);
  return `${SITE_URL}/api/unsubscribe?e=${e}&t=${t}`;
}

/**
 * Headers for a marketing send. The List-Unsubscribe URL is what Gmail /
 * Outlook's one-click button posts to, so it has to point at the real
 * endpoint — a mailto alone leaves the recipient with no way out.
 */
export function buildMarketingEmailHeaders(
  email: string,
  orderId?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${buildUnsubscribeUrl(email)}>, <mailto:support@afrobirthday.com?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  if (orderId) {
    headers["X-Entity-Ref-ID"] = orderId;
  }
  return headers;
}

/**
 * Addresses that must not receive a given automated email: everyone on the
 * suppression list, plus everyone who already got this email on an earlier
 * order. The per-order "sent_at" guard alone doesn't cover repeat customers —
 * two orders used to mean two copies of every automated email.
 */
export async function getSuppressedEmails(
  orders: Order[],
  field: MarketingEmailField
): Promise<Set<string>> {
  const suppressed = await getOptedOutEmails();
  for (const order of orders) {
    if (order.email && order[field]) {
      suppressed.add(normalizeEmail(order.email));
    }
  }
  return suppressed;
}

/** Membership test that applies the same normalization the set was built with. */
export function isSuppressed(suppressed: Set<string>, email: string): boolean {
  return suppressed.has(normalizeEmail(email));
}

/**
 * Addresses that have completed a purchase. A customer who abandons the card
 * form and then pays with PayPal a minute later leaves the first attempt behind
 * as a "pending" order, so order status alone would tell the abandoned-cart cron
 * to chase someone who already bought.
 */
export function getPaidEmails(orders: Order[]): Set<string> {
  const paid = new Set<string>();
  for (const order of orders) {
    if (order.email && order.status === "paid") {
      paid.add(normalizeEmail(order.email));
    }
  }
  return paid;
}

/**
 * Keeps one order per address so a single cron run can't send the same email
 * twice to the same person. The runner-up orders are picked up by
 * getSuppressedEmails on the next run, once the winner is marked as sent.
 */
export function dedupeByEmail(orders: Order[]): Order[] {
  const seen = new Set<string>();
  return orders.filter((order) => {
    const key = normalizeEmail(order.email);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
