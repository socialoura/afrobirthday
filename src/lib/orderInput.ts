import { isMediaUrl } from "@/lib/mediaHost";

/**
 * Server-side validation shared by the checkout routes. The client form
 * validates too, but these routes are public: without this, anyone could make
 * the abandoned-cart cron email arbitrary addresses, overflow Stripe's
 * 500-char metadata limit, or attach URLs we never hosted to an order.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Deliberately loose (one @, a dot in the domain, no spaces): the goal is to
// reject garbage, not to second-guess unusual but valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The form caps the message at 100 characters; leave headroom for clients
// that count emoji differently, while staying far below Stripe's 500.
export const MAX_MESSAGE_LENGTH = 200;
const MAX_LINK_LENGTH = 500;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export type OrderInput = {
  orderId: string;
  email: string;
  message: string;
  photoUrl: string;
  musicLink: string | undefined;
  musicFileUrl: string | undefined;
  musicOption: "custom" | "default";
};

export type OrderInputResult =
  | { ok: true; value: OrderInput }
  | { ok: false; error: string };

export function validateOrderInput(body: Record<string, unknown>): OrderInputResult {
  const { orderId, email, message, photoUrl, musicLink, musicFileUrl, musicOption, hasCustomSong } =
    body;

  if (!isUuid(orderId)) return { ok: false, error: "Invalid orderId" };

  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  if (!isValidEmail(trimmedEmail)) return { ok: false, error: "Invalid email" };

  const trimmedMessage = typeof message === "string" ? message.trim() : "";
  if (trimmedMessage.length < 1 || trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "Invalid message" };
  }

  if (typeof photoUrl !== "string" || !isMediaUrl(photoUrl)) {
    return { ok: false, error: "Missing photoUrl" };
  }

  const link = typeof musicLink === "string" && musicLink.trim() ? musicLink.trim() : undefined;
  if (link && (link.length > MAX_LINK_LENGTH || !isHttpUrl(link))) {
    return { ok: false, error: "Invalid music link" };
  }

  const file = typeof musicFileUrl === "string" && musicFileUrl ? musicFileUrl : undefined;
  if (file && !isMediaUrl(file)) return { ok: false, error: "Invalid music file" };

  const resolvedMusicOption =
    (musicOption ?? (hasCustomSong ? "custom" : "default")) === "custom" ? "custom" : "default";
  // The custom-song option is a paid extra: it needs a song to work with.
  if (resolvedMusicOption === "custom" && !link && !file) {
    return { ok: false, error: "Custom song requires a link or a file" };
  }

  return {
    ok: true,
    value: {
      orderId,
      email: trimmedEmail,
      message: trimmedMessage,
      photoUrl,
      // Only keep music inputs when the customer actually chose a custom song,
      // so a stale draft link is never sent to production for default music.
      musicLink: resolvedMusicOption === "custom" ? link : undefined,
      musicFileUrl: resolvedMusicOption === "custom" ? file : undefined,
      musicOption: resolvedMusicOption,
    },
  };
}
