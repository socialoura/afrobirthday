"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type {
  StripeExpressCheckoutElementConfirmEvent,
  StripeError,
} from "@stripe/stripe-js";
import { Lock, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripe() {
  if (!stripePromise && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}

/**
 * Starts fetching Stripe.js (~1 MB) before the payment step is reached.
 * Without this the download only begins once a client secret exists, i.e.
 * after the photo upload and the PaymentIntent round trip have both finished,
 * putting a megabyte of script on the critical path at the worst moment.
 */
export function preloadStripe() {
  getStripe();
}

const STRIPE_ERROR_KEYS = new Set([
  "card_declined",
  "insufficient_funds",
  "expired_card",
  "incorrect_cvc",
  "processing_error",
  "authentication_required",
  "rate_limit",
]);

function prettifyMethodType(type: string) {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface InlineStripePaymentProps {
  clientSecret: string;
  amount: string;
  orderId: string | null;
  termsAccepted: boolean;
  onTermsRequired: () => void;
  onSuccess: () => void;
}

function InnerPaymentForm({
  amount,
  orderId,
  termsAccepted,
  onTermsRequired,
  onSuccess,
}: Omit<InlineStripePaymentProps, "clientSecret">) {
  const t = useTranslations("PaymentModal");
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExpressOptions, setHasExpressOptions] = useState(false);
  const [methodType, setMethodType] = useState("card");

  // Redirect methods come back here instead of resuming in page, so the order
  // id has to survive the round trip for the conversion tracking on /success.
  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/success${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`
      : undefined;

  const humanizeStripeError = (stripeError: StripeError | undefined) => {
    const code = stripeError?.code;
    const key = code && STRIPE_ERROR_KEYS.has(code) ? code : "generic";
    return `${t(`errors.${key}`)} ${t("errors.suffix")}`;
  };

  const confirmPayment = async () => {
    if (!termsAccepted) {
      onTermsRequired();
      return;
    }
    if (!stripe || !elements) return;
    setIsProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(`${submitError.message ?? t("errors.generic")} ${t("errors.suffix")}`);
      setIsProcessing(false);
      return;
    }

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: returnUrl ? { return_url: returnUrl } : undefined,
      redirect: "if_required",
    });

    if (stripeError) {
      setError(humanizeStripeError(stripeError));
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      if (orderId && paymentIntent.id) {
        try {
          await fetch("/api/confirm-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId: paymentIntent.id, orderId }),
          });
        } catch (confirmErr) {
          console.error("Failed to confirm payment:", confirmErr);
        }
      }
      onSuccess();
      return;
    }

    setIsProcessing(false);
  };

  const handleExpressConfirm = async (_event: StripeExpressCheckoutElementConfirmEvent) => {
    await confirmPayment();
  };

  return (
    <div className="mt-5 pt-5 border-t border-white/10">
      {/* Express checkout — Apple Pay / Google Pay / Link / Revolut Pay, shown
          dynamically by Stripe.js itself based on device/browser eligibility.
          No manual UA/platform detection here on purpose. */}
      <div className={hasExpressOptions ? "block" : "hidden"}>
        <p className="text-[11px] font-bold uppercase mb-2.5 text-white/40" style={{ letterSpacing: "0.06em" }}>
          {t("securePayment")}
        </p>
        <ExpressCheckoutElement
          onConfirm={handleExpressConfirm}
          onReady={({ availablePaymentMethods }) =>
            setHasExpressOptions(Boolean(availablePaymentMethods))
          }
          options={{
            buttonHeight: 48,
            buttonTheme: { applePay: "white", googlePay: "white" },
            // Show every available method up front — no "See more" collapse.
            // (maxColumns/maxRows are deliberately left untouched: forcing a
            // column count once broke button width when only 1 method was
            // available. overflow:"never" alone is enough to expand rows.)
            layout: { overflow: "never" },
          }}
        />
      </div>

      {/* Divider — only meaningful when there's an express option above it. */}
      <div className={hasExpressOptions ? "flex items-center gap-3 my-5" : "hidden"} aria-hidden="true">
        <span className="h-px flex-1 bg-white/10" />
        <span className="whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold uppercase bg-white/5 border border-white/10 text-white/50" style={{ letterSpacing: "0.08em" }}>
          {t("orPayWithCard")}
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {/* Card / Klarna / Revolut Pay / Satispay form */}
      <div className={hasExpressOptions ? undefined : "mt-4"}>
        <PaymentElement
          options={{
            layout: { type: "accordion", defaultCollapsed: false, radios: true },
            paymentMethodOrder: ["card", "klarna", "revolut_pay", "satispay"],
            wallets: { applePay: "never", googlePay: "never" },
          }}
          onChange={(e) => setMethodType(e.value.type)}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl p-3.5 text-[13px] leading-relaxed"
          style={{ color: "#ff9a9a", background: "rgba(192,21,39,0.12)", border: "1px solid rgba(192,21,39,0.35)" }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold mb-1.5">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded-lg px-3.5 py-2 text-xs font-bold text-white"
                style={{ background: "#C01527" }}
              >
                {t("retryWithCard")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay button */}
      <button
        type="button"
        onClick={confirmPayment}
        disabled={isProcessing || !stripe || !elements}
        className="checkout-pay-btn"
      >
        {isProcessing ? (
          <>
            <span
              className="w-[18px] h-[18px] rounded-full border-2 border-white/35 border-t-white animate-spin"
              aria-hidden="true"
            />
            <span>{t("processing")}</span>
          </>
        ) : (
          <>
            <Lock size={18} aria-hidden="true" />
            <span>{t("payButtonLabel")}</span>
            <span className="checkout-pay-amount">{amount}</span>
            {methodType !== "card" && <span>· {prettifyMethodType(methodType)}</span>}
            <ArrowRight size={18} aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}

export default function InlineStripePayment({
  clientSecret,
  amount,
  orderId,
  termsAccepted,
  onTermsRequired,
  onSuccess,
}: InlineStripePaymentProps) {
  const t = useTranslations("PaymentModal");
  const stripe = getStripe();

  if (!stripe) {
    return (
      <div className="mt-5 pt-5 border-t border-white/10 text-center flex flex-col items-center gap-3 text-white/70">
        <AlertTriangle size={24} className="text-primary" aria-hidden="true" />
        <p className="font-semibold text-sm text-white">{t("globalError")}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-white font-bold text-sm bg-primary"
        >
          <RefreshCw size={15} aria-hidden="true" />
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <Elements
      key={clientSecret}
      stripe={stripe}
      options={{
        clientSecret,
        // Stripe renders in a cross-origin iframe, so the page's next/font
        // CSS variable isn't visible in there — load DM Sans into the iframe
        // itself and name it literally.
        fonts: [
          {
            cssSrc:
              "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
          },
        ],
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#FF6B35",
            colorBackground: "#26282A",
            colorText: "#FFFFFF",
            colorTextSecondary: "rgba(255,255,255,0.6)",
            colorTextPlaceholder: "rgba(255,255,255,0.4)",
            colorDanger: "#ff9a9a",
            fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
            borderRadius: "14px",
          },
          rules: {
            ".Input": {
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "none",
            },
            ".Input:focus": {
              border: "1px solid #FF6B35",
              boxShadow: "0 0 0 3px rgba(255,107,53,0.25)",
            },
            ".Tab": {
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(255,255,255,0.03)",
            },
            ".Tab:hover": {
              backgroundColor: "rgba(255,255,255,0.06)",
            },
            ".Tab--selected": {
              border: "1px solid #FF6B35",
              backgroundColor: "rgba(255,107,53,0.12)",
            },
            ".Label": {
              color: "rgba(255,255,255,0.7)",
            },
          },
        },
      }}
    >
      <InnerPaymentForm
        amount={amount}
        orderId={orderId}
        termsAccepted={termsAccepted}
        onTermsRequired={onTermsRequired}
        onSuccess={onSuccess}
      />
    </Elements>
  );
}
