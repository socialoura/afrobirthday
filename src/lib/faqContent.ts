import { getSql } from "@/lib/db";

/**
 * FAQ entries published from the database, read at the moment the page is
 * served, so adding a question needs no deployment.
 *
 * Question-shaped content with a direct answer is what assistants quote — the
 * citation probe shows the site is already cited on "where can I order…" in
 * every language, and absent on "which is the best site…" and "how do I get…".
 * Those gaps are answerable in prose, and this is the surface for it.
 *
 * The read never throws. Database unreachable, table missing, no rows: the
 * page still serves, with the questions from its own translation files. The
 * database is a supplement, never a dependency — otherwise the day of a
 * deployment, with an empty table, the FAQ would disappear.
 */

export type FaqEntry = {
  question: string;
  answer: string;
};

let faqTableReady: Promise<void> | null = null;

/**
 * Declared here, on the path both the reader and the writer go through.
 * A column declared only in the admin's schema helper is missing on the very
 * first write after a deploy.
 */
export function ensureFaqTable(): Promise<void> {
  if (!faqTableReady) {
    faqTableReady = runEnsureFaqTable().catch((err) => {
      faqTableReady = null;
      throw err;
    });
  }
  return faqTableReady;
}

async function runEnsureFaqTable() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS faq_entries (
      id bigserial PRIMARY KEY,
      locale text NOT NULL,
      question text NOT NULL,
      answer text NOT NULL,
      position integer NOT NULL DEFAULT 100,
      published boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS faq_entries_locale_question_idx
      ON faq_entries (locale, question)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS faq_entries_locale_published_idx
      ON faq_entries (locale, published, position)
  `;
}

/**
 * Published entries for a locale, or an empty array if anything at all goes
 * wrong. Callers fall back to their own content on empty.
 */
export async function getPublishedFaq(locale: string): Promise<FaqEntry[]> {
  try {
    await ensureFaqTable();
    const sql = getSql();
    const rows = await sql<FaqEntry[]>`
      SELECT question, answer
      FROM faq_entries
      WHERE locale = ${locale} AND published = true
      ORDER BY position ASC, id ASC
    `;
    return rows.map((r) => ({ question: r.question, answer: r.answer }));
  } catch (err) {
    console.error(`FAQ content read failed for locale ${locale}:`, err);
    return [];
  }
}

/**
 * Merges published entries into the template's own list.
 *
 * Database entries come first — they are the deliberate additions — and a
 * question already present in the template is not repeated.
 */
export function mergeFaq(fromTemplate: FaqEntry[], fromDb: FaqEntry[]): FaqEntry[] {
  if (fromDb.length === 0) return fromTemplate;
  const seen = new Set(fromDb.map((e) => e.question.trim().toLowerCase()));
  return [...fromDb, ...fromTemplate.filter((e) => !seen.has(e.question.trim().toLowerCase()))];
}

export type FaqUpsert = {
  locale: string;
  question: string;
  answer: string;
  position?: number;
  published?: boolean;
};

/** Minimum lengths, so an empty or one-word answer cannot be published. */
const MIN_QUESTION = 10;
const MIN_ANSWER = 40;

export function validateFaqEntry(entry: FaqUpsert): string | null {
  if (!entry.locale?.trim()) return "locale manquante";
  if ((entry.question ?? "").trim().length < MIN_QUESTION) {
    return `question trop courte (minimum ${MIN_QUESTION} caractères)`;
  }
  if ((entry.answer ?? "").trim().length < MIN_ANSWER) {
    return `réponse trop courte (minimum ${MIN_ANSWER} caractères)`;
  }
  return null;
}

export async function upsertFaqEntry(entry: FaqUpsert): Promise<void> {
  const problem = validateFaqEntry(entry);
  if (problem) throw new Error(problem);

  await ensureFaqTable();
  const sql = getSql();
  await sql`
    INSERT INTO faq_entries (locale, question, answer, position, published, updated_at)
    VALUES (
      ${entry.locale.trim()},
      ${entry.question.trim()},
      ${entry.answer.trim()},
      ${entry.position ?? 100},
      ${entry.published ?? false},
      now()
    )
    ON CONFLICT (locale, question) DO UPDATE SET
      answer = EXCLUDED.answer,
      position = EXCLUDED.position,
      published = EXCLUDED.published,
      updated_at = now()
  `;
}

export async function listFaqEntries(locale?: string) {
  await ensureFaqTable();
  const sql = getSql();
  return locale
    ? sql`SELECT * FROM faq_entries WHERE locale = ${locale} ORDER BY position, id`
    : sql`SELECT * FROM faq_entries ORDER BY locale, position, id`;
}
