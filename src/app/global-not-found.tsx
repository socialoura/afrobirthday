import type { Metadata } from "next";
import RootDocument from "@/components/RootDocument";
import { defaultLocale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "Page not found | AfroBirthday",
  robots: { index: false },
};

// Rendered for URLs that match no root layout (e.g. a missing /something.png,
// which the locale middleware skips). Requires experimental.globalNotFound.
export default function GlobalNotFound() {
  return (
    <RootDocument locale={defaultLocale}>
      <main className="section-container py-32 text-center">
        <h1 className="font-display text-4xl font-bold text-white mb-4">Page not found</h1>
        <p className="text-white/70 mb-8">This page doesn&apos;t exist or has moved.</p>
        <a href={`/${defaultLocale}`} className="btn-primary inline-flex">
          Back to home
        </a>
      </main>
    </RootDocument>
  );
}
