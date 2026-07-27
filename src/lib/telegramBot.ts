import type { Order } from "@/lib/db";
import type { VoiceoverResult } from "@/lib/voiceover";
import { describeVoiceoverFailure } from "@/lib/voiceover";
import { createUploadToken } from "@/lib/auth";

const TELEGRAM_API = "https://api.telegram.org/bot";

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

function getChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID || null;
}

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

async function telegramRequest(method: string, body: Record<string, unknown>) {
  const token = getBotToken();
  if (!token) return null;

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Telegram ${method} failed:`, res.status, text);
    }
    return res;
  } catch (err) {
    console.error(`Telegram ${method} error:`, err);
    return null;
  }
}

export async function sendTelegramMessage(
  text: string,
  chatId?: string,
  parseMode: "HTML" | "MarkdownV2" = "HTML"
) {
  const targetChat = chatId || getChatId();
  if (!targetChat) return;

  await telegramRequest("sendMessage", {
    chat_id: targetChat,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

export async function sendTelegramPhoto(
  photoUrl: string,
  caption: string,
  chatId?: string
) {
  const targetChat = chatId || getChatId();
  if (!targetChat) return;

  await telegramRequest("sendPhoto", {
    chat_id: targetChat,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
  });
}

export async function sendTelegramAudio(
  audioUrl: string,
  caption: string,
  chatId?: string
) {
  const targetChat = chatId || getChatId();
  if (!targetChat) return;

  await telegramRequest("sendAudio", {
    chat_id: targetChat,
    audio: audioUrl,
    caption,
    parse_mode: "HTML",
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatOrderAge(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j ${hours % 24}h`;
}

export async function sendNewOrderNotification(params: {
  order: Order;
  provider: "Stripe" | "PayPal";
  amountLabel: string;
  voiceover: VoiceoverResult;
  downloadedMusicUrl?: string | null;
}) {
  const { order, provider, amountLabel, voiceover, downloadedMusicUrl } = params;
  const voiceoverUrl = voiceover.ok ? voiceover.url : null;

  const siteUrl = resolveSiteUrl();
  let uploadLink = "";
  let recapLink = "";
  try {
    const uploadToken = createUploadToken(String(order.id));
    uploadLink = `${siteUrl}/admin/upload/${order.id}?t=${uploadToken}`;
    recapLink = `${siteUrl}/admin/recap/${order.id}?t=${uploadToken}`;
  } catch {
    // Missing secret shouldn't block notification
  }

  const deliveryEmoji = order.delivery_method === "express" ? "⚡" : "📦";
  const deliveryLabel = order.delivery_method === "express" ? "EXPRESS" : "Standard";

  let message = `🎉 <b>Nouvelle commande payée !</b>\n\n`;
  message += `<b>ID:</b> <code>${order.id}</code>\n`;
  message += `<b>Email:</b> ${escapeHtml(order.email)}\n`;
  message += `<b>Montant:</b> ${escapeHtml(amountLabel)}\n`;
  message += `<b>Paiement:</b> ${provider}\n`;
  message += `${deliveryEmoji} <b>Livraison:</b> ${deliveryLabel}\n`;
  message += `<b>Musique:</b> ${order.music_option === "custom" ? "Custom" : "Au choix"}\n`;

  if (order.country) {
    message += `<b>Pays:</b> ${order.country}\n`;
  }

  if (order.music_link) {
    message += `\n🎵 <b>Lien musique :</b>\n${escapeHtml(order.music_link)}\n`;
  }

  if (downloadedMusicUrl) {
    message += `✅ MP3 téléchargé\n`;
  }

  // Always report the voiceover outcome. A silently missing line used to be the
  // only symptom when TTS failed, so nobody noticed the vocal was gone.
  if (voiceover.ok) {
    message += `🗣️ Voiceover généré\n`;
  } else if (voiceover.reason === "skipped-english") {
    message += `🇬🇧 Pas de vocal — message jugé anglais\n`;
  } else if (voiceover.reason === "empty-message") {
    message += `🗣️ Pas de vocal — aucun message\n`;
  } else {
    message += `⚠️ <b>Voiceover ÉCHOUÉ</b> — ${escapeHtml(
      describeVoiceoverFailure(voiceover.reason)
    )}\n`;
    if (voiceover.detail) {
      message += `<code>${escapeHtml(voiceover.detail.slice(0, 200))}</code>\n`;
    }
  }

  if (recapLink) {
    message += `\n📦 <b>Tout pour WeChat (récap) :</b>\n${recapLink}\n`;
  }

  if (uploadLink) {
    message += `\n🎬 <b>Uploader la vidéo :</b>\n${uploadLink}\n`;
  }

  // Send main text message
  await sendTelegramMessage(message);

  // Send customer message in a separate message
  if (order.message?.trim()) {
    await sendTelegramMessage(
      escapeHtml(order.message)
    );
  }

  // Send photo if available
  if (order.photo_url) {
    await sendTelegramPhoto(
      order.photo_url,
      `🖼️ Photo pour la commande <code>${order.id.slice(0, 8)}</code>`
    );
  }

  // Send voiceover audio if available
  if (voiceoverUrl) {
    await sendTelegramAudio(
      voiceoverUrl,
      `🗣️ Voiceover — <code>${order.id.slice(0, 8)}</code>`
    );
  }

  // Send downloaded music if available
  if (downloadedMusicUrl) {
    await sendTelegramAudio(
      downloadedMusicUrl,
      `🎵 Musique — <code>${order.id.slice(0, 8)}</code>`
    );
  }
}

