import { getCitationDrift, recordCitationResults, type CitationRow } from "@/lib/seoDb";
import { sendTelegramMessage } from "@/lib/telegramBot";

/**
 * Do the assistants cite this site, and on which questions?
 *
 * This is the one probe that measures the channel the site actually lives on.
 * Search Console shows eight distinct queries in ninety days, and 118 of 132
 * impressions are the brand name — Google sends almost nothing generic. Three
 * quarters of real visitors arrive from ChatGPT.
 *
 * Both assistants are asked, because they do not answer alike: on the same
 * question ChatGPT cited this site first and Perplexity did not cite it at
 * all. Measuring only one would have produced a confident and wrong answer.
 */

const OWN_DOMAIN = "afrobirthday.com";

export type CitationProvider = "perplexity" | "openai";

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
 * How many questions one nightly pass asks, per provider.
 *
 * Rotating rather than asking everything: the calls cost money, and a flat
 * nightly load means one failed night leaves no hole in the series. The whole
 * set is covered every three or four days.
 */
const BATCH_SIZE = 3;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Walks an arbitrary response shape collecting every url_citation it contains. */
function collectOpenAiCitations(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectOpenAiCitations(item, out);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj.type === "url_citation" && typeof obj.url === "string") out.push(obj.url);
    for (const value of Object.values(obj)) collectOpenAiCitations(value, out);
  }
}

async function askPerplexity(question: string): Promise<string[]> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
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
    throw new Error(`Perplexity failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  }
  const data = (await res.json()) as {
    citations?: string[];
    search_results?: Array<{ url?: string }>;
  };
  return data.citations ?? (data.search_results ?? []).map((s) => s.url ?? "");
}

async function askOpenAi(question: string): Promise<string[]> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      tools: [{ type: "web_search" }],
      // Without this the model often answers from memory and cites nothing,
      // which would read as "not cited" rather than "not searched".
      tool_choice: "required",
      input: question,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  }
  const data = await res.json();
  const urls: string[] = [];
  collectOpenAiCitations(data, urls);
  return urls;
}

const PROVIDERS: Record<CitationProvider, { ask: (q: string) => Promise<string[]>; key: string }> = {
  perplexity: { ask: askPerplexity, key: "PERPLEXITY_API_KEY" },
  openai: { ask: askOpenAi, key: "OPENAI_API_KEY" },
};

export type CitationStats = {
  asked: number;
  drift?: number;
  cited: number;
  failed: number;
  byProvider: Record<string, { asked: number; cited: number }>;
  skipped?: string;
};

export async function runCitationProbe(
  opts: { all?: boolean; providers?: CitationProvider[] } = {}
): Promise<CitationStats> {
  const available = (opts.providers ?? (Object.keys(PROVIDERS) as CitationProvider[])).filter(
    (p) => process.env[PROVIDERS[p].key]
  );
  if (available.length === 0) {
    return { asked: 0, cited: 0, failed: 0, byProvider: {}, skipped: "no assistant API key configured" };
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
  const byProvider: Record<string, { asked: number; cited: number }> = {};
  let failed = 0;

  for (const provider of available) {
    byProvider[provider] = { asked: 0, cited: 0 };
    for (const item of batch) {
      try {
        const raw = await PROVIDERS[provider].ask(item.question);
        const hosts = raw.map(hostOf).filter((h): h is string => Boolean(h));
        const position = hosts.findIndex(
          (h) => h === OWN_DOMAIN || h.endsWith(`.${OWN_DOMAIN}`)
        );
        const cited = position >= 0;

        rows.push({
          provider,
          question: item.question,
          locale: item.locale,
          cited,
          position: cited ? position + 1 : null,
          // Domains only, and only a handful: this is a competitive signal,
          // not an archive of the assistant's answer.
          sources: hosts.slice(0, 15),
        });
        byProvider[provider].asked++;
        if (cited) byProvider[provider].cited++;
      } catch (err) {
        // One question failing must not lose the rest of the batch.
        failed++;
        console.error(`Citation probe (${provider}) failed for "${item.question.slice(0, 46)}":`, err);
      }
    }
  }

  if (rows.length) await recordCitationResults(rows);

  // Alert on the flip, never on the standing total.
  const drift = await getCitationDrift().catch((err) => {
    console.error("Citation drift check failed:", err);
    return [];
  });
  if (drift.length) {
    const lines = drift.map((d) => {
      const verb = d.to ? "✅ désormais cité" : "❌ n'est plus cité";
      return `${verb} — ${d.provider} [${d.locale}]\n${d.question}`;
    });
    await sendTelegramMessage(
      `<b>Citations assistants : changement</b>\n\n${lines.join("\n\n")}`
    ).catch(() => {});
  }

  return {
    asked: rows.length,
    drift: drift.length,
    cited: rows.filter((r) => r.cited).length,
    failed,
    byProvider,
  };
}
