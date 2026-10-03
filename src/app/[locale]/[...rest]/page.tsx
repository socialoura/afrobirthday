import { notFound } from "next/navigation";

// Unknown paths under a locale (/fr/nope) would otherwise skip the localized
// [locale]/not-found.tsx and fall through to the English global 404.
export default function CatchAllNotFound() {
  notFound();
}
