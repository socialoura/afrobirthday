import { hogql } from "@/lib/posthogQuery";
import { upsertAiReferrals, type AiReferralRow } from "@/lib/seoDb";

// Assistants whose referrals we count as "AI". Matched against the session's
// entry utm_source first, then its entry referring domain — ChatGPT strips the
// HTTP referrer, so for most of these the utm tag is the only surviving signal.
//
// Keep the raw values here and normalise below, so `chat.openai.com` and
// `chatgpt.com` roll up into one series instead of splitting the history.
const AI_SOURCES: Record<string, string> = {
  "chatgpt.com": "chatgpt",
  "chat.openai.com": "chatgpt",
  "openai.com": "chatgpt",
  "perplexity.ai": "perplexity",
  "www.perplexity.ai": "perplexity",
  "copilot.microsoft.com": "copilot",
  "www.bing.com/chat": "copilot",
  "gemini.google.com": "gemini",
  "bard.google.com": "gemini",
  "claude.ai": "claude",
  "you.com": "you",
  "grok.com": "grok",
  "x.ai": "grok",
};

function sqlStringList(values: string[]) {
  // Values are hardcoded above, never user input, but escape anyway so a future
  // edit adding an apostrophe can't produce a broken query.
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
}

type RawRow = [string, string, string, number, number];

/**
 * Rebuilds the AI-referral rollup for the trailing `days` days and writes it to
 * Postgres. Re-running overwrites the same rows, so it is safe to call on a
 * retry or by hand.
 *
 * Defaults to 7 days rather than 1: PostHog can receive late events, and a
 * short trailing re-ingest costs nothing while keeping the series accurate.
 */
export async function ingestAiReferrals(days = 7): Promise<{
  rows: number;
  sessions: number;
  orders: number;
}> {
  const sources = sqlStringList(Object.keys(AI_SOURCES));

  const query = `
    SELECT
        toString(toDate(timestamp)) AS d,
        coalesce(
            nullIf(properties.$session_entry_utm_source, ''),
            nullIf(properties.$session_entry_referring_domain, '')
        ) AS src,
        coalesce(nullIf(properties.$session_entry_pathname, ''), '/') AS landing,
        count(DISTINCT if(event = '$pageview', properties.$session_id, NULL)) AS sessions,
        count(DISTINCT if(event = 'order_completed', properties.$session_id, NULL)) AS orders
    FROM events
    WHERE timestamp >= now() - INTERVAL ${Number(days)} DAY
      AND event IN ('$pageview', 'order_completed')
      AND coalesce(
            nullIf(properties.$session_entry_utm_source, ''),
            nullIf(properties.$session_entry_referring_domain, '')
          ) IN (${sources})
    GROUP BY d, src, landing
  `;

  const raw = (await hogql<RawRow>(query)) ?? [];

  // Several raw sources map to one canonical name, so merge before writing.
  const merged = new Map<string, AiReferralRow>();
  for (const [date, src, landing, sessions, orders] of raw) {
    const source = AI_SOURCES[src] ?? src;
    const key = `${date}|${source}|${landing}`;
    const existing = merged.get(key);
    if (existing) {
      existing.sessions += sessions;
      existing.orders += orders;
    } else {
      merged.set(key, {
        date,
        source,
        landing_path: landing,
        sessions,
        orders,
      });
    }
  }

  const rows = [...merged.values()];
  await upsertAiReferrals(rows);

  return {
    rows: rows.length,
    sessions: rows.reduce((n, r) => n + r.sessions, 0),
    orders: rows.reduce((n, r) => n + r.orders, 0),
  };
}
