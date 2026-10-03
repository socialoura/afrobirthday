import RootDocument, { rootMetadata } from "@/components/RootDocument";
import { defaultLocale } from "@/i18n/config";

export const metadata = rootMetadata;

// Root layout for the routes outside the localized storefront (admin, payment
// returns, the "/" fallback). They are English-only.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale={defaultLocale}>{children}</RootDocument>;
}
