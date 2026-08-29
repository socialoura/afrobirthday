"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { STICKY_CTA_VISIBILITY_EVENT, type StickyCtaVisibilityDetail } from "@/lib/events";

export default function ChatWidget() {
  const t = useTranslations("Chat");
  const [isOpen, setIsOpen] = useState(false);
  const [stickyCtaVisible, setStickyCtaVisible] = useState(false);
  const [overlapsCta, setOverlapsCta] = useState(false);
  const lifted = stickyCtaVisible || overlapsCta;
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Move above the mobile sticky order CTA bar when it's showing, so the two
  // fixed elements never overlap.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<StickyCtaVisibilityDetail>).detail;
      setStickyCtaVisible(detail?.visible ?? false);
    };
    window.addEventListener(STICKY_CTA_VISIBILITY_EVENT, handler);
    return () => window.removeEventListener(STICKY_CTA_VISIBILITY_EVENT, handler);
  }, []);

  // The sticky bar isn't the only thing the bubble can land on. Anything marked
  // data-cta-avoid — the order form's own action row, for one — must stay
  // tappable: on a 390px viewport the bubble covered the right 56px of
  // "Continue", and being on top it won the tap.
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-cta-avoid]");
    if (targets.length === 0) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const bubbleSize = 56;
      const margin = 16;
      // The zone the bubble occupies in its resting position.
      const zone = {
        top: window.innerHeight - margin - bubbleSize,
        bottom: window.innerHeight - margin,
        left: window.innerWidth - margin - bubbleSize,
        right: window.innerWidth - margin,
      };
      let hit = false;
      for (const el of targets) {
        const r = el.getBoundingClientRect();
        if (r.height === 0) continue;
        if (r.bottom > zone.top && r.top < zone.bottom && r.right > zone.left && r.left < zone.right) {
          hit = true;
          break;
        }
      }
      setOverlapsCta(hit);
    };

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed end-4 md:bottom-5 md:end-5 z-50 w-14 h-14 bg-primary rounded-full shadow-lg",
          "flex items-center justify-center text-white",
          "hover:bg-primary-600 transition-all duration-300",
          "touch-manipulation",
          lifted ? "bottom-24" : "bottom-4",
          isOpen && "hidden"
        )}
        aria-label={t("open")}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <MessageCircle size={28} aria-hidden="true" />
      </button>

      <div
        role="dialog"
        aria-modal="false"
        aria-label={t("title")}
        className={cn(
          "fixed end-4 md:bottom-5 md:end-5 z-50",
          lifted ? "bottom-24" : "bottom-4",
          "w-[calc(100vw-32px)] md:w-[360px] max-w-[360px]",
          "bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden",
          "transition-all duration-300 transform",
          isOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <div className="bg-primary text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold">{t("title")}</h3>
            <p className="text-sm text-white/90">{t("subtitle")}</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={t("close")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-700">{t("body")}</p>

          <a
            href="mailto:support@afrobirthday.com"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-primary text-white font-semibold hover:bg-primary-600 transition-colors"
          >
            <Mail size={18} aria-hidden="true" />
            {t("emailCta")}
          </a>

          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}?text=Hi%20AfroBirthday!`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full border border-slate-200 text-slate-900 font-semibold hover:bg-slate-50 transition-colors"
            >
              {t("whatsappCta")}
            </a>
          )}

          <p className="text-xs text-slate-500 text-center pt-2">{t("hours")}</p>
        </div>
      </div>
    </>
  );
}
