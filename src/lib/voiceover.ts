/**
 * Voiceover generation for AfroBirthday.
 *
 * When a customer's birthday message is NOT in English, we generate a
 * human-sounding MP3 of someone reading the message (via OpenAI text-to-speech)
 * so the team can hear the pronunciation/intonation in the target language
 * instead of guessing. The resulting MP3 is uploaded to Supabase Storage and
 * sent to the team over Telegram (see discordWebhook.ts / telegramBot.ts).
 */

import { getSupabaseAdmin, publicUrlFor, STORAGE_BUCKET } from "@/lib/storage";

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";

/** Why no voiceover URL came back — surfaced in the Telegram notification. */
export type VoiceoverFailureReason =
  | "skipped-english"
  | "empty-message"
  | "no-api-key"
  | "tts-error"
  | "upload-error"
  | "exception";

export type VoiceoverResult =
  | { ok: true; url: string }
  | { ok: false; reason: VoiceoverFailureReason; detail?: string };

// Latin-script accents that don't appear in English: French/Spanish/Portuguese/
// German/Nordic, Polish, Turkish, Romanian, Vietnamese, and the African Latin
// orthographies (Yoruba/Igbo dots-below, Ewe/Akan open vowels).
const NON_ENGLISH_DIACRITICS =
  /[àâäçéèêëîïôöùûüÿœáíóúñãõåæøäöß¿¡ąćęłńśźżğışİăâîșțẹọṣụịǹɛɔŋđươăạảấầẩẫậắằẳẵặẻẽếềểễệỉịọỏốồổỗộớờởỡợủứừửữựỳỷỹỵ]/i;

// Non-Latin scripts are never English: Greek, Cyrillic, Hebrew, Arabic,
// Devanagari, Ethiopic (Amharic), Thai, CJK, Hiragana/Katakana, Hangul.
const NON_LATIN_SCRIPT =
  /[Ͱ-ϿЀ-ӿ֐-׿؀-ۿऀ-ॿሀ-፿฀-๿぀-ヿ一-鿿가-힯]/;

/**
 * High-signal words that mean "definitely not English". Accent-free forms only,
 * since accented text is already caught by NON_ENGLISH_DIACRITICS above.
 */
const NON_ENGLISH_WORDS = new Set([
  // French
  "joyeux", "joyeuse", "anniversaire", "bon", "bonne", "beau", "bel", "belle",
  "fete", "mon", "ma", "mes", "ami", "amie", "cher", "chere", "vie", "bisous",
  "famille", "coeur", "meilleurs", "voeux", "tres", "avec", "pour", "toi",
  // Spanish
  "feliz", "cumpleanos", "cumple", "felicidades", "amigo", "amiga", "querido",
  "querida", "vida", "abrazo", "quiero", "mucho", "amor", "hermano", "hermana",
  // German
  "alles", "gute", "zum", "geburtstag", "liebe", "lieber", "freund", "herzlichen",
  "glueckwunsch", "wunsche", "dir", "ich",
  // Italian
  "buon", "compleanno", "auguri", "tanti", "caro", "cara", "amore", "felice",
  // Portuguese
  "aniversario", "parabens", "abraco", "muitas", "felicidade", "beijos",
  // Dutch
  "fijne", "verjaardag", "gefeliciteerd", "lieve", "veel", "geluk",
  // Polish
  "wszystkiego", "najlepszego", "urodziny", "sto", "lat", "zdrowia",
  "kocham", "serdeczne", "zyczenia", "ciebie",
  // Turkish
  "dogum", "gunun", "mutlu", "yillar", "kutlu", "olsun", "seni", "seviyorum",
  // Czech / Slovak
  "vsechno", "nejlepsi", "narozeniny", "zdravi", "lasku",
  "vsetko", "najlepsie", "narodeninam", "prajeme", "zdravia", "nasa", "nase",
  // Romanian
  "multi", "ani", "sanatate", "ziua", "nasterii", "fericit",
  // Swedish / Norwegian / Danish / Finnish
  "grattis", "fodelsedagen", "tillykke", "fodselsdag", "gratulerer",
  "hyvaa", "syntymapaivaa", "onnea",
  // Hungarian
  "boldog", "szuletesnapot", "kivanok",
  // Croatian / Serbian / Bosnian
  "sretan", "srecan", "rodendan", "zelim", "puno", "srece",
  // Swahili
  "heri", "siku", "kuzaliwa", "mwaka", "furaha", "rafiki", "mpendwa", "mungu",
  "baraka", "nakupenda", "yako", "sana",
  // Yoruba
  "ojo", "ibi", "odun", "eku", "alafia", "oluwa", "ayo", "pupo",
  // Igbo
  "ncheta", "omumu", "obi", "chukwu", "ekele", "ututu", "ahu",
  // Hausa
  "barka", "ranar", "haihuwa", "allah", "soyayya", "murna",
  // Wolof
  "bes", "jur", "jamm", "nangeen", "yaw",
  // Lingala
  "mbotama", "bolingo", "nzambe", "esengo",
  // Twi / Akan
  "awoda", "afe", "nyame", "medaase",
  // Zulu / Xhosa
  "usuku", "lokuzalwa", "halala", "ngiyakuthanda", "inhliziyo",
  // Somali / Amharic (transliterated)
  "dhalasho", "wanaagsan", "melkam", "lidet",
  // Indonesian / Malay / Tagalog
  "selamat", "ulang", "tahun", "semoga", "kaarawan", "maligayang", "bati",
  // Vietnamese (accent-free typing)
  "chuc", "mung", "sinh", "nhat", "vui", "manh", "khoe",
]);

