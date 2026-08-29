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

    const existingOrder = await getOrderById(orderId);
    const wasAlreadyPaid = existingOrder?.status === "paid";

    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "PayPal capture not completed", status: capture.status },
        { status: 400 }
      );
    }

    if (!wasAlreadyPaid) {
      await markOrderPaidPayPal(orderId, capture.captureId);
    }

    const order = (await getOrderById(orderId)) ?? existingOrder;

    if (!wasAlreadyPaid && order?.promo_code) {
      await incrementPromoCodeUsage(order.promo_code).catch((err) =>
        console.error("Failed to increment promo code usage (PayPal):", err)
      );
      await handlePossibleReferralRedemption(order).catch((err) =>
        console.error("Failed to process referral redemption (PayPal):", err)
      );
    }

    if (!wasAlreadyPaid && order?.email) {
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

    if (order) {
      await notifyOrderPaid({
        order,
        provider: "PayPal",
        amountLabel: `$${Number(order.total_usd).toFixed(2)} USD`,
        paymentRef: capture.captureId ?? paypalOrderId,
      });
    }

    return NextResponse.json({
      ok: true,
      // total_local reflects the actual amount charged (after any promo
      // discount); total_usd is the pre-discount reference price.
      value: order?.total_local ?? order?.total_usd ?? null,
      // PayPal always charges in USD, so the two match — sent explicitly so the
      // success page reports value_usd on this path too.
      valueUsd: order?.total_local ?? order?.total_usd ?? null,
      currency: "USD",
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
