"use client";

import Script from "next/script";
import { useSiteSettled } from "@/lib/useSiteSettled";

/**
 * The gtag.js library (~150 KB), fetched once the page has settled. The
 * dataLayer, consent defaults and config are set inline in RootDocument right
 * away, so anything pushed before the library arrives is replayed by it.
 */
export default function DeferredGtag({ id }: { id: string }) {
  const settled = useSiteSettled();
  if (!settled) return null;
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />;
}
