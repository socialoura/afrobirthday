import { locales } from "@/i18n/config";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * The URLs the indexation probe inspects — the same set the sitemap declares.
 *
 * Sharing one list matters: reporting an address to Search Console that
 * redirects gets the inspection thrown away, because crawlers do not follow
 * redirects for indexing. Every URL here has to answer 200, which is why it is
 * built on the locale-prefixed path and on SITE_URL, whose whole job is to
 * resolve to the origin that does not redirect.
 */

export const SEO_STATIC_PATHS = [
  "",
  "/how-to-order",
  "/our-story",
  "/faq",
  "/about",
  "/privacy",
  "/refund",
  "/terms",
] as const;

export function allIndexableUrls(): string[] {
  return SEO_STATIC_PATHS.flatMap((path) =>
    locales.map((locale) => `${SITE_URL}/${locale}${path}`)
  );
}