export async function sendOverdueAlerts(overdueOrders: Order[]) {
  if (overdueOrders.length === 0) return;

  let message = `⚠️ <b>COMMANDES EN RETARD (${overdueOrders.length})</b>\n\n`;

  for (const order of overdueOrders) {
    const age = formatOrderAge(order.created_at);
    const isExpress = order.delivery_method === "express";
    const emoji = isExpress ? "🔴" : "🟠";
    const type = isExpress ? "EXPRESS" : "Standard";

    message += `${emoji} <b>${type}</b> — ${age} ago\n`;
    message += `   Email: ${escapeHtml(order.email)}\n`;
    message += `   ID: <code>${order.id.slice(0, 8)}</code>\n\n`;
  }

  message += `💡 Utilise /orders pour voir la queue complète`;

  await sendTelegramMessage(message);
}

export function buildOrdersListMessage(orders: Order[]): string {
  if (orders.length === 0) {
    return "✅ <b>Aucune commande en attente !</b>\n\nToutes les commandes sont livrées 🎉";
  }

  const siteUrl = resolveSiteUrl();
  let message = `📋 <b>Queue de production (${orders.length})</b>\n\n`;

  for (const order of orders.slice(0, 15)) {
    const age = formatOrderAge(order.created_at);
    const isExpress = order.delivery_method === "express";
    const isOverdue =
      (isExpress && Date.now() - new Date(order.created_at).getTime() > 24 * 60 * 60 * 1000) ||
      (!isExpress && Date.now() - new Date(order.created_at).getTime() > 48 * 60 * 60 * 1000);

    const statusEmoji = isOverdue ? "🔴" : isExpress ? "⚡" : "📦";
    const deliveryLabel = isExpress ? "EXP" : "STD";

    message += `${statusEmoji} <b>${deliveryLabel}</b> | ${age} | ${escapeHtml(order.email)}\n`;

    let uploadLink = "";
    try {
      const uploadToken = createUploadToken(String(order.id));
      uploadLink = `${siteUrl}/admin/upload/${order.id}?t=${uploadToken}`;
    } catch {
      // ignore
    }

    if (uploadLink) {
      message += `   🎬 <a href="${uploadLink}">Upload vidéo</a>\n`;
    }
    message += `\n`;
  }

  if (orders.length > 15) {
    message += `\n... et ${orders.length - 15} autres commandes`;
  }

  return message;
}

export function getOverdueOrders(orders: Order[]): Order[] {
  const now = Date.now();
  return orders.filter((order) => {
    if (order.status !== "paid") return false;
    if (order.order_status === "completed" || order.order_status === "cancelled") return false;
    if (order.final_video_url) return false;

    const age = now - new Date(order.created_at).getTime();
    const isExpress = order.delivery_method === "express";
    const threshold = isExpress ? 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;

    return age > threshold;
  });
}

export function getPendingOrders(orders: Order[]): Order[] {
  return orders
    .filter((order) => {
      if (order.status !== "paid") return false;
      if (order.order_status === "completed" || order.order_status === "cancelled") return false;
      if (order.final_video_url) return false;
      return true;
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}
