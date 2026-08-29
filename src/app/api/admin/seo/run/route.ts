import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { isSeoStep, runSeoStep, SEO_STEPS } from "@/lib/seoEngine";

export const runtime = "nodejs";
export const maxDuration = 800;

/**
 * Runs one engine step on demand. This is how you backfill, re-run after a
 * failure, or test a step locally without waiting for the cron — and it is why
 * the engine needs only a single cron slot.
 */
export async function POST(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { step?: string; days?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const step = body.step;
  if (!step || !isSeoStep(step)) {
    return NextResponse.json(
      { error: `Unknown step. Expected one of: ${SEO_STEPS.join(", ")}` },
      { status: 400 }
    );
  }

  // Manual runs always force: the operator asked for it, so the "already ran
  // today" guard would only get in the way.
  const days =
    typeof body.days === "number" && body.days > 0 && body.days <= 400
      ? Math.floor(body.days)
      : undefined;

  try {
    const result = await runSeoStep(step, { force: true, days });
    return NextResponse.json({ ok: true, step, result });
  } catch (err) {
    console.error(`Manual SEO step "${step}" failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Step failed" },
      { status: 500 }
    );
  }
}
