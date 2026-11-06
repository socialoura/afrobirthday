#!/usr/bin/env node
/**
 * Regression checks for the real paid-order Telegram notification.
 * All HTTP calls are captured locally: no Telegram message, TTS or DB write.
 * Run: node scripts/check-telegram-music.mjs
 */
import assert from "node:assert/strict";
import { register } from "node:module";

// Use the locked TypeScript compiler: some Node builds lack native TS support.
register("./alias-loader.mjs", import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`
  import { readFile } from "node:fs/promises";
  import ts from ${JSON.stringify(import.meta.resolve("typescript"))};
  export async function load(url, context, nextLoad) {
    if (!url.endsWith(".ts")) return nextLoad(url, context);
    const source = await readFile(new URL(url), "utf8");
    return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    };
  }
`)}`, import.meta.url);

// Replace inherited credentials before importing application modules.
process.env.TELEGRAM_BOT_TOKEN = "local-notification-test";
process.env.TELEGRAM_CHAT_ID = "local-test-chat";
delete process.env.ADMIN_TOKEN_SECRET;
delete process.env.DATABASE_URL;

const originalFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith("https://api.telegram.org/botlocal-notification-test/"));
  assert.equal(options.method, "POST");
  requests.push({ method: String(url).split("/").at(-1), body: JSON.parse(options.body) });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

let passed = 0;
let failed = 0;
try {
  const { sendNewOrderNotification } = await import("../src/lib/telegramBot.ts");
  const uploaded = "https://media.example.test/orders/music/customer.mp3?x=1&y=2";
  const downloaded = "https://media.example.test/orders/music/downloaded.mp3";
  const voice = "https://media.example.test/orders/voiceover/message.mp3";
  const order = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "customer@example.test",
    message: "Happy birthday!",
    delivery_method: "standard",
    music_option: "custom",
    music_link: null,
    music_file_url: null,
    downloaded_music_url: null,
    photo_url: "https://media.example.test/orders/photos/customer.jpg",
    country: null,
  };
  const cases = [
    { label: "MP3 joint sans lien", fields: { music_file_url: uploaded }, expected: uploaded, uploaded: true },
    { label: "MP3 joint avec téléchargement indisponible", fields: { music_file_url: uploaded, music_link: "https://example.test/song" }, downloadedMusicUrl: null, expected: uploaded, uploaded: true },
    { label: "MP3 téléchargé depuis un lien", fields: { music_link: "https://example.test/song" }, downloadedMusicUrl: downloaded, expected: downloaded },
    { label: "Pas de doublon si lien et fichier", fields: { music_file_url: uploaded }, downloadedMusicUrl: downloaded, expected: downloaded },
    { label: "MP3 téléchargé déjà enregistré", fields: { downloaded_music_url: downloaded, music_file_url: uploaded }, expected: downloaded },
    { label: "Musique au choix sans fichier", fields: { music_option: "default" }, expected: null },
    { label: "Lien seul sans MP3 disponible", fields: { music_link: "https://example.test/song" }, expected: null },
  ];
  for (const test of cases) {
    requests.length = 0;
    try {
      await sendNewOrderNotification({
        order: { ...order, ...test.fields },
        provider: "Stripe",
        amountLabel: "test",
        voiceover: { ok: true, url: voice },
        downloadedMusicUrl: test.downloadedMusicUrl,
      });
      const music = requests.filter((r) => r.method === "sendAudio" && r.body.caption.startsWith("🎵 Musique"));
      assert.equal(music.length, test.expected ? 1 : 0, "exactement une pièce jointe musicale si un MP3 existe");
      const summary = requests.find((r) => r.method === "sendMessage").body.text;
      if (test.expected) {
        assert.equal(music[0].body.audio, test.expected, "le bon MP3 est transmis");
        assert.ok(summary.includes(test.expected.replaceAll("&", "&amp;")), "lien de secours présent et échappé");
        assert.ok(summary.includes(test.uploaded ? "MP3 fourni par le client" : "MP3 téléchargé"), "origine du MP3 correcte");
      } else {
        assert.ok(!summary.includes("MP3 fourni") && !summary.includes("MP3 téléchargé"));
      }
      if (test.fields.music_link) assert.ok(summary.includes(test.fields.music_link), "lien d'origine conservé");
      assert.equal(requests.filter((r) => r.method === "sendAudio" && r.body.audio === voice).length, 1, "vocal préservé");
      assert.equal(requests.filter((r) => r.method === "sendPhoto").length, 1, "photo préservée");
      assert.ok(requests.some((r) => r.method === "sendMessage" && r.body.text.startsWith(order.message)), "message client préservé");
      passed++;
      console.log(`OK ${test.label}`);
    } catch (error) {
      failed++;
      console.error(`ECHEC ${test.label}: ${error.message}`);
    }
  }
} finally {
  globalThis.fetch = originalFetch;
}
console.log(`\n${passed} cas réussis, ${failed} échec(s); aucun envoi réel.`);
process.exitCode = failed ? 1 : 0;
