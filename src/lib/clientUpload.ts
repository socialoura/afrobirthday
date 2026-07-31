/**
 * Browser-side helper for uploading large files (final videos) directly to
 * Supabase Storage via a signed upload URL, replacing the old
 * `@vercel/blob/client` `upload()` flow. Keeps the same two properties the
 * admin UI depends on: progress events (Supabase's fetch-based client has
 * none, so this uses a raw XHR) and a public URL back once done.
 */
export async function uploadFileWithProgress(
  orderId: string,
  file: File,
  clientPayload: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const initRes = await fetch("/api/admin/orders/upload-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, filename: file.name, clientPayload }),
  });
  if (!initRes.ok) {
    const body = await initRes.json().catch(() => ({}));
    throw new Error(body?.error || "Upload init failed");
  }
  const { signedUrl, publicUrl, token: uploadToken } = (await initRes.json()) as {
    signedUrl: string;
    publicUrl: string;
    token?: string;
  };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    // Supabase's signed upload URL embeds the token in the query string AND
    // accepts it as a Bearer token — sending both is harmless if the query
    // already has it, and recovers uploads that would otherwise 400 because
    // the token got stripped by some intermediary.
    if (uploadToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${uploadToken}`);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      // Surface the Supabase error body so the operator sees the real reason
      // (token expired, payload too large, bucket policy, etc.) instead of a
      // bare "Upload failed (400)".
      let detail = "";
      const raw =
        (typeof xhr.responseText === "string" && xhr.responseText) ||
        (typeof xhr.response === "string" ? xhr.response : "") ||
        "";
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          detail = parsed.message || parsed.error || parsed.msg || raw;
        } catch {
          detail = raw;
        }
      }
      reject(
        new Error(
          `Upload failed (${xhr.status})${detail ? `: ${String(detail).slice(0, 300)}` : ""}`
        )
      );
    };
    xhr.onerror = () => reject(new Error("Upload failed (network error)"));
    xhr.send(file);
  });

  return publicUrl;
}
