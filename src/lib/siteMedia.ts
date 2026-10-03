/**
 * Heavy storefront media (demo videos and their posters) are served from the
 * VPS media host instead of Vercel: ~30 MB of video per curious visitor would
 * otherwise eat the Vercel bandwidth quota once ads bring traffic.
 *
 * Files live in /srv/media/afrobirthday/site/<version>/ and nginx serves them
 * with a one-year immutable cache, so a changed file must go in a new version
 * folder (v2, ...) rather than overwrite one in place. Copies stay in public/
 * as a fallback: set NEXT_PUBLIC_SITE_MEDIA_BASE="" to serve them locally.
 */
const SITE_MEDIA_BASE =
  process.env.NEXT_PUBLIC_SITE_MEDIA_BASE ?? "https://media.afrobirthday.com/site/v1";

export const SITE_MEDIA_ORIGIN = (() => {
  try {
    return SITE_MEDIA_BASE ? new URL(SITE_MEDIA_BASE).origin : null;
  } catch {
    return null;
  }
})();

export function siteMedia(file: string): string {
  return `${SITE_MEDIA_BASE}/${file.replace(/^\//, "")}`;
}
