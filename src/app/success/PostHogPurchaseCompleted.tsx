"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";

export default function PostHogPurchaseCompleted() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const orderId = searchParams.get("orderId") ?? "";
    const valueParam = searchParams.get("value");
    const currency = searchParams.get("currency") ?? "EUR";

    const value = valueParam != null && valueParam !== "" ? Number(valueParam) : 1.0;

    if (!orderId) return;
    if (!Number.isFinite(value)) return;

    const key = `posthog_purchase_sent_${orderId}`;
    if (typeof window === "undefined") return;

    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch {
      // ignore
    }

    posthog.capture("order_completed", {
      order_id: orderId,
      value,
      currency,
    });

    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // ignore
    }
  }, [searchParams]);

  return null;
}
