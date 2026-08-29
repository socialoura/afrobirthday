import { getSql } from "@/lib/db";

// SEO/AI-visibility tables live here rather than in db.ts, which is already
// large. Same self-healing pattern as the ensure* helpers there: memoise the
// promise, and clear it on failure so a transient DB error doesn't poison the
// process for its whole lifetime.

let seoTablesReady: Promise<void> | null = null;

export function ensureSeoTables(): Promise<void> {
  if (!seoTablesReady) {
    seoTablesReady = runEnsureSeoTables().catch((err) => {
      seoTablesReady = null;
      throw err;
    });
  }
  return seoTablesReady;
}

async function runEnsureSeoTables() {
  const sql = getSql();

  // Daily rollup of sessions arriving from AI assistants, split by the page
  // they landed on. This is the primary KPI of the whole SEO effort: it is
  // first-party, free, and already flowing. `orders` counts the sessions in
  // that same bucket that ended in a completed order.
  await sql`
    CREATE TABLE IF NOT EXISTS seo_ai_referrals (
      date date NOT NULL,
      source text NOT NULL,
      landing_path text NOT NULL,
      sessions integer NOT NULL DEFAULT 0,
      orders integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (date, source, landing_path)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS seo_ai_referrals_date_idx
      ON seo_ai_referrals (date DESC)
  `;

  // Every step the SEO engine runs writes one row here. Used for idempotency
  // ("did this step already run today?") and for debugging unattended runs.
  await sql`
    CREATE TABLE IF NOT EXISTS seo_job_runs (
      id bigserial PRIMARY KEY,
      step text NOT NULL,
      started_at timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz,
      ok boolean,
      detail jsonb
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS seo_job_runs_step_started_idx
      ON seo_job_runs (step, started_at DESC)
  `;
}

export type AiReferralRow = {
  date: string;
  source: string;
  landing_path: string;
  sessions: number;
  orders: number;
};

/**
 * Upserts a day's AI-referral rollup. Re-running for the same day overwrites
 * rather than accumulating, so a retry or a manual re-run is always safe.
 */
export async function upsertAiReferrals(rows: AiReferralRow[]) {
  if (rows.length === 0) return 0;
  await ensureSeoTables();
  const sql = getSql();

  for (const row of rows) {
    await sql`
      INSERT INTO seo_ai_referrals (date, source, landing_path, sessions, orders, updated_at)
      VALUES (${row.date}, ${row.source}, ${row.landing_path}, ${row.sessions}, ${row.orders}, now())
      ON CONFLICT (date, source, landing_path) DO UPDATE
        SET sessions = EXCLUDED.sessions,
            orders = EXCLUDED.orders,
            updated_at = now()
    `;
  }
  return rows.length;
}

/** Daily totals across all sources, for the admin chart. */
export async function getAiReferralsDaily(days = 60) {
  await ensureSeoTables();
  const sql = getSql();
  return (await sql`
    SELECT date,
           sum(sessions)::int AS sessions,
           sum(orders)::int AS orders
    FROM seo_ai_referrals
    WHERE date >= current_date - ${days}::int
    GROUP BY date
    ORDER BY date
  `) as unknown as Array<{ date: string; sessions: number; orders: number }>;
}

/** Which AI assistants send traffic, and how well each converts. */
export async function getAiReferralsBySource(days = 60) {
  await ensureSeoTables();
  const sql = getSql();
  return (await sql`
    SELECT source,
           sum(sessions)::int AS sessions,
           sum(orders)::int AS orders
    FROM seo_ai_referrals
    WHERE date >= current_date - ${days}::int
    GROUP BY source
    ORDER BY sessions DESC
  `) as unknown as Array<{ source: string; sessions: number; orders: number }>;
}

/**
 * Which pages the AI assistants actually send people to. Once generated
 * guides exist this is the most actionable signal in the system: it names the
 * pages worth cloning.
 */
export async function getAiReferralsByLanding(days = 60, limit = 25) {
  await ensureSeoTables();
  const sql = getSql();
  return (await sql`
    SELECT landing_path,
           sum(sessions)::int AS sessions,
           sum(orders)::int AS orders
    FROM seo_ai_referrals
    WHERE date >= current_date - ${days}::int
    GROUP BY landing_path
    ORDER BY sessions DESC
    LIMIT ${limit}
  `) as unknown as Array<{ landing_path: string; sessions: number; orders: number }>;
}

export async function recordJobRun(
  step: string,
  ok: boolean,
  detail: unknown
) {
  await ensureSeoTables();
  const sql = getSql();
  await sql`
    INSERT INTO seo_job_runs (step, finished_at, ok, detail)
    VALUES (${step}, now(), ${ok}, ${JSON.stringify(detail ?? {})}::jsonb)
  `;
}

/** True when `step` already completed successfully today (UTC). */
export async function stepRanToday(step: string): Promise<boolean> {
  await ensureSeoTables();
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM seo_job_runs
    WHERE step = ${step}
      AND ok = true
      AND started_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
    LIMIT 1
  `;
  return rows.length > 0;
}
