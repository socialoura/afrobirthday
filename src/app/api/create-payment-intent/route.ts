import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  attachStripePaymentIntentToOrder,
  createOrder,
  ensureOrdersTable,
  getPricingOverrides,
  getPricingSettings,
  validatePromoCode,
} from "@/lib/db";
import {
  getServerExchangeRates,
  isSupportedCurrency,
  resolveLocalCharge,
} from "@/lib/currency";
import { applyPromoToCharge, usdDiscountAmount } from "@/lib/promo";
import { deviceTypeFromUserAgent } from "@/lib/device";

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
      musicOption,
      musicLink,
      musicFileUrl,
      deliveryMethod,
      photoUrl,
      currency: requestedCurrency,
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
    const computedTotalUsd =
      pricing.base +
      (resolvedMusicOption === "custom" ? pricing.customSong : 0) +
      (resolvedDeliveryMethod === "express" ? pricing.expressDelivery : 0);

    const country = request.headers.get("x-vercel-ip-country") ?? undefined;
    const device = deviceTypeFromUserAgent(request.headers.get("user-agent"));

    // Charge the customer in their local currency. The USD total is computed
    // from admin pricing (never trusted from the client), then converted with
    // live server-side rates. Stripe settles to the merchant account.
    const currency = isSupportedCurrency(requestedCurrency)
      ? requestedCurrency
      : "USD";
    const rates = await getServerExchangeRates();
    const overrides = await getPricingOverrides();
    const charge = resolveLocalCharge({
      usdPricing: pricing,
      hasCustomSong: resolvedMusicOption === "custom",
      isExpress: resolvedDeliveryMethod === "express",
      currency,
      rates,
      override: overrides[currency],
    });

    // Never trust a client-sent discount: re-validate the code server-side
    // and recompute the charge from scratch.
    let finalCharge = charge;
    let appliedPromoCode: string | null = null;
    let discountUsd = 0;
    if (typeof requestedPromoCode === "string" && requestedPromoCode.trim()) {
      const promo = await validatePromoCode(requestedPromoCode.trim());
      if (!promo) {
        return NextResponse.json({ error: "Invalid or expired promo code" }, { status: 400 });
      }
      finalCharge = applyPromoToCharge(charge, promo);
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
      currency: finalCharge.currency,
      totalLocal: finalCharge.localAmount,
      exchangeRate: finalCharge.rate,
      promoCode: appliedPromoCode ?? undefined,
      discountAmount: discountUsd,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalCharge.stripeAmount,
      currency: finalCharge.currency.toLowerCase(),
      receipt_email: email,
      metadata: {
        orderId,
        email,
        message,
        hasCustomSong: hasCustomSong ? "true" : "false",
        isExpress: isExpress ? "true" : "false",
        currency: finalCharge.currency,
        totalUsd: computedTotalUsd.toFixed(2),
        exchangeRate: String(finalCharge.rate),
        ...(appliedPromoCode ? { promoCode: appliedPromoCode, discountUsd: discountUsd.toFixed(2) } : {}),
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
