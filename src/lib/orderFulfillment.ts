import type Stripe from "stripe";
import {
  claimPromoCodeUse,
  getOrderById,
  markConfirmationEmailSent,
  markOrderPaid,
  markOrderPaidPayPal,
  type Order,
} from "@/lib/db";
import { capturePayPalOrder, getPayPalOrder, type PayPalOrderSummary } from "@/lib/paypal";
import { notifyOrderPaid } from "@/lib/discordWebhook";
import { handlePossibleReferralRedemption } from "@/lib/referralEmail";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderOrderConfirmationEmailHtml,
  renderOrderConfirmationEmailText,
} from "@/lib/orderEmailTemplates";
import { formatStripeAmount, isSupportedCurrency, toStripeMinor } from "@/lib/currency";
import { sendTelegramMessage } from "@/lib/telegramBot";

/**
 * Everything that happens once per paid order, shared by the three paths that
 * can observe a payment (Stripe client confirm, Stripe webhook, PayPal
 * capture). Callers must only run this after winning the atomic paid claim
 * (markOrderPaid / markOrderPaidPayPal returned true).
 */

/** Sends the confirmation email and records it; alerts the team on failure. */
export async function sendOrderConfirmationEmail(order: Order): Promise<boolean> {
  if (!order.email) return false;
  try {
    await sendEmailWithResend({
      to: order.email,
      subject: `AfroBirthday order confirmation (${order.id})`,
      html: renderOrderConfirmationEmailHtml(order),
      text: renderOrderConfirmationEmailText(order),
    });
    await markConfirmationEmailSent(order.id).catch((err) =>
      console.error("Failed to record confirmation email:", err)
    );
    return true;
  } catch (err) {
    console.error(`Order confirmation email failed for ${order.id}:`, err);
    await sendTelegramMessage(
      `⚠️ <b>Email de confirmation NON envoyé</b>\nCommande <code>${order.id}</code>\nNouvel essai automatique par le cron confirmation-emails.\nErreur: ${
        err instanceof Error ? err.message : String(err)
      }`
    ).catch(() => {});
    return false;
  }
}

export async function runPaidOrderSideEffects(
  order: Order,
  notification: { provider: "Stripe" | "PayPal"; amountLabel: string; paymentRef?: string | null }
): Promise<void> {
  if (order.promo_code) {
    const claimed = await claimPromoCodeUse(order.promo_code).catch((err) => {
      console.error("Failed to claim promo code use:", err);
      return true; // unknown: don't raise a false alarm
    });
    if (!claimed) {
      await sendTelegramMessage(
        `⚠️ <b>Code promo dépassé</b>\nLe code <code>${order.promo_code}</code> a atteint sa limite d'utilisations mais la commande <code>${order.id}</code> l'a utilisé (paiements simultanés).`
      ).catch(() => {});
    }
    await handlePossibleReferralRedemption(order).catch((err) =>
      console.error("Failed to process referral redemption:", err)
    );
  }

  await sendOrderConfirmationEmail(order);

  await notifyOrderPaid({ order, ...notification });
}

/** What the order says the customer should have paid, in Stripe minor units. */
function expectedStripeCharge(order: Order): { amount: number; currency: string } | null {
  const currency = (order.currency || "USD").toUpperCase();
  if (!isSupportedCurrency(currency)) return null;
  const local = Number(order.total_local ?? order.total_usd);
  if (!Number.isFinite(local)) return null;
  return { amount: toStripeMinor(local, currency), currency };
}

export type StripeFulfillmentResult =
  | "processed"
  | "already-processed"
  | "amount-mismatch"
  | "order-not-found";

/**
 * Marks the order behind a succeeded PaymentIntent as paid and runs the
 * side effects exactly once. The charged amount and currency must match the
 * order row: the row is rewritten on every visit to the payment step, so a
 * cheaper intent created earlier must not unlock options added afterwards.
 */
