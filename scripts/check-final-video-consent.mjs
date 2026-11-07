#!/usr/bin/env node
// Offline template regression: no database, email provider or client data.
// Run from the repo root: node scripts/check-final-video-consent.mjs
import assert from "node:assert/strict";
import { register } from "node:module";
// Some Node builds lack native TypeScript support. Use the project's installed
// compiler, and load the actual source modules rather than copies of templates.
const loader = `
  import { readFile } from 'node:fs/promises';
  import ts from ${JSON.stringify(import.meta.resolve("typescript"))};
  export async function load(url, context, nextLoad) {
    if (!url.endsWith('.ts')) return nextLoad(url, context);
    const source = await readFile(new URL(url), 'utf8');
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
    }).outputText };
  }
`;
register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url);
register(new URL("./alias-loader.mjs", import.meta.url));
const { emailCopy, emailLocale } = await import("../src/lib/emailCopy.ts");
const {
  finalVideoSubject,
  renderFinalVideoEmailHtml,
  renderFinalVideoEmailText,
  renderOrderConfirmationEmailHtml,
  renderOrderConfirmationEmailText,
} = await import("../src/lib/orderEmailTemplates.ts");

const locales = ["en", "fr", "es", "de", "it", "pt", "nl", "ar", "hi", "zh", "ru"];
const videoUrl = "https://example.com/v/11111111-1111-1111-1111-111111111111";
const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
for (const locale of locales) {
  const order = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "customer@example.com",
    created_at: "2026-01-01T12:00:00Z",
    delivery_method: "standard",
    music_option: "default",
    message: "Happy birthday!",
    total_usd: 39.99,
    currency: "USD",
    locale,
  };
  const c = emailCopy(order);
  const consent = c.videoSocialPermission;
  assert.equal(emailLocale(order), locale);
  assert.ok(consent && consent.includes("Instagram") && consent.includes("TikTok"));
  const html = renderFinalVideoEmailHtml(order, videoUrl);
  const text = renderFinalVideoEmailText(order, videoUrl);
  assert.equal(text.split(consent).length - 1, 1, `${locale}: one consent request in text`);
  assert.equal(html.split(escapeHtml(consent)).length - 1, 1, `${locale}: one escaped consent request in HTML`);
  assert.ok(text.indexOf(consent) > text.indexOf(videoUrl));
  assert.ok(text.indexOf(consent) < text.indexOf(c.team));
  assert.ok(html.includes(`href="${videoUrl}"`));
  assert.ok(finalVideoSubject(order).includes("11111111"));
  assert.equal(html.includes('dir="rtl"'), locale === "ar");
  assert.ok(!renderOrderConfirmationEmailHtml(order).includes(escapeHtml(consent)));
  assert.ok(!renderOrderConfirmationEmailText(order).includes(consent));
  console.log(`PASS ${locale}: delivery HTML/text, links, reference, locale and confirmation isolation`);
}
assert.equal(emailCopy({ locale: "unknown" }).videoSocialPermission, emailCopy({ locale: "en" }).videoSocialPermission);
assert.equal(emailCopy({}).videoSocialPermission, emailCopy({ locale: "en" }).videoSocialPermission);
const fr = emailCopy({ locale: "fr" }).videoSocialPermission;
assert.ok(fr.includes("sans votre accord explicite"));
assert.ok(fr.includes("facultatif"));
assert.ok(fr.includes("votre choix ne change rien à votre commande"));
console.log(`PASS: ${locales.length} languages + fallback + explicit, optional consent; no messages sent`);
