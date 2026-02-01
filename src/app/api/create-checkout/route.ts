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
    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
    if (!origin) {
      return NextResponse.json(
        { error: "Missing site URL configuration" },
        { status: 500 }
      );
    }

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

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Personalized Birthday Video",
              description: `Custom message: "${message}"${hasCustomSong ? " + Custom song" : ""}${isExpress ? " + Express delivery" : ""}`,
              images: [`${origin}/logo.png`],
            },
            unit_amount: Math.round(totalPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      return_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        orderId,
        email,
        message,
        hasCustomSong: hasCustomSong ? "true" : "false",
        isExpress: isExpress ? "true" : "false",
        giftNote: giftNote || "",
      },
    });

    if (!session.client_secret) {
      return NextResponse.json(
        { error: "Missing Stripe client secret" },
        { status: 500 }
      );
    }

    await attachStripeSessionToOrder(orderId, session.id);

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
            { name: "Stripe session", value: String(session.id), inline: false },
          ],
        },
      ],
    });

    return NextResponse.json({ clientSecret: session.client_secret, orderId });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
