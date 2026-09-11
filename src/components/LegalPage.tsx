import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import StructuredData from "@/components/StructuredData";

type LegalPageKey = "refund" | "privacy" | "terms";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
  steps?: string[];
  note?: string;
};

type LegalContent = {
  subtitle: string;
  highlight?: { title: string; body: string };
  sections: LegalSection[];
  cta?: string;
};

const SUPPORT_EMAIL = "support@afrobirthday.com";

// Tags available inside the Legal.* strings: <b>, <email></email>, <link>, <refund>.
const richTags = {
  b: (chunks: ReactNode) => <strong className="font-semibold text-white">{chunks}</strong>,
  email: () => (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
      {SUPPORT_EMAIL}
    </a>
  ),
  link: (chunks: ReactNode) => (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
      {chunks}
    </a>
  ),
  refund: (chunks: ReactNode) => (
    <Link href="/refund" className="text-primary hover:underline">
      {chunks}
    </Link>
  ),
};

export default async function LegalPage({
  locale,
  page,
  updated,
}: {
  locale: string;
  page: LegalPageKey;
  /** ISO date of the last change to this page's content. */
  updated: string;
}) {
  const tLegal = await getTranslations({ locale, namespace: "Legal" });
  const t = await getTranslations({ locale, namespace: `Legal.${page}` });
  const tMeta = await getTranslations({ locale, namespace: `LegalMeta.${page}` });
  const format = await getFormatter({ locale });

  const title = tMeta("title");
  const content = tLegal.raw(page) as LegalContent;
  const updatedDate = format.dateTime(new Date(updated), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="pt-32 md:pt-40 pb-20">
      <StructuredData type="page" locale={locale} pageName={title} path={`/${page}`} />
      <div className="section-container max-w-3xl">
        <header className="text-center mb-12 md:mb-16">
          {/* hyphens-auto + break-words: single German compounds such as
              "Rückerstattungsrichtlinie" are wider than a phone screen. */}
          <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight mb-4 hyphens-auto break-words">
            {title}
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto mb-6">{content.subtitle}</p>
          <p className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/50">
            {tLegal("updated", { date: updatedDate })}
          </p>
        </header>

        {content.highlight && (
          <div className="mb-12 rounded-2xl border border-success/30 bg-success/10 p-6 md:p-8">
            <h2 className="font-display text-xl md:text-2xl font-semibold text-success mb-2">
              {content.highlight.title}
            </h2>
            <p className="text-white/80 leading-relaxed">{t.rich("highlight.body", richTags)}</p>
          </div>
        )}

        <div className="divide-y divide-white/10">
          {content.sections.map((section, i) => (
            <section key={i} className="py-8 first:pt-0">
              <h2 className="heading-3 text-white mb-4">{section.title}</h2>
              <div className="space-y-4 text-white/70 leading-relaxed">
                {section.paragraphs?.map((_, j) => (
                  <p key={j}>{t.rich(`sections.${i}.paragraphs.${j}`, richTags)}</p>
                ))}
                {section.items && (
                  <ul className="space-y-2">
                    {section.items.map((_, j) => (
                      <li key={j} className="flex gap-3">
                        <span aria-hidden className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                        <span>{t.rich(`sections.${i}.items.${j}`, richTags)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.steps && (
                  <ol className="space-y-3">
                    {section.steps.map((_, j) => (
                      <li key={j} className="flex gap-3">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                          {j + 1}
                        </span>
                        <span className="pt-0.5">{t.rich(`sections.${i}.steps.${j}`, richTags)}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {section.note && <p>{t.rich(`sections.${i}.note`, richTags)}</p>}
              </div>
            </section>
          ))}
        </div>

        {content.cta && (
          <div className="text-center pt-8">
            <Link href="/#order" className="btn-primary inline-block">
              {content.cta}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
