import { getTranslations } from "next-intl/server";
import { PRICES } from "@/lib/utils";
import { SITE_URL } from "@/lib/siteUrl";

const SITE = SITE_URL;

type StructuredDataProps = {
  type: "home" | "faq" | "page";
  locale: string;
  /** Required for type "page" — the breadcrumb label, e.g. "About Us". */
  pageName?: string;
  /** Required for type "page" — the path segment, e.g. "/about". */
  path?: string;
};

function breadcrumbSchema(
  items: Array<{ name: string; url: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export default async function StructuredData({ type, locale, pageName, path }: StructuredDataProps) {
  const url = `${SITE}/${locale}`;

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AfroBirthday",
    url: SITE,
    logo: `${SITE}/logo.png`,
    sameAs: [
      "https://www.instagram.com/afrobirthday",
      "https://www.tiktok.com/@afrobirthday",
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
        // Google warns on an Offer with no priceValidUntil and can stop showing
        // the price. Rolls forward automatically so it never goes stale.
        priceValidUntil: `${new Date().getUTCFullYear() + 1}-12-31`,
        availability: "https://schema.org/InStock",
        deliveryLeadTime: {
          "@type": "QuantitativeValue",
          minValue: 12,
          maxValue: 48,
          unitCode: "HUR",
        },
        // Mirrors the visible /refund page: full refund within 7 days of
        // delivery, no cost to the customer. Structured data has to match the
        // text on the site, so these numbers must move together.
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          returnPolicyCategory:
            "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: 7,
          returnMethod: "https://schema.org/ReturnByMail",
          returnFees: "https://schema.org/FreeReturn",
        },
      },
      // Deliberately no shippingDetails: the product is a video delivered by
      // email, so a shipping block would describe something that doesn't exist.
      aggregateRating:
        reviewCount > 0
          ? {
              "@type": "AggregateRating",
              ratingValue,
              reviewCount,
              bestRating: 5,
              worstRating: 1,
            }
          : undefined,
    };

    const breadcrumb = breadcrumbSchema([{ name: "Home", url }]);

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
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
    const breadcrumb = breadcrumbSchema([
      { name: "Home", url },
      { name: "FAQ", url: `${url}/faq` },
    ]);
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
        />
      </>
    );
  }

  if (type === "page" && pageName && path) {
    const breadcrumb = breadcrumbSchema([
      { name: "Home", url },
      { name: pageName, url: `${url}${path}` },
    ]);
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
        />
      </>
    );
  }

  return null;
}
