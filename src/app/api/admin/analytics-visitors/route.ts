import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";

// Fixed to this specific PostHog project/region — the app/query API lives on
// a different host than the ingestion proxy (NEXT_PUBLIC_POSTHOG_HOST points
// at eu.i.posthog.com, ingestion-only; this is eu.posthog.com, the app API).
const POSTHOG_API_HOST = "https://eu.posthog.com";
const POSTHOG_PROJECT_ID = "238346";

export async function GET(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.POSTHOG;
  if (!apiKey) {
    return NextResponse.json(
      { error: "POSTHOG personal API key not configured" },
      { status: 501 }
    );
  }

  try {
    const res = await fetch(
      `${POSTHOG_API_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query:
              "SELECT count(DISTINCT person_id) AS visitors FROM events WHERE event = '$pageview'",
          },
        }),
        // Real-time-enough for an admin dashboard glance, cheap to refetch.
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("PostHog visitors query failed:", res.status, text);
      return NextResponse.json({ error: "PostHog query failed" }, { status: 502 });
    }

    const data = (await res.json()) as { results?: Array<[number]> };
    const totalVisitors = data.results?.[0]?.[0] ?? 0;

    return NextResponse.json(
      { totalVisitors },
      { headers: { "Cache-Control": "private, s-maxage=300, stale-while-revalidate=900" } }
    );
  } catch (error) {
    console.error("Analytics visitors error:", error);
    return NextResponse.json({ error: "Failed to fetch visitor count" }, { status: 500 });
  }
}
