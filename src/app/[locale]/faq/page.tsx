import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import FAQPageClient from "@/app/faq/FAQPageClient";
import StructuredData from "@/components/StructuredData";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "FAQPage" });
  const title = t("title");
  const description = t("intro");

  return {
    title,
    description,
    alternates: buildAlternates(locale, "/faq"),
    openGraph: {
      title,
      description,
      url: `/${locale}/faq`,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      title,
      description,
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
