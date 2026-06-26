import { getAllOrders, type Order } from "@/lib/db";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

// Claude model on Amazon Bedrock (cross-region inference profile ID).
const BEDROCK_MODEL =
  process.env.BEDROCK_MODEL || "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

type ChatMessage = { role: "user" | "assistant"; content: string };

const conversationHistory: Map<string, ChatMessage[]> = new Map();
const HISTORY_MAX = 20;
const HISTORY_TTL = 30 * 60 * 1000; // 30 minutes
const lastActivity: Map<string, number> = new Map();

function getHistory(chatId: string): ChatMessage[] {
  const last = lastActivity.get(chatId) || 0;
  if (Date.now() - last > HISTORY_TTL) {
    conversationHistory.delete(chatId);
  }
  return conversationHistory.get(chatId) || [];
}

function addToHistory(chatId: string, message: ChatMessage) {
  const history = getHistory(chatId);
  history.push(message);
  if (history.length > HISTORY_MAX) {
    history.splice(0, history.length - HISTORY_MAX);
  }
  conversationHistory.set(chatId, history);
  lastActivity.set(chatId, Date.now());
}

// ============================================
// Filtering — shared by the LLM tools
// ============================================

type OrderFilters = {
  email_contains?: string;
  country?: string;
  delivery_method?: "express" | "standard";
  music_option?: "custom" | "preset";
  status?: string;
  order_status?: string;
  created_after?: string;
  created_before?: string;
  message_contains?: string;
  only_pending?: boolean;
  has_video?: boolean;
};

function isPending(o: Order): boolean {
  return (
    o.status === "paid" &&
    o.order_status !== "completed" &&
    o.order_status !== "cancelled" &&
    !o.final_video_url
  );
}

function applyFilters(orders: Order[], f: OrderFilters): Order[] {
  return orders.filter((o) => {
    if (f.email_contains && !o.email?.toLowerCase().includes(f.email_contains.toLowerCase())) return false;
    if (f.country && (o.country || "").toLowerCase() !== f.country.toLowerCase()) return false;
    if (f.delivery_method && o.delivery_method !== f.delivery_method) return false;
    if (f.music_option === "custom" && o.music_option !== "custom") return false;
    if (f.music_option === "preset" && o.music_option === "custom") return false;
    if (f.status && o.status !== f.status) return false;
    if (f.order_status && o.order_status !== f.order_status) return false;
    if (f.created_after && new Date(o.created_at).getTime() < new Date(f.created_after).getTime()) return false;
    if (f.created_before && new Date(o.created_at).getTime() > new Date(f.created_before).getTime()) return false;
    if (f.message_contains && !(o.message || "").toLowerCase().includes(f.message_contains.toLowerCase())) return false;
    if (f.only_pending && !isPending(o)) return false;
    if (f.has_video === true && !o.final_video_url) return false;
    if (f.has_video === false && o.final_video_url) return false;
    return true;
  });
}

function orderToCompact(o: Order): Record<string, unknown> {
  return {
    id: o.id,
    short_id: String(o.id).slice(0, 8),
    date: String(o.created_at).slice(0, 16).replace("T", " "),
    email: o.email,
    amount_usd: Number(o.total_usd),
    currency: o.currency,
    payment_provider: o.payment_provider,
    payment_status: o.status,
    order_status: o.order_status,
    delivery: o.delivery_method,
    country: o.country || null,
    music_option: o.music_option,
    music_link: o.music_link || null,
    uploaded_music_file_url: o.music_file_url || null,
    // true si le client a fourni une musique (lien OU fichier MP3 uploadé)
    music_provided: !!(o.music_link || o.music_file_url),
    customer_message: o.message || null,
    has_photo: !!o.photo_url,
    promo_code: o.promo_code || null,
    discount_usd: Number(o.discount_amount || 0),
    pending: isPending(o),
    video_delivered: !!o.final_video_url,
    video_sent_at: o.final_video_sent_at || null,
    notes: o.notes || null,
  };
}

