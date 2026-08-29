import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import {
  getAiReferralsByLanding,
  getAiReferralsBySource,
  getAiReferralsDaily,
  getCitationSummary,
  getUrlInspections,
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
    const [daily, bySource, byLanding, inspections, citations] = await Promise.all([
      getAiReferralsDaily(days),
      getAiReferralsBySource(days),
      getAiReferralsByLanding(days),
      getUrlInspections(),
      getCitationSummary(),
    ]);

    // Google's own wording is grouped as-is rather than normalised: "URL is
    // unknown to Google" needs a link, "Crawled - currently not indexed" needs
    // content. Collapsing them into one "not indexed" bucket would hide which.
    const byCoverage = new Map<string, number>();
    for (const row of inspections) {
      const key = row.coverage_state ?? row.verdict ?? "unknown";
      byCoverage.set(key, (byCoverage.get(key) ?? 0) + 1);
    }

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
      indexation: {
        inspected: inspections.length,
        indexed: inspections.filter((r) => r.verdict === "PASS").length,
        byCoverage: [...byCoverage.entries()]
          .map(([state, count]) => ({ state, count }))
          .sort((a, b) => b.count - a.count),
        urls: inspections,
      },
      citations,
    });
  } catch (err) {
    console.error("SEO signals query failed:", err);
    return NextResponse.json(
      { error: "Failed to load SEO signals" },
      { status: 500 }
    );
  }
}
