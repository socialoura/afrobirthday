import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyAdminToken } from "@/lib/auth";

export const runtime = "nodejs";

// Client-token endpoint used by `@vercel/blob/client` `upload()` to upload
// large video files directly from the admin browser to Vercel Blob.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // clientPayload is the admin bearer token sent by the browser.
        const admin = clientPayload ? verifyAdminToken(clientPayload) : null;
        if (!admin) {
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
