import HeroSection from "@/components/sections/HeroSection";
import ProductShowcaseSection from "@/components/sections/ProductShowcaseSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import LazyOrderFormSection from "@/components/sections/LazyOrderFormSection";
import FAQQuickSection from "@/components/sections/FAQQuickSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import StructuredData from "@/components/StructuredData";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import ScrollToOrderHint from "@/components/ScrollToOrderHint";

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HomeMeta" });
  const title = t("title");
  const description = t("description");

  return {
    // Absolute: the "%s | AfroBirthday" template lives in [locale]/layout and
    // only applies to child segments, so the home page (same segment) lost
    // the brand in its title when the root layout moved there.
    title: { absolute: `${title} | AfroBirthday` },
    description,
    alternates: buildAlternates(locale, ""),
    openGraph: {
      title,
      description,
      url: `/${locale}`,
      images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
    },
    twitter: {
      title,
      description,
      images: ["/og-image.jpg"],
    },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <StructuredData type="home" locale={locale} />
      <HeroSection />
      <ProductShowcaseSection />
      <LazyOrderFormSection />
      <HowItWorksSection />
      <FAQQuickSection />
      <TestimonialsSection />
      <StickyMobileCTA />
      <ScrollToOrderHint />
    </>
  );
}
