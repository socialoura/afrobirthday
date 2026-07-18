/**
 * Voiceover generation for AfroBirthday.
 *
 * When a customer's birthday message is NOT in English, we generate a
 * human-sounding MP3 of someone reading the message (via OpenAI text-to-speech)
 * so the team can hear the pronunciation/intonation in the target language
 * instead of guessing. The resulting MP3 is uploaded to Vercel Blob and
 * attached to the Discord order notification (see discordWebhook.ts).
 */

import { getSupabaseAdmin, publicUrlFor, STORAGE_BUCKET } from "@/lib/storage";

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";

/**
 * Best-effort "is this English?" check. Errs toward English (i.e. skip the
 * voiceover) when unsure, since a missing voiceover is harmless but generating
 * one for every English order costs money for no benefit.
 *
 * Strategy:
 *  - Any non-Latin script (Arabic, CJK, Devanagari, Cyrillic, …) => not English.
 *  - Latin text with language-specific diacritics or common non-English
 *    stop/keywords (fr/es/de/it/pt/nl) => not English.
 *  - Otherwise => treat as English.
 */
export function isLikelyEnglish(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  // Non-Latin scripts are never English: Arabic, Hebrew, Devanagari (Hindi),
  // Cyrillic, CJK (Chinese/Japanese), Hangul (Korean), Thai.
  if (
    /[֐-׿؀-ۿऀ-ॿЀ-ӿ一-鿿぀-ヿ가-힯฀-๿]/.test(
      trimmed
    )
  ) {
    return false;
  }

  // Latin-script accents that don't appear in English.
  if (/[àâäçéèêëîïôöùûüÿœáíóúñãõ¿¡ßąćęłńśźżĄĆĘŁŃŚŹŻ]/i.test(trimmed)) {
    return false;
  }

  // ASCII-only Latin text (e.g. "Joyeux anniversaire mon ami") — fall back to a
  // small set of high-signal non-English words.
  const NON_ENGLISH_WORDS = new Set([
    // French
    "joyeux", "anniversaire", "bonne", "fete", "mon", "ami", "amie", "cher",
    "chere", "vie", "bisous", "famille", "coeur",
    // Spanish
    "feliz", "cumpleanos", "amigo", "amiga", "querido", "querida", "vida", "abrazo",
    // German
    "alles", "gute", "zum", "geburtstag", "liebe", "lieber", "freund",
    // Italian
    "buon", "compleanno", "auguri", "tanti", "caro", "cara", "amore",
    // Portuguese
    "feliz", "aniversario", "parabens", "amigo", "querido", "abraco",
    // Dutch
    "fijne", "verjaardag", "gefeliciteerd", "lieve",
    // Polish
    "wszystkiego", "najlepszego", "urodziny", "sto", "lat", "zdrowia",
    "kocham", "serdeczne", "zyczenia", "dupa", "ciebie", "byku",
    // Turkish
    "dogum", "gunun", "mutlu", "yillar", "kutlu", "olsun", "seni", "seviyorum",
    // Czech/Slovak
    "vsechno", "nejlepsi", "narozeniny", "zdravi", "lasku",
    // Romanian
    "multi", "ani", "sanatate", "ziua", "nasterii",
    // Swedish/Norwegian/Danish
    "grattis", "fodelsedagen", "tillykke", "fodselsdag", "gratulerer",
  ]);

  const words = trimmed
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.some((w) => NON_ENGLISH_WORDS.has(w))) {
    return false;
  }

  return true;
}

/**
 * Generates a spoken MP3 of `text` using OpenAI TTS and uploads it to Vercel
 * Blob. Returns the public URL, or null if disabled / not configured / failed.
 */
export async function generateVoiceover(
  text: string,
  orderId: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set, skipping voiceover generation");
    return null;
  }

  // OpenAI TTS caps input at 4096 characters.
  const input = text.trim().slice(0, 4096);
  if (!input) return null;

  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const voice = process.env.OPENAI_TTS_VOICE || "nova";
  // Playback speed (0.25–4.0). Default to a slightly slow, easy-to-follow pace.
  const parsedSpeed = Number(process.env.OPENAI_TTS_SPEED);
  const speed =
    Number.isFinite(parsedSpeed) && parsedSpeed >= 0.25 && parsedSpeed <= 4
      ? parsedSpeed
      : 0.75;

  try {
    const response = await fetch(OPENAI_TTS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        input,
        response_format: "mp3",
        speed,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("OpenAI TTS error:", response.status, errText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filename = `orders/voiceover/${orderId}-voiceover.mp3`;
    const { error } = await getSupabaseAdmin()
      .storage.from(STORAGE_BUCKET)
      .upload(filename, buffer, { contentType: "audio/mpeg", upsert: true });
    if (error) {
      console.error("Voiceover upload error:", error);
      return null;
    }

    return publicUrlFor(filename);
  } catch (error) {
    console.error("Voiceover generation error:", error);
    return null;
  }
}

/**
 * Convenience wrapper: generates a voiceover only when the message is not in
 * English. Returns the MP3 URL or null.
 */
export async function generateVoiceoverIfNonEnglish(
  text: string,
  orderId: string
): Promise<string | null> {
  if (!text || !text.trim()) return null;
  if (isLikelyEnglish(text)) return null;
  return generateVoiceover(text, orderId);
}
