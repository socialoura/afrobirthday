import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const order = await getOrderById(id);
  if (!order || !order.final_video_url) {
    return new NextResponse("Video not available", { status: 404 });
  }

  return NextResponse.redirect(order.final_video_url, 302);
}
