"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { OPEN_CONSENT_EVENT, consentRequired, getStoredConsent, setConsent } from "@/lib/consent";

/**
 * Opt-in banner for visitors from the EEA, UK and Switzerland. Until they
 * accept, Google tags run in Consent Mode "denied", PostHog keeps no cookies
 * and the ChatGPT Ads pixel is not loaded. Both buttons carry equal weight.
 */
export default function ConsentBanner() {
  const t = useTranslations("Consent");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(consentRequired() && getStoredConsent() === null);
    // Anyone can reopen it from the footer to change or withdraw consent.
    const open = () => setVisible(true);
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  if (!visible) return null;

  const choose = (state: "granted" | "denied") => {
    setConsent(state);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("privacy")}
      className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-dark/95 p-4 shadow-2xl backdrop-blur sm:flex sm:items-center sm:gap-6">
        <p className="text-sm text-white/80">
          {t("text")}{" "}
          <Link href="/privacy" className="underline hover:text-white">
            {t("privacy")}
          </Link>
        </p>
        <div className="mt-3 flex shrink-0 gap-3 sm:mt-0">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="flex-1 rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10 sm:flex-none"
          >
            {t("decline")}
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="flex-1 rounded-full bg-white px-5 py-2 text-sm font-semibold text-dark hover:bg-white/90 sm:flex-none"
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
