import type { Metadata } from "next";
import "@/app/globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { getTextDirection } from "@/i18n/config";
import { SITE_URL } from "@/lib/siteUrl";
import { CONSENT_COUNTRIES } from "@/lib/consent";
import OpenAIPixel from "@/components/OpenAIPixel";

const siteUrl = SITE_URL;

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-body",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

/**
 * The <html> shell shared by the two root layouts: app/[locale]/layout.tsx
 * (storefront, statically rendered per locale) and app/(site)/layout.tsx
 * (admin, payment returns). A single app/layout.tsx had to read the locale
 * from request headers, which made every page dynamic: no CDN caching and a
 * database round trip on every visit.
 */
export const rootMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AfroBirthday - Personalized Birthday Videos from African Dancers",
    template: "%s | AfroBirthday",
  },
  description:
    "Order a personalized birthday video from real African dancers. Upload a photo, add your message, choose delivery (12-48h), and receive it by email.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
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
      "Order a personalized birthday video from real African dancers. Upload a photo, add your message, choose delivery (12-48h), and receive it by email.",
    url: siteUrl,
    siteName: "AfroBirthday",
    locale: "en_US",
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AfroBirthday - Personalized Birthday Videos from African Dancers",
    description:
      "Order a personalized birthday video from real African dancers. Upload a photo, add your message, choose delivery (12-48h), and receive it by email.",
    images: ["/og-image.jpg"],
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

export default function RootDocument({
  locale,
  children,
}: Readonly<{
  locale: string;
  children: React.ReactNode;
}>) {
  const dir = getTextDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${dmSans.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('consent', 'default', {ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});
gtag('consent', 'default', {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',region:${JSON.stringify([...CONSENT_COUNTRIES])},wait_for_update:500});
try{var m=document.cookie.match(/(?:^|; )ab_consent=(granted|denied)/);if(m){var v=m[1];gtag('consent','update',{ad_storage:v,ad_user_data:v,ad_personalization:v,analytics_storage:v});}}catch(e){}
gtag('js', new Date());
gtag('config', 'G-8HTHEF5B04');`}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8HTHEF5B04"
          strategy="afterInteractive"
        />
        {children}
        <OpenAIPixel />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

