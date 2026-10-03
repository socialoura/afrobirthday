import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  attachStripePaymentIntentToOrder,
  createOrder,
  ensureOrdersTable,
  getOrderById,
  getPricingOverrides,
  getPricingSettings,
  sanitizeAttribution,
  validatePromoCode,
} from "@/lib/db";
import {
  getServerExchangeRates,
  isSupportedCurrency,
  resolveLocalCharge,
} from "@/lib/currency";
import { applyPromoToCharge, usdDiscountAmount } from "@/lib/promo";
import { deviceTypeFromUserAgent } from "@/lib/device";
import { validateOrderInput } from "@/lib/orderInput";
import { orderRequestContext } from "@/lib/requestContext";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      totalPrice,
      hasCustomSong,
      isExpress,
      danceExtended,
      deliveryMethod,
      currency: requestedCurrency,
      promoCode: requestedPromoCode,
      attribution: rawAttribution,
    } = body;

    const input = validateOrderInput(body);
    if (!input.ok) {
      return NextResponse.json({ error: input.error }, { status: 400 });
    }
    const {
      orderId,
      email,
      message,
      photoUrl,
      musicLink,
      musicFileUrl,
      musicOption: resolvedMusicOption,
    } = input.value;

    // These four are independent; running them in series added a full round
    // trip each to the wait before the payment form can even start rendering.
    const [, pricing, rates, overrides] = await Promise.all([
      ensureOrdersTable(),
      getPricingSettings(),
      getServerExchangeRates(),
      getPricingOverrides(),
    ]);
    // Each visit to the payment step creates a new intent; remember the one
    // this order pointed at so it can be canceled once replaced.
    const previousIntentId = (await getOrderById(orderId))?.stripe_payment_intent_id ?? null;

    const resolvedDeliveryMethod = deliveryMethod ?? (isExpress ? "express" : "standard");
    const resolvedDanceExtended = danceExtended === true;

    const country = request.headers.get("x-vercel-ip-country") ?? undefined;
    const device = deviceTypeFromUserAgent(request.headers.get("user-agent"));

    // Charge the customer in their local currency. The USD total is computed
    // from admin pricing (never trusted from the client), then converted with
    // live server-side rates. Stripe settles to the merchant account.
    const currency = isSupportedCurrency(requestedCurrency)
      ? requestedCurrency
      : "USD";
    const charge = resolveLocalCharge({
      usdPricing: pricing,
      hasCustomSong: resolvedMusicOption === "custom",
      isExpress: resolvedDeliveryMethod === "express",
      hasDanceExtended: resolvedDanceExtended,
      currency,
      rates,
      override: overrides[currency],
    });

    // total_usd has to be what the charge is worth, not the USD list price:
    // the list price understates every sale in a currency carrying a manual
    // override (a £19.99 base pinned against $19.99 is really a ~$27 sale).
    const referenceUsd = charge.usdEquivalent;

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
      discountUsd = usdDiscountAmount(referenceUsd, promo);
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
      totalUsd: referenceUsd,
      country,
      device,
      currency: finalCharge.currency,
      displayCurrency: finalCharge.currency,
      totalLocal: finalCharge.localAmount,
      exchangeRate: finalCharge.rate,
      promoCode: appliedPromoCode ?? undefined,
      discountAmount: discountUsd,
      danceExtended: resolvedDanceExtended,
      attribution: sanitizeAttribution(rawAttribution),
      ...orderRequestContext(request, body),
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalCharge.stripeAmount,
      currency: finalCharge.currency.toLowerCase(),
      receipt_email: email,
      metadata: {
        orderId,
        email,
        message,
        hasCustomSong: resolvedMusicOption === "custom" ? "true" : "false",
        isExpress: isExpress ? "true" : "false",
        danceExtended: resolvedDanceExtended ? "true" : "false",
        currency: finalCharge.currency,
        totalUsd: referenceUsd.toFixed(2),
        exchangeRate: String(finalCharge.rate),
        ...(appliedPromoCode ? { promoCode: appliedPromoCode, discountUsd: discountUsd.toFixed(2) } : {}),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    await attachStripePaymentIntentToOrder(orderId, paymentIntent.id);

    if (previousIntentId && previousIntentId !== paymentIntent.id) {
      // Best effort: a superseded intent left open could still be paid at its
      // old amount. The order already points at the new intent, so the
      // resulting payment_intent.canceled webhook leaves the order alone.
      stripe.paymentIntents.cancel(previousIntentId).catch(() => {});
    }

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
