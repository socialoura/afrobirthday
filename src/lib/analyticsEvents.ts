import posthog from "posthog-js";

/**
 * Every analytics event name the site emits, declared once.
 *
 * Without this list a typo creates a twin event that lives its own life beside
 * the real one, shows up in no funnel, and is only noticed while working out
 * why the numbers don't add up. And with no list at all, nobody knows what is
 * already measured, so events get redeclared, doubled, or forgotten.
 *
 * `captureEvent` is the only way to emit one, and it accepts nothing else.
 * Cross-check the list against the code with `npm run audit:events`.
 */
export const ANALYTICS_EVENTS = {
  // --- order form ---
  ORDER_FORM_STARTED: "order_form_started",
  PHOTO_SELECTED: "photo_selected",
  PHOTO_UPLOAD_FAILED: "photo_upload_failed",
  MUSIC_SELECTED: "music_selected",
  PROMO_CODE_APPLIED: "promo_code_applied",
  ORDER_FORM_STEP_COMPLETED: "order_form_step_completed",

  // --- payment step ---
  PAYMENT_STEP_VIEWED: "payment_step_viewed",
  /** Every press of the pay button, before any guard. The denominator for the
   *  two below: without it, a click that a guard swallowed is indistinguishable
   *  from never having clicked at all. */
  PAYMENT_CTA_CLICKED: "payment_cta_clicked",
  PAYMENT_BLOCKED_NOT_READY: "payment_blocked_not_ready",
  CHECKOUT_INITIATED: "checkout_initiated",
  PAYMENT_SETUP_FAILED: "payment_setup_failed",
  PAYMENT_FORM_MOUNTED: "payment_form_mounted",
  PAYMENT_ELEMENT_READY: "payment_element_ready",
  // The accordion-specific events went with the inline form: the card modal
  // offers one method, so there is nothing to select and no element to fail.
  PAYMENT_BLOCKED_TERMS: "payment_blocked_terms",
  PAYMENT_SUBMITTED: "payment_submitted",
  PAYMENT_REDIRECT_STARTED: "payment_redirect_started",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_INCOMPLETE: "payment_incomplete",
  PAYMENT_SUCCEEDED: "payment_succeeded",
  STRIPE_UNAVAILABLE: "stripe_unavailable",

  // --- post-purchase ---
  ORDER_COMPLETED: "order_completed",

  // --- e-mail channel (emitted server-side, from the crons) ---
  EMAIL_SENT: "email_sent",

  // --- performance ---
  WEB_VITAL_ATTRIBUTED: "web_vital_attributed",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** The only sanctioned way to emit an analytics event from the browser. */
export function captureEvent(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>
): void {
  posthog.capture(event, properties);
}
