type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  timestamp?: string;
  fields?: DiscordEmbedField[];
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
