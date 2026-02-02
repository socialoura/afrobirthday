"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type FAQItemContent = { question: string; answer: string };

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left hover:text-primary transition-colors text-white"
      >
        <span className="font-medium pr-4">{question}</span>
        <ChevronDown
          size={20}
          className={cn(
            "flex-shrink-0 transition-transform duration-200 text-white/70",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-96 pb-5" : "max-h-0"
        )}
      >
        <p className="text-white/60">{answer}</p>
      </div>
    </div>
  );
}

export default function FAQPageClient() {
  const t = useTranslations("FAQPage");
  const faqs = t.raw("items") as FAQItemContent[];

  return (
    <main className="pt-24 pb-20 bg-dark relative overflow-hidden">
      <div className="section-container relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none -z-10" />
        <div className="text-center mb-12 relative">
          <h1 className="heading-1 mb-4 text-white">{t("title")}</h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            {t("intro")}{" "}
            <a href="mailto:support@afrobirthday.com" className="text-primary hover:underline">
              {t("contactLink")}
            </a>
          </p>
        </div>

        <div className="max-w-3xl mx-auto glass-card rounded-2xl p-6 md:p-8 mb-12 relative">
          {faqs.map((faq, index) => (
            <FAQItem key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>

        <div className="text-center relative">
          <div className="glass-card p-8 rounded-2xl max-w-xl mx-auto mb-8">
            <h3 className="heading-3 mb-3 text-white">{t("still.title")}</h3>
            <p className="text-white/60 mb-4">{t("still.subtitle")}</p>
            <a href="mailto:support@afrobirthday.com" className="btn-outline inline-block">
              {t("still.email")}
            </a>
          </div>

          <Link href="/#order" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2">
            {t("cta")}
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>
    </main>
  );
}
