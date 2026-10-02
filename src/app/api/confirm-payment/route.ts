import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ensureOrdersTable } from "@/lib/db";
import { fulfillStripePaymentIntent } from "@/lib/orderFulfillment";
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

    // Verify payment status directly with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment not succeeded", status: paymentIntent.status },
        { status: 400 }
      );
    }

    // A redirect payment method (Revolut Pay, Klarna, Amazon Pay...) sends the
    // customer back with only Stripe's own query parameters, so the caller may
    // not know the order id. Stripe's own metadata is authoritative here —
    // safer than trusting a client-supplied id anyway.
    const resolvedOrderId = paymentIntent.metadata?.orderId;

    if (!resolvedOrderId) {
      return NextResponse.json({ error: "Payment intent has no order" }, { status: 400 });
    }
    if (typeof orderId === "string" && orderId && orderId !== resolvedOrderId) {
      return NextResponse.json({ error: "Order ID mismatch" }, { status: 400 });
    }

    await ensureOrdersTable();

    const result = await fulfillStripePaymentIntent(paymentIntent);
    if (result === "amount-mismatch" || result === "order-not-found") {
      // The team was alerted; the customer still sees success because Stripe
      // did take the payment, and the order will be resolved by hand.
      return NextResponse.json({ success: true, needsReview: true });
    }
    if (result === "already-processed") {
      return NextResponse.json({ success: true, alreadyProcessed: true });
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
