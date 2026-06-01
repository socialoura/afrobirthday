import type { Order } from "@/lib/db";
import { deviceLabel } from "@/lib/device";

type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  fields?: DiscordEmbedField[];
  image?: { url: string };
  thumbnail?: { url: string };
};

type DiscordWebhookPayload = {
  content?: string;
  username?: string;
  embeds?: DiscordEmbed[];
};

export async function sendDiscordWebhook(payload: DiscordWebhookPayload) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Discord webhook failed:", res.status, text);
    }
  } catch (err) {
    console.error("Discord webhook error:", err);
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Sends a rich "paid order" notification to Discord including the customer's
 * birthday message, the uploaded photo (shown inline), and the music link/file.
 */
export async function sendOrderPaidDiscord(params: {
  order: Order;
  provider: "Stripe" | "PayPal";
  amountLabel: string;
  paymentRef?: string | null;
}) {
  const { order, provider, amountLabel, paymentRef } = params;

  const fields: DiscordEmbedField[] = [
    { name: "Order ID", value: String(order.id), inline: true },
    { name: "Email", value: String(order.email ?? "-"), inline: true },
    { name: "Amount", value: amountLabel || "-", inline: true },
    {
      name: "Delivery",
      value: order.delivery_method === "express" ? "Express" : "Standard",
      inline: true,
    },
    {
      name: "Music",
      value: order.music_option === "custom" ? "Custom song" : "We choose",
      inline: true,
    },
    { name: "Provider", value: provider, inline: true },
    { name: "Device", value: deviceLabel(order.device), inline: true },
  ];

  if (order.country) {
    fields.push({ name: "Country", value: String(order.country), inline: true });
  }

  if (order.music_link) {
    fields.push({ name: "🎵 Music link", value: truncate(order.music_link, 1000), inline: false });
  }
  if (order.music_file_url) {
    fields.push({ name: "🎵 Music file", value: truncate(order.music_file_url, 1000), inline: false });
  }
  if (order.photo_url) {
    fields.push({ name: "🖼️ Photo", value: truncate(order.photo_url, 1000), inline: false });
  }
  if (paymentRef) {
    fields.push({ name: "Payment ref", value: String(paymentRef), inline: false });
  }

  await sendDiscordWebhook({
    username: "AfroBirthday",
    embeds: [
      {
        title: "🎉 New paid order",
        description: order.message
          ? `**Birthday message:**\n> ${truncate(order.message, 1500)}`
          : undefined,
        color: 0x22c55e,
        timestamp: new Date().toISOString(),
        fields,
        image: order.photo_url ? { url: order.photo_url } : undefined,
      },
    ],
  });
}
