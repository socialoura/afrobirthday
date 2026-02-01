import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = (formData.get("folder") as string | null) ?? "uploads";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const safeExt = (ext ?? "bin").replace(/[^a-zA-Z0-9]/g, "");
    const key = `${folder}/${crypto.randomUUID()}.${safeExt || "bin"}`;

    const blob = await put(key, file, {
      access: "public",
      contentType: file.type || undefined,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
