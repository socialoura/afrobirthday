// Thin wrapper around PostHog's HogQL query API.
//
// Note the host: NEXT_PUBLIC_POSTHOG_HOST points at eu.i.posthog.com, which is
// ingestion-only. The query API lives on eu.posthog.com. Keeping both constants
// here so the difference is stated once rather than rediscovered per caller.
const POSTHOG_API_HOST = "https://eu.posthog.com";
const POSTHOG_PROJECT_ID = "238346";

export class PostHogNotConfiguredError extends Error {
  constructor() {
    super("POSTHOG personal API key not configured");
    this.name = "PostHogNotConfiguredError";
  }
}

/**
 * Runs a HogQL query and returns the raw result rows.
 *
 * `revalidateSeconds` is passed through to fetch's cache. Pass 0 for cron jobs,
 * which must not read a cached answer from an earlier run.
 */
export async function hogql<T = unknown[]>(
  query: string,
  revalidateSeconds = 0
): Promise<T[]> {
  const apiKey = process.env.POSTHOG;
  if (!apiKey) throw new PostHogNotConfiguredError();

  const res = await fetch(
    `${POSTHOG_API_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      next: revalidateSeconds > 0 ? { revalidate: revalidateSeconds } : { revalidate: 0 },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PostHog query failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { results?: T[] };
  return data.results ?? [];
}
