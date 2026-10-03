"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { CONSENT_EVENT, hasAdsConsent } from "@/lib/consent";
import { pixelMeasure } from "@/lib/adPixels";

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
    const onConsent = () => setEnabled(hasAdsConsent());
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

  if (!PIXEL_ID || !enabled) return null;

  return (
    <Script id="openai-pixel" strategy="afterInteractive">
      {`(function (w, d, s, u) {
  if (w.oaiq) return;
  var q = function () { q.q.push(arguments); };
  q.q = [];
  w.oaiq = q;
  var js = d.createElement(s);
  js.async = true;
  js.src = u;
  var f = d.getElementsByTagName(s)[0];
  f.parentNode.insertBefore(js, f);
})(window, document, "script", "https://bzrcdn.openai.com/sdk/oaiq.min.js");
oaiq("init", { pixelId: ${JSON.stringify(PIXEL_ID)} });
oaiq("measure", "page_viewed", { type: "contents", contents: [{ id: location.pathname, content_type: "page" }] });`}
    </Script>
  );
}
