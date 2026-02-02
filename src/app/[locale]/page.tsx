import HeroSection from "@/components/sections/HeroSection";
import ProductShowcaseSection from "@/components/sections/ProductShowcaseSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import OrderFormSection from "@/components/sections/OrderFormSection";
import FAQQuickSection from "@/components/sections/FAQQuickSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";

import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: "Personalized Birthday Videos",
    description:
      "Make their birthday unforgettable with a personalized video from real African dancers. Upload a photo, add your message, choose delivery (12–48h), and receive it by email.",
    alternates: {
      canonical: `/${locale}`,
    },
    openGraph: {
      title: "Personalized Birthday Videos",
      description:
        "Make their birthday unforgettable with a personalized video from real African dancers. Upload a photo, add your message, choose delivery (12–48h), and receive it by email.",
      url: `/${locale}`,
      images: [{ url: "/logo.png" }],
    },
    twitter: {
      title: "Personalized Birthday Videos",
      description:
        "Make their birthday unforgettable with a personalized video from real African dancers. Upload a photo, add your message, choose delivery (12–48h), and receive it by email.",
      images: ["/logo.png"],
    },
  };
}

export default function Home() {
  return (
    <>
      <HeroSection />
      <ProductShowcaseSection />
      <OrderFormSection />
      <HowItWorksSection />
      <FAQQuickSection />
      <TestimonialsSection />
    </>
  );
}