function computeStats(orders: Order[]) {
  const paid = orders.filter((o) => o.status === "paid");
  const revenue = paid.reduce((s, o) => s + Number(o.total_usd), 0);
  const countries = paid.reduce((acc, o) => {
    if (o.country) acc[o.country] = (acc[o.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const byDelivery = paid.reduce((acc, o) => {
    acc[o.delivery_method] = (acc[o.delivery_method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return {
    matching_orders: orders.length,
    paid_orders: paid.length,
    pending_orders: orders.filter(isPending).length,
    completed_orders: orders.filter((o) => o.order_status === "completed").length,
    cancelled_orders: orders.filter(
      (o) => o.status === "canceled" || o.order_status === "cancelled"
    ).length,
    delivered_videos: orders.filter((o) => o.final_video_url).length,
    revenue_usd: Number(revenue.toFixed(2)),
    avg_order_usd: paid.length ? Number((revenue / paid.length).toFixed(2)) : 0,
    by_country: countries,
    by_delivery: byDelivery,
  };
}

// ============================================
// LLM tool definitions
// ============================================

const tools = [
  {
    name: "query_orders",
    description:
      "Recherche des commandes et renvoie leurs détails complets (email, montant, musique, lien musique, message client, statut, livraison, pays, vidéo livrée, etc.). Utilise ceci pour répondre à TOUTE question sur une ou plusieurs commandes précises.",
    input_schema: {
      type: "object" as const,
      properties: {
        email_contains: { type: "string", description: "Filtre les commandes dont l'email contient ce texte" },
        country: { type: "string", description: "Code pays exact (ex: US, FR)" },
        delivery_method: { type: "string", enum: ["express", "standard"] },
        music_option: { type: "string", enum: ["custom", "preset"], description: "custom = client a fourni son lien musique; preset = nous laisse choisir" },
        status: { type: "string", description: "Statut paiement (paid, canceled, ...)" },
        order_status: { type: "string", description: "Statut production (pending, completed, cancelled, ...)" },
        created_after: { type: "string", description: "Date ISO, commandes après cette date" },
        created_before: { type: "string", description: "Date ISO, commandes avant cette date" },
        message_contains: { type: "string", description: "Recherche dans le message du client (ex: un prénom)" },
        only_pending: { type: "boolean", description: "Seulement les commandes payées en attente de production" },
        has_video: { type: "boolean", description: "true = vidéo déjà livrée, false = pas encore" },
        sort: { type: "string", enum: ["newest", "oldest"], description: "Tri par date (défaut newest)" },
        limit: { type: "number", description: "Nombre max de commandes renvoyées (défaut 20, max 50)" },
      },
    },
  },
  {
    name: "get_stats",
    description:
      "Renvoie des statistiques agrégées (nombre de commandes, revenu total, moyenne, répartition par pays et par livraison) pour les commandes correspondant aux filtres. Utilise ceci pour les questions de comptage / revenu / tendances.",
    input_schema: {
      type: "object" as const,
      properties: {
        country: { type: "string" },
        delivery_method: { type: "string", enum: ["express", "standard"] },
        music_option: { type: "string", enum: ["custom", "preset"] },
        status: { type: "string" },
        order_status: { type: "string" },
        created_after: { type: "string", description: "Date ISO" },
        created_before: { type: "string", description: "Date ISO" },
        only_pending: { type: "boolean" },
      },
    },
  },
];

function runTool(name: string, args: OrderFilters & { sort?: string; limit?: number }, orders: Order[]): unknown {
  if (name === "query_orders") {
    let filtered = applyFilters(orders, args);
    if (args.sort === "oldest") {
      filtered = [...filtered].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    const limit = Math.min(Math.max(args.limit || 20, 1), 50);
    const total = filtered.length;
    const slice = filtered.slice(0, limit);
    return {
      total_matching: total,
      returned: slice.length,
      orders: slice.map(orderToCompact),
    };
  }
  if (name === "get_stats") {
    return computeStats(applyFilters(orders, args));
  }
  return { error: `Outil inconnu: ${name}` };
}

// ============================================
// Main entry
// ============================================

let bedrockClient: AnthropicBedrock | null = null;

function getBedrockClient(): AnthropicBedrock | null {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return null;
  }
  if (!bedrockClient) {
    bedrockClient = new AnthropicBedrock({
      awsRegion: process.env.AWS_REGION || "us-east-1",
      awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
      awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
      awsSessionToken: process.env.AWS_SESSION_TOKEN,
    });
  }
  return bedrockClient;
}

export async function answerQuestion(question: string, chatId: string): Promise<string> {
  const client = getBedrockClient();
  if (!client) return "❌ Identifiants AWS Bedrock non configurés.";

  // Loaded once per question; tools read from this in-memory snapshot.
  const orders = await getAllOrders();
  const globalStats = computeStats(orders);

  const systemPrompt = `Tu es l'assistant IA d'AfroBirthday, un service de vidéos d'anniversaire personnalisées.
Tu réponds au propriétaire sur ses commandes, son business, ses stats — tu peux répondre à N'IMPORTE QUELLE question sur les données.

Tu as accès à des OUTILS pour interroger la base de commandes en temps réel:
- query_orders: détails complets d'une ou plusieurs commandes (utilise-le dès qu'on parle d'une commande précise, d'un client, d'une musique, d'un message...)
- get_stats: chiffres agrégés (comptes, revenu, répartitions)
Appelle ces outils autant de fois que nécessaire avant de répondre. Ne devine jamais: si tu as besoin d'une donnée, va la chercher avec un outil.

Aperçu global actuel (pour info, utilise les outils pour le détail):
- Commandes payées: ${globalStats.paid_orders}
- En attente de production: ${globalStats.pending_orders}
- Complétées: ${globalStats.completed_orders}
- Revenu total payé: $${globalStats.revenue_usd}

Notes importantes:
- music_option "custom" = le client a fourni SA propre musique, soit via un lien (music_link), soit en uploadant un fichier MP3 (uploaded_music_file_url). Le champ music_provided=true signifie qu'une musique a bien été fournie (lien OU fichier). "preset"/"au choix" = il nous laisse choisir.
- Les commandes sont triées de la plus récente à la plus ancienne. Quand on dit "elle", "ce client", "la dernière commande" sans préciser, c'est la commande la plus récente (utilise query_orders avec limit 1, sort newest).
- Réponds en français, concis, formaté pour Telegram (texte simple, pas de markdown lourd). Emojis si pertinent.
- Date d'aujourd'hui: ${new Date().toISOString().slice(0, 10)}
- Utilise le contexte de la conversation pour comprendre les pronoms et références.`;

  // Anthropic Messages API: system is separate, messages alternate user/assistant.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    ...getHistory(chatId),
    { role: "user", content: question },
  ];

  try {
    const MAX_TOOL_ROUNDS = 6;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: BEDROCK_MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: tools as any,
        messages,
      });

      if (response.stop_reason === "tool_use") {
        // Record the assistant turn (with its tool_use blocks), then answer each one.
        messages.push({ role: "assistant", content: response.content });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolResults: any[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const result = runTool(
            block.name,
            (block.input || {}) as OrderFilters & { sort?: string; limit?: number },
            orders
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
        messages.push({ role: "user", content: toolResults });
        continue; // loop again so the model can use the results
      }

      const answer = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim();

      const finalAnswer = answer || "❌ Pas de réponse.";
      addToHistory(chatId, { role: "user", content: question });
      addToHistory(chatId, { role: "assistant", content: finalAnswer });
      return finalAnswer;
    }

    return "❌ Trop d'étapes pour répondre, reformule ta question.";
  } catch (err) {
    console.error("AI chat error:", err);
    return `❌ Erreur IA: ${err instanceof Error ? err.message : String(err)}`;
  }
}
