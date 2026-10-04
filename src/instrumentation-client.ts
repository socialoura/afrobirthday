import posthog from "posthog-js";
import { trackAttributedWebVitals } from "@/lib/webVitalsAttribution";
import { captureFirstTouch } from "@/lib/attribution";
import { redactUrlProperties } from "@/lib/redactUrl";
import { CONSENT_EVENT, hasAdsConsent } from "@/lib/consent";
import { installTranslatorGuard } from "@/lib/translatorGuard";

// First, before React hydrates: browser translation must not crash the page.
installTranslatorGuard();

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

// api_host must stay in sync with the /ingest rewrite in next.config.mjs.
if (token) {
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

    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });

  trackAttributedWebVitals();

  window.addEventListener(CONSENT_EVENT, () => {
    posthog.set_config({ persistence: hasAdsConsent() ? "localStorage+cookie" : "memory" });
  });
}

// Outside the PostHog guard on purpose: the order's own attribution must not
// depend on an analytics token being present.
captureFirstTouch();
