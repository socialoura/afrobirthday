"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { STICKY_CTA_VISIBILITY_EVENT, type StickyCtaVisibilityDetail } from "@/lib/events";

/** Persistent floating arrow pointing to the order form — visible from page
 * load on every section, until the order form itself scrolls into view. */
export default function ScrollToOrderHint() {
  const t = useTranslations("Hero");
  const [visible, setVisible] = useState(true);
  const [stickyCtaVisible, setStickyCtaVisible] = useState(false);

  useEffect(() => {
    const orderSection = document.getElementById("order");
    if (!orderSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Hide once the order form is in view, and keep it hidden once the
        // user has scrolled past it — the arrow points down, so it stops
        // making sense once the order form is behind them.
        setVisible(entry.isIntersecting ? false : entry.boundingClientRect.top > 0);
      },
      { threshold: 0.15 }
    );
    observer.observe(orderSection);
    return () => observer.disconnect();
  }, []);

  // Move above the mobile sticky order CTA bar when it's showing, so the two
  // fixed elements never overlap (same pattern as the chat bubble).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<StickyCtaVisibilityDetail>).detail;
      setStickyCtaVisible(detail?.visible ?? false);
    };
    window.addEventListener(STICKY_CTA_VISIBILITY_EVENT, handler);
    return () => window.removeEventListener(STICKY_CTA_VISIBILITY_EVENT, handler);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 z-30 flex justify-center pointer-events-none transition-opacity duration-300 ${
        stickyCtaVisible ? "bottom-24" : "bottom-4"
      } lg:bottom-6 ${visible ? "opacity-100" : "opacity-0"}`}
      aria-hidden={!visible}
    >
      <a
        href="#order"
        tabIndex={visible ? 0 : -1}
        className="pointer-events-auto flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors group bg-dark/50 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-lg"
      >
        <span className="text-[11px] font-medium tracking-wide uppercase">
          {t("scrollHint")}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="animate-bounce group-hover:translate-y-0.5 transition-transform"
        />
      </a>
    </div>
  );
}
