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

/**
 * Sends a Discord webhook with a file attachment
 * Used to send MP3 files directly to Discord
 */
export async function sendDiscordWebhookWithFile(
  payload: DiscordWebhookPayload,
  fileUrl: string,
  filename: string = "music.mp3"
) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    // Download the file first
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      console.error("Failed to download file:", fileResponse.status);
      return;
    }

    const fileBlob = await fileResponse.blob();
    const fileBuffer = await fileBlob.arrayBuffer();

    // Create FormData with file + payload
    const formData = new FormData();

    // Add the JSON payload
    formData.append(
      "payload_json",
      JSON.stringify({
        username: payload.username,
        content: payload.content,
        embeds: payload.embeds,
      })
    );

    // Add the file
    formData.append("file", new Blob([fileBuffer]), filename);

    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Discord webhook with file failed:", res.status, text);
    }
  } catch (err) {
    console.error("Discord webhook with file error:", err);
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Sends a rich "paid order" notification to Discord including the customer's
 * birthday message, the uploaded photo (shown inline), and the music link/file.
 *
 * NEW: If music_link is provided, downloads the MP3 and attaches it directly to Discord.
 */
export async function sendOrderPaidDiscord(params: {
  order: Order;
  provider: "Stripe" | "PayPal";
  amountLabel: string;
  paymentRef?: string | null;
  downloadedMusicUrl?: string | null;
}) {
  const { order, provider, amountLabel, paymentRef, downloadedMusicUrl } = params;

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
    fields.push({
      name: "🎵 Music link",
      value: truncate(order.music_link, 1000),
      inline: false,
    });
  }

  // Show status if music was downloaded
  if (downloadedMusicUrl) {
    fields.push({
      name: "✅ Music MP3",
      value: "Downloaded and attached below",
      inline: false,
    });
  } else if (order.music_file_url) {
    fields.push({
      name: "🎵 Music file",
      value: truncate(order.music_file_url, 1000),
      inline: false,
    });
  }

  if (order.photo_url) {
    fields.push({
      name: "🖼️ Photo",
      value: truncate(order.photo_url, 1000),
      inline: false,
    });
  }
  if (paymentRef) {
    fields.push({ name: "Payment ref", value: String(paymentRef), inline: false });
  }

  const payload = {
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
  };

  // If we have a downloaded MP3, send it as attachment
  if (downloadedMusicUrl) {
    const filename = `${order.id}-music.mp3`;
    await sendDiscordWebhookWithFile(payload, downloadedMusicUrl, filename);
  } else {
    await sendDiscordWebhook(payload);
  }
}
