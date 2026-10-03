import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { defaultLocale, locales } from "./src/i18n/config";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeDetection: true,
});

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  // Storefront pages are static, so the browser learns the visitor's country
  // from this cookie to decide whether to show the cookie banner
  // (src/lib/consent.ts).
  const country = request.headers.get("x-vercel-ip-country");
  if (country && request.cookies.get("ab_geo")?.value !== country) {
    response.cookies.set("ab_geo", country, {
      path: "/",
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next|admin|success|paypal|v/|ingest|.*\\..*).*)",
  ],
};
