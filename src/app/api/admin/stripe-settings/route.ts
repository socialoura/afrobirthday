import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { getStripeSettings, updateStripeSettings, initAdminTables } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initAdminTables();
    const settings = await getStripeSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Get stripe settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { secretKey, publishableKey } = await request.json();

    if (secretKey && !secretKey.startsWith('sk_')) {
      return NextResponse.json({ error: "Invalid secret key format" }, { status: 400 });
    }

    if (publishableKey && !publishableKey.startsWith('pk_')) {
      return NextResponse.json({ error: "Invalid publishable key format" }, { status: 400 });
    }

    await initAdminTables();
    await updateStripeSettings(secretKey || '', publishableKey || '');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update stripe settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
