import { NextResponse } from "next/server";
import { verifyAdminToken, verifyUploadToken } from "@/lib/auth";
import { getSupabaseAdmin, publicUrlFor, STORAGE_BUCKET } from "@/lib/storage";

export const runtime = "nodejs";

// Signed-upload-URL endpoint used by the admin dashboard and the order-scoped
// mobile upload page to upload large final-video files directly to Supabase
// Storage — either from the admin dashboard (full admin token) or from the
// order-scoped mobile upload page (magic-link upload token, which is only
// valid for that one order's video path).
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { orderId, filename, clientPayload } = (await request.json()) as {
      orderId?: string;
      filename?: string;
      clientPayload?: string;
    };

    if (!orderId || !filename || !clientPayload) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `final-videos/${orderId}/${crypto.randomUUID()}-${safeName}`;

    if (!verifyUploadAuthorized(clientPayload, path)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await getSupabaseAdmin()
      .storage.from(STORAGE_BUCKET)
      .createSignedUploadUrl(path);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl: publicUrlFor(path),
    });
  } catch (error) {
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
