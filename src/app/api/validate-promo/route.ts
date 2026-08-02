import { NextRequest, NextResponse } from "next/server";
import { validatePromoCode } from "@/lib/db";

export const runtime = "nodejs";

// Public endpoint (no admin auth): lets the checkout form check a code before
// payment. Only returns what's needed to display the discount — never the
// promo code's id, usage count, or expiry, to avoid leaking catalog data.
export async function POST(request: NextRequest) {
  try {
    const { code } = (await request.json()) as { code?: string };

    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const promo = await validatePromoCode(code.trim());

    if (!promo) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      code: promo.code,
      discountType: promo.discount_type,
      discountValue: Number(promo.discount_value),
    });
  } catch (error) {
    console.error("Validate promo code error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
