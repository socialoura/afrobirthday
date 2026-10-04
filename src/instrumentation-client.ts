import { trackAttributedWebVitals } from "@/lib/webVitalsAttribution";
import { captureFirstTouch } from "@/lib/attribution";
import { installTranslatorGuard } from "@/lib/translatorGuard";
import { loadPostHog } from "@/lib/posthogClient";
import { whenPageSettled } from "@/lib/pageSettled";

// First, before React hydrates: browser translation must not crash the page.
installTranslatorGuard();

// PostHog itself waits for the first interaction or a few idle seconds
// (pageSettled.ts); events captured before then are queued in posthogClient.
whenPageSettled().then(loadPostHog);

// Registered now: the observers read buffered entries, and the attributed
// events wait in the PostHog queue.
trackAttributedWebVitals();

// Outside PostHog on purpose: the order's own attribution must not depend on
// an analytics token being present.
captureFirstTouch();
