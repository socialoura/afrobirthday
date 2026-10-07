"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { CONSENT_EVENT, hasAdsConsent } from "@/lib/consent";
import { pixelMeasure } from "@/lib/adPixels";
import { useSiteSettled } from "@/lib/useSiteSettled";
import { isOperatorPage } from "@/lib/pageSettled";

const PIXEL_ID = process.env.NEXT_PUBLIC_OPENAI_PIXEL_ID;

/**
 * ChatGPT Ads measurement pixel (oaiq). Loaded only once the visitor may be
 * tracked (outside the EEA/UK/CH, or after accepting the cookie banner), and
 * only when NEXT_PUBLIC_OPENAI_PIXEL_ID is configured.
 */
export default function OpenAIPixel() {
  const [enabled, setEnabled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!PIXEL_ID) return;
    setEnabled(hasAdsConsent());
    const onConsent = () => {
      const allowed = hasAdsConsent();
      setEnabled(allowed);
      // Already loaded and consent withdrawn (or given again): the pixel's own
      // switch stops or resumes measurement without a reload.
      const oaiq = (window as unknown as { oaiq?: (...args: unknown[]) => void }).oaiq;
      oaiq?.("consent", allowed);
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  // The snippet records the first page view itself (the queue only exists
  // once it has run); client-side navigations after that are sent from here.
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (lastPath.current !== null && lastPath.current !== pathname) pixelMeasure("page_viewed");
    lastPath.current = pathname;
  }, [enabled, pathname]);

  // The queue, init and first page view are set up at once so no event is
  // dropped; the SDK itself (which replays the queue) waits until the page has
  // settled, like the other third-party scripts (see pageSettled.ts).
  const settled = useSiteSettled();

  if (!PIXEL_ID || !enabled || isOperatorPage(pathname ?? "")) return null;

  return (
    <>
      <Script id="openai-pixel" strategy="afterInteractive">
        {`(function (w) {
  if (w.oaiq) return;
  var q = function () { q.q.push(arguments); };
  q.q = [];
  w.oaiq = q;
  q("init", { pixelId: ${JSON.stringify(PIXEL_ID)} });
  q("measure", "page_viewed", { type: "contents", contents: [{ id: location.pathname, content_type: "page" }] });
})(window);`}
      </Script>
      {settled && <Script id="openai-pixel-sdk" src="https://bzrcdn.openai.com/sdk/oaiq.min.js" strategy="afterInteractive" />}
    </>
  );
}
