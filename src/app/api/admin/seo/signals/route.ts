import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import {
  getAiReferralsByLanding,
  getAiReferralsBySource,
  getAiReferralsDaily,
} from "@/lib/seoDb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get("days"));
  const days =
    Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365
      ? Math.floor(daysParam)
      : 60;

  try {
    const [daily, bySource, byLanding] = await Promise.all([
      getAiReferralsDaily(days),
      getAiReferralsBySource(days),
      getAiReferralsByLanding(days),
    ]);

    const sessions = bySource.reduce((n, r) => n + r.sessions, 0);
    const orders = bySource.reduce((n, r) => n + r.orders, 0);

    return NextResponse.json({
      days,
      totals: {
        sessions,
        orders,
        conversionRate: sessions > 0 ? orders / sessions : 0,
      },
      daily,
      bySource,
      byLanding,
    });
  } catch (err) {
    console.error("SEO signals query failed:", err);
    return NextResponse.json(
      { error: "Failed to load SEO signals" },
      { status: 500 }
    );
  }
}
