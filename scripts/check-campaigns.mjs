#!/usr/bin/env node
/**
 * Checks the e-mail campaign tagging, including the two mistakes that are easy
 * to make and invisible once made:
 *
 *  - a link that already carries a signed token must keep it, not have its
 *    query string overwritten;
 *  - the unsubscribe link must never be tagged, or the acquisition reports
 *    fill up with people who are leaving.
 *
 * Run with: npm run check:campaigns
 */
import { withCampaign, EMAIL_CAMPAIGNS } from "../src/lib/campaign.ts";
import { buildUnsubscribeUrl } from "../src/lib/emailOptOut.ts";
import {
  renderAbandonedCartEmailHtml,
  renderCrossSellEmailHtml,
  renderAnnualReminderEmailHtml,
} from "../src/lib/orderEmailTemplates.ts";

let ok = 0;
let ko = 0;
const check = (label, cond, detail = "") => {
  cond ? ok++ : ko++;
  console.log(`${cond ? "ok   " : "ECHEC"} ${label}${detail ? "  ->  " + detail : ""}`);
};

// The origin follows NEXT_PUBLIC_SITE_URL, which is localhost in development
// on purpose — asserting the production host here would fail for the wrong
// reason. What matters is that a relative path becomes absolute and tagged.
const base = withCampaign("/#order", EMAIL_CAMPAIGNS.ABANDONED_CART);
check(
  "transforme une URL relative en absolue et la marque",
  /^https?:\/\/[^/]+\//.test(base) && base.includes("utm_campaign=abandoned_cart"),
  base
);
check("conserve le fragment #order", base.endsWith("#order"));

// Piege 1 : une chaine de requete existante doit survivre au marquage.
const signed = "/api/unsubscribe?e=YWJjQGV4LmNvbQ&t=SIGNATURE_ABC123";
const tagged = new URL(withCampaign(signed, EMAIL_CAMPAIGNS.CROSS_SELL));
check(
  "preserve un jeton signe deja present",
  tagged.searchParams.get("t") === "SIGNATURE_ABC123" &&
    tagged.searchParams.get("e") === "YWJjQGV4LmNvbQ",
  tagged.search
);
check("ajoute la campagne sans ecraser", tagged.searchParams.get("utm_campaign") === "cross_sell");

// Piege 2 : le lien de desinscription ne doit jamais porter de campagne.
const order = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "client@example.com",
  created_at: new Date(),
  delivery_method: "standard",
  music_option: "default",
};

const emails = [
  ["panier abandonne", renderAbandonedCartEmailHtml(order, base)],
  ["vente croisee", renderCrossSellEmailHtml(order, "PROMO10")],
  ["rappel annuel", renderAnnualReminderEmailHtml(order, "PROMO10")],
];

const unsub = buildUnsubscribeUrl(order.email);
for (const [name, html] of emails) {
  check(`${name} : lien de desinscription intact`, html.includes(unsub));
  check(`${name} : desinscription non marquee`, !/unsubscribe[^"]*utm_/.test(html));

  const ctas = [...html.matchAll(/href="([^"]*#order[^"]*)"/g)].map((m) => m[1]);
  check(
    `${name} : possede un lien vers la commande`,
    ctas.length > 0,
    ctas[0] ?? "AUCUN LIEN"
  );
  check(
    `${name} : ce lien est marque`,
    ctas.length > 0 && ctas.every((h) => h.includes("utm_campaign=")),
  );
}

// Une entree que URL() refuse doit ressortir intacte, pas casser l'e-mail.
check(
  "une adresse mailto ressort intacte",
  withCampaign("mailto:support@afrobirthday.com", EMAIL_CAMPAIGNS.CROSS_SELL).startsWith("mailto:")
);

console.log(`\n${ok} ok, ${ko} echec(s)`);
process.exit(ko ? 1 : 0);
