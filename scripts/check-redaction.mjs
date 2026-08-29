#!/usr/bin/env node
/**
 * The unsubscribe link carries a signed token in the URL. If it reaches
 * analytics through $current_url, that credential now lives in a third-party
 * tool. These checks cover the redaction that stops it.
 *
 * Tested here rather than on the wire: the real payload leaves via sendBeacon
 * on page unload, which cannot be intercepted reliably.
 *
 * Run with: npm run check:redaction
 */
import { redactUrl, redactUrlProperties } from "../src/lib/redactUrl.ts";

let ok = 0, ko = 0;
const check = (label, cond, detail = "") => {
  cond ? ok++ : ko++;
  console.log(`${cond ? "ok   " : "ECHEC"} ${label}${detail ? "  ->  " + detail : ""}`);
};

const unsub = "https://www.afrobirthday.com/api/unsubscribe?e=Y2xpZW50QGV4LmNvbQ&t=SIGNATURE_ABC123";
const cleaned = String(redactUrl(unsub));
check("jeton signe retire", !cleaned.includes("SIGNATURE_ABC123"), cleaned);
check("email encode retire", !cleaned.includes("Y2xpZW50QGV4LmNvbQ"));
check("marqueur pose", cleaned.includes("%5Bredacted%5D") || cleaned.includes("[redacted]"));

const utm = "https://www.afrobirthday.com/en?utm_source=chatgpt.com&utm_campaign=abandoned_cart";
check("parametres de campagne intacts", redactUrl(utm) === utm, String(redactUrl(utm)));

const stripe = "https://www.afrobirthday.com/success?payment_intent_client_secret=pi_3ABC_secret_XYZ&orderId=11111111";
const s = String(redactUrl(stripe));
check("secret Stripe retire", !s.includes("secret_XYZ"), s);
check("orderId conserve", s.includes("orderId=11111111"));

check("URL sans requete inchangee", redactUrl("https://www.afrobirthday.com/en") === "https://www.afrobirthday.com/en");
check("valeur non-chaine inchangee", redactUrl(42) === 42);
check("URL invalide inchangee", redactUrl("pas?une?url") === "pas?une?url");

const props = redactUrlProperties({
  $current_url: unsub,
  $referrer: utm,
  distinct_id: "client@example.com",
  value: 19.99,
});
check("$current_url redige", !String(props.$current_url).includes("SIGNATURE_ABC123"));
check("$referrer intact", props.$referrer === utm);
check("autres proprietes intactes", props.value === 19.99 && props.distinct_id === "client@example.com");

console.log(`\n${ok} ok, ${ko} echec(s)`);
process.exit(ko ? 1 : 0);
