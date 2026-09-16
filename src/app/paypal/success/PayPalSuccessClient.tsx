"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analyticsEvents";

export default function PayPalSuccessClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const capture = async () => {
      const token = searchParams.get("token");
      const orderId = searchParams.get("orderId");

      if (!token || !orderId) {
        setError("Missing PayPal return parameters.");
        return;
      }

      try {
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, paypalOrderId: token }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "PayPal capture failed");
        }

        const data = (await res.json().catch(() => null)) as
          | { value?: number | null; valueUsd?: number | null; currency?: string }
          | null;

        // payment_succeeded used to fire only from the Stripe card modal, so
        // every PayPal order was missing from it while still showing up in
        // order_completed. Any funnel built on payment_succeeded therefore
        // read PayPal as a 0% conversion rate, and under-reported the
        // locales that favour it (notably de).
        captureEvent(ANALYTICS_EVENTS.PAYMENT_SUCCEEDED, {
          payment_method_type: "paypal",
          order_id: orderId,
          paypal_order_id: token,
          ...(data?.value != null ? { value: data.value } : {}),
          ...(data?.valueUsd != null ? { value_usd: data.valueUsd } : {}),
          currency: data?.currency ?? "USD",
        });

        const qs = new URLSearchParams();
        qs.set("orderId", orderId);
        qs.set("value", data?.value != null ? String(data.value) : "1.0");
        qs.set("currency", data?.currency ?? "USD");
        if (data?.valueUsd != null) qs.set("valueUsd", String(data.valueUsd));
        router.replace(`/success?${qs.toString()}`);
      } catch (e) {
        captureEvent(ANALYTICS_EVENTS.PAYMENT_FAILED, {
          payment_method_type: "paypal",
          order_id: orderId,
          reason: e instanceof Error ? e.message : String(e),
        });
        setError(e instanceof Error ? e.message : "PayPal capture failed");
      }
    };

    capture();
  }, [router, searchParams]);

  return (
    <main className="pt-32 md:pt-40 pb-20 min-h-screen bg-dark">
      <div className="section-container max-w-2xl text-center">
        <h1 className="heading-2 text-white mb-4">Confirming your PayPal payment…</h1>
        {!error ? (
          <p className="text-white/60">Please wait, we’re validating your payment.</p>
        ) : (
          <div className="glass-card p-6 text-left">
            <p className="text-red-400 font-semibold mb-2">Payment confirmation failed</p>
            <p className="text-white/70 text-sm">{error}</p>
            <div className="mt-4">
              <a href="/#order" className="btn-primary inline-flex">
                Back to order
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
