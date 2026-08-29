/**
 * Resolves the "@/..." path alias when running project modules directly under
 * Node, which the tsconfig alias only covers inside the Next build.
 *
 * Used by the check scripts so they exercise the real modules rather than a
 * copy that would drift.
 */
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { existsSync } from "node:fs";

const SRC = join(process.cwd(), "src");

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = join(SRC, specifier.slice(2));
    // The alias is extensionless in source, so the extension is added here.
    // Existence is checked rather than caught: nextResolve is async, so a
    // try/catch around it never sees the rejection.
    for (const candidate of [`${target}.ts`, `${target}.tsx`, target, join(target, "index.ts")]) {
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
