import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { defaultLocale, locales } from "./src/i18n/config";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeDetection: true,
});

export default function middleware(request: NextRequest) {
  // skipTrailingSlashRedirect (next.config.mjs, kept for the PostHog /ingest
  // proxy, which this middleware never sees) meant /fr/ and /fr both answered
  // 200; Search Console listed them as separate pages. One canonical form.
  const { pathname, search } = request.nextUrl;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    // A plain URL: NextURL (request.nextUrl.clone()) re-applies the trailing
    // slash it was parsed with, which turned this into a redirect loop.
    const target = new URL(pathname.replace(/\/+$/, "") + search, request.url);
    return NextResponse.redirect(target, 308);
  }

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
