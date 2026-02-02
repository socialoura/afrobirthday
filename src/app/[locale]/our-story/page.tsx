import Image from "next/image";
import { Heart, Globe, Users, Sparkles, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "OurStoryPage.meta" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/our-story`,
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `/${locale}/our-story`,
      images: [{ url: "/logo.png" }],
    },
    twitter: {
      title: t("title"),
      description: t("description"),
      images: ["/logo.png"],
    },
  };
}
export default async function OurStoryPage() {
  const t = await getTranslations("OurStoryPage");
  const values = [
    {
      icon: Heart,
      title: t("values.authenticity.title"),
      description: t("values.authenticity.description"),
    },
    {
      icon: Sparkles,
      title: t("values.joy.title"),
      description: t("values.joy.description"),
    },
    {
      icon: Users,
      title: t("values.impact.title"),
      description: t("values.impact.description"),
    },
    {
      icon: Globe,
      title: t("values.quality.title"),
      description: t("values.quality.description"),
    },
  ];

  const metrics = [
    { number: "500+", label: t("metrics.customers") },
    { number: "100+", label: t("metrics.creators") },
    { number: "50+", label: t("metrics.countries") },
    { number: "4.9", label: t("metrics.rating") },
  ];

  return (
    <main className="pt-24 pb-20 bg-dark relative overflow-hidden">
      <div className="section-container relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none -z-10" />

        <div className="text-center mb-16 relative">
          <h1 className="heading-1 mb-4 text-white">{t("title")}</h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-20">
          <div className="glass-card p-8 md:p-12 rounded-3xl text-center">
            <h2 className="heading-2 mb-6 text-white">{t("mission.title")}</h2>
            <p className="text-lg text-white/70 leading-relaxed">
              {t("mission.body")}
            </p>
          </div>
        </div>

        <div className="mb-20">
          <h2 className="heading-2 text-center mb-10 text-white">{t("coreValuesTitle")}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div
                key={index}
                className="glass-card p-6 rounded-2xl hover:bg-white/10 transition-shadow text-center"
              >
                <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <value.icon size={28} className="text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2 text-white">{value.title}</h3>
                <p className="text-white/60 text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-20">
          <h2 className="heading-2 text-center mb-10 text-white">{t("creators.title")}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden group">
              <Image
                src="/showcase_1.jpg"
                alt={t("creators.images.0.alt")}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/70 to-transparent" />
              <p className="absolute bottom-4 left-4 text-white font-medium">{t("creators.images.0.caption")}</p>
            </div>
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden group">
              <Image
                src="/showcase_2.jpg"
                alt={t("creators.images.1.alt")}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/70 to-transparent" />
              <p className="absolute bottom-4 left-4 text-white font-medium">{t("creators.images.1.caption")}</p>
            </div>
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden group">
              <Image
                src="/showcase_3.jpg"
                alt={t("creators.images.2.alt")}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/70 to-transparent" />
              <p className="absolute bottom-4 left-4 text-white font-medium">{t("creators.images.2.caption")}</p>
            </div>
          </div>
          <div className="text-center mt-8">
            <p className="text-white/60 italic">
              {t("creators.quote")}
            </p>
            <p className="font-medium mt-2 text-white">— {t("creators.signature")}</p>
          </div>
        </div>

        <div className="bg-dark text-white p-8 md:p-12 rounded-3xl mb-16">
          <h2 className="heading-2 text-center mb-10">{t("impact.title")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {metrics.map((metric, index) => (
              <div key={index} className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-secondary mb-2">{metric.number}</p>
                <p className="text-white/70">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <h3 className="heading-3 mb-4 text-white">{t("cta.title")}</h3>
          <Link href="/#order" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2">
            {t("cta.button")}
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>
    </main>
  );
}
