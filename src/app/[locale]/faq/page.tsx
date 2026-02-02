import type { Metadata } from "next";

import FAQPageClient from "@/app/faq/FAQPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: "FAQ",
    description:
      "Find answers about delivery times, pricing, photos, refunds, and how AfroBirthday personalized birthday videos work.",
    alternates: {
      canonical: `/${locale}/faq`,
    },
    openGraph: {
      title: "FAQ",
      description:
        "Find answers about delivery times, pricing, photos, refunds, and how AfroBirthday personalized birthday videos work.",
      url: `/${locale}/faq`,
      images: [{ url: "/logo.png" }],
    },
    twitter: {
      title: "FAQ",
      description:
        "Find answers about delivery times, pricing, photos, refunds, and how AfroBirthday personalized birthday videos work.",
      images: ["/logo.png"],
    },
  };
}

export default function FAQPage() {
  return <FAQPageClient />;
}
