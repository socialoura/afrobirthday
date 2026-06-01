import type { Order } from "@/lib/db";

export function renderOrderConfirmationEmailHtml(order: Order) {
  const createdAt = order.created_at ? new Date(order.created_at).toLocaleString() : "";
  const delivery = order.delivery_method === "express" ? "Express (12-24 hours)" : "Standard (24-48 hours)";
  const music = order.music_option === "custom" ? "Custom song" : "We choose music";

  return `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color: #111;">
      <h2 style="margin:0 0 12px;">Thanks for your order 🎂</h2>
      <p style="margin:0 0 16px;">We received your order and payment successfully.</p>

      <div style="border:1px solid #eee; border-radius:12px; padding:16px;">
        <h3 style="margin:0 0 12px;">Order details</h3>
        <p style="margin:0 0 6px;"><strong>Order ID:</strong> ${order.id}</p>
        ${createdAt ? `<p style="margin:0 0 6px;"><strong>Date:</strong> ${createdAt}</p>` : ""}
        <p style="margin:0 0 6px;"><strong>Total:</strong> ${formatOrderTotal(order)}</p>
        <p style="margin:0 0 6px;"><strong>Delivery:</strong> ${delivery}</p>
        <p style="margin:0 0 6px;"><strong>Music:</strong> ${music}</p>
        ${order.music_link ? `<p style="margin:0 0 6px;"><strong>Music link:</strong> ${escapeHtml(order.music_link)}</p>` : ""}
        <p style="margin:12px 0 0;"><strong>Message:</strong><br/>${escapeHtml(order.message)}</p>
      </div>

      <p style="margin:16px 0 0;">
        We’ll deliver your video by email as soon as it’s ready.
      </p>

      <p style="margin:16px 0 0; font-size: 12px; color: #555;">
        Need help? Reply to this email.
      </p>
    </div>
  `;
}

export function renderFinalVideoEmailHtml(order: Order, videoUrl: string) {
  const safeUrl = escapeHtml(videoUrl);
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 16px;">
      <p style="margin:0 0 16px;">Hi,</p>

      <p style="margin:0 0 16px;">
        Your personalized birthday video is ready. You can view and download it from the link below.
      </p>

      <p style="margin: 0 0 16px;">
        <a href="${safeUrl}" style="color: #c2410c; text-decoration: underline; font-weight: 600;">
          View your video
        </a>
      </p>

      <p style="margin:0 0 16px; font-size: 14px; color:#555;">
        If the link above doesn't open, copy and paste this URL into your browser:<br/>
        <span style="word-break: break-all;">${safeUrl}</span>
      </p>

      <p style="margin:0 0 16px;">
        Your order reference is <strong>${order.id}</strong>. We'd love to hear what you think — just reply to this email if you have any feedback or questions.
      </p>

      <p style="margin:0 0 16px;">
        Thanks for choosing AfroBirthday,<br/>
        The AfroBirthday team
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />

      <p style="margin:0; font-size: 12px; color: #888;">
        AfroBirthday — Personalized birthday videos<br/>
        Support: <a href="mailto:support@afrobirthday.com" style="color: #888;">support@afrobirthday.com</a><br/>
        You're receiving this email because you placed an order on afrobirthday.com.
      </p>
    </div>
  `;
}

export function renderFinalVideoEmailText(order: Order, videoUrl: string) {
  return [
    "Hi,",
    "",
    "Your personalized birthday video is ready. You can view and download it from the link below:",
    videoUrl,
    "",
    `Your order reference is ${order.id}. We'd love to hear what you think — just reply to this email if you have any feedback or questions.`,
    "",
    "Thanks for choosing AfroBirthday,",
    "The AfroBirthday team",
    "",
    "—",
    "AfroBirthday — Personalized birthday videos",
    "Support: support@afrobirthday.com",
    "You're receiving this email because you placed an order on afrobirthday.com.",
  ].join("\n");
}

export function renderOrderConfirmationEmailText(order: Order) {
  const delivery = order.delivery_method === "express" ? "Express (12-24 hours)" : "Standard (24-48 hours)";
  const music = order.music_option === "custom" ? "Custom song" : "We choose music";

  return [
    "Thanks for your order!",
    "",
    `Order ID: ${order.id}`,
    `Total: ${formatOrderTotal(order)}`,
    `Delivery: ${delivery}`,
    `Music: ${music}`,
    order.music_link ? `Music link: ${order.music_link}` : "",
    "",
    "Message:",
    order.message,
    "",
    "We’ll deliver your video by email as soon as it’s ready.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Shows the amount the customer was actually charged. When the order was paid
 * in a non-USD currency, the USD equivalent is appended for reference.
 */
function formatOrderTotal(order: Order) {
  const currency = (order.currency || "USD").toUpperCase();
  const usd = `$${Number(order.total_usd).toFixed(2)} USD`;

  if (currency === "USD" || order.total_local == null) {
    return usd;
  }

  const localValue = Number(order.total_local);
  let local: string;
  try {
    local = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(localValue);
  } catch {
    local = `${localValue.toFixed(2)} ${currency}`;
  }

  return `${local} (≈ ${usd})`;
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
