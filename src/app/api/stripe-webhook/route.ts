import { NextResponse } from "next/server";
import Stripe from "stripe";
import { markOrderPaid, markOrderCanceled } from "@/lib/db";
import { sendDiscordWebhook } from "@/lib/discordWebhook";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await markOrderPaid(orderId, (session.payment_intent as string | null) ?? null);
      }

      await sendDiscordWebhook({
        username: "AfroBirthday",
        embeds: [
          {
            title: "Payment confirmed",
            color: 0x22c55e,
            timestamp: new Date().toISOString(),
            fields: [
              { name: "Order ID", value: String(orderId ?? "-"), inline: true },
              { name: "Email", value: String(session.customer_email ?? session.metadata?.email ?? "-"), inline: true },
              { name: "Amount total", value: session.amount_total != null ? String(session.amount_total / 100) : "-", inline: true },
              { name: "Currency", value: String(session.currency ?? "-"), inline: true },
              { name: "Payment intent", value: String((session.payment_intent as string | null) ?? "-"), inline: false },
              { name: "Stripe session", value: String(session.id), inline: false },
            ],
          },
        ],
      });
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await markOrderCanceled(orderId);
      }

      await sendDiscordWebhook({
        username: "AfroBirthday",
        embeds: [
          {
            title: "Checkout expired",
            color: 0xef4444,
            timestamp: new Date().toISOString(),
            fields: [
              { name: "Order ID", value: String(orderId ?? "-"), inline: true },
              { name: "Email", value: String(session.customer_email ?? session.metadata?.email ?? "-"), inline: true },
              { name: "Stripe session", value: String(session.id), inline: false },
            ],
          },
        ],
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
