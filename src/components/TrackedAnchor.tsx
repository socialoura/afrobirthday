"use client";

import type { ReactNode } from "react";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analyticsEvents";

/**
 * An in-page "Order" anchor that records order_cta_clicked. Lets server
 * components keep a CTA without becoming client components themselves.
 */
export default function TrackedAnchor({
  href,
  location,
  className,
  id,
  children,
}: {
  href: string;
  location: string;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <a
      id={id}
      href={href}
      className={className}
      onClick={() => captureEvent(ANALYTICS_EVENTS.ORDER_CTA_CLICKED, { location })}
    >
      {children}
    </a>
  );
}
