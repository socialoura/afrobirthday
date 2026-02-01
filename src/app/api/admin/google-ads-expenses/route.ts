import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { getAllGoogleAdsExpenses, setGoogleAdsExpense, initAdminTables } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initAdminTables();
    const expenses = await getAllGoogleAdsExpenses();
    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Get google ads expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { month, amount } = await request.json();

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month format (YYYY-MM)" }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    await initAdminTables();
    await setGoogleAdsExpense(month, amount);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set google ads expense error:", error);
    return NextResponse.json({ error: "Failed to set expense" }, { status: 500 });
  }
}
