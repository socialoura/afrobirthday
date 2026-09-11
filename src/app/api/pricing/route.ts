import { NextResponse } from "next/server";
import { getPricingOverrides, getPricingSettings, getSetting } from "@/lib/db";
import { getActivePriceTest } from "@/lib/priceTest";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [pricing, overrides, promoEnabledSetting, priceTest] = await Promise.all([
      getPricingSettings(),
      getPricingOverrides(),
      getSetting("promo_enabled"),
      getActivePriceTest(),
    ]);
    return NextResponse.json(
      {
        ...pricing,
        overrides,
        promoEnabled: promoEnabledSetting === "true",
        // Lets the client tag every analytics event with the test arm.
        priceTest: priceTest
          ? { id: priceTest.id, startedAt: priceTest.startedAt, controlCurrencies: priceTest.controlCurrencies }
          : null,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    console.error("Get pricing error:", error);
    return NextResponse.json({ error: "Failed to fetch pricing" }, { status: 500 });
  }
}
