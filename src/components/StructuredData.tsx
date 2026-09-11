import { getTranslations } from "next-intl/server";
import { PRICES } from "@/lib/utils";
import { getPricingSettings } from "@/lib/db";
import { getPriceTestDefinition } from "@/lib/priceTest";

// Google caps applicableCountry at 50 codes. Every country with a paid order
// (44 as of Sept 2026), then the nearest markets without one yet.
const RETURN_POLICY_COUNTRIES = [
  "US", "DE", "ES", "CA", "HU", "FR", "IT", "AU", "CH", "SK", "GB", "BR", "NO",
  "HR", "BE", "CZ", "TH", "SG", "LT", "MX", "AT", "AE", "TR", "SE", "LU", "PE",
  "SI", "KR", "JP", "KZ", "LV", "HN", "NL", "EE", "AR", "IE", "LB", "PL", "UA",
  "MY", "BA", "IL", "AL", "EG", "PT", "NZ", "DK", "FI", "GR", "RO",
];

// The base price was unchanged from launch until the first price test.
const PRICE_UNCHANGED_SINCE = "2026-02-01";
import { SITE_URL } from "@/lib/siteUrl";
import { getPublishedFaq, mergeFaq } from "@/lib/faqContent";

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

    // The advertised price has to match the charged one, or Google flags the
    // offer. It reads the settings the checkout charges from, so a price
    // change cannot leave the structured data behind.
    const [livePricing, priceTest] = await Promise.all([
      getPricingSettings().catch(() => null),
      getPriceTestDefinition(),
    ]);
    const advertisedBase = livePricing?.base ?? PRICES.base;
    // validFrom is the day the advertised price took effect: the test's start
    // while it runs, its end once the price has gone back.
    const priceSince = (priceTest?.endedAt ?? priceTest?.startedAt)?.slice(0, 10) ?? PRICE_UNCHANGED_SINCE;

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
        price: advertisedBase.toFixed(2),
        validFrom: priceSince,
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
          applicableCountry: RETURN_POLICY_COUNTRIES,
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
    // Published entries first, template questions after. The read never
    // throws, so a database problem degrades to the template rather than
    // stripping the schema off the page.
    const templateItems = (t.raw("items") as Array<{ question: string; answer: string }>) ?? [];
    const items = mergeFaq(templateItems, await getPublishedFaq(locale));
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
