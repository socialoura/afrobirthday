import { getCachedPricingSettings } from "@/lib/cachedContent";
import { PRICES } from "@/lib/utils";

// Plain-text summary for AI assistants (llmstxt.org). A route rather than a
// file in public/ so the prices always match what checkout charges.
export const revalidate = 300;

function usd(value: number): string {
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

export async function GET() {
  const p = (await getCachedPricingSettings()) ?? PRICES;
  const body = `# AfroBirthday

> AfroBirthday makes personalized birthday videos performed by a group of real African dancers in Africa. The customer uploads a photo, writes a short birthday message, and receives a custom video by email, usually within 24-48 hours (12-24 hours with Express delivery). No account is needed.

## How it works

1. Upload a photo of the birthday person and write a message of up to 100 characters (their name and a short wish).
2. Choose options: our music or your own song (YouTube/Spotify link or MP3 upload), Standard (24-48h) or Express (12-24h) delivery, and an optional extended dance version (over 2 minutes).
3. Pay securely by card (Stripe) or PayPal. Prices are shown in the visitor's local currency.
4. The dancers film the video holding the personalized message; it is delivered by email as a download link the customer keeps forever.

## Pricing (USD reference, charged in local currency)

- Personalized birthday video: from ${usd(p.base)}
- Your own song: +${usd(p.customSong)}
- Express delivery (12-24h): +${usd(p.expressDelivery)}
- Extended dance version: +${usd(p.danceExtended)}

## Guarantee and support

- 100% money-back guarantee within 7 days of delivery.
- Free remake within 24 hours if the personalization contains an error on our side.
- Photos are deleted within 30 days after delivery.
- Support: support@afrobirthday.com
- Languages: English, French, Spanish, German, Italian, Portuguese, Dutch, Arabic, Hindi, Chinese.

## Key pages

- [Order a video (English)](https://www.afrobirthday.com/en#order)
- [How to order](https://www.afrobirthday.com/en/how-to-order)
- [FAQ](https://www.afrobirthday.com/en/faq)
- [Our story](https://www.afrobirthday.com/en/our-story)
- [Refund policy](https://www.afrobirthday.com/en/refund)
- [Terms](https://www.afrobirthday.com/en/terms)
- [Privacy](https://www.afrobirthday.com/en/privacy)
- [Commander en français](https://www.afrobirthday.com/fr#order)
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
