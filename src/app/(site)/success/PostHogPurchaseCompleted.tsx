"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ORDER_DRAFT_STORAGE_KEY } from "@/lib/utils";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analyticsEvents";

type OrderSummary = { status: string; value: number; currency: string; valueUsd: number };

/** The webhook may land a moment after the redirect: retry briefly. */
async function fetchPaidSummary(orderId: string): Promise<OrderSummary | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`/api/order-summary?orderId=${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const summary = (await res.json()) as OrderSummary;
        if (summary.status === "paid") return summary;
      }
    } catch {
      // network blip: retry
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return null;
}

/**
 * Reports the purchase once per order. Amount and currency come from the
 * order in the database: the URL values could be missing (they used to fall
 * back to 1.0) or edited, and ad platforms bid on this number.
 */
export default function PostHogPurchaseCompleted() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const orderId = searchParams.get("orderId") ?? "";
    if (!orderId) return;

    try {
      window.localStorage.removeItem(ORDER_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }

    const key = `posthog_purchase_sent_${orderId}`;
    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch {
      // ignore
    }

    let cancelled = false;
    fetchPaidSummary(orderId).then((summary) => {
      if (cancelled || !summary) return;
      captureEvent(ANALYTICS_EVENTS.ORDER_COMPLETED, {
        order_id: orderId,
        value: summary.value,
        currency: summary.currency,
        value_usd: summary.valueUsd,
      });
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return null;
}
