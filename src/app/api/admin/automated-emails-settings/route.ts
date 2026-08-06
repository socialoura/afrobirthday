import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { getSetting, setSetting, initAdminTables } from "@/lib/db";

export const runtime = "nodejs";

const BOOLEAN_KEYS = [
  "review_email_enabled",
  "abandoned_cart_email_enabled",
  "cross_sell_email_enabled",
  "annual_reminder_email_enabled",
  "referral_email_enabled",
] as const;

const TEXT_KEYS = [
  "review_email_delay_days",
  "abandoned_cart_email_delay_hours",
  "cross_sell_email_delay_days",
  "annual_reminder_email_delay_days",
  "winback_promo_code",
  "referral_email_delay_days",
  "referral_friend_discount_type",
  "referral_friend_discount_value",
  "referral_max_uses",
  "referral_reward_type",
  "referral_reward_value",
] as const;

const DEFAULTS: Record<(typeof BOOLEAN_KEYS)[number] | (typeof TEXT_KEYS)[number], string> = {
  review_email_enabled: "true",
  abandoned_cart_email_enabled: "false",
  cross_sell_email_enabled: "false",
  annual_reminder_email_enabled: "false",
  referral_email_enabled: "false",
  review_email_delay_days: "3",
  abandoned_cart_email_delay_hours: "3",
  cross_sell_email_delay_days: "7",
  annual_reminder_email_delay_days: "365",
  winback_promo_code: "",
  referral_email_delay_days: "3",
  referral_friend_discount_type: "percentage",
  referral_friend_discount_value: "15",
  referral_max_uses: "5",
  referral_reward_type: "percentage",
  referral_reward_value: "15",
};

type SettingsPayload = Record<string, string>;

export async function GET(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initAdminTables();
    const entries = await Promise.all(
      [...BOOLEAN_KEYS, ...TEXT_KEYS].map(async (key) => {
        const value = await getSetting(key);
        return [key, value ?? DEFAULTS[key]] as const;
      })
    );

    const settings: SettingsPayload = Object.fromEntries(entries);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Get automated email settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<SettingsPayload>;
    await initAdminTables();

    const allKeys = new Set<string>([...BOOLEAN_KEYS, ...TEXT_KEYS]);
    const updates = Object.entries(body).filter(([key]) => allKeys.has(key));

    await Promise.all(updates.map(([key, value]) => setSetting(key, String(value))));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update automated email settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
