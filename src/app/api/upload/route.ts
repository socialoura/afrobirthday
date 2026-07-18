import { NextResponse } from "next/server";
import { getSupabaseAdmin, publicUrlFor, STORAGE_BUCKET } from "@/lib/storage";
import { verifyAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED = {
  "orders/photos": {
    mimes: ["image/jpeg", "image/png", "image/webp"],
    exts: ["jpg", "jpeg", "png", "webp"],
    maxBytes: 5 * 1024 * 1024,
  },
  "orders/music": {
    mimes: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac"],
    exts: ["mp3", "wav", "m4a", "aac"],
    maxBytes: 10 * 1024 * 1024,
  },
  "admin/videos": {
    mimes: ["video/mp4", "video/webm", "video/quicktime"],
    exts: ["mp4", "webm", "mov"],
    maxBytes: 200 * 1024 * 1024,
    adminOnly: true,
  },
} as const;

type Folder = keyof typeof ALLOWED;

const ipRequests = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequests.get(ip);
  if (!entry || entry.resetAt < now) {
    ipRequests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folderRaw = (formData.get("folder") as string | null) ?? "";

    if (!(folderRaw in ALLOWED)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }
    const folder = folderRaw as Folder;
    const rules = ALLOWED[folder];

    if ("adminOnly" in rules && rules.adminOnly) {
      const admin = verifyAdminRequest(request);
      if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > rules.maxBytes) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const mime = (file.type || "").toLowerCase();
    if (!rules.mimes.includes(mime as never)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 415 }
      );
    }

    const extFromName = file.name.includes(".")
      ? file.name.split(".").pop()?.toLowerCase()
      : undefined;
    const ext =
      extFromName && rules.exts.includes(extFromName as never)
        ? extFromName
        : rules.exts[0];

    const key = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { error } = await getSupabaseAdmin()
      .storage.from(STORAGE_BUCKET)
      .upload(key, file, { contentType: mime, upsert: false });
    if (error) throw error;

    return NextResponse.json({ url: publicUrlFor(key) });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
