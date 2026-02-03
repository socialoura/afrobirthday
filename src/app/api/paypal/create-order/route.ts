import { NextRequest, NextResponse } from "next/server";
import {
  attachPayPalOrderToOrder,
  createOrder,
  ensureOrdersTable,
  getPricingSettings,
} from "@/lib/db";
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

    const pricing = await getPricingSettings();
    const resolvedMusicOption = musicOption ?? (hasCustomSong ? "custom" : "default");
    const resolvedDeliveryMethod = deliveryMethod ?? (isExpress ? "express" : "standard");
    const computedTotalUsd =
      pricing.base +
      (resolvedMusicOption === "custom" ? pricing.customSong : 0) +
      (resolvedDeliveryMethod === "express" ? pricing.expressDelivery : 0);

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
    });

    const returnUrl = `${origin}/paypal/success?orderId=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${origin}/#order`;

    const { paypalOrderId, approveUrl } = await createPayPalOrder({
      orderId,
      amountUsd: computedTotalUsd,
      returnUrl,
      cancelUrl,
    });

    await attachPayPalOrderToOrder(orderId, paypalOrderId);

    return NextResponse.json({ url: approveUrl, orderId, paypalOrderId });
  } catch (error) {
    console.error("PayPal create order error:", error);
    return NextResponse.json(
      { error: "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}
