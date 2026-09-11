import Image from "next/image";
import { Mail, Instagram } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { buildAlternates } from "@/lib/seo";
import StructuredData from "@/components/StructuredData";

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
    alternates: buildAlternates(locale, "/about"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `/${locale}/about`,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      title: t("title"),
      description: t("description"),
      images: ["/logo.png"],
    },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("AboutPage");
  const tMeta = await getTranslations({ locale, namespace: "AboutPage.meta" });

  return (
    <main className="pt-32 md:pt-40 pb-20">
      <StructuredData type="page" locale={locale} pageName={tMeta("title")} path="/about" />
      <div className="section-container max-w-4xl">
        <h1 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl tracking-tight text-center mb-12 md:mb-16">
          {t("title")}
        </h1>

        <div className="space-y-12 text-white/70 leading-relaxed">
          <section>
            <h2 className="heading-3 text-white mb-4">{t("who.title")}</h2>
            <p className="mb-4">{t("who.p1")}</p>
            <p>{t("who.p2")}</p>
          </section>

          <section>
            <h2 className="heading-3 text-white mb-4">{t("mission.title")}</h2>
            <p>{t("mission.p1")}</p>
          </section>

          <section>
            <h2 className="heading-3 text-white mb-4">{t("team.title")}</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <Image src="/showcase_1.jpg" alt={t("team.images.0")} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <Image src="/showcase_2.jpg" alt={t("team.images.1")} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <Image src="/showcase_3.jpg" alt={t("team.images.2")} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
            </div>
            <p>{t("team.p1")}</p>
          </section>

          <section>
            <h2 className="heading-3 text-white mb-4">{t("contact.title")}</h2>
            <div className="glass-card rounded-2xl p-6">
              <div className="space-y-3">
                <a
                  href="mailto:support@afrobirthday.com"
                  className="flex items-center gap-3 text-white/80 hover:text-primary transition-colors"
                >
                  <Mail size={20} />
                  support@afrobirthday.com
                </a>
                <a
                  href="https://www.instagram.com/afrobirthday"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-white/80 hover:text-primary transition-colors"
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
