import { onINP, onLCP, type INPMetricWithAttribution, type LCPMetricWithAttribution } from "web-vitals/attribution";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analyticsEvents";

/**
 * PostHog's built-in $web_vitals tells you the score and nothing else — its
 * `entries` array arrives empty, so a poor INP is a number with no cause
 * attached. These two metrics are reported again, with the attribution build,
 * so the slow interaction can actually be found and fixed.
 *
 * Only INP and LCP are duplicated: they're the two the site currently fails,
 * and they're the two whose attribution is worth the extra bytes.
 */

/** web-vitals rates each metric itself; only the bad ones are worth an event. */
function shouldReport(rating: string) {
  return rating === "needs-improvement" || rating === "poor";
}

function reportInp(metric: INPMetricWithAttribution) {
  if (!shouldReport(metric.rating)) return;
  const a = metric.attribution;
  captureEvent(ANALYTICS_EVENTS.WEB_VITAL_ATTRIBUTED, {
    metric: "INP",
    value: Math.round(metric.value),
    rating: metric.rating,
    // Which element the customer tapped, as a CSS selector.
    target: a.interactionTarget ?? null,
    interaction_type: a.interactionType ?? null,
    // The three phases INP is made of. Whichever dominates says what to fix:
    // input delay means the main thread was busy, processing means our own
    // handlers are slow, presentation means rendering the result is slow.
    input_delay: Math.round(a.inputDelay ?? 0),
    processing_duration: Math.round(a.processingDuration ?? 0),
    presentation_delay: Math.round(a.presentationDelay ?? 0),
    load_state: a.loadState ?? null,
  });
}

function reportLcp(metric: LCPMetricWithAttribution) {
  if (!shouldReport(metric.rating)) return;
  const a = metric.attribution;
  captureEvent(ANALYTICS_EVENTS.WEB_VITAL_ATTRIBUTED, {
    metric: "LCP",
    value: Math.round(metric.value),
    rating: metric.rating,
    target: a.target ?? null,
    element_url: a.url ?? null,
    // Splits LCP into server time, time before the image starts downloading,
    // the download itself, and the render after it — one of the four is the
    // problem, and they call for completely different fixes.
    ttfb: Math.round(a.timeToFirstByte ?? 0),
    resource_load_delay: Math.round(a.resourceLoadDelay ?? 0),
    resource_load_duration: Math.round(a.resourceLoadDuration ?? 0),
    element_render_delay: Math.round(a.elementRenderDelay ?? 0),
  });
}

export function trackAttributedWebVitals() {
  if (typeof window === "undefined") return;
  try {
    onINP(reportInp);
    onLCP(reportLcp);
  } catch {
    // Never let analytics break the page.
  }
}
