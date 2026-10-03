"use client";

import { Component, useState, type ReactNode } from "react";
import { Elements, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type {
  StripeElementLocale,
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementReadyEvent,
} from "@stripe/stripe-js";
import { useTranslations } from "next-intl";
import { preloadStripe } from "@/components/CustomPaymentModal";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analyticsEvents";

type Props = {
  clientSecret: string;
  orderId: string | null;
  locale: string;
  value: number;
  valueUsd: number;
  currency: string;
  onSuccess: () => void;
};

/**
 * Apple Pay / Google Pay buttons for the "wallets" arm of the checkout test
 * (src/lib/checkoutVariant.ts). Wallets only: Link, PayPal and Amazon Pay are
 * switched off so this never turns back into the multi-method Payment Element
 * that hurt conversion. Renders nothing on devices without a wallet.
 */
function WalletButtonsInner({ clientSecret, orderId, locale, value, valueUsd, currency, onSuccess }: Props) {
  const t = useTranslations("OrderForm");
  const stripe = useStripe();
  const elements = useElements();
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const track = (event: Parameters<typeof captureEvent>[0], props: Record<string, unknown> = {}) =>
    captureEvent(event, {
      order_id: orderId,
      value,
      value_usd: valueUsd,
      currency,
      checkout_variant: "wallets",
      ...props,
    });

  const onReady = (event: StripeExpressCheckoutElementReadyEvent) => {
    const methods = event.availablePaymentMethods;
    const any = Boolean(methods && Object.values(methods).some(Boolean));
    setAvailable(any);
    track(ANALYTICS_EVENTS.PAYMENT_ELEMENT_READY, {
      element: "express_checkout",
      wallets: methods ? Object.keys(methods).filter((k) => methods[k as keyof typeof methods]) : [],
    });
  };

  const onConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements) return;
    setError(null);
    track(ANALYTICS_EVENTS.PAYMENT_SUBMITTED, { payment_method_type: event.expressPaymentType });

    const returnUrl = `${window.location.origin}/${locale}/success?orderId=${encodeURIComponent(orderId ?? "")}`;
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (stripeError) {
      event.paymentFailed({ reason: "fail" });
      track(ANALYTICS_EVENTS.PAYMENT_FAILED, {
        payment_method_type: event.expressPaymentType,
        stage: "confirm",
        error_code: stripeError.code ?? null,
        decline_code: stripeError.decline_code ?? null,
      });
      setError(stripeError.message ?? null);
      return;
    }

    track(ANALYTICS_EVENTS.PAYMENT_SUCCEEDED, {
      payment_method_type: event.expressPaymentType,
      payment_intent_id: paymentIntent?.id,
    });
    if (paymentIntent?.id) {
      // Same server confirmation as the card modal; the webhook is the backup.
      await fetch("/api/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id, orderId }),
      }).catch(() => {});
    }
    onSuccess();
  };

  return (
    <div className={available ? "mt-5" : "h-0 overflow-hidden"}>
      <ExpressCheckoutElement
        onReady={onReady}
        onConfirm={onConfirm}
        options={{
          paymentMethods: { link: "never", paypal: "never", amazonPay: "never" },
          buttonType: { applePay: "buy", googlePay: "buy" },
          buttonTheme: { applePay: "white", googlePay: "white" },
          buttonHeight: 52,
          layout: { overflow: "never" },
        }}
      />
      {available && (
        <>
          {error && (
            <p className="mt-3 text-sm text-red-400 text-center" role="alert">
              {error}
            </p>
          )}
          <div className="mt-5 flex items-center gap-3 text-xs text-white/50" aria-hidden="true">
            <span className="h-px flex-1 bg-white/10" />
            {t("payment.orCard")}
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </>
      )}
    </div>
  );
}

const STRIPE_LOCALES = new Set(["en", "fr", "es", "de", "it", "pt", "nl", "ar", "zh"]);

/**
 * An error in an experiment must never take the order form down with it: on
 * failure the buttons simply disappear and the card button remains.
 */
class WalletErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    captureEvent(ANALYTICS_EVENTS.PAYMENT_FAILED, {
      stage: "wallet_render",
      checkout_variant: "wallets",
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function WalletButtons(props: Props) {
  const stripePromise = preloadStripe();
  if (!stripePromise) return null;
  return (
    <WalletErrorBoundary>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret: props.clientSecret,
          locale: (STRIPE_LOCALES.has(props.locale) ? props.locale : "auto") as StripeElementLocale,
          appearance: { theme: "night" },
        }}
      >
        <WalletButtonsInner {...props} />
      </Elements>
    </WalletErrorBoundary>
  );
}
