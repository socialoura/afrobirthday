import { NextResponse } from "next/server";
import { getPricingOverrides, getPricingSettings, getSetting } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [pricing, overrides, promoEnabledSetting] = await Promise.all([
      getPricingSettings(),
      getPricingOverrides(),
      getSetting("promo_enabled"),
    ]);
    return NextResponse.json(
      { ...pricing, overrides, promoEnabled: promoEnabledSetting === "true" },
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
