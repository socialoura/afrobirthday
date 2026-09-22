import { NextRequest, NextResponse } from "next/server";
import { ensureOrdersTable, getOrderById, markOrderPaidPayPal, incrementPromoCodeUsage } from "@/lib/db";
import { notifyOrderPaid } from "@/lib/discordWebhook";
import { handlePossibleReferralRedemption } from "@/lib/referralEmail";
import { capturePayPalOrder } from "@/lib/paypal";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderOrderConfirmationEmailHtml,
  renderOrderConfirmationEmailText,
} from "@/lib/orderEmailTemplates";
import { sendTelegramMessage } from "@/lib/telegramBot";

export const runtime = "nodejs";
// notifyOrderPaid generates the TTS voiceover and downloads the custom song,
// which can exceed the default 10s budget. 60s is the Hobby plan ceiling.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, paypalOrderId } = body as {
      orderId?: string;
      paypalOrderId?: string;
    };

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }
    if (!paypalOrderId || typeof paypalOrderId !== "string") {
      return NextResponse.json({ error: "Missing paypalOrderId" }, { status: 400 });
    }

    await ensureOrdersTable();

    const pendingOrder = await getOrderById(orderId);
    if (!pendingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (pendingOrder.paypal_order_id !== paypalOrderId) {
      return NextResponse.json({ error: "PayPal order mismatch" }, { status: 400 });
    }

    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "PayPal capture not completed", status: capture.status },
        { status: 400 }
      );
    }

    const expectedCurrency = (pendingOrder.currency || "USD").toUpperCase();
    const expectedAmount = Number(pendingOrder.total_local ?? pendingOrder.total_usd);
    if (
      capture.orderId !== orderId ||
      capture.currency?.toUpperCase() !== expectedCurrency ||
      capture.amount == null ||
      Math.abs(capture.amount - expectedAmount) > 0.001
    ) {
      throw new Error(
        `PayPal capture mismatch for order ${orderId}: expected ${expectedAmount} ${expectedCurrency}`
      );
    }

    const shouldProcess = await markOrderPaidPayPal(orderId, capture.captureId);

    const order = await getOrderById(orderId);

    if (shouldProcess && order?.promo_code) {
      await incrementPromoCodeUsage(order.promo_code).catch((err) =>
        console.error("Failed to increment promo code usage (PayPal):", err)
      );
      await handlePossibleReferralRedemption(order).catch((err) =>
        console.error("Failed to process referral redemption (PayPal):", err)
      );
    }

    if (shouldProcess && order?.email) {
      try {
        await sendEmailWithResend({
          to: order.email,
          subject: `AfroBirthday order confirmation (${order.id})`,
          html: renderOrderConfirmationEmailHtml(order),
          text: renderOrderConfirmationEmailText(order),
        });
      } catch (emailErr) {
        console.error("Failed to send order confirmation email (PayPal):", emailErr);
      }
    }

    // Previously this notification was outside the !wasAlreadyPaid guard, so
    // every repeated PayPal callback resent the complete Telegram bundle.
    if (shouldProcess && order) {
      const currency = (order.currency || "USD").toUpperCase();
      const localAmount = Number(order.total_local ?? order.total_usd);
      const amountLabel =
        currency === "USD"
          ? `$${localAmount.toFixed(2)} USD`
          : `${localAmount.toFixed(currency === "JPY" ? 0 : 2)} ${currency} (≈ $${Number(order.total_usd).toFixed(2)} USD)`;
      await notifyOrderPaid({
        order,
        provider: "PayPal",
        amountLabel,
        paymentRef: capture.captureId ?? paypalOrderId,
      });
    }

    return NextResponse.json({
      ok: true,
      value: order?.total_local ?? order?.total_usd ?? null,
      valueUsd: order
        ? Math.max(0, Number(order.total_usd) - Number(order.discount_amount || 0))
        : null,
      currency: order?.currency ?? "USD",
    });
  } catch (error) {
    console.error("PayPal capture error:", error);
    await sendTelegramMessage(
      `🚨 <b>PayPal capture-order failed</b>\nA payment may have been approved by the customer but not recorded.\nError: ${
        error instanceof Error ? error.message : String(error)
      }`
    ).catch(() => {});
    return NextResponse.json(
      { error: "Failed to capture PayPal order" },
      { status: 500 }
    );
  }
}
