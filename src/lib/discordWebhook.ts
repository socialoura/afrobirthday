import type { Order } from "@/lib/db";
import { deviceLabel } from "@/lib/device";
import { createUploadToken } from "@/lib/auth";

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

// Resolves the public base URL for building customer/admin links. Prefers an
// explicit NEXT_PUBLIC_SITE_URL (but ignores localhost, which is useless in a
// Discord notification opened on a phone), then falls back to the Vercel-
// provided production domain, then a sane default.
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit && !/localhost|127\.0\.0\.1/.test(explicit)) {
    return explicit.replace(/\/$/, "");
  }
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "https://afrobirthday.com";
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

  // One-tap magic link to the mobile page where the final video is uploaded and
  // delivered for this exact order — no admin login or order search needed.
  try {
    const siteUrl = resolveSiteUrl();
    const uploadToken = createUploadToken(String(order.id));
    fields.push({
      name: "🎬 Uploader la vidéo finale",
      value: `${siteUrl}/admin/upload/${order.id}?t=${uploadToken}`,
      inline: false,
    });
  } catch (err) {
    // Missing ADMIN_TOKEN_SECRET shouldn't block the order notification.
    console.error("Failed to build upload magic link:", err);
  }

  // Add copyable message text before the embed (mobile-friendly)
  // The label is OUTSIDE the code block so it's not copied
  const contentLines: string[] = [];

  if (order.message) {
    contentLines.push("📝 **MESSAGE À COPIER (pour la vidéo) :**");
    contentLines.push("```");
    contentLines.push(order.message);
    contentLines.push("```");
    contentLines.push(""); // Empty line for spacing
  }

  const payload = {
    username: "AfroBirthday",
    content: contentLines.length > 0 ? contentLines.join("\n") : undefined,
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

/**
 * Single entry point for the "paid order" Discord notification: downloads the
 * custom song MP3 from its link (best-effort) and then sends the rich embed,
 * attaching the MP3 when available. Shared by every payment-confirmation path
 * (Stripe client confirm, Stripe webhook, PayPal capture) so the MP3 is always
 * attached regardless of which path wins the paid-dedup race.
 */
export async function notifyOrderPaid(params: {
  order: Order;
  provider: "Stripe" | "PayPal";
  amountLabel: string;
  paymentRef?: string | null;
}) {
  const { order } = params;

  let downloadedMusicUrl: string | null = null;
  if (order.music_link && order.music_option === "custom") {
    try {
      const { downloadMusicFromLink } = await import("@/lib/musicDownloader");
      const result = await downloadMusicFromLink(order.music_link, order.id);
      if (result.success && result.mp3Url) {
        downloadedMusicUrl = result.mp3Url;
        console.log(`Music downloaded for order ${order.id}:`, downloadedMusicUrl);
      }
    } catch (err) {
      console.error("Failed to download music:", err);
      // Continue anyway — the notification still includes the link.
    }
  }

  await sendOrderPaidDiscord({ ...params, downloadedMusicUrl });
}
