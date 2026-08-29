import { recordCitationResults, type CitationRow } from "@/lib/seoDb";

/**
 * Do the assistants cite this site, and on which questions?
 *
 * This is the one probe that measures the channel the site actually lives on.
 * Search Console shows eight distinct queries in ninety days, and 118 of 132
 * impressions are the brand name — Google sends almost nothing generic. Three
 * quarters of real visitors arrive from ChatGPT.
 *
 * So the question worth asking nightly is not "where do we rank" but "when
 * someone asks an assistant what we sell, are we in the answer, and who is
 * there instead". The competitor list is the useful half: it names the pages
 * that own the answers today.
 */

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const OWN_DOMAIN = "afrobirthday.com";

/**
 * The questions asked, in the languages that actually appear in the data.
 *
 * Dutch is here because two real Search Console queries are Dutch. These are
 * buyer questions, not keywords: an assistant is asked things, not queried.
 */
export const CITATION_QUESTIONS = [
  { locale: "en", question: "Where can I order a personalized birthday video from African dancers?" },
  { locale: "en", question: "What is the best site to send a custom birthday video message with a photo?" },
  { locale: "en", question: "How do I get a personalised dance video greeting for someone's birthday?" },
  { locale: "fr", question: "Où commander une vidéo d'anniversaire personnalisée avec des danseurs africains ?" },
  { locale: "fr", question: "Quel site pour envoyer un message vidéo d'anniversaire personnalisé ?" },
  { locale: "de", question: "Wo kann ich ein personalisiertes Geburtstagsvideo mit afrikanischen Tänzern bestellen?" },
  { locale: "es", question: "¿Dónde pedir un vídeo de cumpleaños personalizado con bailarines africanos?" },
  { locale: "it", question: "Dove ordinare un video di auguri di compleanno personalizzato con ballerini africani?" },
  { locale: "nl", question: "Waar kan ik een gepersonaliseerde verjaardagsvideo met Afrikaanse dansers bestellen?" },
  { locale: "pt", question: "Onde encomendar um vídeo de aniversário personalizado com dançarinos africanos?" },
] as const;

/**
 * How many questions one nightly pass asks.
 *
 * Rotating rather than asking everything: the calls cost money, and a flat
 * nightly load means one failed night leaves no hole in the series. The whole
 * set is covered every three or four days.
 */
const BATCH_SIZE = 3;

type PerplexityResponse = {
  citations?: string[];
  search_results?: Array<{ url?: string }>;
  choices?: Array<{ message?: { content?: string } }>;
  error?: unknown;
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function askOne(question: string): Promise<{ cited: boolean; position: number | null; sources: string[] }> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: question }],
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    throw new Error(`Perplexity call failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  }

  const data = (await res.json()) as PerplexityResponse;
  const raw = data.citations ?? (data.search_results ?? []).map((s) => s.url ?? "");
  const hosts = raw.map(hostOf).filter((h): h is string => Boolean(h));

  const position = hosts.findIndex((h) => h === OWN_DOMAIN || h.endsWith(`.${OWN_DOMAIN}`));

  return {
    cited: position >= 0,
    position: position >= 0 ? position + 1 : null,
    sources: hosts,
  };
}

export type CitationStats = {
  asked: number;
  cited: number;
  failed: number;
  skipped?: string;
};

export async function runCitationProbe(
  opts: { all?: boolean } = {}
): Promise<CitationStats> {
  if (!process.env.PERPLEXITY_API_KEY) {
    return { asked: 0, cited: 0, failed: 0, skipped: "PERPLEXITY_API_KEY not configured" };
  }

  // Rotate through the list by day so the whole set is covered without asking
  // everything every night.
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const batch = opts.all
    ? [...CITATION_QUESTIONS]
    : Array.from({ length: Math.min(BATCH_SIZE, CITATION_QUESTIONS.length) }, (_, i) =>
        CITATION_QUESTIONS[(dayIndex * BATCH_SIZE + i) % CITATION_QUESTIONS.length]
      );

  const rows: CitationRow[] = [];
  let failed = 0;

  for (const item of batch) {
    try {
      const result = await askOne(item.question);
      rows.push({
        question: item.question,
        locale: item.locale,
        cited: result.cited,
        position: result.position,
        // Only the domains, and only a handful: this is a competitive signal,
        // not an archive of the assistant's answer.
        sources: result.sources.slice(0, 15),
      });
    } catch (err) {
      failed++;
      console.error(`Citation probe failed for "${item.question.slice(0, 50)}":`, err);
    }
  }

  if (rows.length) await recordCitationResults(rows);

  return { asked: rows.length, cited: rows.filter((r) => r.cited).length, failed };
}
