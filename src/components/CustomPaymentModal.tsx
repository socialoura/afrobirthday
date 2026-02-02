"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { X, CreditCard, Lock, ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface CustomPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientSecret: string;
  amount: string;
  productName: string;
  onSuccess: () => void;
}

function VisaLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-auto" style={{ color: "#1434CB" }}>
      <path
        fill="currentColor"
        d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"
      />
    </svg>
  );
}

function MastercardLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-auto">
      <circle cx="9" cy="12" r="7" fill="#EB001B" />
      <circle cx="15" cy="12" r="7" fill="#F79E1B" />
      <path
        fill="#FF5F00"
        d="M12 17.5a7 7 0 010-11 7 7 0 000 11z"
      />
    </svg>
  );
}

function AmexLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-auto" style={{ color: "#2E77BC" }}>
      <rect width="24" height="24" rx="2" fill="currentColor" />
      <text x="12" y="14" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">
        AMEX
      </text>
    </svg>
  );
}

const cardElementOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#ffffff",
      fontFamily: "system-ui, -apple-system, sans-serif",
      "::placeholder": {
        color: "rgba(255, 255, 255, 0.4)",
      },
    },
    invalid: {
      color: "#ef4444",
    },
  },
};

function PaymentForm({
  clientSecret,
  amount,
  productName,
  onSuccess,
  onClose,
}: {
  clientSecret: string;
  amount: string;
  productName: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("PaymentModal");
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (!termsAccepted) {
      setError(t("errors.termsRequired"));
      return;
    }

    setIsProcessing(true);
    setError(null);

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) {
      setError(t("errors.cardMissing"));
      setIsProcessing(false);
      return;
    }

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardNumber,
        },
      }
    );

    if (stripeError) {
      setError(stripeError.message || t("errors.generic"));
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center">
          <CreditCard size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t("title")}</h2>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/70 text-sm">
          {productName}
        </div>
        <p className="text-3xl font-bold text-primary mt-3">{amount}</p>
      </div>

      {/* Card Form */}
      <div className="bg-dark/50 rounded-2xl p-5 mb-4 border border-white/10">
        <div className="flex items-center gap-2 mb-4 text-accent text-sm">
          <Lock size={14} />
          <span>{t("securePayment")}</span>
        </div>

        {/* Card Number */}
        <div className="mb-4">
          <label className="block text-white/70 text-sm mb-2">{t("cardNumber")}</label>
          <div className="relative">
            <div className="bg-dark/80 border border-white/20 rounded-xl px-4 py-3.5 focus-within:border-primary transition-colors">
              <CardNumberElement options={cardElementOptions} />
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <VisaLogo />
              <MastercardLogo />
              <AmexLogo />
            </div>
          </div>
        </div>

        {/* Expiry and CVC */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-white/70 text-sm mb-2">{t("expiry")}</label>
            <div className="bg-dark/80 border border-white/20 rounded-xl px-4 py-3.5 focus-within:border-primary transition-colors">
              <CardExpiryElement options={cardElementOptions} />
            </div>
          </div>
          <div>
            <label className="block text-white/70 text-sm mb-2">{t("cvc")}</label>
            <div className="bg-dark/80 border border-white/20 rounded-xl px-4 py-3.5 focus-within:border-primary transition-colors">
              <CardCvcElement options={cardElementOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Terms Checkbox */}
      <label className="flex items-start gap-3 mb-4 cursor-pointer bg-dark/30 rounded-xl p-4 border border-white/10">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="w-5 h-5 mt-0.5 rounded border-white/30 bg-dark/50 text-primary focus:ring-primary focus:ring-offset-0"
        />
        <span className="text-sm text-white/70">
          {t("termsPrefix")}{" "}
          <Link href="/terms" className="text-primary hover:underline" target="_blank">
            {t("termsLink")}
          </Link>
        </span>
      </label>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isProcessing || !stripe}
        className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            {t("processing")}
          </>
        ) : (
          <>
            <Lock size={18} />
            {t("payButton", { amount })}
          </>
        )}
      </button>

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-6 mt-5 text-xs text-white/50">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-green-500" />
          <span>{t("badges.secure")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock size={14} className="text-accent" />
          <span>{t("badges.ssl")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-green-500" />
          <span>{t("badges.guaranteed")}</span>
        </div>
      </div>
    </form>
  );
}

export default function CustomPaymentModal({
  isOpen,
  onClose,
  clientSecret,
  amount,
  productName,
  onSuccess,
}: CustomPaymentModalProps) {
  const t = useTranslations("PaymentModal");

  if (!isOpen || !stripePromise) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-dark/95 backdrop-blur-md" />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-gradient-to-b from-dark via-dark to-dark/95 rounded-3xl p-6 border border-white/10 shadow-2xl shadow-primary/10 animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/80 flex items-center justify-center transition-colors group z-10"
          aria-label={t("close")}
        >
          <X size={18} className="text-white/70 group-hover:text-white" />
        </button>

        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "night",
              variables: {
                colorPrimary: "#f97316",
                colorBackground: "#0a0a0a",
                colorText: "#ffffff",
                colorDanger: "#ef4444",
                fontFamily: "system-ui, -apple-system, sans-serif",
                borderRadius: "12px",
              },
            },
          }}
        >
          <PaymentForm
            clientSecret={clientSecret}
            amount={amount}
            productName={productName}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        </Elements>
      </div>
    </div>
  );
}
