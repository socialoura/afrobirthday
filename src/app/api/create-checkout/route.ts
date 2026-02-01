import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { attachStripeSessionToOrder, createOrder, ensureOrdersTable } from "@/lib/db";

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
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#order`,
      metadata: {
        orderId,
        email,
        message,
        hasCustomSong: hasCustomSong ? "true" : "false",
        isExpress: isExpress ? "true" : "false",
        giftNote: giftNote || "",
      },
    });

    await attachStripeSessionToOrder(orderId, session.id);

    return NextResponse.json({ url: session.url, orderId });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
