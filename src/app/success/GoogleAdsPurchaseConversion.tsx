"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

const SEND_TO = "AW-17929280297/K6rMCKHOnvIbEKm2rOVC";

export default function GoogleAdsPurchaseConversion() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const orderId = searchParams.get("orderId") ?? "";
    const valueParam = searchParams.get("value");
    const currency = searchParams.get("currency") ?? "EUR";

    const value = valueParam != null && valueParam !== "" ? Number(valueParam) : 1.0;

    if (!orderId) return;
    if (!Number.isFinite(value)) return;

    const key = `google_ads_purchase_sent_${orderId}`;
    if (typeof window === "undefined") return;

    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch {
      // ignore
    }

    if (typeof window.gtag !== "function") return;

    window.gtag("event", "conversion", {
      send_to: SEND_TO,
      value,
      currency,
      transaction_id: orderId,
    });

    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // ignore
    }
  }, [searchParams]);

  return null;
}
