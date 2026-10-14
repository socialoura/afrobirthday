/**
 * What the public upload routes accept, shared by /api/upload (file through
 * the function) and /api/upload/signed (file straight to the media host).
 */

export const UPLOAD_RULES = {
  "orders/photos": {
    // HEIC/HEIF are what an iPhone hands over when the browser doesn't
    // transcode on pick. The client converts them to JPEG first, but that
    // conversion can fail (older iOS, no canvas codec), and rejecting them
    // here cost real orders: the customer only saw "upload failed" and left.
    mimes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/heic-sequence",
      "image/heif-sequence",
    ],
    exts: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
    maxBytes: 5 * 1024 * 1024,
  },
  "orders/music": {
    mimes: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac"],
    exts: ["mp3", "wav", "m4a", "aac"],
    maxBytes: 10 * 1024 * 1024,
  },
  "admin/videos": {
    mimes: ["video/mp4", "video/webm", "video/quicktime"],
    exts: ["mp4", "webm", "mov"],
    maxBytes: 200 * 1024 * 1024,
    adminOnly: true,
  },
} as const;

export type UploadFolder = keyof typeof UPLOAD_RULES;

const ipRequests = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;

export function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequests.get(ip);
  if (!entry || entry.resetAt < now) {
    ipRequests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

/** Storage key for a new upload: random name, extension from the allowlist. */
export function uploadKey(folder: UploadFolder, fileName: string): string {
  const rules = UPLOAD_RULES[folder];
  const extFromName = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : undefined;
  const ext = extFromName && (rules.exts as readonly string[]).includes(extFromName) ? extFromName : rules.exts[0];
  return `${folder}/${crypto.randomUUID()}.${ext}`;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
