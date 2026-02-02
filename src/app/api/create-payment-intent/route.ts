import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { attachStripeSessionToOrder, createOrder, ensureOrdersTable } from "@/lib/db";
import { sendDiscordWebhook } from "@/lib/discordWebhook";

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

    await createOrder({
      id: orderId,
      email,
      message,
      giftNote,
      musicOption: musicOption ?? (hasCustomSong ? "custom" : "default"),
      musicLink,
      musicFileUrl,
      deliveryMethod: deliveryMethod ?? (isExpress ? "express" : "standard"),
      photoUrl,
      totalUsd: totalPrice,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100),
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

    await attachStripeSessionToOrder(orderId, paymentIntent.id);

    await sendDiscordWebhook({
      username: "AfroBirthday",
      embeds: [
        {
          title: "New order created",
          color: 0xf59e0b,
          timestamp: new Date().toISOString(),
          fields: [
            { name: "Order ID", value: String(orderId), inline: true },
            { name: "Email", value: String(email ?? ""), inline: true },
            { name: "Total (USD)", value: String(totalPrice), inline: true },
            { name: "Delivery", value: String(deliveryMethod ?? (isExpress ? "express" : "standard")), inline: true },
            { name: "Custom song", value: hasCustomSong ? "yes" : "no", inline: true },
            { name: "Gift note", value: String(giftNote || "-") },
            { name: "Message", value: String(message || "-") },
            { name: "Payment Intent", value: String(paymentIntent.id), inline: false },
          ],
        },
      ],
    });

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
