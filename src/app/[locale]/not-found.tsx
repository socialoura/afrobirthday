import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function LocaleNotFound() {
  const t = await getTranslations("NotFound");

  return (
    <section className="section-container py-32 text-center">
      <h1 className="font-display text-4xl font-bold text-white mb-4">{t("title")}</h1>
      <p className="text-white/70 mb-8">{t("description")}</p>
      <Link href="/" className="btn-primary inline-flex">
        {t("cta")}
      </Link>
    </section>
  );
}
