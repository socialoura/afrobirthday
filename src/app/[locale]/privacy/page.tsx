import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildAlternates } from "@/lib/seo";
import LegalPage from "@/components/LegalPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LegalMeta.privacy" });
  const title = t("title");
  const description = t("description");

  return {
    title,
    description,
    alternates: buildAlternates(locale, "/privacy"),
    openGraph: {
      title,
      description,
      url: `/${locale}/privacy`,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <LegalPage locale={locale} page="privacy" updated="2024-01-15" />;
}
