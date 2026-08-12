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
