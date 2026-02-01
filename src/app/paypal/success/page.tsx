"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function PayPalSuccessPage() {
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

        router.replace("/success");
      } catch (e) {
        setError(e instanceof Error ? e.message : "PayPal capture failed");
      }
    };

    capture();
  }, [router, searchParams]);

  return (
    <main className="pt-24 pb-20 min-h-screen bg-dark">
      <div className="section-container max-w-2xl text-center">
        <h1 className="heading-2 text-white mb-4">Confirming your PayPal payment…</h1>
        {!error ? (
          <p className="text-white/60">Please wait, we’re validating your payment.</p>
        ) : (
          <div className="glass-card p-6 text-left">
            <p className="text-error font-semibold mb-2">Payment confirmation failed</p>
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
