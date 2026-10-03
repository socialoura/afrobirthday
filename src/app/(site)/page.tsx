// This file should never render: the next-intl middleware rewrites "/" to
// "/<locale>" based on the visitor's Accept-Language header. It is kept only
// as a safety net for environments where the middleware does not run (e.g.
// static export).
import { permanentRedirect } from "next/navigation";
import { defaultLocale } from "@/i18n/config";

export default function Home() {
  permanentRedirect(`/${defaultLocale}`);
}
