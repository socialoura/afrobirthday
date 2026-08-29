import { ingestAiReferrals } from "@/lib/aiVisibility";
import { runIndexationProbe } from "@/lib/indexationProbe";
import { runFunnelProbe } from "@/lib/funnelProbe";
import { getSetting } from "@/lib/db";
import { recordJobRun, stepRanToday } from "@/lib/seoDb";

// The engine is a small step registry rather than one cron per job. Steps are
// individually runnable (from the admin "run now" endpoint) and individually
// idempotent, so a retry, a manual re-run, or a partial pass never doubles up.

export type SeoStep = "ai-referrals" | "indexation" | "funnel";

export const SEO_STEPS: SeoStep[] = ["ai-referrals", "indexation", "funnel"];

export function isSeoStep(value: string): value is SeoStep {
  return (SEO_STEPS as string[]).includes(value);
}

type StepResult = {
  ok: boolean;
  skipped?: string;
  [key: string]: unknown;
};

/**
 * Runs one engine step.
 *
 * `force` bypasses the "already ran today" guard — used by the admin run-now
 * button and by backfills, never by the cron.
 */
export async function runSeoStep(
  step: SeoStep,
  opts: { force?: boolean; days?: number } = {}
): Promise<StepResult> {
  const enabled = await getSetting("seo_engine_enabled");
  // Absent setting means enabled: the engine should work on a fresh deploy
  // without anyone remembering to flip a row on. Only an explicit "false"
  // stops it.
  if (enabled === "false" && !opts.force) {
    return { ok: true, skipped: "seo_engine_enabled is false" };
  }

  if (!opts.force && (await stepRanToday(step))) {
    return { ok: true, skipped: "already ran today" };
  }

  let result: StepResult;
  try {
    result = await execute(step, opts);
  } catch (err) {
    await recordJobRun(step, false, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  await recordJobRun(step, true, result);
  return result;
}

async function execute(
  step: SeoStep,
  opts: { days?: number }
): Promise<StepResult> {
  switch (step) {
    case "ai-referrals": {
      const stats = await ingestAiReferrals(opts.days ?? 7);
      return { ok: true, ...stats };
    }
    case "indexation": {
      const stats = await runIndexationProbe();
      return { ok: true, ...stats };
    }
    case "funnel": {
      const stats = await runFunnelProbe();
      return { ok: true, ...stats };
    }
  }
}
