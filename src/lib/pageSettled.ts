/**
 * When third-party code (analytics, ad tags, the chat) may start loading.
 *
 * On a slow phone those scripts were parsed and run in the seconds right after
 * the first paint, exactly when the visitor first taps or scrolls, and made
 * the page feel stuck. They now wait for the visitor's first interaction or a
 * few quiet seconds, whichever comes first. The tags' own queues (dataLayer,
 * oaiq, the PostHog queue in posthogClient.ts) are created immediately, so an
 * event fired before then is held, not lost.
 *
 * Payment-return pages load at once: the purchase must be recorded even if
 * the customer closes the tab right away.
 */

const FALLBACK_MS = 4_000;
const INTERACTION_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

let settled: Promise<void> | null = null;

function isUrgentPage(pathname: string) {
  return /\/success(\/|$)/.test(pathname) || pathname.startsWith("/paypal/");
}

function whenIdle(cb: () => void) {
  if ("requestIdleCallback" in window) window.requestIdleCallback(cb, { timeout: 1_500 });
  else setTimeout(cb, 200);
}

export function whenPageSettled(): Promise<void> {
  if (typeof window === "undefined") return new Promise(() => {});
  if (settled) return settled;

  settled = new Promise<void>((resolve) => {
    if (isUrgentPage(window.location.pathname)) {
      resolve();
      return;
    }
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      for (const e of INTERACTION_EVENTS) window.removeEventListener(e, go);
      // Not inside the tap or scroll itself: let it paint first.
      whenIdle(resolve);
    };
    for (const e of INTERACTION_EVENTS) window.addEventListener(e, go, { passive: true });
    timer = setTimeout(go, FALLBACK_MS);
  });
  return settled;
}
