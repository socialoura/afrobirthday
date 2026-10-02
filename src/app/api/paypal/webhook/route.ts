import { NextResponse } from "next/server";
import { ensureOrdersTable } from "@/lib/db";
import { fulfillPayPalOrder } from "@/lib/orderFulfillment";
import { verifyPayPalWebhook } from "@/lib/paypal";
import { sendTelegramMessage } from "@/lib/telegramBot";

export const runtime = "nodejs";
export const maxDuration = 60;

type PayPalWebhookEvent = {
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    purchase_units?: Array<{ custom_id?: string; reference_id?: string }>;
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

/**
 * Safety net for the return page. Subscribe to CHECKOUT.ORDER.APPROVED and
 * PAYMENT.CAPTURE.COMPLETED in the PayPal developer dashboard and set
 * PAYPAL_WEBHOOK_ID. A customer who approves and then closes the tab never
 * reaches /paypal/success; this captures and fulfills the order anyway.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  let verified = false;
  try {
    verified = await verifyPayPalWebhook(request.headers, rawBody);
  } catch (err) {
    console.error("PayPal webhook verification error:", err);
  }
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as PayPalWebhookEvent;
  const resource = event.resource ?? {};

  let paypalOrderId: string | undefined;
  let orderId: string | undefined;
  if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
    paypalOrderId = resource.id;
    orderId = resource.purchase_units?.[0]?.custom_id ?? resource.purchase_units?.[0]?.reference_id;
  } else if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    paypalOrderId = resource.supplementary_data?.related_ids?.order_id;
    orderId = resource.custom_id;
  } else {
    return NextResponse.json({ received: true });
  }

  if (!paypalOrderId || !orderId) {
    return NextResponse.json({ received: true });
  }

  try {
    await ensureOrdersTable();
    await fulfillPayPalOrder(orderId, paypalOrderId);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("PayPal webhook handler error:", err);
    await sendTelegramMessage(
      `🚨 <b>PayPal webhook failed</b>\nEvent: ${event.event_type}\nCommande <code>${orderId}</code>\nError: ${
        err instanceof Error ? err.message : String(err)
      }`
    ).catch(() => {});
    // 500 makes PayPal retry the delivery.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
