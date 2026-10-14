import { NextResponse } from "next/server";
import { signedUploadUrl } from "@/lib/mediaHost";
import { clientIp, rateLimit, UPLOAD_RULES, uploadKey, type UploadFolder } from "@/lib/uploadRules";

export const runtime = "nodejs";

// Vercel refuses any function request body over 4.5 MB, so a song posted
// through /api/upload failed with a 413 the customer only saw as "payment
// could not be prepared" (two blocked checkouts on 2026-10-14; the form
// allows 10 MB). This route only signs: the browser PUTs the file straight to
// the media host, whose signature check enforces the key and the size cap.

// Long enough for a song on a slow uplink; the URL authorizes one key only.
const TOKEN_TTL_SECONDS = 15 * 60;

const PUBLIC_FOLDERS = new Set<UploadFolder>(["orders/photos", "orders/music"]);

export async function POST(request: Request) {
  if (!rateLimit(clientIp(request))) {
    return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  }

  let body: { folder?: unknown; size?: unknown; type?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const folder = typeof body.folder === "string" ? (body.folder as UploadFolder) : null;
  if (!folder || !PUBLIC_FOLDERS.has(folder)) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }
  const rules = UPLOAD_RULES[folder];

  const size = typeof body.size === "number" ? body.size : 0;
  if (size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (size > rules.maxBytes) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const mime = typeof body.type === "string" ? body.type.toLowerCase() : "";
  if (!(rules.mimes as readonly string[]).includes(mime)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  try {
    const { uploadUrl, publicUrl } = signedUploadUrl(uploadKey(folder, name), rules.maxBytes, TOKEN_TTL_SECONDS);
    return NextResponse.json({ uploadUrl, url: publicUrl });
  } catch (error) {
    console.error("Signed upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
