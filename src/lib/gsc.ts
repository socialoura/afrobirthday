import { SignJWT, importPKCS8 } from "jose";

/**
 * Search Console, reached with a service account.
 *
 * The URL Inspection API answers without anyone opening a dashboard: a stable
 * verdict, the raw reason in Google's own words, and the last crawl date.
 * Keep the raw reason — it is what separates "page is too thin" from "page is
 * blocked", two problems that are not fixed the same way.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

export class GscNotConfiguredError extends Error {
  constructor() {
    super("GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GSC_SITE_URL not configured");
    this.name = "GscNotConfiguredError";
  }
}

export function isGscConfigured(): boolean {
  return Boolean(
    process.env.GSC_CLIENT_EMAIL && process.env.GSC_PRIVATE_KEY && process.env.GSC_SITE_URL
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!isGscConfigured()) throw new GscNotConfiguredError();
  // A cron pass inspects a whole batch; re-minting per URL would be wasteful.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  // Env vars store the PEM with literal \n, and sometimes wrapped in quotes.
  const pem = (process.env.GSC_PRIVATE_KEY ?? "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");

  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(process.env.GSC_CLIENT_EMAIL!)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error(`Search Console token exchange failed: ${JSON.stringify(data).slice(0, 200)}`);
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

export type UrlInspection = {
  url: string;
  verdict: string | null;
  /** Google's own words. This is the field worth keeping. */
  coverageState: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
  pageFetchState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  lastCrawlTime: string | null;
};

export async function inspectUrl(url: string): Promise<UrlInspection> {
  const token = await getAccessToken();

  const res = await fetch(INSPECT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: process.env.GSC_SITE_URL }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`URL inspection failed (${res.status}) for ${url}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    inspectionResult?: { indexStatusResult?: Record<string, string> };
  };
  const r = data.inspectionResult?.indexStatusResult ?? {};

  return {
    url,
    verdict: r.verdict ?? null,
    coverageState: r.coverageState ?? null,
    robotsTxtState: r.robotsTxtState ?? null,
    indexingState: r.indexingState ?? null,
    pageFetchState: r.pageFetchState ?? null,
    googleCanonical: r.googleCanonical ?? null,
    userCanonical: r.userCanonical ?? null,
    lastCrawlTime: r.lastCrawlTime ?? null,
  };
}

export type SearchAnalyticsRow = {
  date: string;
  clicks: number;
  impressions: number;
};

/**
 * Daily clicks and impressions from Search Console.
 *
 * Search Console lags by two to three days, so a caller asking for "yesterday"
 * gets nothing and should not read that as a collapse.
 */
export async function querySearchAnalytics(
  startDate: string,
  endDate: string
): Promise<SearchAnalyticsRow[]> {
  const token = await getAccessToken();
  const site = encodeURIComponent(process.env.GSC_SITE_URL!);

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["date"], rowLimit: 500 }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Search analytics failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    rows?: Array<{ keys: string[]; clicks: number; impressions: number }>;
  };

  return (data.rows ?? []).map((r) => ({
    date: r.keys[0],
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
  }));
}
