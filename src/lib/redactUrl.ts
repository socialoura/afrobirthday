/**
 * Query-string keys that must never reach analytics.
 *
 * The unsubscribe link carries a signed token in the URL, and it reaches
 * PostHog through $current_url on any page that links to it. A signed token
 * sitting in a third-party analytics tool is a credential we no longer
 * control, so it is replaced before the event leaves the browser.
 *
 * Extracted from the PostHog config so it can be tested directly: the real
 * payload leaves via sendBeacon on page unload, which is impractical to
 * intercept reliably.
 */
export const SENSITIVE_QUERY_KEYS = [
  "t",
  "token",
  "e",
  "email",
  "session_id",
  "payment_intent_client_secret",
] as const;

export function redactUrl(value: unknown): unknown {
  if (typeof value !== "string" || !value.includes("?")) return value;
  try {
    const url = new URL(value);
    let touched = false;
    for (const key of SENSITIVE_QUERY_KEYS) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, "[redacted]");
        touched = true;
      }
    }
    return touched ? url.toString() : value;
  } catch {
    // A relative or malformed value is left alone rather than dropped: losing
    // the property outright would be worse than leaving it as it was.
    return value;
  }
}

/** Keys whose values are URLs, and therefore need redacting. */
export const URL_PROPERTIES = [
  "$current_url",
  "$referrer",
  "$pathname",
  "$session_entry_url",
] as const;

export function redactUrlProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...properties };
  for (const key of URL_PROPERTIES) {
    if (key in cleaned) cleaned[key] = redactUrl(cleaned[key]);
  }
  return cleaned;
}
