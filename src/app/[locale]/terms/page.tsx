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
  const t = await getTranslations({ locale, namespace: "LegalMeta.terms" });
  const title = t("title");
  const description = t("description");

  return {
    title,
    description,
    alternates: buildAlternates(locale, "/terms"),
    openGraph: {
      title,
      description,
      url: `/${locale}/terms`,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Payment section rewritten 2026-09: prices are no longer euro-only, and PayPal is accepted.
  return <LegalPage locale={locale} page="terms" updated="2026-09-11" />;
}