export async function fulfillStripePaymentIntent(
  paymentIntent: Stripe.PaymentIntent
): Promise<StripeFulfillmentResult> {
  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) return "order-not-found";

  const existing = await getOrderById(orderId);
  if (!existing) {
    await sendTelegramMessage(
      `🚨 <b>Paiement Stripe sans commande</b>\nPaymentIntent <code>${paymentIntent.id}</code> (${formatStripeAmount(
        paymentIntent.amount,
        paymentIntent.currency ?? "usd"
      )}) référence la commande <code>${orderId}</code> introuvable.`
    ).catch(() => {});
    return "order-not-found";
  }
  if (existing.status === "paid") return "already-processed";

  const expected = expectedStripeCharge(existing);
  const paidCurrency = (paymentIntent.currency ?? "").toUpperCase();
  if (!expected || expected.amount !== paymentIntent.amount || expected.currency !== paidCurrency) {
    await sendTelegramMessage(
      `🚨 <b>Montant Stripe incohérent — commande NON validée</b>\nCommande <code>${orderId}</code>\nPayé: ${formatStripeAmount(
        paymentIntent.amount,
        paymentIntent.currency ?? "usd"
      )}\nAttendu: ${
        expected ? formatStripeAmount(expected.amount, expected.currency) : "inconnu"
      }\nPaymentIntent <code>${paymentIntent.id}</code>. Vérifier les options avant production ou rembourser.`
    ).catch(() => {});
    return "amount-mismatch";
  }

  const claimed = await markOrderPaid(orderId, paymentIntent.id);
  if (!claimed) return "already-processed";

  const order = (await getOrderById(orderId)) ?? existing;
  const usd = paymentIntent.metadata?.totalUsd;
  await runPaidOrderSideEffects(order, {
    provider: "Stripe",
    amountLabel: `${formatStripeAmount(paymentIntent.amount, paymentIntent.currency ?? "usd")}${
      usd ? ` (≈ $${usd})` : ""
    }`,
    paymentRef: paymentIntent.id,
  });
  return "processed";
}

export type PayPalFulfillmentResult =
  | "processed"
  | "already-processed"
  | "not-captured"
  | "amount-mismatch"
  | "order-mismatch"
  | "order-not-found";

/**
 * Captures (if needed) and fulfills a PayPal order. Shared by the return page
 * (/api/paypal/capture-order) and the PayPal webhook, so a customer who closes
 * the tab after approving is still captured. Amounts are checked against the
 * order row BEFORE capturing: refusing a mismatched order takes no money,
 * while the old capture-then-compare left customers charged with a pending
 * order.
 */
export async function fulfillPayPalOrder(
  orderId: string,
  paypalOrderId: string
): Promise<{ result: PayPalFulfillmentResult; order: Order | null }> {
  const existing = await getOrderById(orderId);
  if (!existing) return { result: "order-not-found", order: null };
  if (existing.status === "paid") return { result: "already-processed", order: existing };
  if (existing.paypal_order_id !== paypalOrderId) {
    return { result: "order-mismatch", order: existing };
  }

  const expectedCurrency = (existing.currency || "USD").toUpperCase();
  const expectedAmount = Number(existing.total_local ?? existing.total_usd);
  const matches = (summary: PayPalOrderSummary) =>
    summary.orderId === orderId &&
    summary.currency?.toUpperCase() === expectedCurrency &&
    summary.amount != null &&
    Math.abs(summary.amount - expectedAmount) < 0.005;

  const current = await getPayPalOrder(paypalOrderId);
  if (!matches(current)) {
    await sendTelegramMessage(
      `🚨 <b>Commande PayPal incohérente — non capturée</b>\nCommande <code>${orderId}</code>\nPayPal: ${current.amount ?? "?"} ${current.currency ?? "?"}\nAttendu: ${expectedAmount} ${expectedCurrency}\nOrdre PayPal <code>${paypalOrderId}</code>.`
    ).catch(() => {});
    return { result: "amount-mismatch", order: existing };
  }

  const capture = current.status === "COMPLETED" ? current : await capturePayPalOrder(paypalOrderId);
  if (capture.status !== "COMPLETED" || (capture.captureStatus && capture.captureStatus !== "COMPLETED")) {
    // PENDING captures (eCheck, review) complete later via the webhook.
    return { result: "not-captured", order: existing };
  }

  const claimed = await markOrderPaidPayPal(orderId, capture.captureId);
  const order = (await getOrderById(orderId)) ?? existing;
  if (!claimed) return { result: "already-processed", order };

  const currency = (order.currency || "USD").toUpperCase();
  const localAmount = Number(order.total_local ?? order.total_usd);
  const amountLabel =
    currency === "USD"
      ? `$${localAmount.toFixed(2)} USD`
      : `${localAmount.toFixed(currency === "JPY" ? 0 : 2)} ${currency} (≈ $${Number(order.total_usd).toFixed(2)} USD)`;
  await runPaidOrderSideEffects(order, {
    provider: "PayPal",
    amountLabel,
    paymentRef: capture.captureId ?? paypalOrderId,
  });
  return { result: "processed", order };
}
