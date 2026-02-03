import { NextResponse } from "next/server";
import { getPricingSettings } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pricing = await getPricingSettings();
    return NextResponse.json(pricing);
  } catch (error) {
    console.error("Get pricing error:", error);
    return NextResponse.json({ error: "Failed to fetch pricing" }, { status: 500 });
  }
}
