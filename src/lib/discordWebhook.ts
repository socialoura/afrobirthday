import type { Order } from "@/lib/db";
import type { VoiceoverResult } from "@/lib/voiceover";
import { deviceLabel } from "@/lib/device";
import { createUploadToken } from "@/lib/auth";
import { resolveNotificationUrl } from "@/lib/siteUrl";

// Discord notifications are disabled — Telegram is used instead.
const DISCORD_DISABLED = true;

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
  if (DISCORD_DISABLED) return;
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
  if (DISCORD_DISABLED) return;
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
  voiceoverUrl?: string | null;
}) {
  const { order, provider, amountLabel, paymentRef, downloadedMusicUrl, voiceoverUrl } =
    params;

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
  }

  // Voiceover of a non-English message — sent as a separate message below.
  if (voiceoverUrl) {
    fields.push({
      name: "🗣️ Voix (message non-anglais)",
      value: "Lecture audio du message attachée ci-dessous",
      inline: false,
    });
  }

  if (!downloadedMusicUrl && order.music_file_url) {
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
    const siteUrl = resolveNotificationUrl();
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

  // The webhook file slot is taken by the music MP3, so the voiceover (when the
  // message isn't English) goes out as its own follow-up message with the MP3
  // attached.
  if (voiceoverUrl) {
    await sendDiscordWebhookWithFile(
      {
        username: "AfroBirthday",
        content: `🗣️ **Lecture audio du message (langue du client) :**\n\n📥 **Lien direct:** ${voiceoverUrl}`,
      },
      voiceoverUrl,
      `${order.id}-voiceover.mp3`
    );
  }
}

/**
 * Shared by all paid-confirmation paths. Existing music is attached immediately;
 * link downloads run durably on the VPS and are sent separately by the same bot.
 */
const MEDIA_DEADLINE_MS = 30_000;

export async function notifyOrderPaid(params: {
  order: Order;
  provider: "Stripe" | "PayPal";
  amountLabel: string;
  paymentRef?: string | null;
}) {
  const { order } = params;

  const persistMedia = async (media: {
    voiceoverUrl?: string | null;
    downloadedMusicUrl?: string | null;
  }) => {
    try {
      const { setOrderMedia } = await import("@/lib/db");
      await setOrderMedia(order.id, media);
    } catch (err) {
      console.error("Failed to persist order media:", err);
    }
  };

  // The VPS downloads independently of the payment function's 60s lifetime.
  // A customer's MP3 or a previously saved download never needs re-fetching.
  const musicPromise = (async () => {
    if (order.music_option !== "custom" || !order.music_link || order.music_file_url || order.downloaded_music_url) return { queued: false, error: undefined };
    const { queueMusicDownload } = await import("@/lib/musicDownloader");
    return queueMusicDownload(order.music_link, order.id);
  })();

  const voicePromise = (async (): Promise<VoiceoverResult> => {
    if (!order.message) return { ok: false, reason: "empty-message" };
    try {
      const { generateVoiceoverIfNonEnglish } = await import("@/lib/voiceover");
      const result = await generateVoiceoverIfNonEnglish(order.message, order.id);
      if (result.ok) {
        console.log(`Voiceover generated for order ${order.id}:`, result.url);
      } else {
        console.warn(`No voiceover for order ${order.id}:`, result.reason, result.detail ?? "");
      }
      return result;
    } catch (err) {
      console.error("Failed to generate voiceover:", err);
      return {
        ok: false,
        reason: "exception",
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  })();

  // Persist each result the moment it lands, independently of the deadline.
  const persistedVoice = voicePromise.then(async (result) => {
    if (result.ok) await persistMedia({ voiceoverUrl: result.url });
    return result;
  });


  // Bound the voiceover wait. Music queueing has its own eight-second timeout.
  let deadlineTimer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<"timeout">((resolve) => {
    deadlineTimer = setTimeout(() => resolve("timeout"), MEDIA_DEADLINE_MS);
  });
  const voiceRace = await Promise.race([persistedVoice, deadline]);
  clearTimeout(deadlineTimer!);
  // Past the deadline the vocal is still being generated (with retries): the
  // notification says so, and the vocal follows in its own message below.
  const voicePending = voiceRace === "timeout";
  const voiceover: VoiceoverResult = voicePending
    ? { ok: false, reason: "timeout", detail: "vocal encore en cours" }
    : voiceRace;
  const musicResult = await musicPromise;
  const downloadedMusicUrl = order.downloaded_music_url || null;

  const voiceoverUrl = voiceover.ok ? voiceover.url : null;
  await sendOrderPaidDiscord({ ...params, downloadedMusicUrl, voiceoverUrl });

  // Also notify via Telegram bot
  try {
    const { sendNewOrderNotification } = await import("@/lib/telegramBot");
    await sendNewOrderNotification({
      order,
      provider: params.provider,
      amountLabel: params.amountLabel,
      voiceover,
      voicePending,
      downloadedMusicUrl,
      musicPending: musicResult.queued,
      musicFailure: musicResult.error,
    });
  } catch (err) {
    console.error("Telegram notification error:", err);
  }

  // Keep the function alive until the late vocal is persisted and delivered;
  // generateVoiceover bounds its own retries, so this cannot hang.
  if (voicePending) {
    const late = await persistedVoice;
    try {
      const { sendLateVoiceoverNotification } = await import("@/lib/telegramBot");
      await sendLateVoiceoverNotification(order, late);
    } catch (err) {
      console.error("Late voiceover notification error:", err);
    }
  }
}
