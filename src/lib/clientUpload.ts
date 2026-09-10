import { upload } from "@vercel/blob/client";

/**
 * Browser-side helper for uploading large files (final videos) directly to
 * Vercel Blob, keeping the two properties the admin UI depends on: progress
 * events and a public URL back once done.
 *
 * Videos deliberately do not go to Supabase Storage — see the comment in
 * `/api/admin/orders/upload-video` for why serving them from there can restrict
 * the whole Supabase project.
 */
export async function uploadFileWithProgress(
  orderId: string,
  file: File,
  clientPayload: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "video";
  // The server only signs a token for a path under this order's prefix, so the
  // orderId here is not a trust boundary — the UUID just keeps a re-upload from
  // colliding with the previous take.
  const pathname = `final-videos/${orderId}/${crypto.randomUUID()}-${safeName}`;

  try {
    const blob = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/admin/orders/upload-video",
      clientPayload,
      contentType: file.type || "application/octet-stream",
      // Splits the video into parts uploaded in parallel with per-part retries,
      // so a dropped bar on mobile data doesn't restart the whole upload.
      multipart: true,
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
    });

    return blob.url;
  } catch (error) {
    // The SDK collapses every failure of the token route into one opaque
    // message; the only ways that route refuses are an expired magic link, an
    // expired admin session, or a missing Blob token, so point the operator at
    // the fix instead of showing them that.
    const message = error instanceof Error ? error.message : "";
    if (/client token/i.test(message)) {
      throw new Error(
        "Upload refusé : lien expiré ou session admin expirée. Recharge la page."
      );
    }
    throw error;
  }
}
