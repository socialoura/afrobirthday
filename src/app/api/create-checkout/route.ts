import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  attachStripeSessionToOrder,
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

    // Charge the customer in their local currency (USD total converted with
    // live server-side rates). Stripe settles to the merchant account.
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

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: finalCharge.currency.toLowerCase(),
            product_data: {
              name: "Personalized Birthday Video",
              description: `Custom message: "${message}"${hasCustomSong ? " + Custom song" : ""}${isExpress ? " + Express delivery" : ""}`,
              images: [`${origin}/logo.png`],
            },
            unit_amount: finalCharge.stripeAmount,
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
        hasCustomSong: resolvedMusicOption === "custom" ? "true" : "false",
        isExpress: resolvedDeliveryMethod === "express" ? "true" : "false",
        currency: finalCharge.currency,
        totalUsd: computedTotalUsd.toFixed(2),
        exchangeRate: String(finalCharge.rate),
        ...(appliedPromoCode ? { promoCode: appliedPromoCode, discountUsd: discountUsd.toFixed(2) } : {}),
      },
    });

    if (!session.client_secret) {
      return NextResponse.json(
        { error: "Missing Stripe client secret" },
        { status: 500 }
      );
    }

    await attachStripeSessionToOrder(orderId, session.id);

    return NextResponse.json({ clientSecret: session.client_secret, orderId });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
