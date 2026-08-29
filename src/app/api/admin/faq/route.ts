import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { listFaqEntries, upsertFaqEntry, validateFaqEntry } from "@/lib/faqContent";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const locale = new URL(request.url).searchParams.get("locale") ?? undefined;
  try {
    return NextResponse.json({ entries: await listFaqEntries(locale) });
  } catch (err) {
    console.error("FAQ list failed:", err);
    return NextResponse.json({ error: "Failed to list FAQ entries" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { entries?: unknown };
    const entries = Array.isArray(body.entries) ? body.entries : [body];

    // Refused at the door rather than hoped for on the way out: nobody is
    // going to review what gets published here.
    const problems: string[] = [];
    for (const [index, entry] of entries.entries()) {
      const problem = validateFaqEntry(entry as never);
      if (problem) problems.push(`entrée ${index + 1} : ${problem}`);
    }
    if (problems.length) {
      return NextResponse.json({ error: "Validation failed", problems }, { status: 400 });
    }

    for (const entry of entries) await upsertFaqEntry(entry as never);
    return NextResponse.json({ ok: true, saved: entries.length });
  } catch (err) {
    console.error("FAQ upsert failed:", err);
    return NextResponse.json({ error: "Failed to save FAQ entries" }, { status: 500 });
  }
}
