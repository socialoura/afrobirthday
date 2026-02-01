import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { getAllPromoCodes, createPromoCode, updatePromoCode, deletePromoCode, initAdminTables } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initAdminTables();
    const promoCodes = await getAllPromoCodes();
    return NextResponse.json({ promoCodes });
  } catch (error) {
    console.error("Get promo codes error:", error);
    return NextResponse.json({ error: "Failed to fetch promo codes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { code, discountType, discountValue, maxUses, expiresAt } = await request.json();

    if (!code || !discountType || discountValue === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return NextResponse.json({ error: "Invalid discount type" }, { status: 400 });
    }

    if (discountValue < 0) {
      return NextResponse.json({ error: "Invalid discount value" }, { status: 400 });
    }

    await initAdminTables();
    await createPromoCode({ code, discountType, discountValue, maxUses, expiresAt });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Create promo code error:", error);
    return NextResponse.json({ error: "Failed to create promo code" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, ...data } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing promo code ID" }, { status: 400 });
    }

    await updatePromoCode(id, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update promo code error:", error);
    return NextResponse.json({ error: "Failed to update promo code" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Missing promo code ID" }, { status: 400 });
    }

    await deletePromoCode(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete promo code error:", error);
    return NextResponse.json({ error: "Failed to delete promo code" }, { status: 500 });
  }
}
