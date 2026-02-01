import { NextRequest, NextResponse } from "next/server";
import { attachPayPalOrderToOrder, createOrder, ensureOrdersTable } from "@/lib/db";
import { sendDiscordWebhook } from "@/lib/discordWebhook";
import { createPayPalOrder } from "@/lib/paypal";

export const runtime = "nodejs";

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

    const returnUrl = `${origin}/paypal/success?orderId=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${origin}/#order`;

    const { paypalOrderId, approveUrl } = await createPayPalOrder({
      orderId,
      amountUsd: Number(totalPrice),
      returnUrl,
      cancelUrl,
    });

    await attachPayPalOrderToOrder(orderId, paypalOrderId);

    await sendDiscordWebhook({
      username: "AfroBirthday",
      embeds: [
        {
          title: "New order created (PayPal)",
          color: 0xf59e0b,
          timestamp: new Date().toISOString(),
          fields: [
            { name: "Order ID", value: String(orderId), inline: true },
            { name: "Email", value: String(email ?? ""), inline: true },
            { name: "Total (USD)", value: String(totalPrice), inline: true },
            {
              name: "Delivery",
              value: String(deliveryMethod ?? (isExpress ? "express" : "standard")),
              inline: true,
            },
            { name: "Custom song", value: hasCustomSong ? "yes" : "no", inline: true },
            { name: "Gift note", value: String(giftNote || "-") },
            { name: "Message", value: String(message || "-") },
            { name: "PayPal order", value: String(paypalOrderId), inline: false },
          ],
        },
      ],
    });

    return NextResponse.json({ url: approveUrl, orderId, paypalOrderId });
  } catch (error) {
    console.error("PayPal create order error:", error);
    return NextResponse.json(
      { error: "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}
