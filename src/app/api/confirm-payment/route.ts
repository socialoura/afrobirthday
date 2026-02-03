import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ensureOrdersTable, getOrderById, markOrderPaid } from "@/lib/db";
import { sendDiscordWebhook } from "@/lib/discordWebhook";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderOrderConfirmationEmailHtml,
  renderOrderConfirmationEmailText,
} from "@/lib/orderEmailTemplates";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, orderId } = body as {
      paymentIntentId?: string;
      orderId?: string;
    };

    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return NextResponse.json({ error: "Missing paymentIntentId" }, { status: 400 });
    }
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    // Verify payment status directly with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment not succeeded", status: paymentIntent.status },
        { status: 400 }
      );
    }

    // Check if orderId matches the one in metadata (security check)
    if (paymentIntent.metadata?.orderId !== orderId) {
      return NextResponse.json({ error: "Order ID mismatch" }, { status: 400 });
    }

    await ensureOrdersTable();

    const existingOrder = await getOrderById(orderId);
    const wasAlreadyPaid = existingOrder?.status === "paid";

    if (wasAlreadyPaid) {
      // Already processed, just return success
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    // Mark order as paid
    await markOrderPaid(orderId, paymentIntentId);

    // Get updated order for email
    const order = (await getOrderById(orderId)) ?? existingOrder;

    // Send confirmation email
    if (order?.email) {
      try {
        await sendEmailWithResend({
          to: order.email,
          subject: `AfroBirthday order confirmation (${order.id})`,
          html: renderOrderConfirmationEmailHtml(order),
          text: renderOrderConfirmationEmailText(order),
        });
      } catch (emailErr) {
        console.error("Failed to send order confirmation email:", emailErr);
      }
    }

    // Send Discord notification
    await sendDiscordWebhook({
      username: "AfroBirthday",
      embeds: [
        {
          title: "💳 Payment confirmed (Stripe)",
          color: 0x22c55e,
          timestamp: new Date().toISOString(),
          fields: [
            { name: "Order ID", value: String(orderId), inline: true },
            { name: "Email", value: String(order?.email ?? paymentIntent.receipt_email ?? "-"), inline: true },
            { name: "Amount", value: `$${(paymentIntent.amount / 100).toFixed(2)}`, inline: true },
            { name: "Currency", value: String(paymentIntent.currency?.toUpperCase() ?? "USD"), inline: true },
            { name: "Payment Intent", value: String(paymentIntentId), inline: false },
          ],
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Confirm payment error:", error);
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
}
