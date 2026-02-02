import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function FAQQuickSection() {
  const t = useTranslations("FAQQuick");
  const quickFaqs = [
    {
      question: t("items.delivery.q"),
      answer: t("items.delivery.a"),
    },
    {
      question: t("items.refund.q"),
      answer: t("items.refund.a"),
    },
    {
      question: t("items.customize.q"),
      answer: t("items.customize.a"),
    },
  ];

  return (
    <section className="py-24 bg-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="section-container">
        <div className="text-center mb-10">
          <h2 className="heading-2 mb-4 text-white">{t("title")}</h2>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {quickFaqs.map((faq, index) => (
            <div
              key={index}
              className="glass-card p-6 rounded-2xl"
            >
              <h3 className="font-semibold text-lg mb-2 text-white">{faq.question}</h3>
              <p className="text-white/60">{faq.answer}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/faq"
            className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
          >
            {t("seeAll")}
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
