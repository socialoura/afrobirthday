/**
 * Cookie consent for advertising and analytics storage.
 *
 * Only visitors from countries with an opt-in regime (EEA, UK, Switzerland)
 * are asked; everyone else is opted in by default. The country comes from the
 * `ab_geo` cookie, set by middleware.ts from Vercel's geo header, because the
 * storefront pages are static and cannot read request headers themselves.
 */

export const CONSENT_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
  "SE", "IS", "LI", "NO", "GB", "CH",
] as const;

export const GEO_COOKIE = "ab_geo";
const CONSENT_COOKIE = "ab_consent";
export const CONSENT_EVENT = "afrobirthday:consent";
/** Dispatched by the footer "Cookie settings" link to show the banner again. */
export const OPEN_CONSENT_EVENT = "afrobirthday:open-consent";

export type ConsentState = "granted" | "denied";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** The visitor's country (ISO code) from the middleware cookie, if known. */
export function getGeoCountry(): string | null {
  return readCookie(GEO_COOKIE);
}

/** True when this visitor must opt in before ad/analytics storage is used. */
export function consentRequired(): boolean {
  const country = readCookie(GEO_COOKIE);
  // Unknown country (cookie blocked, local dev): ask, the safe default.
  if (!country) return true;
  return (CONSENT_COUNTRIES as readonly string[]).includes(country.toUpperCase());
}

export function getStoredConsent(): ConsentState | null {
  const value = readCookie(CONSENT_COOKIE);
  return value === "granted" || value === "denied" ? value : null;
}

/** Whether ad pixels and persistent analytics may run right now. */
export function hasAdsConsent(): boolean {
  if (typeof document === "undefined") return false;
  const stored = getStoredConsent();
  if (stored) return stored === "granted";
  return !consentRequired();
}

type Gtag = (...args: unknown[]) => void;

export function setConsent(state: ConsentState): void {
  const maxAge = 60 * 60 * 24 * 180; // 6 months, then ask again
  document.cookie = `${CONSENT_COOKIE}=${state}; path=/; max-age=${maxAge}; SameSite=Lax`;
  applyConsentToGtag(state);
  window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }));
}

/** Pushes the visitor's choice to Google Consent Mode v2. */
export function applyConsentToGtag(state: ConsentState): void {
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (!gtag) return;
  const value = state === "granted" ? "granted" : "denied";
  gtag("consent", "update", {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
}
