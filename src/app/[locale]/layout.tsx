import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatWidgetWrapper from "@/components/ChatWidgetWrapper";
import RootDocument, { rootMetadata } from "@/components/RootDocument";
import { locales } from "@/i18n/config";

export const metadata = rootMetadata;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Only the 10 known locales exist. Without this, any root URL with a dot that
// the middleware skips (/og-image.jpg, /llms.txt, a missing .webm) rendered
// the English home page with a 200.
export const dynamicParams = false;

// Static pages, regenerated in the background at most every 5 minutes (prices
// and FAQ come from the database through src/lib/cachedContent.ts).
export const revalidate = 300;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as never)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <RootDocument locale={locale}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <ChatWidgetWrapper />
      </NextIntlClientProvider>
    </RootDocument>
  );
}
