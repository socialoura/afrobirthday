import HeroSection from "@/components/sections/HeroSection";
import ProductShowcaseSection from "@/components/sections/ProductShowcaseSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import OrderFormSection from "@/components/sections/OrderFormSection";
import FAQQuickSection from "@/components/sections/FAQQuickSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import StructuredData from "@/components/StructuredData";

import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = "Personalized Birthday Videos";
  const description =
    "Make their birthday unforgettable with a personalized video from real African dancers. Upload a photo, add your message, choose delivery (12-48h), and receive it by email.";

  return {
    title,
    description,
    alternates: buildAlternates(locale, ""),
    openGraph: {
      title,
      description,
      url: `/${locale}`,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <StructuredData type="home" locale={locale} />
      <HeroSection />
      <ProductShowcaseSection />
      <OrderFormSection />
      <HowItWorksSection />
      <FAQQuickSection />
      <TestimonialsSection />
    </>
  );
}
