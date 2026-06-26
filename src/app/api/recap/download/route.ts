import { NextResponse } from "next/server";
import { verifyUploadToken } from "@/lib/auth";
import { getOrderById } from "@/lib/db";

export const runtime = "nodejs";

// Proxies an order's media (photo / music / voiceover) through our own origin
// with a Content-Disposition: attachment header, so the recap page's download
// buttons actually trigger a download instead of opening the file in-browser
// (the `download` attribute is ignored for cross-origin blob URLs).
function extFor(url: string, contentType: string): string {
  const fromUrl = url.split("?")[0].match(/\.([a-z0-9]{2,4})$/i)?.[1];
  if (fromUrl) return `.${fromUrl.toLowerCase()}`;
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
  };
  return map[contentType.split(";")[0].trim()] || "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId") ?? "";
  const token = searchParams.get("t") ?? "";
  const kind = searchParams.get("kind") ?? "";

  const upload = verifyUploadToken(token);
  if (!upload || upload.orderId !== orderId) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const short = order.id.slice(0, 8);
  let url: string | null = null;
  let baseName = "fichier";
  if (kind === "photo") {
    url = order.photo_url;
    baseName = `commande-${short}-photo`;
  } else if (kind === "music") {
    url = order.downloaded_music_url || order.music_file_url;
    baseName = `commande-${short}-musique`;
  } else if (kind === "voiceover") {
    url = order.voiceover_url;
    baseName = `commande-${short}-vocal`;
  }

  if (!url) {
    return NextResponse.json({ error: "No file for this kind" }, { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(url);
  } catch {
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }

  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";
  const filename = `${baseName}${extFor(url, contentType)}`;

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
