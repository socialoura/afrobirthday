/**
 * Browser-side helper for uploading large files (final videos) straight to
 * media.afrobirthday.com, keeping the two properties the admin UI depends on:
 * progress events and a public URL back once done.
 *
 * The server signs a URL for one exact key; the browser never holds a secret.
 * XMLHttpRequest rather than fetch, because only XHR reports upload progress —
 * fetch's streaming request bodies are still not usable for this across the
 * mobile browsers the magic-link page runs in.
 */

type SignedUpload = { uploadUrl: string; publicUrl: string; expiresAt: number };

export async function uploadFileWithProgress(
  orderId: string,
  file: File,
  clientPayload: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "video";
  // The server only signs a key under this order's prefix, so the orderId here
  // is not a trust boundary — the UUID just keeps a re-upload from colliding
  // with the previous take.
  const pathname = `final-videos/${orderId}/${crypto.randomUUID()}-${safeName}`;

  const res = await fetch("/api/admin/orders/upload-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pathname, clientPayload }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 401 || res.status === 409) {
      throw new Error(
        body.error ||
          "Upload refusé : lien expiré ou session admin expirée. Recharge la page."
      );
    }
    throw new Error(body.error || `Upload refusé (${res.status})`);
  }

  const signed = (await res.json()) as SignedUpload;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.uploadUrl, true);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      // The media server answers JSON; surface its reason rather than a bare
      // status, since "expired" and "too large" need different fixes.
      let reason = `HTTP ${xhr.status}`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { error?: string };
        if (parsed.error) reason = parsed.error;
      } catch {
        /* non-JSON body: the status alone is all we have */
      }
      if (xhr.status === 403) {
        return reject(
          new Error("Upload expiré — recharge la page et réessaie.")
        );
      }
      if (xhr.status === 413) {
        return reject(new Error("Fichier trop volumineux."));
      }
      reject(new Error(`Upload échoué : ${reason}`));
    };
    xhr.onerror = () =>
      reject(new Error("Upload interrompu — vérifie ta connexion et réessaie."));
    xhr.ontimeout = () => reject(new Error("Upload trop long — réessaie."));
    xhr.send(file);
  });

  return signed.publicUrl;
}
