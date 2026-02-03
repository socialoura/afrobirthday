import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getLocale } from "next-intl/server";
import Script from "next/script";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://afrobirthday.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AfroBirthday - Personalized Birthday Videos from African Dancers",
    template: "%s | AfroBirthday",
  },
  description:
    "Order a personalized birthday video from real African dancers. Upload a photo, add your message, choose delivery (12–48h), and receive it by email.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  keywords: [
    "birthday video",
    "personalized video",
    "african dancers",
    "birthday gift",
    "viral birthday",
    "birthday surprise",
    "custom birthday message",
  ],
  openGraph: {
    title: "AfroBirthday - Personalized Birthday Videos from African Dancers",
    description:
      "Order a personalized birthday video from real African dancers. Upload a photo, add your message, choose delivery (12–48h), and receive it by email.",
    url: siteUrl,
    siteName: "AfroBirthday",
    locale: "en_US",
    type: "website",
    images: [{ url: "/logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AfroBirthday - Personalized Birthday Videos from African Dancers",
    description:
      "Order a personalized birthday video from real African dancers. Upload a photo, add your message, choose delivery (12–48h), and receive it by email.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let locale = "en";
  try {
    locale = await getLocale();
  } catch {
    locale = "en";
  }

  return (
    <html lang={locale}>
      <body>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17929280297"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());
gtag('config', 'AW-17929280297');`}
        </Script>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
