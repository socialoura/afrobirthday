import type { PostHog } from "posthog-js";
import { redactUrlProperties } from "@/lib/redactUrl";
import { CONSENT_EVENT, hasAdsConsent } from "@/lib/consent";
import { isOperatorPage } from "@/lib/pageSettled";

/**
 * PostHog, loaded once the page has settled (see pageSettled.ts) instead of
 * before hydration. posthog-js is ~60 KB of JavaScript that a slow phone had
 * to run before the first tap could be answered.
 *
 * Nothing may import posthog-js directly any more, or it lands back in the
 * first bundle: go through `withPostHog`, which runs the call at once when
 * PostHog is ready and holds it until then otherwise.
 */

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

let instance: PostHog | null = null;
let loading: Promise<void> | null = null;
let landingPageviewSent = false;
const pending: Array<(ph: PostHog) => void> = [];

export function withPostHog(fn: (ph: PostHog) => void): void {
  if (typeof window === "undefined" || !token) return;
  // PostHog never loads there: queuing would only hold calls forever.
  if (isOperatorPage(window.location.pathname)) return;
  if (instance) {
    fn(instance);
    return;
  }
  pending.push(fn);
}

export function loadPostHog(): Promise<void> {
  if (typeof window === "undefined" || !token) return Promise.resolve();
  if (isOperatorPage(window.location.pathname)) return Promise.resolve();
  if (loading) return loading;

  loading = import("posthog-js").then(({ default: posthog }) => {
    // api_host must stay in sync with the /ingest rewrite in next.config.mjs.
    posthog.init(token, {
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,

      // Pinned on purpose. Left unset, a posthog-js upgrade silently changes what
      // is measured, and a break in the series looks like a change in the
      // business rather than a change in the library.
      defaults: "2026-06-25",

      // No cookies or localStorage until the visitor may be tracked (opt-in
      // countries ask first, see ConsentBanner); switched on when they accept.
      persistence: hasAdsConsent() ? "localStorage+cookie" : "memory",

      capture_pageview: "history_change",
      autocapture: false,
      disable_session_recording: true,
      person_profiles: "identified_only",

      // Answers "are customers hitting JavaScript errors we never see?" — the
      // site currently has no way to know.
      capture_exceptions: true,

      // Remote config was pulling surveys.js on every page load: 100 KB for a
      // feature this site does not use. Web experiments likewise.
      disable_surveys: true,
      disable_web_experiments: true,

      // Strips e-mail addresses and similar out of captured properties.
      mask_personal_data_properties: true,

      // The catch-all for URLs the masking above does not know about.
      sanitize_properties: (properties) => redactUrlProperties(properties),

      // The landing page view is recorded when PostHog loads, seconds after
      // the visit began and possibly after a queued click: date it to the
      // navigation itself, or funnels would see the click before the view.
      before_send: (event) => {
        if (event && event.event === "$pageview" && !landingPageviewSent) {
          landingPageviewSent = true;
          event.timestamp = new Date(performance.timeOrigin);
        }
        return event;
      },

      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.debug();
      },
    });

    window.addEventListener(CONSENT_EVENT, () => {
      posthog.set_config({ persistence: hasAdsConsent() ? "localStorage+cookie" : "memory" });
    });

    instance = posthog;
    for (const fn of pending.splice(0)) {
      try {
        fn(posthog);
      } catch {
        // One bad call must not drop the rest of the queue.
      }
    }
  });
  return loading;
}
