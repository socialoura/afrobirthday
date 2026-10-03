"use client";

import { OPEN_CONSENT_EVENT } from "@/lib/consent";

/** Footer link that reopens the cookie banner so consent can be withdrawn. */
export default function CookieSettingsButton({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      {label}
    </button>
  );
}
