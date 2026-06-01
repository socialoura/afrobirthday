export type DeviceType = "mobile" | "tablet" | "desktop";

/**
 * Best-effort device classification from a User-Agent string. Used to record
 * whether an order was placed from a phone, tablet, or computer.
 */
export function deviceTypeFromUserAgent(ua: string | null | undefined): DeviceType {
  if (!ua) return "desktop";
  const s = ua.toLowerCase();

  // Tablets first (some Android tablets also match "android" without "mobile").
  if (/ipad|tablet|playbook|silk|kindle|(android(?!.*mobile))/.test(s)) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile|windows phone/.test(s)) {
    return "mobile";
  }
  return "desktop";
}

/** Human-friendly label with an emoji for Discord/admin display. */
export function deviceLabel(device: string | null | undefined): string {
  switch (device) {
    case "mobile":
      return "📱 Mobile";
    case "tablet":
      return "📲 Tablet";
    case "desktop":
      return "🖥️ Desktop";
    default:
      return "❓ Unknown";
  }
}
