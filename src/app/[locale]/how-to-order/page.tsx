import { Upload, CreditCard, Gift, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HowToOrderPage.meta" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/how-to-order`,
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `/${locale}/how-to-order`,
      images: [{ url: "/logo.png" }],
    },
    twitter: {
      title: t("title"),
      description: t("description"),
      images: ["/logo.png"],
    },
  };
}

export default async function HowToOrderPage() {
  const t = await getTranslations("HowToOrderPage");
  const steps = [
    {
      icon: Upload,
      number: "01",
      title: t("steps.0.title"),
      description: t("steps.0.description"),
      tips: [t("steps.0.tips.0"), t("steps.0.tips.1"), t("steps.0.tips.2")],
    },
    {
      icon: CreditCard,
      number: "02",
      title: t("steps.1.title"),
      description: t("steps.1.description"),
      tips: [t("steps.1.tips.0"), t("steps.1.tips.1"), t("steps.1.tips.2")],
    },
    {
      icon: Gift,
      number: "03",
      title: t("steps.2.title"),
      description: t("steps.2.description"),
      tips: [t("steps.2.tips.0"), t("steps.2.tips.1"), t("steps.2.tips.2")],
    },
  ];

  return (
    <main className="pt-24 pb-20 bg-dark relative overflow-hidden">
      <div className="section-container relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none -z-10" />
        <div className="text-center mb-16 relative">
          <h1 className="heading-1 mb-4">{t("title")}</h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-12 mb-16">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center relative">
                  <step.icon size={36} className="text-primary" />
                  <span className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {step.number}
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <h2 className="heading-3 mb-3 text-white">{step.title}</h2>
                <p className="text-white/60 mb-4">{step.description}</p>
                <div className="glass-card p-4 rounded-xl">
                  <p className="font-medium text-sm text-white/80 mb-2">{t("tipsLabel")}</p>
                  <ul className="space-y-1">
                    {step.tips.map((tip, tipIndex) => (
                      <li key={tipIndex} className="text-sm text-white/60 flex items-start gap-2">
                        <span className="text-primary mt-1">✓</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto mb-16">
          <div className="bg-dark text-white p-8 rounded-2xl text-center">
            <h3 className="heading-3 mb-4">{t("timeline.title")}</h3>
            <div className="flex justify-center items-center gap-4 flex-wrap">
              <div className="bg-white/10 px-6 py-4 rounded-xl">
                <p className="text-secondary font-bold text-2xl">24-48h</p>
                <p className="text-white/70 text-sm">{t("timeline.standard")}</p>
              </div>
              <span className="text-white/50">{t("timeline.or")}</span>
              <div className="bg-primary px-6 py-4 rounded-xl">
                <p className="text-white font-bold text-2xl">12-24h</p>
                <p className="text-white/80 text-sm">{t("timeline.express")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mb-16">
          <h3 className="font-semibold mb-4 text-white">{t("secure.title")}</h3>
          <div className="flex justify-center items-center gap-8 flex-wrap">
            <div className="flex items-center gap-2 text-white/60">
              <span className="text-2xl">🔒</span>
              <span className="text-sm">{t("secure.ssl")}</span>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <span className="text-2xl">💳</span>
              <span className="text-sm">{t("secure.cards")}</span>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <span className="text-2xl">💯</span>
              <span className="text-sm">{t("secure.guarantee")}</span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link href="/#order" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2">
            {t("cta")}
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>
    </main>
  );
}
