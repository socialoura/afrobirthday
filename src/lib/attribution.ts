"use client";

/**
 * First-touch attribution, captured in the browser and carried to the order.
 *
 * "Where did this sale come from?" came up on a real order and could not be
 * answered: the orders table kept no origin at all, and the answer lived in a
 * third-party tool behind a key that can be revoked.
 *
 * First touch, never last. Someone who discovers the site through an
 * assistant, comes back two days later by typing the address, and then orders,
 * was brought in by the assistant. Last touch would say "direct" — true, and
 * of no use whatsoever. So it is written once and never overwritten.
 */

const STORAGE_KEY = "afrobirthday_attribution_v1";

export type Attribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landing: string | null;
  referrer: string | null;
  firstSeenAt: string;
};

/** Trimmed hard: this ends up in a database column, and the browser can edit it. */
function clean(value: string | null | undefined, max = 120): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : null;
}

function read(): Attribution | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    if (!parsed || typeof parsed !== "object" || !parsed.firstSeenAt) return null;
    return {
      source: clean(parsed.source),
      medium: clean(parsed.medium),
      campaign: clean(parsed.campaign),
      landing: clean(parsed.landing, 200),
      referrer: clean(parsed.referrer, 200),
      firstSeenAt: clean(parsed.firstSeenAt, 40) ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Records the first visit if nothing is stored yet, and returns what is stored.
 * Safe to call on every page load — it is a no-op after the first one.
 */
export function captureFirstTouch(): Attribution | null {
  if (typeof window === "undefined") return null;

  const existing = read();
  if (existing) return existing;

  try {
    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer || null;

    // A referrer host is only useful when it is not our own domain.
    let referrerHost: string | null = null;
    if (referrer) {
      try {
        const host = new URL(referrer).hostname;
        if (host && host !== window.location.hostname) referrerHost = host;
      } catch {
        // unparseable referrer, leave it null
      }
    }

    const attribution: Attribution = {
      source: clean(params.get("utm_source")) ?? referrerHost ?? "direct",
      medium: clean(params.get("utm_medium")) ?? (referrerHost ? "referral" : "none"),
      campaign: clean(params.get("utm_campaign")),
      landing: clean(window.location.pathname, 200),
      referrer: clean(referrer, 200),
      firstSeenAt: new Date().toISOString(),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    // Private mode, storage disabled: attribution is a bonus, never a blocker.
    return null;
  }
}

/** What the order form sends along with a new order. */
export function getAttributionPayload(): Record<string, string> | undefined {
  const a = read() ?? captureFirstTouch();
  if (!a) return undefined;
  const payload: Record<string, string> = {};
  if (a.source) payload.source = a.source;
  if (a.medium) payload.medium = a.medium;
  if (a.campaign) payload.campaign = a.campaign;
  if (a.landing) payload.landing = a.landing;
  if (a.referrer) payload.referrer = a.referrer;
  payload.firstSeenAt = a.firstSeenAt;
  return payload;
}
