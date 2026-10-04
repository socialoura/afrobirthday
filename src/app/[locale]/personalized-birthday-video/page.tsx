import { Camera, Clock, Gift, Heart, Megaphone, Music, ShieldCheck, Sparkles, Users, Video } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { buildAlternates } from "@/lib/seo";
import { SITE_URL } from "@/lib/siteUrl";
import { getCachedPricingSettings } from "@/lib/cachedContent";
import { PRICES } from "@/lib/utils";
import StructuredData from "@/components/StructuredData";
import OrderCtaLink from "@/components/OrderCtaLink";
import ProductShowcaseSection from "@/components/sections/ProductShowcaseSection";
import HeroPrice from "@/components/sections/hero/HeroPrice";

const PATH = "/personalized-birthday-video";

/**
 * Non-brand landing page. Search Console (Oct 2026) showed almost only brand
 * queries ("afro birthday"); this page targets what people search before
 * they know the brand: a personalized birthday video, African dancers, an
 * original birthday gift. Same slug in every locale, content translated.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ProductPage.meta" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates(locale, PATH),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `/${locale}${PATH}`,
      images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
    },
    twitter: {
      title: t("title"),
      description: t("description"),
      images: ["/og-image.jpg"],
    },
  };
}

const INCLUDE_ICONS = [Camera, Megaphone, Users, Music];
const OCCASION_ICONS = [Gift, Heart, Users, Sparkles];
const COUNT = { includes: 4, steps: 3, occasions: 4, faq: 5 } as const;

export default async function PersonalizedBirthdayVideoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ProductPage");
  const pricing = (await getCachedPricingSettings()) ?? PRICES;

  const range = (n: number) => Array.from({ length: n }, (_, i) => i);
  const faq = range(COUNT.faq).map((i) => ({ q: t(`faq.items.${i}.q` as never), a: t(`faq.items.${i}.a` as never) }));

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: t("h1"),
    description: t("meta.description"),
    image: [`${SITE_URL}/og-image.jpg`, `${SITE_URL}/showcase_1.jpg`],
    brand: { "@type": "Brand", name: "AfroBirthday" },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/${locale}${PATH}`,
      priceCurrency: "USD",
      price: pricing.base.toFixed(2),
      availability: "https://schema.org/InStock",
    },
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <StructuredData type="page" locale={locale} pageName={t("breadcrumb")} path={PATH} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Intro */}
      <section className="relative pt-28 sm:pt-32 pb-16 bg-dark overflow-hidden">
        <div className="absolute inset-0 hero-glow" aria-hidden="true" />
        <div className="section-container relative max-w-3xl text-center">
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-5">
            {t("badge")}
          </span>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-white leading-tight mb-5">{t("h1")}</h1>
          <p className="text-base sm:text-lg text-white/80 leading-relaxed mb-8">{t("intro")}</p>
          <div className="flex flex-col items-center gap-2 mb-8">
            <span className="text-white/60 text-sm">{t("priceFrom")}</span>
            <HeroPrice />
          </div>
          <OrderCtaLink location="product_page" className="btn-primary inline-flex items-center gap-2 min-h-[52px]">
            <Video size={18} aria-hidden="true" />
            {t("cta")}
          </OrderCtaLink>
        </div>
      </section>

      {/* What's in the video */}
      <section className="py-16 bg-dark">
        <div className="section-container">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-10">{t("includes.title")}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {range(COUNT.includes).map((i) => {
              const Icon = INCLUDE_ICONS[i];
              return (
                <div key={i} className="glass-card p-6">
                  <Icon size={26} className="text-primary mb-3" aria-hidden="true" />
                  <h3 className="font-semibold text-white mb-2">{t(`includes.items.${i}.title` as never)}</h3>
                  <p className="text-white/70 text-sm leading-relaxed">{t(`includes.items.${i}.text` as never)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Real examples */}
      <ProductShowcaseSection />

      {/* How it works */}
      <section className="py-16 bg-dark">
        <div className="section-container max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-10">{t("steps.title")}</h2>
          <ol className="grid md:grid-cols-3 gap-5">
            {range(COUNT.steps).map((i) => (
              <li key={i} className="glass-card p-6">
                <span className="text-primary font-display font-bold text-3xl">0{i + 1}</span>
                <h3 className="font-semibold text-white mt-2 mb-2">{t(`steps.items.${i}.title` as never)}</h3>
                <p className="text-white/70 text-sm leading-relaxed">{t(`steps.items.${i}.text` as never)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Occasions */}
      <section className="py-16 bg-dark">
        <div className="section-container">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-3">{t("occasions.title")}</h2>
          <p className="text-white/70 text-center max-w-2xl mx-auto mb-10">{t("occasions.subtitle")}</p>
          <div className="grid sm:grid-cols-2 gap-5">
            {range(COUNT.occasions).map((i) => {
              const Icon = OCCASION_ICONS[i];
              return (
                <div key={i} className="glass-card p-6 flex gap-4">
                  <Icon size={24} className="text-secondary flex-shrink-0 mt-1" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-white mb-2">{t(`occasions.items.${i}.title` as never)}</h3>
                    <p className="text-white/70 text-sm leading-relaxed">{t(`occasions.items.${i}.text` as never)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Delivery & guarantee */}
      <section className="py-16 bg-dark">
        <div className="section-container grid md:grid-cols-2 gap-5 max-w-4xl">
          <div className="glass-card p-6">
            <Clock size={24} className="text-accent mb-3" aria-hidden="true" />
            <h2 className="text-xl font-bold text-white mb-2">{t("delivery.title")}</h2>
            <p className="text-white/70 text-sm leading-relaxed">{t("delivery.text")}</p>
          </div>
          <div className="glass-card p-6">
            <ShieldCheck size={24} className="text-accent mb-3" aria-hidden="true" />
            <h2 className="text-xl font-bold text-white mb-2">{t("guarantee.title")}</h2>
            <p className="text-white/70 text-sm leading-relaxed">{t("guarantee.text")}</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-dark">
        <div className="section-container max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-8">{t("faq.title")}</h2>
          <div className="space-y-4">
            {faq.map((f, i) => (
              <details key={i} className="glass-card p-5 group">
                <summary className="font-semibold text-white cursor-pointer list-none flex justify-between gap-4">
                  {f.q}
                  <span className="text-primary group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
                </summary>
                <p className="text-white/70 text-sm leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-dark">
        <div className="section-container max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white mb-4">{t("final.title")}</h2>
          <p className="text-white/70 mb-8">{t("final.text")}</p>
          <OrderCtaLink location="product_page_bottom" className="btn-primary inline-flex items-center gap-2 min-h-[52px]">
            <Sparkles size={18} aria-hidden="true" />
            {t("cta")}
          </OrderCtaLink>
        </div>
      </section>
    </>
  );
}
