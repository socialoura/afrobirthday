import { NextResponse } from "next/server";
import {
  ensureOrdersTable,
  getOrderByPayPalCapture,
  markOrderRefundedByPayPalCapture,
} from "@/lib/db";
import { fulfillPayPalOrder } from "@/lib/orderFulfillment";
import { verifyPayPalWebhook } from "@/lib/paypal";
import { createUploadToken } from "@/lib/auth";
import { resolveNotificationUrl } from "@/lib/siteUrl";
import { sendTelegramMessage } from "@/lib/telegramBot";

export const runtime = "nodejs";
export const maxDuration = 60;

type PayPalLink = { href?: string; rel?: string };

type PayPalWebhookEvent = {
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    reason?: string;
    status?: string;
    amount?: { value?: string; currency_code?: string };
    dispute_amount?: { value?: string; currency_code?: string };
    disputed_transactions?: Array<{ seller_transaction_id?: string }>;
    purchase_units?: Array<{ custom_id?: string; reference_id?: string }>;
    supplementary_data?: { related_ids?: { order_id?: string } };
    links?: PayPalLink[];
  };
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function hoursSince(date: string): number {
  return Math.round((Date.now() - new Date(date).getTime()) / 3_600_000);
}

/** A refund resource points at its capture through the "up" link. */
function captureIdFromRefund(links: PayPalLink[] | undefined): string | undefined {
  const up = links?.find((l) => l.rel === "up")?.href;
  return up?.match(/\/captures\/([^/?]+)/)?.[1];
}

/**
 * PayPal events. Subscribe (or keep "all events") in the developer dashboard
 * and set PAYPAL_WEBHOOK_ID.
 * - CHECKOUT.ORDER.APPROVED / PAYMENT.CAPTURE.COMPLETED: safety net for the
 *   return page (customer approved then closed the tab).
 * - PAYMENT.CAPTURE.REFUNDED / REVERSED: take the order out of revenue and
 *   production, alert the team. A refunded order used to stay "paid" and
 *   show up as late.
 * - CUSTOMER.DISPUTE.CREATED: alert at once, with the links to deliver before
 *   PayPal decides. All Q3 2026 disputes were "not received" after delays.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  let verified = false;
  try {
    verified = await verifyPayPalWebhook(request.headers, rawBody);
  } catch (err) {
    console.error("PayPal webhook verification error:", err);
  }
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as PayPalWebhookEvent;
  const resource = event.resource ?? {};
  const type = event.event_type;

  try {
    await ensureOrdersTable();

    if (type === "PAYMENT.CAPTURE.REFUNDED" || type === "PAYMENT.CAPTURE.REVERSED") {
      const captureId = type === "PAYMENT.CAPTURE.REVERSED" ? resource.id : captureIdFromRefund(resource.links);
      if (!captureId) return NextResponse.json({ received: true });
      const label = type === "PAYMENT.CAPTURE.REVERSED" ? "Paiement PayPal annulé (reversal)" : "Remboursement PayPal";
      const today = new Date().toISOString().slice(0, 10);
      const order = await markOrderRefundedByPayPalCapture(
        captureId,
        `[${today}] ${label} — capture ${captureId}${resource.amount?.value ? `, ${resource.amount.value} ${resource.amount.currency_code ?? ""}` : ""}.`
      );
      if (order) {
        await sendTelegramMessage(
          `↩️ <b>${label}</b>\nCommande <code>${order.id.slice(0, 8)}</code> · ${escapeHtml(order.email)}\nMontant : ${resource.amount?.value ?? "?"} ${resource.amount?.currency_code ?? ""}\nCommande retirée de la production et du chiffre d'affaires.`
        );
      }
      return NextResponse.json({ received: true });
    }

    if (type === "CUSTOMER.DISPUTE.CREATED") {
      const captureId = resource.disputed_transactions?.[0]?.seller_transaction_id;
      const order = captureId ? await getOrderByPayPalCapture(captureId) : null;
      let message = `⚠️ <b>LITIGE PayPal ouvert</b>\nMotif : ${escapeHtml(resource.reason ?? "?")} · ${resource.dispute_amount?.value ?? "?"} ${resource.dispute_amount?.currency_code ?? ""}\n`;
      if (order) {
        const delivered = Boolean(order.final_video_sent_at);
        message += `Commande <code>${order.id.slice(0, 8)}</code> · ${escapeHtml(order.email)} · ${order.delivery_method === "express" ? "⚡ EXPRESS" : "📦 Standard"}\n`;
        message += delivered
          ? `✅ Vidéo livrée le ${String(order.final_video_sent_at).slice(0, 10)} — répondre au litige avec la preuve de livraison.`
          : `❌ Pas encore livrée (${hoursSince(order.created_at)} h depuis la commande) — livrer MAINTENANT puis répondre au litige.`;
        try {
          const token = createUploadToken(String(order.id));
          const site = resolveNotificationUrl();
          message += `\n📋 <a href="${site}/admin/recap/${order.id}?t=${token}">Récap</a>  ·  🎬 <a href="${site}/admin/upload/${order.id}?t=${token}">Déposer la vidéo</a>`;
        } catch {
          // no links without the secret
        }
      } else {
        message += `Commande introuvable (capture ${escapeHtml(captureId ?? "?")}).`;
      }
      await sendTelegramMessage(message);
      return NextResponse.json({ received: true });
    }

    let paypalOrderId: string | undefined;
    let orderId: string | undefined;
    if (type === "CHECKOUT.ORDER.APPROVED") {
      paypalOrderId = resource.id;
      orderId = resource.purchase_units?.[0]?.custom_id ?? resource.purchase_units?.[0]?.reference_id;
    } else if (type === "PAYMENT.CAPTURE.COMPLETED") {
      paypalOrderId = resource.supplementary_data?.related_ids?.order_id;
      orderId = resource.custom_id;
    } else {
      return NextResponse.json({ received: true });
    }

    if (!paypalOrderId || !orderId) {
      return NextResponse.json({ received: true });
    }

    await fulfillPayPalOrder(orderId, paypalOrderId);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("PayPal webhook handler error:", err);
    await sendTelegramMessage(
      `🚨 <b>PayPal webhook failed</b>\nEvent: ${type}\nError: ${
        err instanceof Error ? err.message : String(err)
      }`
    ).catch(() => {});
    // 500 makes PayPal retry the delivery.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
