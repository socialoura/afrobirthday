import { NextRequest, NextResponse } from "next/server";
import {
  attachPayPalOrderToOrder,
  createOrder,
  ensureOrdersTable,
  getPricingOverrides,
  getPricingSettings,
  sanitizeAttribution,
  validatePromoCode,
} from "@/lib/db";
import { applyPromoToCharge, usdDiscountAmount } from "@/lib/promo";
import { createPayPalOrder, isPayPalSupportedCurrency } from "@/lib/paypal";
import { deviceTypeFromUserAgent } from "@/lib/device";
import { SITE_URL } from "@/lib/siteUrl";
import {
  getServerExchangeRates,
  isSupportedCurrency,
  resolveLocalCharge,
} from "@/lib/currency";
import { getActivePriceTest, isControlCurrency } from "@/lib/priceTest";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin") ?? SITE_URL;
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
      attribution: rawAttribution,
      currency: requestedCurrency,
    } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }
    if (!photoUrl || typeof photoUrl !== "string") {
      return NextResponse.json({ error: "Missing photoUrl" }, { status: 400 });
    }

    await ensureOrdersTable();

    const displayCurrency = isSupportedCurrency(requestedCurrency) ? requestedCurrency : "USD";
    // PayPal does not accept every local currency displayed by the storefront.
    // Charge supported currencies directly (notably EUR); otherwise retain the
    // existing USD fallback.
    const currency = isPayPalSupportedCurrency(displayCurrency) ? displayCurrency : "USD";
    const [livePricing, priceTest, rates, overrides] = await Promise.all([
      getPricingSettings(),
      getActivePriceTest(),
      getServerExchangeRates(),
      getPricingOverrides(),
    ]);
    const pricing =
      priceTest && isControlCurrency(priceTest, displayCurrency)
        ? priceTest.legacyUsdPricing
        : livePricing;
    const resolvedMusicOption = musicOption ?? (hasCustomSong ? "custom" : "default");
    const resolvedDeliveryMethod = deliveryMethod ?? (isExpress ? "express" : "standard");
    const resolvedDanceExtended = danceExtended === true;
    const charge = resolveLocalCharge({
      usdPricing: pricing,
      hasCustomSong: resolvedMusicOption === "custom",
      isExpress: resolvedDeliveryMethod === "express",
      hasDanceExtended: resolvedDanceExtended,
      currency,
      rates,
      override: overrides[currency],
    });
    const referenceUsd = charge.usdEquivalent;

    const country = request.headers.get("x-vercel-ip-country") ?? undefined;
    const device = deviceTypeFromUserAgent(request.headers.get("user-agent"));

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
      displayCurrency,
      totalLocal: finalCharge.localAmount,
      exchangeRate: finalCharge.rate,
      promoCode: appliedPromoCode ?? undefined,
      discountAmount: discountUsd,
      danceExtended: resolvedDanceExtended,
      attribution: sanitizeAttribution(rawAttribution),
    });

    const returnUrl = `${origin}/paypal/success?orderId=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${origin}/#order`;

    const { paypalOrderId, approveUrl } = await createPayPalOrder({
      orderId,
      amount: finalCharge.localAmount,
      currency: finalCharge.currency,
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
