import { getAllOrders, type Order } from "@/lib/db";

const OPENAI_CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";

function summarizeOrders(orders: Order[]): string {
  const paid = orders.filter((o) => o.status === "paid");
  const pending = paid.filter(
    (o) =>
      o.order_status !== "completed" &&
      o.order_status !== "cancelled" &&
      !o.final_video_url
  );
  const completed = orders.filter((o) => o.order_status === "completed");
  const cancelled = orders.filter(
    (o) => o.status === "canceled" || o.order_status === "cancelled"
  );

  const now = Date.now();
  const last30d = paid.filter(
    (o) => now - new Date(o.created_at).getTime() < 30 * 24 * 60 * 60 * 1000
  );
  const last7d = paid.filter(
    (o) => now - new Date(o.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
  );
  const today = paid.filter(
    (o) => new Date(o.created_at).toDateString() === new Date().toDateString()
  );

  const totalRevenue = paid.reduce((sum, o) => sum + Number(o.total_usd), 0);
  const last30dRevenue = last30d.reduce(
    (sum, o) => sum + Number(o.total_usd),
    0
  );
  const last7dRevenue = last7d.reduce(
    (sum, o) => sum + Number(o.total_usd),
    0
  );

  const countries = paid.reduce(
    (acc, o) => {
      if (o.country) acc[o.country] = (acc[o.country] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const topCountries = Object.entries(countries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([c, n]) => `${c}: ${n}`)
    .join(", ");

  let summary = `=== STATS GLOBALES ===\n`;
  summary += `Total commandes payées: ${paid.length}\n`;
  summary += `Commandes complétées: ${completed.length}\n`;
  summary += `Commandes annulées: ${cancelled.length}\n`;
  summary += `En attente de production: ${pending.length}\n`;
  summary += `Revenue total (USD): $${totalRevenue.toFixed(2)}\n\n`;

  summary += `=== PERIODES ===\n`;
  summary += `Aujourd'hui: ${today.length} commandes\n`;
  summary += `7 derniers jours: ${last7d.length} commandes, $${last7dRevenue.toFixed(2)}\n`;
  summary += `30 derniers jours: ${last30d.length} commandes, $${last30dRevenue.toFixed(2)}\n\n`;

  summary += `=== TOP PAYS ===\n${topCountries}\n\n`;

  summary += `=== COMMANDES RECENTES (50 dernieres payées) ===\n`;
  for (const o of paid.slice(0, 50)) {
    const age = Math.floor(
      (now - new Date(o.created_at).getTime()) / (1000 * 60 * 60)
    );
    const ageLabel = age < 24 ? `${age}h` : `${Math.floor(age / 24)}j`;
    summary += `- ${String(o.created_at).slice(0, 10)} | ${o.email} | $${Number(o.total_usd).toFixed(2)} | ${o.delivery_method} | ${o.country || "?"} | status: ${o.order_status} | age: ${ageLabel}`;
    if (o.final_video_url) summary += ` | ✅ vidéo livrée`;
    if (o.final_video_sent_at) summary += ` | ✅ email envoyé`;
    summary += `\n`;
  }

  if (pending.length > 0) {
    summary += `\n=== EN ATTENTE DE PRODUCTION ===\n`;
    for (const o of pending) {
      const age = Math.floor(
        (now - new Date(o.created_at).getTime()) / (1000 * 60 * 60)
      );
      const ageLabel = age < 24 ? `${age}h` : `${Math.floor(age / 24)}j`;
      const isExpress = o.delivery_method === "express";
      const overdue =
        (isExpress && age > 24) || (!isExpress && age > 48)
          ? " ⚠️ EN RETARD"
          : "";
      summary += `- ${o.email} | ${isExpress ? "EXPRESS" : "Standard"} | age: ${ageLabel}${overdue}\n`;
    }
  }

  return summary;
}

export async function answerQuestion(question: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "❌ OPENAI_API_KEY non configurée.";

  const orders = await getAllOrders();
  const context = summarizeOrders(orders);

  const systemPrompt = `Tu es l'assistant IA d'AfroBirthday, un service de vidéos d'anniversaire personnalisées.
Tu réponds aux questions du propriétaire sur ses commandes, son business, ses stats.
Réponds de façon concise et utile, en français. Utilise des emojis si pertinent.
Tu as accès aux données suivantes:

${context}

Règles:
- Réponds uniquement basé sur les données ci-dessus
- Si tu ne peux pas répondre, dis-le
- Sois concis (max 500 caractères sauf si on te demande un détail)
- Formate pour Telegram (texte simple, pas de markdown complexe)
- Date d'aujourd'hui: ${new Date().toISOString().slice(0, 10)}`;

  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      console.error("OpenAI chat error:", response.status, err);
      return "❌ Erreur lors de la requête IA.";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "❌ Pas de réponse.";
  } catch (err) {
    console.error("AI chat error:", err);
    return "❌ Erreur interne.";
  }
}
