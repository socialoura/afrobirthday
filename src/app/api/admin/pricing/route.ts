import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import {
  getPricingOverrides,
  getPricingSettings,
  initAdminTables,
  updatePricingOverrides,
  updatePricingSettings,
  type PricingOverrides,
} from "@/lib/db";
import { SUPPORTED_CURRENCIES } from "@/lib/utils";

export const runtime = "nodejs";

const COMPONENT_KEYS = ["base", "customSong", "expressDelivery", "danceExtended"] as const;

export async function GET(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initAdminTables();
    const [pricing, overrides] = await Promise.all([
      getPricingSettings(),
      getPricingOverrides(),
    ]);
    return NextResponse.json({ ...pricing, overrides });
  } catch (error) {
    console.error("Get pricing settings error:", error);
    return NextResponse.json({ error: "Failed to fetch pricing" }, { status: 500 });
  }
}

/**
 * Validates and normalizes a raw overrides object: keeps only supported,
 * non-USD currencies and finite non-negative component values. Empty
 * currency entries are dropped so they fall back to automatic conversion.
 */
function sanitizeOverrides(raw: unknown): PricingOverrides | { error: string } {
  if (raw == null) return {};
  if (typeof raw !== "object") return { error: "Invalid overrides" };

  const supported = new Set<string>(SUPPORTED_CURRENCIES);
  const result: PricingOverrides = {};

  for (const [currency, value] of Object.entries(raw as Record<string, unknown>)) {
    if (currency === "USD" || !supported.has(currency)) {
      return { error: `Unsupported currency: ${currency}` };
    }
    if (value == null || typeof value !== "object") continue;

    const entry: Record<string, number> = {};
    for (const key of COMPONENT_KEYS) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined || v === null || v === "") continue;
      const num = typeof v === "number" ? v : Number.parseFloat(String(v));
      if (Number.isNaN(num) || !Number.isFinite(num) || num < 0) {
        return { error: `Invalid ${key} for ${currency}` };
      }
      entry[key] = num;
    }

    if (Object.keys(entry).length > 0) {
      result[currency] = entry;
    }
  }

  return result;
}

export async function PUT(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<{
      base: number;
      customSong: number;
      expressDelivery: number;
      danceExtended: number;
      overrides: unknown;
    }>;

    for (const key of COMPONENT_KEYS) {
      const v = body[key];
      if (v === undefined) continue;
      if (typeof v !== "number" || Number.isNaN(v) || !Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
      }
    }

    let sanitizedOverrides: PricingOverrides | undefined;
    if ("overrides" in body) {
      const sanitized = sanitizeOverrides(body.overrides);
      if ("error" in sanitized) {
        return NextResponse.json({ error: sanitized.error }, { status: 400 });
      }
      sanitizedOverrides = sanitized;
    }

    await initAdminTables();
    await updatePricingSettings({
      base: body.base,
      customSong: body.customSong,
      expressDelivery: body.expressDelivery,
      danceExtended: body.danceExtended,
    });
    if (sanitizedOverrides !== undefined) {
      await updatePricingOverrides(sanitizedOverrides);
    }

    const [pricing, overrides] = await Promise.all([
      getPricingSettings(),
      getPricingOverrides(),
    ]);
    return NextResponse.json({ success: true, pricing: { ...pricing, overrides } });
  } catch (error) {
    console.error("Update pricing settings error:", error);
    return NextResponse.json({ error: "Failed to update pricing" }, { status: 500 });
  }
}
