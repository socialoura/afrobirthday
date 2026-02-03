import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { getPricingSettings, initAdminTables, updatePricingSettings } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initAdminTables();
    const pricing = await getPricingSettings();
    return NextResponse.json(pricing);
  } catch (error) {
    console.error("Get pricing settings error:", error);
    return NextResponse.json({ error: "Failed to fetch pricing" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<{
      base: number;
      customSong: number;
      expressDelivery: number;
    }>;

    const keys: Array<keyof typeof body> = ["base", "customSong", "expressDelivery"];
    for (const key of keys) {
      const v = body[key];
      if (v === undefined) continue;
      if (typeof v !== "number" || Number.isNaN(v) || !Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
      }
    }

    await initAdminTables();
    await updatePricingSettings({
      base: body.base,
      customSong: body.customSong,
      expressDelivery: body.expressDelivery,
    });

    const pricing = await getPricingSettings();
    return NextResponse.json({ success: true, pricing });
  } catch (error) {
    console.error("Update pricing settings error:", error);
    return NextResponse.json({ error: "Failed to update pricing" }, { status: 500 });
  }
}
