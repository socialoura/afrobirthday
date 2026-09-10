import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyAdminToken, verifyUploadToken } from "@/lib/auth";

export const runtime = "nodejs";

// Final videos live on Vercel Blob, not Supabase Storage: a delivered video is
// watched and downloaded straight from its public URL, and that traffic burns
// far more egress than every photo and MP3 combined — enough to trip Supabase's
// cached-egress quota and restrict the whole project (database included) mid
// delivery. Vercel Blob bandwidth comes out of the hosting plan instead, so a
// busy month can no longer take the site down. Photos, music and voiceovers
// stay on Supabase, where they cost almost nothing.
//
// BLOB_READ_WRITE_TOKEN must name a *public* store, and specifically the
// afrobirthday-videos one. Delivery hands the customer /v/<id>, which 302s to
// whatever URL is stored, so a private store would need a signed URL minted per
// visit; and an earlier store went dead when it was left behind in a team
// migration, taking 64 delivered videos with it — pointing this at a store the
// project does not own is how that happened.
//
// Client-token endpoint for the browser's direct-to-Blob upload, used by both
// the admin dashboard (full admin token) and the order-scoped mobile upload
// page (magic-link upload token, valid only for that one order's video path).

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
// The SDK's default client token lasts 30 seconds, which expires mid-upload for
// a phone-sized video on mobile data. The token authorizes this one pathname
// only, so a longer window costs nothing.
const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const raw = (await request.json()) as Record<string, unknown>;

    // A page loaded before this route moved to Vercel Blob posts the old
    // Supabase shape — `{ orderId, filename, clientPayload }`, with no event
    // `type`. The SDK would call that "Invalid event type", which tells the
    // operator nothing; the stale page does render this message, so say what
    // actually fixes it.
    if (typeof raw.type !== "string") {
      console.error(
        "Upload video token error: stale client payload, keys:",
        Object.keys(raw).join(",")
      );
      return NextResponse.json(
        {
          error:
            "Page obsolète — ferme et rouvre le lien d'upload pour charger la nouvelle version.",
        },
        { status: 409 }
      );
    }

    const body = raw as unknown as HandleUploadBody;

    const result = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload || !verifyUploadAuthorized(clientPayload, pathname)) {
          throw new Error("Unauthorized");
        }
        return {
          // Phones label camera captures video/quicktime; a file picked from
          // Files can arrive with no type at all, hence octet-stream.
          allowedContentTypes: ["video/*", "application/octet-stream"],
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          validUntil: Date.now() + TOKEN_TTL_MS,
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    // The client SDK discards this body and reports a generic failure, so this
    // log is the only place the real reason (expired link, missing
    // BLOB_READ_WRITE_TOKEN) survives.
    console.error("Upload video token error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}

// Authorizes a video upload for the given target pathname. Full admin tokens may
// upload anywhere; order-scoped upload tokens may only write to that order's
// `final-videos/<orderId>/` prefix.
function verifyUploadAuthorized(clientPayload: string, pathname: string): boolean {
  if (verifyAdminToken(clientPayload)) return true;

  const upload = verifyUploadToken(clientPayload);
  if (!upload) return false;
  return pathname.startsWith(`final-videos/${upload.orderId}/`);
}
