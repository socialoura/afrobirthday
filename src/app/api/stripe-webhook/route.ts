import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ensureOrdersTable, getOrderById, markOrderPaid, markOrderCanceled } from "@/lib/db";
import { sendDiscordWebhook } from "@/lib/discordWebhook";
import { fulfillStripePaymentIntent, runPaidOrderSideEffects } from "@/lib/orderFulfillment";
import { formatStripeAmount } from "@/lib/currency";
import { sendTelegramMessage } from "@/lib/telegramBot";

export const runtime = "nodejs";
// notifyOrderPaid generates the TTS voiceover and downloads the custom song,
// which can exceed the default 10s budget. 60s is the Hobby plan ceiling.
export const maxDuration = 60;

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
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await ensureOrdersTable();
      await fulfillStripePaymentIntent(paymentIntent);
    }

    if (event.type === "payment_intent.canceled") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.orderId;

      await ensureOrdersTable();

      if (orderId) {
        await markOrderCanceled(orderId, { paymentIntentId: paymentIntent.id });
      }

      await sendDiscordWebhook({
        username: "AfroBirthday",
        embeds: [
          {
            title: "Payment canceled",
            color: 0xef4444,
            timestamp: new Date().toISOString(),
            fields: [
              { name: "Order ID", value: String(orderId ?? "-"), inline: true },
              { name: "Payment intent", value: String(paymentIntent.id ?? "-"), inline: false },
            ],
          },
        ],
      });
    }

    // Legacy embedded Checkout (route removed); kept so sessions created before
    // the removal still confirm.
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      await ensureOrdersTable();

      if (orderId && session.payment_status === "paid") {
        const paymentIntentId = (session.payment_intent as string | null) ?? null;
        const claimed = await markOrderPaid(orderId, paymentIntentId);
        const order = claimed ? await getOrderById(orderId) : null;
        if (order) {
          await runPaidOrderSideEffects(order, {
            provider: "Stripe",
            amountLabel:
              session.amount_total != null
                ? formatStripeAmount(session.amount_total, session.currency ?? "usd")
                : "-",
            paymentRef: paymentIntentId ?? session.id,
          });
        }
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await markOrderCanceled(orderId, { sessionId: session.id });
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

    // Refunded or disputed orders must not keep going through production.
    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const charge =
        event.type === "charge.refunded"
          ? (event.data.object as Stripe.Charge)
          : null;
      const dispute =
        event.type === "charge.dispute.created"
          ? (event.data.object as Stripe.Dispute)
          : null;
      const paymentIntentId =
        (charge?.payment_intent as string | null) ??
        (dispute?.payment_intent as string | null) ??
        null;
      const orderId = paymentIntentId
        ? (await stripe.paymentIntents.retrieve(paymentIntentId)).metadata?.orderId
        : undefined;
      const label = dispute ? "⚠️ <b>LITIGE Stripe ouvert</b>" : "↩️ <b>Remboursement Stripe</b>";
      const amount = dispute
        ? formatStripeAmount(dispute.amount, dispute.currency)
        : charge
          ? formatStripeAmount(charge.amount_refunded, charge.currency)
          : "-";
      await sendTelegramMessage(
        `${label}
Commande <code>${orderId ?? "?"}</code>
Montant: ${amount}
PaymentIntent <code>${paymentIntentId ?? "-"}</code>${
          dispute ? `
Motif: ${dispute.reason}` : ""
        }
Vérifier la production de cette commande.`
      ).catch(() => {});
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    await sendTelegramMessage(
      `🚨 <b>Stripe webhook handler failed</b>\nEvent type: ${event.type}\nA payment event may not have been recorded (order not marked paid, or email/notification not sent).\nError: ${
        err instanceof Error ? err.message : String(err)
      }`
    ).catch(() => {});
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
