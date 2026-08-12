import { NextResponse } from "next/server";
import { getRecentlyDeliveredOrdersCount } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const count = await getRecentlyDeliveredOrdersCount(7);
    return NextResponse.json(
      { count },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    console.error("Get recent orders count error:", error);
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
