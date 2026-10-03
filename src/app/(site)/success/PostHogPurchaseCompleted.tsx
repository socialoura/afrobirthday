"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ORDER_DRAFT_STORAGE_KEY } from "@/lib/utils";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analyticsEvents";

export default function PostHogPurchaseCompleted() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const orderId = searchParams.get("orderId") ?? "";
    const valueParam = searchParams.get("value");
    const valueUsdParam = searchParams.get("valueUsd");
    const currency = searchParams.get("currency") ?? "EUR";

    const value = valueParam != null && valueParam !== "" ? Number(valueParam) : 1.0;
    // `value` is in the currency the customer was charged, so summing it across
    // orders adds pounds to dollars. value_usd is the one to build revenue
    // insights on. Left off rather than guessed when it wasn't passed through.
    const valueUsd =
      valueUsdParam != null && valueUsdParam !== "" ? Number(valueUsdParam) : null;

    if (!orderId) return;
    if (!Number.isFinite(value)) return;

    const key = `posthog_purchase_sent_${orderId}`;
    if (typeof window === "undefined") return;

    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch {
      // ignore
    }

    captureEvent(ANALYTICS_EVENTS.ORDER_COMPLETED, {
      order_id: orderId,
      value,
      currency,
      ...(valueUsd != null && Number.isFinite(valueUsd) ? { value_usd: valueUsd } : {}),
    });

    try {
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(ORDER_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [searchParams]);

  return null;
}
