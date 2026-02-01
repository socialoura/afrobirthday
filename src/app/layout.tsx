import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "AfroBirthday - Make Every Birthday VIRAL 🎂💃",
  description:
    "Get a personalized birthday video from real African dancers. Authentic energy, pure joy, delivered in 24-48 hours.",
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
  ],
  openGraph: {
    title: "AfroBirthday - Make Every Birthday VIRAL 🎂💃",
    description:
      "Get a personalized birthday video from real African dancers. Authentic energy, pure joy, delivered in 24-48 hours.",
    url: "https://afrobirthday.com",
    siteName: "AfroBirthday",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AfroBirthday - Make Every Birthday VIRAL 🎂💃",
    description:
      "Get a personalized birthday video from real African dancers. Authentic energy, pure joy, delivered in 24-48 hours.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <ChatWidget />
      </body>
    </html>
  );
}
