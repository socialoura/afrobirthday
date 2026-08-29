import { NextResponse } from "next/server";
import { runSeoStep, type SeoStep } from "@/lib/seoEngine";

export const runtime = "nodejs";
export const maxDuration = 800;

// Steps that run on every daily pass, in order.
const DAILY_STEPS: SeoStep[] = ["ai-referrals", "indexation"];

export async function GET(request: Request) {
  // Fails CLOSED, unlike the older crons in this directory. Those use
  // `if (cronSecret && authHeader !== ...)`, which silently makes the endpoint
  // public whenever CRON_SECRET is unset — the same shape of guard that caused
  // the 2026-08-22 duplicate-email incident documented in src/lib/db.ts.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("SEO cron refused to run: CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const results: Record<string, unknown> = {};

  for (const step of DAILY_STEPS) {
    // Leave headroom before the platform kills the function mid-write. Every
    // step commits its own writes, so stopping early is safe and resumable.
    if (Date.now() - startedAt > 700_000) {
      return NextResponse.json({ ok: true, incomplete: true, nextStep: step, results });
    }
    try {
      results[step] = await runSeoStep(step);
    } catch (err) {
      console.error(`SEO cron step "${step}" failed:`, err);
      results[step] = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ ok: true, incomplete: false, results });
}
