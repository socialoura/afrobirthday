import type { Metadata } from "next";

import FAQPageClient from "@/app/faq/FAQPageClient";
import StructuredData from "@/components/StructuredData";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: "FAQ",
    description:
      "Find answers about delivery times, pricing, photos, refunds, and how AfroBirthday personalized birthday videos work.",
    alternates: buildAlternates(locale, "/faq"),
    openGraph: {
      title: "FAQ",
      description:
        "Find answers about delivery times, pricing, photos, refunds, and how AfroBirthday personalized birthday videos work.",
      url: `/${locale}/faq`,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      title: "FAQ",
      description:
        "Find answers about delivery times, pricing, photos, refunds, and how AfroBirthday personalized birthday videos work.",
      images: ["/og-image.png"],
    },
  };
}

export default async function FAQPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <StructuredData type="faq" locale={locale} />
      <FAQPageClient />
    </>
  );
}
