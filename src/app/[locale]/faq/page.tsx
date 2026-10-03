import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import FAQPageClient from "@/app/faq/FAQPageClient";
import StructuredData from "@/components/StructuredData";
import { buildAlternates } from "@/lib/seo";
import { getCachedPublishedFaq } from "@/lib/cachedContent";

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
      images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
    },
    twitter: {
      title,
      description,
      images: ["/og-image.jpg"],
    },
  };
}

export default async function FAQPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Read at request time so publishing a question needs no deployment.
  const published = await getCachedPublishedFaq(locale);
  return (
    <>
      <StructuredData type="faq" locale={locale} />
      <FAQPageClient extraItems={published} />
    </>
  );
}
