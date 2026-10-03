"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Finishes a payment that completed away from the site.
 *
 * Card payments confirm in place, and CustomPaymentModal posts to
 * /api/confirm-payment itself. Anything that redirects — a 3-D Secure
 * challenge, or a redirect method should one be enabled again — sends the
 * customer away instead, so that code never resumes — leaving the Stripe webhook as the only thing that could mark
 * the order paid. When that webhook doesn't arrive, the customer is charged and
 * the order sits unpaid forever: no video, no confirmation, nothing in the
 * queue. That happened on 2026-08-21.
 *
 * Stripe appends `payment_intent` to the return URL, so confirm from here too.
 * The endpoint re-checks the payment against Stripe and is idempotent, so
 * running alongside the webhook is safe.
 */
export default function ConfirmRedirectPayment() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const paymentIntentId = searchParams.get("payment_intent");
    // No payment_intent means the in-page flow already confirmed this one.
    if (!paymentIntentId) return;

    const redirectStatus = searchParams.get("redirect_status");
    if (redirectStatus && redirectStatus !== "succeeded") return;

    const key = `payment_confirmed_${paymentIntentId}`;
    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch {
      // private mode / storage disabled — a duplicate call is harmless
    }

    fetch("/api/confirm-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId }),
      keepalive: true,
    })
      .then((res) => {
        if (!res.ok) return;
        try {
          window.localStorage.setItem(key, "1");
        } catch {
          // ignore
        }
      })
      .catch((err) => console.error("Failed to confirm redirect payment:", err));
  }, [searchParams]);

  return null;
}
