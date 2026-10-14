import { NextResponse } from "next/server";
import { uploadObject } from "@/lib/storage";
import { verifyAdminRequest } from "@/lib/auth";
import { clientIp, rateLimit, UPLOAD_RULES, uploadKey, type UploadFolder } from "@/lib/uploadRules";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!rateLimit(clientIp(request))) {
    return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folderRaw = (formData.get("folder") as string | null) ?? "";

    if (!(folderRaw in UPLOAD_RULES)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }
    const folder = folderRaw as UploadFolder;
    const rules = UPLOAD_RULES[folder];

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

    const key = uploadKey(folder, file.name);

    const url = await uploadObject(key, file, { contentType: mime });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
