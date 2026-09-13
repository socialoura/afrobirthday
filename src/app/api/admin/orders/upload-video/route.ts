import { NextResponse } from "next/server";
import { verifyAdminToken, verifyUploadToken } from "@/lib/auth";
import { signedUploadUrl } from "@/lib/mediaHost";

export const runtime = "nodejs";

// Final videos are served from media.afrobirthday.com, a file server we run.
// They used to sit on Vercel Blob, and before that on Supabase Storage, whose
// cached-egress quota a busy delivery month could exhaust — restricting the
// whole project, database included, mid delivery. Both of those hostnames are
// now unreachable for older files; ours is a subdomain of the site, so moving
// the box behind it is a DNS change and the stored URLs keep resolving.
//
// This route hands the browser a URL it may PUT one file to. The signature
// covers the exact key, an expiry and a size ceiling, so a leaked URL cannot be
// aimed at another order's prefix or used to fill the disk.

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
// A phone-sized video on mobile data can take a long while; the URL authorizes
// this one key only, so a wide window costs nothing.
const TOKEN_TTL_SECONDS = 60 * 60;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const raw = (await request.json()) as Record<string, unknown>;

    // A page loaded before this route left Vercel Blob posts the SDK's shape,
    // which carries an event `type`. That page would upload to a store we no
    // longer write to, so refuse it and say what actually fixes it.
    if (typeof raw.type === "string") {
      console.error(
        "Upload video token error: stale Vercel Blob client payload, keys:",
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

    const pathname = typeof raw.pathname === "string" ? raw.pathname : "";
    const clientPayload =
      typeof raw.clientPayload === "string" ? raw.clientPayload : "";

    if (!pathname || !clientPayload) {
      return NextResponse.json(
        { error: "Missing pathname or clientPayload" },
        { status: 400 }
      );
    }

    // The media server applies the same rule, but refusing here gives the
    // operator a real message instead of an opaque 400 from the upload itself.
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(pathname) || pathname.includes("..")) {
      return NextResponse.json({ error: "Invalid pathname" }, { status: 400 });
    }

    if (!verifyUploadAuthorized(clientPayload, pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const signed = signedUploadUrl(pathname, MAX_VIDEO_BYTES, TOKEN_TTL_SECONDS);
    return NextResponse.json(signed);
  } catch (error) {
    // The browser shows a generic failure, so this log is the only place the
    // real reason (expired link, missing MEDIA_UPLOAD_SECRET) survives.
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
