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
  const { signedUrl, publicUrl } = (await initRes.json()) as {
    signedUrl: string;
    publicUrl: string;
  };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });

  return publicUrl;
}
