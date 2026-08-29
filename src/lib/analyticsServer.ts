import { ANALYTICS_EVENTS } from "@/lib/analyticsEvents";
import type { EmailCampaign } from "@/lib/campaign";

/**
 * Server-side analytics, for the things the browser cannot see.
 *
 * An e-mail send happens on a cron, with no browser anywhere. Without it the
 * channel has clicks and no sends — a numerator with no denominator, which is
 * not a rate.
 *
 * The campaign travels as a property rather than as its own event name: eight
 * twin events would be impossible to compare against each other.
 */

const INGEST_HOST = "https://eu.i.posthog.com";

/**
 * Fire-and-forget: analytics must never be able to fail a send. The caller is
 * already inside a try/catch for the e-mail itself, and a rejected capture
 * here would abort the loop over the remaining recipients.
 */
async function captureServerEvent(
  event: string,
  distinctId: string,
  properties: Record<string, unknown>
): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token || !distinctId) return;

  try {
    await fetch(`${INGEST_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: token,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: "afrobirthday-server" },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error(`PostHog server capture failed (${event}):`, err);
  }
}

/**
 * One event per message sent. distinct_id is the customer's e-mail, matching
 * the identify() call the order form makes, so a send and the visit it
 * produces belong to the same person.
 */
export async function trackEmailSent(
  campaign: EmailCampaign,
  email: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  await captureServerEvent(ANALYTICS_EVENTS.EMAIL_SENT, email.trim().toLowerCase(), {
    campaign,
    ...properties,
  });
}
