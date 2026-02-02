import Image from "next/image";
import { Mail, Instagram } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AboutPage.meta" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/about`,
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `/${locale}/about`,
      images: [{ url: "/logo.png" }],
    },
    twitter: {
      title: t("title"),
      description: t("description"),
      images: ["/logo.png"],
    },
  };
}

export default async function AboutPage() {
  const t = await getTranslations("AboutPage");

  return (
    <main className="pt-24 pb-20">
      <div className="section-container max-w-4xl">
        <h1 className="heading-1 text-center mb-8">{t("title")}</h1>

        <div className="prose prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="heading-2 mb-4">{t("who.title")}</h2>
            <p className="text-dark/80 mb-4">{t("who.p1")}</p>
            <p className="text-dark/80">{t("who.p2")}</p>
          </section>

          <section className="mb-12">
            <h2 className="heading-2 mb-4">{t("mission.title")}</h2>
            <p className="text-dark/80">{t("mission.p1")}</p>
          </section>

          <section className="mb-12">
            <h2 className="heading-2 mb-4">{t("team.title")}</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <Image src="/showcase_1.jpg" alt={t("team.images.0")} fill className="object-cover" />
              </div>
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <Image src="/showcase_2.jpg" alt={t("team.images.1")} fill className="object-cover" />
              </div>
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <Image src="/showcase_3.jpg" alt={t("team.images.2")} fill className="object-cover" />
              </div>
            </div>
            <p className="text-dark/80">{t("team.p1")}</p>
          </section>

          <section className="mb-12">
            <h2 className="heading-2 mb-4">{t("contact.title")}</h2>
            <div className="bg-light p-6 rounded-xl">
              <div className="space-y-3">
                <a
                  href="mailto:support@afrobirthday.com"
                  className="flex items-center gap-3 text-dark/80 hover:text-primary transition-colors"
                >
                  <Mail size={20} />
                  support@afrobirthday.com
                </a>
                <a
                  href="https://instagram.com/afrobirthday"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-dark/80 hover:text-primary transition-colors"
                >
                  <Instagram size={20} />
                  @afrobirthday
                </a>
              </div>
            </div>
          </section>

          <div className="text-center">
            <Link href="/#order" className="btn-primary inline-block">
              {t("cta")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
