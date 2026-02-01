import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { getSetting, setSetting, initAdminTables } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initAdminTables();
    const enabled = await getSetting('promo_enabled');
    return NextResponse.json({ enabled: enabled === 'true' });
  } catch (error) {
    console.error("Get promo settings error:", error);
    return NextResponse.json({ error: "Failed to fetch promo settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { enabled } = await request.json();
    await initAdminTables();
    await setSetting('promo_enabled', enabled ? 'true' : 'false');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update promo settings error:", error);
    return NextResponse.json({ error: "Failed to update promo settings" }, { status: 500 });
  }
}
