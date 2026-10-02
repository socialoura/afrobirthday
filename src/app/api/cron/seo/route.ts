import { NextResponse } from "next/server";
import { runSeoStep, type SeoStep } from "@/lib/seoEngine";
import { rejectUnauthorizedCron } from "@/lib/cronAuth";

export const runtime = "nodejs";
export const maxDuration = 800;

// Steps that run on every daily pass, in order.
// Every step is attempted daily; each one enforces its own cadence, so the
// weekly funnel simply skips on the six days it should not run.
const DAILY_STEPS: SeoStep[] = ["ai-referrals", "indexation", "funnel", "citations"];

export async function GET(request: Request) {
  const unauthorized = rejectUnauthorizedCron(request, "seo");
  if (unauthorized) return unauthorized;

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
