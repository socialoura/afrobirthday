"use client";

import { hasAdsConsent } from "@/lib/consent";
import { ZERO_DECIMAL_CURRENCIES } from "@/lib/currency";

/**
 * Browser-side conversion signals for ad platforms: the OpenAI (ChatGPT Ads)
 * pixel and GA4 ecommerce events. Called from captureEvent so that one
 * analytics call feeds PostHog, GA4 and the pixel consistently.
 *
 * The server-side half (Conversions API) lives in src/lib/openaiConversions.ts
 * and shares the order id as event id so the platform deduplicates them.
 */

type Oaiq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;

function oaiq(): Oaiq | null {
  return (window as unknown as { oaiq?: Oaiq }).oaiq ?? null;
}

function gtag(): Gtag | null {
  return (window as unknown as { gtag?: Gtag }).gtag ?? null;
}

/** OpenAI expects amounts in the currency's minor unit (12999 = $129.99). */
function toMinor(value: number, currency: string): number {
  return (ZERO_DECIMAL_CURRENCIES as Set<string>).has(currency.toUpperCase())
    ? Math.round(value)
    : Math.round(value * 100);
}

const PRODUCT_CONTENT = {
  id: "afrobirthday-video",
  name: "Personalized birthday video",
  content_type: "product",
};

/**
 * oaiq("measure", event, data, options): data always uses the "contents"
 * shape; event_id goes in the options so the pixel and the Conversions API
 * call for the same order are deduplicated.
 */
export function pixelMeasure(
  event: "page_viewed" | "contents_viewed" | "checkout_started" | "order_created",
  data?: { value?: number; currency?: string; eventId?: string }
): void {
  if (typeof window === "undefined" || !hasAdsConsent()) return;
  const q = oaiq();
  if (!q) return;
  const payload: Record<string, unknown> = {
    type: "contents",
    contents: [event === "page_viewed" ? { id: window.location.pathname, content_type: "page" } : PRODUCT_CONTENT],
  };
  if (data?.value != null && data.currency) {
    payload.amount = toMinor(data.value, data.currency);
    payload.currency = data.currency.toUpperCase();
  }
  if (data?.eventId) q("measure", event, payload, { event_id: data.eventId });
  else q("measure", event, payload);
}

/** GA4 recommended ecommerce events; Consent Mode decides what is stored. */
export function ga4Event(
  name: "begin_checkout" | "add_payment_info" | "purchase",
  params: { value?: number; currency?: string; transactionId?: string; paymentType?: string }
): void {
  if (typeof window === "undefined") return;
  const g = gtag();
  if (!g) return;
  g("event", name, {
    ...(params.value != null ? { value: params.value } : {}),
    ...(params.currency ? { currency: params.currency.toUpperCase() } : {}),
    ...(params.transactionId ? { transaction_id: params.transactionId } : {}),
    ...(params.paymentType ? { payment_type: params.paymentType } : {}),
    items: [{ item_id: "afrobirthday-video", item_name: "Personalized birthday video" }],
  });
}
