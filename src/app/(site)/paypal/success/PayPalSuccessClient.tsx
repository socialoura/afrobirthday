"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analyticsEvents";
import { defaultLocale, locales } from "@/i18n/config";

// This page sits outside the localized storefront (PayPal returns to a fixed
// URL), so its few strings are kept here, keyed by the locale PayPal echoes
// back in the return URL.
const COPY: Record<string, { title: string; wait: string; failed: string; back: string }> = {
  en: { title: "Confirming your PayPal payment…", wait: "Please wait, we're validating your payment.", failed: "Payment confirmation failed", back: "Back to order" },
  fr: { title: "Confirmation de votre paiement PayPal…", wait: "Merci de patienter, nous validons votre paiement.", failed: "La confirmation du paiement a échoué", back: "Retour à la commande" },
  es: { title: "Confirmando tu pago con PayPal…", wait: "Espera un momento, estamos validando tu pago.", failed: "No se pudo confirmar el pago", back: "Volver al pedido" },
  de: { title: "Deine PayPal-Zahlung wird bestätigt…", wait: "Bitte warten, wir prüfen deine Zahlung.", failed: "Zahlungsbestätigung fehlgeschlagen", back: "Zurück zur Bestellung" },
  it: { title: "Conferma del pagamento PayPal…", wait: "Attendi, stiamo verificando il pagamento.", failed: "Conferma del pagamento non riuscita", back: "Torna all'ordine" },
  pt: { title: "A confirmar o seu pagamento PayPal…", wait: "Aguarde, estamos a validar o seu pagamento.", failed: "Falha na confirmação do pagamento", back: "Voltar à encomenda" },
  nl: { title: "Je PayPal-betaling wordt bevestigd…", wait: "Even geduld, we controleren je betaling.", failed: "Betalingsbevestiging mislukt", back: "Terug naar bestelling" },
  ar: { title: "جارٍ تأكيد دفعتك عبر PayPal…", wait: "يرجى الانتظار، نتحقق من الدفع.", failed: "فشل تأكيد الدفع", back: "العودة إلى الطلب" },
  hi: { title: "आपके PayPal भुगतान की पुष्टि हो रही है…", wait: "कृपया प्रतीक्षा करें, हम आपका भुगतान सत्यापित कर रहे हैं।", failed: "भुगतान की पुष्टि विफल रही", back: "ऑर्डर पर वापस जाएँ" },
  zh: { title: "正在确认您的 PayPal 付款…", wait: "请稍候，我们正在验证您的付款。", failed: "付款确认失败", back: "返回订单" },
  ru: { title: "Подтверждаем оплату PayPal…", wait: "Пожалуйста, подождите, мы проверяем платёж.", failed: "Не удалось подтвердить оплату", back: "Вернуться к заказу" },
};

export default function PayPalSuccessClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const requestedLocale = searchParams.get("locale");
  const locale =
    requestedLocale && (locales as readonly string[]).includes(requestedLocale)
      ? requestedLocale
      : defaultLocale;
  const copy = COPY[locale] ?? COPY.en;

  useEffect(() => {
    // Effects run twice in development, and a second capture call is wasted
    // work even though the server now treats it as already captured.
    if (startedRef.current) return;
    startedRef.current = true;

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
        // order_completed.
        captureEvent(ANALYTICS_EVENTS.PAYMENT_SUCCEEDED, {
          payment_method_type: "paypal",
          order_id: orderId,
          paypal_order_id: token,
          ...(data?.value != null ? { value: data.value } : {}),
          ...(data?.valueUsd != null ? { value_usd: data.valueUsd } : {}),
          currency: data?.currency ?? "USD",
        });

        // The success page reads the amount from the order itself.
        router.replace(`/${locale}/success?orderId=${encodeURIComponent(orderId)}`);
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
  }, [router, searchParams, locale]);

  return (
    <main
      className="pt-32 md:pt-40 pb-20 min-h-screen bg-dark"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <div className="section-container max-w-2xl text-center">
        <h1 className="heading-2 text-white mb-4">{copy.title}</h1>
        {!error ? (
          <p className="text-white/60">{copy.wait}</p>
        ) : (
          <div className="glass-card p-6 text-left" role="alert">
            <p className="text-red-400 font-semibold mb-2">{copy.failed}</p>
            <p className="text-white/70 text-sm">{error}</p>
            <div className="mt-4">
              <a href={`/${locale}#order`} className="btn-primary inline-flex">
                {copy.back}
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
