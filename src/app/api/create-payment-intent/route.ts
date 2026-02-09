import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  attachStripePaymentIntentToOrder,
  createOrder,
  ensureOrdersTable,
  getPricingSettings,
} from "@/lib/db";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orderId,
      email,
      message,
      totalPrice,
      hasCustomSong,
      isExpress,
      giftNote,
      musicOption,
      musicLink,
      musicFileUrl,
      deliveryMethod,
      photoUrl,
    } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }
    if (!photoUrl || typeof photoUrl !== "string") {
      return NextResponse.json({ error: "Missing photoUrl" }, { status: 400 });
    }

    await ensureOrdersTable();

    const pricing = await getPricingSettings();
    const resolvedMusicOption = musicOption ?? (hasCustomSong ? "custom" : "default");
    const resolvedDeliveryMethod = deliveryMethod ?? (isExpress ? "express" : "standard");
    const computedTotalUsd =
      pricing.base +
      (resolvedMusicOption === "custom" ? pricing.customSong : 0) +
      (resolvedDeliveryMethod === "express" ? pricing.expressDelivery : 0);

    const country = request.headers.get("x-vercel-ip-country") ?? undefined;

    await createOrder({
      id: orderId,
      email,
      message,
      giftNote,
      musicOption: resolvedMusicOption,
      musicLink,
      musicFileUrl,
      deliveryMethod: resolvedDeliveryMethod,
      photoUrl,
      totalUsd: computedTotalUsd,
      country,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(computedTotalUsd * 100),
      currency: "usd",
      receipt_email: email,
      metadata: {
        orderId,
        email,
        message,
        hasCustomSong: hasCustomSong ? "true" : "false",
        isExpress: isExpress ? "true" : "false",
        giftNote: giftNote || "",
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    await attachStripePaymentIntentToOrder(orderId, paymentIntent.id);

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret, 
      orderId,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Payment intent error:", error);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
