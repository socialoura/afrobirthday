import { NextRequest, NextResponse } from "next/server";
import {
  attachPayPalOrderToOrder,
  createOrder,
  ensureOrdersTable,
  getPricingSettings,
  validatePromoCode,
} from "@/lib/db";
import { discountedUsdTotal, usdDiscountAmount } from "@/lib/promo";
import { createPayPalOrder } from "@/lib/paypal";
import { deviceTypeFromUserAgent } from "@/lib/device";

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
      danceExtended,
      musicOption,
      musicLink,
      musicFileUrl,
      deliveryMethod,
      photoUrl,
      promoCode: requestedPromoCode,
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
    const resolvedDanceExtended = danceExtended === true;
    const computedTotalUsd =
      pricing.base +
      (resolvedMusicOption === "custom" ? pricing.customSong : 0) +
      (resolvedDeliveryMethod === "express" ? pricing.expressDelivery : 0) +
      (resolvedDanceExtended ? pricing.danceExtended : 0);

    const country = request.headers.get("x-vercel-ip-country") ?? undefined;
    const device = deviceTypeFromUserAgent(request.headers.get("user-agent"));

    // Never trust a client-sent discount: re-validate the code server-side
    // and recompute the charge from scratch.
    let chargedUsd = computedTotalUsd;
    let appliedPromoCode: string | null = null;
    let discountUsd = 0;
    if (typeof requestedPromoCode === "string" && requestedPromoCode.trim()) {
      const promo = await validatePromoCode(requestedPromoCode.trim());
      if (!promo) {
        return NextResponse.json({ error: "Invalid or expired promo code" }, { status: 400 });
      }
      chargedUsd = discountedUsdTotal(computedTotalUsd, promo);
      appliedPromoCode = promo.code;
      discountUsd = usdDiscountAmount(computedTotalUsd, promo);
    }

    await createOrder({
      id: orderId,
      email,
      message,
      musicOption: resolvedMusicOption,
      musicLink,
      musicFileUrl,
      deliveryMethod: resolvedDeliveryMethod,
      photoUrl,
      totalUsd: computedTotalUsd,
      country,
      device,
      currency: "USD",
      totalLocal: chargedUsd,
      exchangeRate: 1,
      promoCode: appliedPromoCode ?? undefined,
      discountAmount: discountUsd,
      danceExtended: resolvedDanceExtended,
    });

    const returnUrl = `${origin}/paypal/success?orderId=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${origin}/#order`;

    const { paypalOrderId, approveUrl } = await createPayPalOrder({
      orderId,
      amountUsd: chargedUsd,
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
