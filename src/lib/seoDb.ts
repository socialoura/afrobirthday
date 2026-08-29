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

  // One row per URL, overwritten on each inspection. coverage_state holds
  // Google's own words rather than a normalised enum of our own: it is what
  // separates a page judged thin from a page never crawled, and those two are
  // not fixed the same way.
  await sql`
    CREATE TABLE IF NOT EXISTS seo_url_inspections (
      url text PRIMARY KEY,
      verdict text,
      coverage_state text,
      robots_txt_state text,
      indexing_state text,
      page_fetch_state text,
      google_canonical text,
      user_canonical text,
      last_crawl_time timestamptz,
      inspected_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  // The rotating batch reads oldest-inspected first.
  await sql`
    CREATE INDEX IF NOT EXISTS seo_url_inspections_inspected_idx
      ON seo_url_inspections (inspected_at ASC)
  `;

  // One row per question per pass. Kept as a series rather than overwritten:
  // whether an assistant starts or stops citing the site is the whole point,
  // and that only shows up over time. `sources` keeps the domains cited
  // instead — the competitive half of the answer.
  await sql`
    CREATE TABLE IF NOT EXISTS seo_citations (
      id bigserial PRIMARY KEY,
      asked_at timestamptz NOT NULL DEFAULT now(),
      question text NOT NULL,
      locale text NOT NULL,
      cited boolean NOT NULL,
      position integer,
      sources jsonb NOT NULL DEFAULT '[]'::jsonb
    )
  `;

  // Added after the table shipped with Perplexity only. The two assistants
  // answer differently — on the same question ChatGPT cited this site first
  // and Perplexity not at all — so the provider has to be part of the key.
  await sql`
    ALTER TABLE seo_citations
    ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'perplexity'
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS seo_citations_asked_idx
      ON seo_citations (asked_at DESC)
  `;
}

export type CitationRow = {
  provider: string;
  question: string;
  locale: string;
  cited: boolean;
  position: number | null;
  sources: string[];
};

export async function recordCitationResults(rows: CitationRow[]) {
  await ensureSeoTables();
  const sql = getSql();
  for (const r of rows) {
    await sql`
      INSERT INTO seo_citations (provider, question, locale, cited, position, sources)
      VALUES (${r.provider}, ${r.question}, ${r.locale}, ${r.cited}, ${r.position},
              ${JSON.stringify(r.sources)}::jsonb)
    `;
  }
}

export type CitationDrift = {
  provider: string;
  question: string;
  locale: string;
  from: boolean;
  to: boolean;
};

/**
 * Questions where the answer flipped between the two most recent passes.
 *
 * Drift, not absolute state: "we are cited on 3 of 10" is a standing figure
 * and belongs on a dashboard. "We stopped being cited on this question
 * overnight" is an event, and it is the only thing worth interrupting someone
 * for. An alert that fires every night stops being read within three days.
 */
export async function getCitationDrift(): Promise<CitationDrift[]> {
  await ensureSeoTables();
  const sql = getSql();

  const rows = await sql<
    { provider: string; question: string; locale: string; cited: boolean; rn: number }[]
  >`
    SELECT provider, question, locale, cited, rn FROM (
      SELECT provider, question, locale, cited,
             row_number() OVER (PARTITION BY provider, question ORDER BY asked_at DESC) AS rn
      FROM seo_citations
    ) ranked
    WHERE rn <= 2
  `;

  const byKey = new Map<string, { latest?: typeof rows[number]; previous?: typeof rows[number] }>();
  for (const r of rows) {
    const key = `${r.provider}::${r.question}`;
    const entry = byKey.get(key) ?? {};
    if (Number(r.rn) === 1) entry.latest = r;
    else entry.previous = r;
    byKey.set(key, entry);
  }

  const drift: CitationDrift[] = [];
  for (const { latest, previous } of byKey.values()) {
    // A question asked only once has nothing to compare against, and a first
    // reading is not a change.
    if (!latest || !previous) continue;
    if (latest.cited !== previous.cited) {
      drift.push({
        provider: latest.provider,
        question: latest.question,
        locale: latest.locale,
        from: previous.cited,
        to: latest.cited,
      });
    }
  }
  return drift;
}

/** Latest result per question, plus the domains cited instead of ours. */
export async function getCitationSummary(days = 30) {
  await ensureSeoTables();
  const sql = getSql();

  const latest = await sql<
    { provider: string; question: string; locale: string; cited: boolean; position: number | null; sources: unknown; asked_at: Date }[]
  >`
    SELECT DISTINCT ON (provider, question)
      provider, question, locale, cited, position, sources, asked_at
    FROM seo_citations
    WHERE asked_at >= now() - make_interval(days => ${days})
    ORDER BY provider, question, asked_at DESC
  `;

  // postgres.js hands jsonb back as a string unless a transform is configured,
  // so iterating it directly counts characters, not hosts. Parsed here rather
  // than assuming, since the driver could reasonably do either.
  const asHosts = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const competitors = new Map<string, number>();
  for (const row of latest) {
    for (const host of asHosts(row.sources)) {
      if (host.endsWith("afrobirthday.com")) continue;
      competitors.set(host, (competitors.get(host) ?? 0) + 1);
    }
  }

  return {
    questions: latest.map((r) => ({ ...r, sources: asHosts(r.sources) })),
    citedCount: latest.filter((r) => r.cited).length,
    topCompetitors: [...competitors.entries()]
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
  };
}

export type UrlInspectionRow = {
  url: string;
  verdict: string | null;
  coverageState: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
  pageFetchState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  lastCrawlTime: string | null;
};

export async function upsertUrlInspection(row: UrlInspectionRow) {
  await ensureSeoTables();
  const sql = getSql();
  await sql`
    INSERT INTO seo_url_inspections (
      url, verdict, coverage_state, robots_txt_state, indexing_state,
      page_fetch_state, google_canonical, user_canonical, last_crawl_time, inspected_at
    ) VALUES (
      ${row.url}, ${row.verdict}, ${row.coverageState}, ${row.robotsTxtState},
      ${row.indexingState}, ${row.pageFetchState}, ${row.googleCanonical},
      ${row.userCanonical}, ${row.lastCrawlTime}, now()
    )
    ON CONFLICT (url) DO UPDATE SET
      verdict = EXCLUDED.verdict,
      coverage_state = EXCLUDED.coverage_state,
      robots_txt_state = EXCLUDED.robots_txt_state,
      indexing_state = EXCLUDED.indexing_state,
      page_fetch_state = EXCLUDED.page_fetch_state,
      google_canonical = EXCLUDED.google_canonical,
      user_canonical = EXCLUDED.user_canonical,
      last_crawl_time = EXCLUDED.last_crawl_time,
      inspected_at = now()
  `;
}

/**
 * The next URLs to inspect: never-seen ones first, then least recently seen.
 *
 * The daily quota would allow inspecting everything at once, but a rotating
 * batch keeps the load flat and means one failed day leaves no hole in the
 * series.
 */
export async function pickUrlsToInspect(candidates: string[], limit: number): Promise<string[]> {
  await ensureSeoTables();
  const sql = getSql();
  if (candidates.length === 0) return [];

  const seen = await sql<{ url: string; inspected_at: Date }[]>`
    SELECT url, inspected_at FROM seo_url_inspections WHERE url IN ${sql(candidates)}
  `;
  const lastSeen = new Map(seen.map((r) => [r.url, r.inspected_at.getTime()]));

  return [...candidates]
    .sort((a, b) => (lastSeen.get(a) ?? 0) - (lastSeen.get(b) ?? 0))
    .slice(0, limit);
}

export type StoredUrlInspection = {
  url: string;
  verdict: string | null;
  coverage_state: string | null;
  robots_txt_state: string | null;
  indexing_state: string | null;
  page_fetch_state: string | null;
  google_canonical: string | null;
  user_canonical: string | null;
  last_crawl_time: Date | null;
  inspected_at: Date;
};

export async function getUrlInspections(limit = 200): Promise<StoredUrlInspection[]> {
  await ensureSeoTables();
  const sql = getSql();
  return sql<StoredUrlInspection[]>`
    SELECT * FROM seo_url_inspections
    ORDER BY (verdict = 'PASS') ASC, inspected_at DESC
    LIMIT ${limit}
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
/**
 * Has this step run successfully within the last `days` days?
 *
 * Used by steps whose natural cadence is not daily. The funnel is weekly: at
 * this volume a day measures noise, so it is checked against a seven-day
 * window rather than "today".
 */
export async function stepRanWithinDays(step: string, days: number): Promise<boolean> {
  await ensureSeoTables();
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM seo_job_runs
    WHERE step = ${step}
      AND ok = true
      AND started_at >= now() - make_interval(days => ${days})
    LIMIT 1
  `;
  return rows.length > 0;
}

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
