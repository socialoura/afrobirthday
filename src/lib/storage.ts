import { del as deleteBlob } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "orders";

let cached: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}

export function publicUrlFor(path: string): string {
  return getSupabaseAdmin().storage.from(STORAGE_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

/** Reverses publicUrlFor: extracts the storage key from a public bucket URL. */
export function keyFromPublicUrl(url: string): string | null {
  const marker = `/public/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

export async function deleteObject(key: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage.from(STORAGE_BUCKET).remove([key]);
  if (error) throw error;
}

/**
 * Deletes a stored photo whatever backend it lives on, and reports whether it
 * could. Photos uploaded before the move to Supabase Storage are still on
 * Vercel Blob, so a public URL can be either shape; the caller must not clear
 * the database pointer when this returns false, or the file becomes an
 * unreachable orphan that stays publicly readable.
 */
export async function deletePhotoByUrl(url: string): Promise<boolean> {
  const key = keyFromPublicUrl(url);
  if (key) {
    await deleteObject(key);
    return true;
  }

  if (url.includes(".blob.vercel-storage.com/")) {
    // Throws when BLOB_READ_WRITE_TOKEN is missing, which is what we want:
    // the caller leaves the row alone and retries on the next run.
    await deleteBlob(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return true;
  }

  return false;
}
