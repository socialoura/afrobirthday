"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { STICKY_CTA_VISIBILITY_EVENT, type StickyCtaVisibilityDetail } from "@/lib/events";

export default function StickyMobileCTA() {
  const t = useTranslations("Hero");
  const [pastHero, setPastHero] = useState(false);
  const [reachedOrder, setReachedOrder] = useState(false);

  useEffect(() => {
    const heroCta = document.getElementById("hero-cta");
    const orderSection = document.getElementById("order");
    if (!heroCta || !orderSection) return;

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        // Only "past" once it has scrolled above the viewport — not merely
        // because it starts below the fold (e.g. behind the mobile hero video).
        setPastHero(entry.isIntersecting ? false : entry.boundingClientRect.top < 0);
      },
      { rootMargin: "-64px 0px 0px 0px" }
    );
    const orderObserver = new IntersectionObserver(
      ([entry]) => setReachedOrder(entry.isIntersecting),
      { threshold: 0.15 }
    );

    heroObserver.observe(heroCta);
    orderObserver.observe(orderSection);
    return () => {
      heroObserver.disconnect();
      orderObserver.disconnect();
    };
  }, []);

  const visible = pastHero && !reachedOrder;

  // Let other fixed elements (e.g. the chat bubble) move out of the way.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<StickyCtaVisibilityDetail>(STICKY_CTA_VISIBILITY_EVENT, { detail: { visible } })
    );
  }, [visible]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 md:hidden transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-hidden={!visible}
    >
      <div className="mx-3 mb-3 rounded-2xl bg-dark/95 backdrop-blur-xl border border-white/10 shadow-2xl px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-white/80 text-xs font-medium truncate">{t("ordersThisYear")}</span>
        <a
          href="#order"
          tabIndex={visible ? 0 : -1}
          className="btn-primary text-sm py-2.5 px-5 flex items-center gap-1.5 flex-shrink-0"
        >
          <Sparkles size={14} aria-hidden="true" />
          {t("ctaOrder")}
        </a>
      </div>
    </div>
  );
}
