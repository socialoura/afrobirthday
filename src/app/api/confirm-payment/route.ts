import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ensureOrdersTable, getOrderById, markOrderPaid, incrementPromoCodeUsage } from "@/lib/db";
import { notifyOrderPaid } from "@/lib/discordWebhook";
import { handlePossibleReferralRedemption } from "@/lib/referralEmail";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderOrderConfirmationEmailHtml,
  renderOrderConfirmationEmailText,
} from "@/lib/orderEmailTemplates";
import { formatStripeAmount } from "@/lib/currency";
import { sendTelegramMessage } from "@/lib/telegramBot";

export const runtime = "nodejs";
// notifyOrderPaid generates the TTS voiceover and downloads the custom song
// (the Spotify path alone polls for up to ~24s). The default 10s budget cut the
// function off before the media was persisted. 60s is the Hobby plan ceiling.
export const maxDuration = 60;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, orderId } = body as {
      paymentIntentId?: string;
      orderId?: string;
    };

    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return NextResponse.json({ error: "Missing paymentIntentId" }, { status: 400 });
    }
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    // Verify payment status directly with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment not succeeded", status: paymentIntent.status },
        { status: 400 }
      );
    }

    // Check if orderId matches the one in metadata (security check)
    if (paymentIntent.metadata?.orderId !== orderId) {
      return NextResponse.json({ error: "Order ID mismatch" }, { status: 400 });
    }

    await ensureOrdersTable();

    const existingOrder = await getOrderById(orderId);
    const wasAlreadyPaid = existingOrder?.status === "paid";

    if (wasAlreadyPaid) {
      // Already processed, just return success
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    // Mark order as paid
    await markOrderPaid(orderId, paymentIntentId);

    // Get updated order for email
    const order = (await getOrderById(orderId)) ?? existingOrder;

    if (order?.promo_code) {
      await incrementPromoCodeUsage(order.promo_code).catch((err) =>
        console.error("Failed to increment promo code usage (confirm-payment):", err)
      );
      await handlePossibleReferralRedemption(order).catch((err) =>
        console.error("Failed to process referral redemption (confirm-payment):", err)
      );
    }

    // Send confirmation email
    if (order?.email) {
      try {
        console.log("[confirm-payment] Attempting to send email to:", order.email);
        console.log("[confirm-payment] RESEND_API_KEY configured:", !!process.env.RESEND_API_KEY);
        console.log("[confirm-payment] RESEND_FROM_EMAIL configured:", !!process.env.RESEND_FROM_EMAIL);
        
        const emailResult = await sendEmailWithResend({
          to: order.email,
          subject: `AfroBirthday order confirmation (${order.id})`,
          html: renderOrderConfirmationEmailHtml(order),
          text: renderOrderConfirmationEmailText(order),
        });
        console.log("[confirm-payment] Email sent successfully:", emailResult);
      } catch (emailErr) {
        console.error("[confirm-payment] Failed to send order confirmation email:", emailErr);
      }
    } else {
      console.log("[confirm-payment] No email to send - order.email is missing");
    }

    // Send Discord notification with the customer's order details
    if (order) {
      const usd = paymentIntent.metadata?.totalUsd;
      const amountLabel = `${formatStripeAmount(paymentIntent.amount, paymentIntent.currency ?? "usd")}${usd ? ` (≈ $${usd})` : ""}`;
      await notifyOrderPaid({
        order,
        provider: "Stripe",
        amountLabel,
        paymentRef: paymentIntentId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Confirm payment error:", error);
    await sendTelegramMessage(
      `⚠️ <b>confirm-payment failed</b>\nA Stripe payment may have succeeded but order confirmation (email/notification) failed to process.\nError: ${
        error instanceof Error ? error.message : String(error)
      }`
    ).catch(() => {});
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
}
