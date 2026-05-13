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
        <p style="margin:0 0 6px;"><strong>Total:</strong> $${Number(order.total_usd).toFixed(2)} USD</p>
        <p style="margin:0 0 6px;"><strong>Delivery:</strong> ${delivery}</p>
        <p style="margin:0 0 6px;"><strong>Music:</strong> ${music}</p>
        ${order.music_link ? `<p style="margin:0 0 6px;"><strong>Music link:</strong> ${escapeHtml(order.music_link)}</p>` : ""}
        ${order.gift_note ? `<p style="margin:0 0 6px;"><strong>Gift note:</strong> ${escapeHtml(order.gift_note)}</p>` : ""}
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
  return `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6; color: #111;">
      <h2 style="margin:0 0 12px;">Your AfroBirthday video is ready! 🎉🎂</h2>
      <p style="margin:0 0 16px;">
        Thank you again for your order. Your personalized birthday video is ready —
        click the button below to watch and download it.
      </p>

      <p style="margin: 24px 0;">
        <a href="${escapeHtml(videoUrl)}"
           style="display:inline-block; padding:14px 24px; background:linear-gradient(90deg,#f97316,#9333ea); color:#fff; text-decoration:none; border-radius:9999px; font-weight:600;">
          Watch your video
        </a>
      </p>

      <p style="margin:0 0 16px; font-size: 14px; color:#444;">
        Direct link: <a href="${escapeHtml(videoUrl)}">${escapeHtml(videoUrl)}</a>
      </p>

      <div style="border-top:1px solid #eee; margin-top:24px; padding-top:16px; font-size:12px; color:#666;">
        <p style="margin:0 0 6px;"><strong>Order ID:</strong> ${order.id}</p>
        <p style="margin:0;">Need help or want to share feedback? Just reply to this email.</p>
      </div>
    </div>
  `;
}

export function renderFinalVideoEmailText(order: Order, videoUrl: string) {
  return [
    "Your AfroBirthday video is ready!",
    "",
    "Watch and download here:",
    videoUrl,
    "",
    `Order ID: ${order.id}`,
    "",
    "Need help? Just reply to this email.",
  ].join("\n");
}

export function renderOrderConfirmationEmailText(order: Order) {
  const delivery = order.delivery_method === "express" ? "Express (12-24 hours)" : "Standard (24-48 hours)";
  const music = order.music_option === "custom" ? "Custom song" : "We choose music";

  return [
    "Thanks for your order!",
    "",
    `Order ID: ${order.id}`,
    `Total: $${Number(order.total_usd).toFixed(2)} USD`,
    `Delivery: ${delivery}`,
    `Music: ${music}`,
    order.music_link ? `Music link: ${order.music_link}` : "",
    order.gift_note ? `Gift note: ${order.gift_note}` : "",
    "",
    "Message:",
    order.message,
    "",
    "We’ll deliver your video by email as soon as it’s ready.",
  ]
    .filter(Boolean)
    .join("\n");
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
