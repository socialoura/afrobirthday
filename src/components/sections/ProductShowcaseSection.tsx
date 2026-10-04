import { getTranslations } from "next-intl/server";
import ShowcasePlayer from "@/components/sections/showcase/ShowcasePlayer";

/** Server shell; only the player/thumbnails (shared "active video" state) hydrate. */
export default async function ProductShowcaseSection() {
  const t = await getTranslations("ProductShowcase");

  return (
    <section id="showcase" className="py-16 md:py-24 bg-dark relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 showcase-glow" />
      </div>

      <div className="section-container relative">
        <div className="text-center mb-10 md:mb-16 px-4">
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {t("badge")}
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">{t("title")}</h2>
          <p className="text-white/80 max-w-2xl mx-auto text-sm md:text-base">
            {t("subtitle")}
          </p>
        </div>

        <ShowcasePlayer />
      </div>
    </section>
  );
}
