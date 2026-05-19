"use client";

import { useState } from "react";
import { MessageCircle, X, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export default function ChatWidget() {
  const t = useTranslations("Chat");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-4 end-4 md:bottom-5 md:end-5 z-50 w-14 h-14 bg-primary rounded-full shadow-lg",
          "flex items-center justify-center text-white",
          "hover:bg-primary-600 transition-all duration-300",
          "touch-manipulation",
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
          "fixed bottom-4 end-4 md:bottom-5 md:end-5 z-50",
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

          <a
            href="https://wa.me/0?text=Hi%20AfroBirthday!"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full border border-slate-200 text-slate-900 font-semibold hover:bg-slate-50 transition-colors"
          >
            {t("whatsappCta")}
          </a>

          <p className="text-xs text-slate-500 text-center pt-2">{t("hours")}</p>
        </div>
      </div>
    </>
  );
}
