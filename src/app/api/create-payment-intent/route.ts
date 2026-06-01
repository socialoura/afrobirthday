import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  attachStripePaymentIntentToOrder,
  createOrder,
  ensureOrdersTable,
  getPricingOverrides,
  getPricingSettings,
} from "@/lib/db";
import {
  getServerExchangeRates,
  isSupportedCurrency,
  resolveLocalCharge,
} from "@/lib/currency";
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
      currency: charge.currency,
      totalLocal: charge.localAmount,
      exchangeRate: charge.rate,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: charge.stripeAmount,
      currency: charge.currency.toLowerCase(),
      receipt_email: email,
      metadata: {
        orderId,
        email,
        message,
        hasCustomSong: hasCustomSong ? "true" : "false",
        isExpress: isExpress ? "true" : "false",
        currency: charge.currency,
        totalUsd: computedTotalUsd.toFixed(2),
        exchangeRate: String(charge.rate),
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
