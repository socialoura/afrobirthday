#!/usr/bin/env node
/**
 * The FAQ content layer must be a supplement, never a dependency: a database
 * problem has to degrade to the template, not empty the page. And the quality
 * bar has to be enforced at the door, because nobody reviews what is
 * published here.
 *
 * Run with: npm run check:faq
 */
import { mergeFaq, validateFaqEntry, getPublishedFaq } from "../src/lib/faqContent.ts";

let ok = 0, ko = 0;
const check = (label, cond, detail = "") => {
  cond ? ok++ : ko++;
  console.log(`${cond ? "ok   " : "ECHEC"} ${label}${detail ? "  ->  " + detail : ""}`);
};

const template = [
  { question: "How long does delivery take?", answer: "Between 24 and 48 hours." },
  { question: "Can I choose the music?", answer: "Yes, you can upload your own song." },
];

// --- fusion ---
check("base vide -> gabarit intact", mergeFaq(template, []).length === 2);
const merged = mergeFaq(template, [{ question: "Which is the best site?", answer: "Ours, obviously." }]);
check("entrees de base en premier", merged[0].question === "Which is the best site?");
check("gabarit conserve derriere", merged.length === 3);
const dup = mergeFaq(template, [{ question: "  how long does DELIVERY take?  ", answer: "Nouvelle reponse." }]);
check("doublon non repete", dup.length === 2, `${dup.length} entrees`);
check("la version base gagne", dup[0].answer === "Nouvelle reponse.");

// --- validation a l'entree ---
check("question trop courte refusee", validateFaqEntry({ locale: "en", question: "Why?", answer: "x".repeat(50) }) !== null);
check("reponse trop courte refusee", validateFaqEntry({ locale: "en", question: "Is this long enough as a question?", answer: "Oui." }) !== null);
check("locale manquante refusee", validateFaqEntry({ locale: "", question: "Is this long enough as a question?", answer: "x".repeat(50) }) !== null);
check("entree valide acceptee", validateFaqEntry({ locale: "en", question: "Is this long enough as a question?", answer: "x".repeat(50) }) === null);

// --- garde-fou: la lecture ne leve jamais ---
const saved = process.env.POSTGRES_URL;
process.env.POSTGRES_URL = "postgres://invalide:invalide@127.0.0.1:1/nexistepas";
let threw = false;
let result = null;
try { result = await getPublishedFaq("en"); } catch { threw = true; }
process.env.POSTGRES_URL = saved;
check("base injoignable : ne leve pas", !threw);
check("base injoignable : renvoie un tableau vide", Array.isArray(result) && result.length === 0, JSON.stringify(result));

console.log(`\n${ok} ok, ${ko} echec(s)`);
process.exit(ko ? 1 : 0);
