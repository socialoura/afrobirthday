import posthog from "posthog-js";
import { trackAttributedWebVitals } from "@/lib/webVitalsAttribution";
import { captureFirstTouch } from "@/lib/attribution";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

// api_host must stay in sync with the /ingest rewrite in next.config.mjs.
if (token) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: "history_change",
    autocapture: false,
    disable_session_recording: true,
    person_profiles: "identified_only",
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });

  trackAttributedWebVitals();
}

// Outside the PostHog guard on purpose: the order's own attribution must not
// depend on an analytics token being present.
captureFirstTouch();
