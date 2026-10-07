"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useSiteSettled } from "@/lib/useSiteSettled";
import { isOperatorPage } from "@/lib/pageSettled";

/**
 * The gtag.js library (~150 KB), fetched once the page has settled. The
 * dataLayer, consent defaults and config are set inline in RootDocument right
 * away, so anything pushed before the library arrives is replayed by it.
 */
export default function DeferredGtag({ id }: { id: string }) {
  const settled = useSiteSettled();
  const pathname = usePathname();
  if (!settled || isOperatorPage(pathname ?? "")) return null;
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />;
}
