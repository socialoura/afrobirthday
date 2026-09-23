type OrderUploadFolder = "orders/photos" | "orders/music";

type ResolveOrderUploadsInput = {
  photo: File;
  musicFile?: File | null;
  photoUrl?: string | null;
  musicFileUrl?: string | null;
  photoUpload?: Promise<string> | null;
  musicUpload?: Promise<string> | null;
  upload: (file: File, folder: OrderUploadFolder) => Promise<string>;
};

/**
 * Resolves the assets shared by card and PayPal checkout.
 *
 * Selection starts uploads in the background. Checkout must reuse the cached
 * URL or in-flight promise and only transfer a file again when that first
 * attempt failed.
 */
export async function resolveOrderUploads({
  photo,
  musicFile,
  photoUrl,
  musicFileUrl,
  photoUpload,
  musicUpload,
  upload,
}: ResolveOrderUploadsInput): Promise<{
  photoUrl: string;
  musicFileUrl?: string;
}> {
  const pendingPhoto = photoUrl
    ? Promise.resolve(photoUrl)
    : (photoUpload ?? upload(photo, "orders/photos"));

  const pendingMusic: Promise<string | undefined> = !musicFile
    ? Promise.resolve(undefined)
    : musicFileUrl
      ? Promise.resolve(musicFileUrl)
      : (musicUpload ?? upload(musicFile, "orders/music"));

  const [resolvedPhotoUrl, resolvedMusicFileUrl] = await Promise.all([
    pendingPhoto.catch(() => upload(photo, "orders/photos")),
    pendingMusic.catch(() =>
      musicFile ? upload(musicFile, "orders/music") : Promise.resolve(undefined)
    ),
  ]);

  return {
    photoUrl: resolvedPhotoUrl,
    musicFileUrl: resolvedMusicFileUrl,
  };
}
