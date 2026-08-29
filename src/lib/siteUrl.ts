/**
 * The site's public origin, in one place.
 *
 * `www` is authoritative: the apex 307-redirects to it. Everything that emits a
 * URL — canonical tags, hreflang, sitemap, robots, e-mail links, payment return
 * URLs — has to agree with that, or it publishes an address that redirects.
 * Getting this wrong is not cosmetic: the Stripe webhook was registered on the
 * apex, every delivery answered 307, and Stripe disabled the endpoint.
 *
 * The configured value is normalised rather than trusted, so a stale apex URL
 * in the deployment environment can't put the problem back.
 */

const CANONICAL_HOST = "www.afrobirthday.com";
const FALLBACK = `https://${CANONICAL_HOST}`;

/** Rewrites the bare apex to www and strips any trailing slash. */
export function normalizeSiteUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return FALLBACK;
  try {
    const url = new URL(value);
    if (url.hostname === "afrobirthday.com") url.hostname = CANONICAL_HOST;
    return url.origin;
  } catch {
    return FALLBACK;
  }
}

/**
 * Base URL for anything shown to a customer or indexed by a crawler.
 * Localhost is preserved, so development builds keep pointing at themselves.
 */
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

/**
 * Base URL for links inside Discord and Telegram notifications. Localhost is
 * deliberately ignored here — an operator opening the alert on a phone can do
 * nothing with it — so it falls through to the deployment's own domain.
 */
export function resolveNotificationUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit && !/localhost|127\.0\.0\.1/.test(explicit)) {
    return normalizeSiteUrl(explicit);
  }
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return FALLBACK;
}
