import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { addEmailOptOut, getAllEmailOptOuts, removeEmailOptOut } from "@/lib/db";

export const runtime = "nodejs";

/** Manual suppression list management, for when someone asks over support. */

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ optOuts: await getAllEmailOptOuts() });
  } catch (error) {
    console.error("Get email opt-outs error:", error);
    return NextResponse.json({ error: "Failed to fetch opt-outs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email } = await request.json();
    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    await addEmailOptOut(email, "support");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add email opt-out error:", error);
    return NextResponse.json({ error: "Failed to add opt-out" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const email = new URL(request.url).searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    await removeEmailOptOut(email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove email opt-out error:", error);
    return NextResponse.json({ error: "Failed to remove opt-out" }, { status: 500 });
  }
}
