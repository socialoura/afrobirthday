import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyAdminToken, verifyUploadToken } from "@/lib/auth";

export const runtime = "nodejs";

// Client-token endpoint used by `@vercel/blob/client` `upload()` to upload
// large video files directly to Vercel Blob — either from the admin dashboard
// (full admin token) or from the order-scoped mobile upload page (magic-link
// upload token, which is only valid for that one order's video path).
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // clientPayload is either a full admin token or an order-scoped upload
        // token. A full admin token may upload to any path; an upload token may
        // only write to its own order's `final-videos/<orderId>/...` prefix.
        const isAdmin = clientPayload
          ? verifyUploadAuthorized(clientPayload, pathname)
          : false;
        if (!isAdmin) {
          throw new Error("Unauthorized");
        }
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-matroska",
            "video/mpeg",
          ],
          // Up to ~2GB, plenty for final videos
          maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No-op. The admin client persists the URL via the update endpoint.
      },
    });

    return NextResponse.json(json);
  } catch (error) {
    console.error("Upload video token error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}

// Authorizes a blob upload for the given target pathname. Full admin tokens may
// upload anywhere; order-scoped upload tokens may only write to that order's
// `final-videos/<orderId>/` prefix.
function verifyUploadAuthorized(clientPayload: string, pathname: string): boolean {
  if (verifyAdminToken(clientPayload)) return true;

  const upload = verifyUploadToken(clientPayload);
  if (!upload) return false;
  return pathname.startsWith(`final-videos/${upload.orderId}/`);
}
