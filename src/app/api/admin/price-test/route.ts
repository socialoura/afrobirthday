import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { buildPriceTestReport } from "@/lib/priceTestReport";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await buildPriceTestReport());
  } catch (err) {
    console.error("Price test report failed:", err);
    return NextResponse.json({ error: "Failed to build the price test report" }, { status: 500 });
  }
}
