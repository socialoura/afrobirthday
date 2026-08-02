import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ensureOrdersTable, getOrderById, markOrderPaid, markOrderCanceled, incrementPromoCodeUsage } from "@/lib/db";
import { sendDiscordWebhook, notifyOrderPaid } from "@/lib/discordWebhook";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderOrderConfirmationEmailHtml,
  renderOrderConfirmationEmailText,
} from "@/lib/orderEmailTemplates";
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
      const orderId = paymentIntent.metadata?.orderId;

      await ensureOrdersTable();

      const existingOrder = orderId ? await getOrderById(orderId) : null;
      const wasAlreadyPaid = existingOrder?.status === "paid";

      if (orderId && !wasAlreadyPaid) {
        await markOrderPaid(orderId, paymentIntent.id);
      }

      if (orderId && !wasAlreadyPaid) {
        const order = (await getOrderById(orderId)) ?? existingOrder;

        if (order?.promo_code) {
          await incrementPromoCodeUsage(order.promo_code).catch((err) =>
            console.error("Failed to increment promo code usage (Stripe PI):", err)
          );
        }

        if (order?.email) {
          try {
            await sendEmailWithResend({
              to: order.email,
              subject: `AfroBirthday order confirmation (${order.id})`,
              html: renderOrderConfirmationEmailHtml(order),
              text: renderOrderConfirmationEmailText(order),
            });
          } catch (emailErr) {
            console.error("Failed to send order confirmation email (Stripe PI):", emailErr);
          }
        }

        if (order) {
          await notifyOrderPaid({
            order,
            provider: "Stripe",
            amountLabel: formatStripeAmount(paymentIntent.amount, paymentIntent.currency ?? "usd"),
            paymentRef: paymentIntent.id,
          });
        }
      }
    }

    if (event.type === "payment_intent.canceled") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.orderId;

      await ensureOrdersTable();

      if (orderId) {
        await markOrderCanceled(orderId);
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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      await ensureOrdersTable();

      const existingOrder = orderId ? await getOrderById(orderId) : null;
      const wasAlreadyPaid = existingOrder?.status === "paid";

      if (orderId && !wasAlreadyPaid) {
        await markOrderPaid(orderId, (session.payment_intent as string | null) ?? null);
      }

      if (orderId && !wasAlreadyPaid) {
        const order = (await getOrderById(orderId)) ?? existingOrder;

        if (order?.promo_code) {
          await incrementPromoCodeUsage(order.promo_code).catch((err) =>
            console.error("Failed to increment promo code usage (Stripe):", err)
          );
        }

        if (order?.email) {
          try {
            await sendEmailWithResend({
              to: order.email,
              subject: `AfroBirthday order confirmation (${order.id})`,
              html: renderOrderConfirmationEmailHtml(order),
              text: renderOrderConfirmationEmailText(order),
            });
          } catch (emailErr) {
            console.error("Failed to send order confirmation email (Stripe):", emailErr);
          }
        }

        if (order) {
          await notifyOrderPaid({
            order,
            provider: "Stripe",
            amountLabel:
              session.amount_total != null
                ? formatStripeAmount(session.amount_total, session.currency ?? "usd")
                : "-",
            paymentRef: (session.payment_intent as string | null) ?? session.id,
          });
        }
      }
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
    await sendTelegramMessage(
      `🚨 <b>Stripe webhook handler failed</b>\nEvent type: ${event.type}\nA payment event may not have been recorded (order not marked paid, or email/notification not sent).\nError: ${
        err instanceof Error ? err.message : String(err)
      }`
    ).catch(() => {});
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
