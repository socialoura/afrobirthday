"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * "Order my video" call to action, used from the header, the footer and the
 * home page sections.
 *
 * These all used next-intl's Link with `/#order`, which renders
 * `/<locale>/#order`. On the home page that is a different pathname than the
 * current `/<locale>`, so the click was handled as a route change and the
 * fragment was dropped — the button did nothing at all. A plain anchor is
 * what every working CTA on the page already used, so use one whenever the
 * target section is on the current page, and fall back to a real navigation
 * everywhere else.
 */
export default function OrderCtaLink({
  className,
  children,
  onNavigate,
}: {
  className: string;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  if (pathname === "/") {
    return (
      <a href="#order" className={className} onClick={onNavigate}>
        {children}
      </a>
    );
  }

  return (
    <Link href="/#order" className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}
