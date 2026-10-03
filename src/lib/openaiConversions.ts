import { createHash } from "node:crypto";
import type { Order } from "@/lib/db";
import { isSupportedCurrency, toStripeMinor } from "@/lib/currency";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * ChatGPT Ads Conversions API (https://developers.openai.com/ads/conversions-api).
 *
 * Sends order_created server-side for every paid order whose customer
 * consented to ad measurement, so ad-blocked browsers and closed tabs still
 * count. The event id is the order id, the same value the browser pixel sends
 * as event_id, so OpenAI deduplicates the two.
 *
 * Needs NEXT_PUBLIC_OPENAI_PIXEL_ID and OPENAI_ADS_API_KEY; silently skipped
 * when either is missing.
 */

const ENDPOINT = "https://bzr.openai.com/v1/events";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function sendOrderCreatedConversion(order: Order): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_OPENAI_PIXEL_ID;
  const apiKey = process.env.OPENAI_ADS_API_KEY;
  if (!pixelId || !apiKey || !order.ads_consent) return;

  const currency = (order.currency || "USD").toUpperCase();
  if (!isSupportedCurrency(currency)) return;
  const amount = toStripeMinor(Number(order.total_local ?? order.total_usd), currency);

  const user: Record<string, unknown> = {
    emails_sha256: [sha256(order.email)],
    external_ids_sha256: [sha256(order.id)],
  };
  if (order.country) user.countries = [order.country.toLowerCase()];
  if (order.client_ip) user.ip_address = order.client_ip;
  if (order.client_user_agent) user.user_agent = order.client_user_agent;

  const event: Record<string, unknown> = {
    id: order.id,
    type: "order_created",
    timestamp_ms: Date.now(),
    action_source: "web",
    source_url: `${SITE_URL}/${order.locale ?? "en"}/success`,
    user,
    data: {
      type: "contents",
      amount,
      currency,
      contents: [
        { id: "afrobirthday-video", name: "Personalized birthday video", content_type: "product" },
      ],
    },
  };
  if (order.oai_ref) event.oppref = order.oai_ref;

  try {
    const res = await fetch(`${ENDPOINT}?pid=${encodeURIComponent(pixelId)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ validate_only: false, integration_source: "afrobirthday", events: [event] }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      console.error("OpenAI Conversions API error:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("OpenAI Conversions API request failed:", err);
  }
}
