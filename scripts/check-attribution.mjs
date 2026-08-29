#!/usr/bin/env node
/**
 * The attribution values come from browser storage, which the visitor can
 * edit. These checks cover what the server must refuse.
 *
 * Run with: npm run check:attribution
 */
import { sanitizeAttribution } from "../src/lib/db.ts";

let ok = 0;
let ko = 0;
const check = (label, cond, detail = "") => {
  cond ? ok++ : ko++;
  console.log(`${cond ? "ok   " : "ECHEC"} ${label}${detail ? "  ->  " + detail : ""}`);
};

const nominal = sanitizeAttribution({
  source: "chatgpt.com",
  medium: "referral",
  campaign: "abandoned_cart",
  landing: "/en",
  referrer: "https://chatgpt.com/",
  firstSeenAt: "2026-08-20T10:00:00.000Z",
});
check("cas nominal conserve", nominal?.source === "chatgpt.com" && nominal?.campaign === "abandoned_cart");
check("date normalisee en ISO", nominal?.firstSeenAt === "2026-08-20T10:00:00.000Z");

// Champs inconnus : ils ne doivent jamais atteindre la colonne.
const extra = sanitizeAttribution({
  source: "email",
  is_admin: true,
  "; DROP TABLE orders; --": "x",
  notes: "injecte",
});
check("champ inconnu ignore", extra !== undefined && !("is_admin" in extra) && !("notes" in extra));
check(
  "sortie limitee aux six cles connues",
  extra !== undefined &&
    JSON.stringify(Object.keys(extra).sort()) ===
      JSON.stringify(["campaign", "firstSeenAt", "landing", "medium", "referrer", "source"]),
  extra ? Object.keys(extra).join(",") : ""
);

// Longueurs : le visiteur peut envoyer n'importe quoi.
const long = sanitizeAttribution({ source: "a".repeat(5000), referrer: "b".repeat(5000) });
check("source tronquee a 120", long?.source?.length === 120, String(long?.source?.length));
check("referrer tronque a 200", long?.referrer?.length === 200, String(long?.referrer?.length));

// Types inattendus.
const wrong = sanitizeAttribution({ source: 42, medium: null, campaign: { a: 1 }, landing: [] });
check("types non-chaine ecartes", wrong === undefined, JSON.stringify(wrong));

// Dates invalides ou dans le futur.
check("date illisible ecartee", sanitizeAttribution({ source: "x", firstSeenAt: "pas-une-date" })?.firstSeenAt === null);
const future = new Date(Date.now() + 5 * 86400000).toISOString();
check("date future ecartee", sanitizeAttribution({ source: "x", firstSeenAt: future })?.firstSeenAt === null);

// Entrees vides.
check("objet vide -> undefined", sanitizeAttribution({}) === undefined);
check("null -> undefined", sanitizeAttribution(null) === undefined);
check("chaine -> undefined", sanitizeAttribution("chatgpt") === undefined);
check("chaines vides -> undefined", sanitizeAttribution({ source: "   ", medium: "" }) === undefined);

console.log(`\n${ok} ok, ${ko} echec(s)`);
process.exit(ko ? 1 : 0);