/**
 * High-signal English words. Deliberately excludes short function words that
 * also exist in other languages ("is", "me", "to", "for", "all", "we"), because
 * a false "English" verdict silently costs the team a voiceover.
 */
const ENGLISH_WORDS = new Set([
  "happy", "birthday", "birthdays", "bday", "wish", "wishes", "wishing",
  "love", "lovely", "you", "your", "yours", "dear", "darling", "sweetheart",
  "best", "many", "more", "years", "year", "old", "hope", "great", "bless",
  "blessed", "blessings", "always", "forever", "friend", "friends", "sister",
  "brother", "mum", "mom", "mummy", "mommy", "dad", "daddy", "much", "proud",
  "amazing", "beautiful", "wonderful", "celebrate", "celebrating", "enjoy",
  "awesome", "congratulations", "cheers", "health", "smile", "laugh", "today",
  "life", "world", "everything", "deserve", "special", "queen", "king",
  "grandma", "grandpa", "auntie", "uncle", "cousin", "thank", "thanks",
  "another", "trip", "around", "sun", "day",
]);

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Best-effort "is this English?" check, used to decide whether the team needs a
 * spoken rendition of the message.
 *
 * We only answer "English" when the message shows *positive* evidence of being
 * English. An unrecognised message (a name on its own, an African language we
 * don't have vocabulary for, "Bon anniversaire Sarah") is treated as
 * non-English, so it still gets a voiceover.
 *
 * The asymmetry is deliberate: a spurious voiceover costs about $0.01 and is
 * simply ignored, whereas a missing one leaves the team guessing at the
 * pronunciation — the failure that prompted this logic.
 *
 * Order of evidence:
 *  1. Non-Latin script (Arabic, CJK, Devanagari, …) => not English.
 *  2. Latin text with non-English diacritics => not English.
 *  3. A known non-English keyword => not English.
 *  4. A known English keyword => English.
 *  5. Nothing recognised => not English.
 */
export function isLikelyEnglish(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  if (NON_LATIN_SCRIPT.test(trimmed)) return false;
  if (NON_ENGLISH_DIACRITICS.test(trimmed)) return false;

  const words = wordsOf(trimmed);
  if (words.some((w) => NON_ENGLISH_WORDS.has(w))) return false;

  return words.some((w) => ENGLISH_WORDS.has(w));
}

/**
 * Generates a spoken MP3 of `text` using OpenAI TTS and uploads it to Supabase
 * Storage. Never throws — failures come back as a typed reason so the caller can
 * report them instead of silently dropping the voiceover.
 */
export async function generateVoiceover(
  text: string,
  orderId: string
): Promise<VoiceoverResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set, skipping voiceover generation");
    return { ok: false, reason: "no-api-key" };
  }

  // OpenAI TTS caps input at 4096 characters.
  const input = text.trim().slice(0, 4096);
  if (!input) return { ok: false, reason: "empty-message" };

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
      return {
        ok: false,
        reason: "tts-error",
        detail: `HTTP ${response.status} ${errText.slice(0, 200)}`.trim(),
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filename = `orders/voiceover/${orderId}-voiceover.mp3`;
    const { error } = await getSupabaseAdmin()
      .storage.from(STORAGE_BUCKET)
      .upload(filename, buffer, { contentType: "audio/mpeg", upsert: true });
    if (error) {
      console.error("Voiceover upload error:", error);
      return { ok: false, reason: "upload-error", detail: error.message };
    }

    return { ok: true, url: publicUrlFor(filename) };
  } catch (error) {
    console.error("Voiceover generation error:", error);
    return {
      ok: false,
      reason: "exception",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Convenience wrapper: generates a voiceover only when the message doesn't look
 * like English. See isLikelyEnglish for how that call is made.
 */
export async function generateVoiceoverIfNonEnglish(
  text: string,
  orderId: string
): Promise<VoiceoverResult> {
  if (!text || !text.trim()) return { ok: false, reason: "empty-message" };
  if (isLikelyEnglish(text)) return { ok: false, reason: "skipped-english" };
  return generateVoiceover(text, orderId);
}

/** Human-readable (French) label for the team-facing Telegram notification. */
export function describeVoiceoverFailure(
  reason: VoiceoverFailureReason
): string {
  switch (reason) {
    case "skipped-english":
      return "message jugé anglais";
    case "empty-message":
      return "message vide";
    case "no-api-key":
      return "clé OpenAI absente";
    case "tts-error":
      return "erreur API OpenAI";
    case "upload-error":
      return "upload Supabase échoué";
    case "exception":
      return "erreur inattendue";
  }
}
