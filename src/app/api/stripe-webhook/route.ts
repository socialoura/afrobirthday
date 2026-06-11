import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ensureOrdersTable, getOrderById, markOrderPaid, markOrderCanceled } from "@/lib/db";
import { sendDiscordWebhook, sendOrderPaidDiscord } from "@/lib/discordWebhook";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderOrderConfirmationEmailHtml,
  renderOrderConfirmationEmailText,
} from "@/lib/orderEmailTemplates";
import { formatStripeAmount } from "@/lib/currency";
import { downloadMusicFromLink } from "@/lib/musicDownloader";

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
          // Download music from link if provided
          let downloadedMusicUrl: string | null = null;
          if (order.music_link && order.music_option === "custom") {
            try {
              const result = await downloadMusicFromLink(order.music_link, order.id);
              if (result.success && result.mp3Url) {
                downloadedMusicUrl = result.mp3Url;
                console.log(`Music downloaded for order ${order.id}:`, downloadedMusicUrl);
              }
            } catch (err) {
              console.error("Failed to download music:", err);
              // Continue anyway - will still show the link
            }
          }

          await sendOrderPaidDiscord({
            order,
            provider: "Stripe",
            amountLabel: formatStripeAmount(paymentIntent.amount, paymentIntent.currency ?? "usd"),
            paymentRef: paymentIntent.id,
            downloadedMusicUrl,
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
          // Download music from link if provided
          let downloadedMusicUrl: string | null = null;
          if (order.music_link && order.music_option === "custom") {
            try {
              const result = await downloadMusicFromLink(order.music_link, order.id);
              if (result.success && result.mp3Url) {
                downloadedMusicUrl = result.mp3Url;
                console.log(`Music downloaded for order ${order.id}:`, downloadedMusicUrl);
              }
            } catch (err) {
              console.error("Failed to download music:", err);
            }
          }

          await sendOrderPaidDiscord({
            order,
            provider: "Stripe",
            amountLabel:
              session.amount_total != null
                ? formatStripeAmount(session.amount_total, session.currency ?? "usd")
                : "-",
            paymentRef: (session.payment_intent as string | null) ?? session.id,
            downloadedMusicUrl,
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
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
