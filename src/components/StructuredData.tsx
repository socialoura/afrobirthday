import { getTranslations } from "next-intl/server";
import { PRICES } from "@/lib/utils";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://afrobirthday.com";

type StructuredDataProps = {
  type: "home" | "faq";
  locale: string;
};

export default async function StructuredData({ type, locale }: StructuredDataProps) {
  const url = `${SITE}/${locale}`;

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AfroBirthday",
    url: SITE,
    logo: `${SITE}/logo.png`,
    sameAs: [
      "https://instagram.com/afrobirthday",
      "https://tiktok.com/@afrobirthday",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "support@afrobirthday.com",
      contactType: "customer support",
      availableLanguage: [
        "English",
        "French",
        "Spanish",
        "German",
        "Italian",
        "Portuguese",
        "Dutch",
        "Arabic",
        "Hindi",
        "Chinese",
      ],
    },
  };

  if (type === "home") {
    const tTest = await getTranslations({ locale, namespace: "Testimonials" });
    const items = tTest.raw("items") as Array<{ rating: number }>;
    const reviewCount = items?.length ?? 0;
    const ratingValue =
      reviewCount > 0
        ? (items.reduce((s, i) => s + (i.rating ?? 5), 0) / reviewCount).toFixed(1)
        : "4.9";

    const product = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "AfroBirthday personalized birthday video",
      description:
        "Personalized birthday video filmed by real African dancers, delivered by email within 24-48h.",
      image: [`${SITE}/og-image.png`, `${SITE}/showcase_1.jpg`],
      brand: { "@type": "Brand", name: "AfroBirthday" },
      offers: {
        "@type": "Offer",
        url: `${url}#order`,
        priceCurrency: "USD",
        price: PRICES.base.toFixed(2),
        availability: "https://schema.org/InStock",
        deliveryLeadTime: {
          "@type": "QuantitativeValue",
          minValue: 12,
          maxValue: 48,
          unitCode: "HUR",
        },
      },
      aggregateRating:
        reviewCount > 0
          ? {
              "@type": "AggregateRating",
              ratingValue,
              reviewCount: 500,
              bestRating: 5,
              worstRating: 1,
            }
          : undefined,
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }}
        />
      </>
    );
  }

  if (type === "faq") {
    const t = await getTranslations({ locale, namespace: "FAQPage" });
    const items = (t.raw("items") as Array<{ question: string; answer: string }>) ?? [];
    const faq = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((it) => ({
        "@type": "Question",
        name: it.question,
        acceptedAnswer: { "@type": "Answer", text: it.answer },
      })),
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
        />
      </>
    );
  }

  return null;
}
