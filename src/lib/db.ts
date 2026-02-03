import { neon } from "@neondatabase/serverless";

const POSTGRES_URL = process.env.POSTGRES_URL;

export function getSql() {
  if (!POSTGRES_URL) {
    throw new Error("Missing POSTGRES_URL");
  }
  return neon(POSTGRES_URL);
}

export async function ensureOrdersTable() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'pending',

      email text NOT NULL,
      message text NOT NULL,
      gift_note text,

      music_option text NOT NULL,
      music_link text,
      music_file_url text,

      delivery_method text NOT NULL,

      photo_url text NOT NULL,

      total_usd numeric(10,2) NOT NULL,

      stripe_session_id text,
      stripe_payment_intent_id text
    )
  `;

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_provider text,
    ADD COLUMN IF NOT EXISTS paypal_order_id text,
    ADD COLUMN IF NOT EXISTS paypal_capture_id text
  `;
}

export async function ensureSettingsTable() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key text PRIMARY KEY,
      value text NOT NULL
    )
  `;
}

export type OrderCreateInput = {
  id: string;
  email: string;
  message: string;
  giftNote?: string;
  musicOption: string;
  musicLink?: string;
  musicFileUrl?: string;
  deliveryMethod: string;
  photoUrl: string;
  totalUsd: number;
};

export async function createOrder(input: OrderCreateInput) {
  const sql = getSql();

  await sql`
    INSERT INTO orders (
      id,
      email,
      message,
      gift_note,
      music_option,
      music_link,
      music_file_url,
      delivery_method,
      photo_url,
      total_usd
    ) VALUES (
      ${input.id}::uuid,
      ${input.email},
      ${input.message},
      ${input.giftNote ?? null},
      ${input.musicOption},
      ${input.musicLink ?? null},
      ${input.musicFileUrl ?? null},
      ${input.deliveryMethod},
      ${input.photoUrl},
      ${input.totalUsd}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function attachStripeSessionToOrder(orderId: string, stripeSessionId: string) {
  const sql = getSql();

  await sql`
    UPDATE orders
    SET stripe_session_id = ${stripeSessionId}
    WHERE id = ${orderId}::uuid
  `;
}

export async function attachStripePaymentIntentToOrder(orderId: string, paymentIntentId: string) {
  const sql = getSql();

  await sql`
    UPDATE orders
    SET payment_provider = 'stripe', stripe_payment_intent_id = ${paymentIntentId}
    WHERE id = ${orderId}::uuid
  `;
}

export async function markOrderPaid(orderId: string, paymentIntentId: string | null) {
  const sql = getSql();

  await sql`
    UPDATE orders
    SET status = 'paid', payment_provider = 'stripe', stripe_payment_intent_id = ${paymentIntentId}
    WHERE id = ${orderId}::uuid
  `;
}

export async function attachPayPalOrderToOrder(orderId: string, paypalOrderId: string) {
  const sql = getSql();

  await sql`
    UPDATE orders
    SET payment_provider = 'paypal', paypal_order_id = ${paypalOrderId}
    WHERE id = ${orderId}::uuid
  `;
}

export async function markOrderPaidPayPal(orderId: string, paypalCaptureId: string | null) {
  const sql = getSql();

  await sql`
    UPDATE orders
    SET status = 'paid', payment_provider = 'paypal', paypal_capture_id = ${paypalCaptureId}
    WHERE id = ${orderId}::uuid
  `;
}

export async function markOrderCanceled(orderId: string) {
  const sql = getSql();

  await sql`
    UPDATE orders
    SET status = 'canceled'
    WHERE id = ${orderId}::uuid
  `;
}

// ============================================
// ADMIN TABLES INIT
// ============================================

export async function initAdminTables() {
  const sql = getSql();

  // Settings table (key-value store)
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key text PRIMARY KEY,
      value text NOT NULL
    )
  `;

  // Promo codes table
  await sql`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text UNIQUE NOT NULL,
      discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
      discount_value numeric(10,2) NOT NULL,
      max_uses integer,
      current_uses integer NOT NULL DEFAULT 0,
      expires_at timestamptz,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  // Google Ads expenses table
  await sql`
    CREATE TABLE IF NOT EXISTS google_ads_expenses (
      month text PRIMARY KEY,
      amount numeric(10,2) NOT NULL DEFAULT 0
    )
  `;

  // Extend orders table with admin fields if not present
  await sql`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS order_status text DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS cost numeric(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promo_code text,
    ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0
  `;

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_provider text,
    ADD COLUMN IF NOT EXISTS paypal_order_id text,
    ADD COLUMN IF NOT EXISTS paypal_capture_id text
  `;
}

// ============================================
// ORDERS (Admin)
// ============================================

export type Order = {
  id: string;
  created_at: string;
  status: string;
  order_status: string;
  email: string;
  message: string;
  gift_note: string | null;
  music_option: string;
  music_link: string | null;
  music_file_url: string | null;
  delivery_method: string;
  photo_url: string;
  total_usd: number;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_provider: string | null;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  notes: string | null;
  cost: number;
  promo_code: string | null;
  discount_amount: number;
};

export async function getOrderById(orderId: string): Promise<Order | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM orders WHERE id = ${orderId}::uuid LIMIT 1`;
  return rows.length > 0 ? (rows[0] as Order) : null;
}

export async function getAllOrders(): Promise<Order[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM orders ORDER BY created_at DESC
  `;
  return rows as Order[];
}

export async function updateOrderStatus(orderId: string, orderStatus: string) {
  const sql = getSql();
  await sql`
    UPDATE orders SET order_status = ${orderStatus} WHERE id = ${orderId}::uuid
  `;
}

export async function updateOrderNotes(orderId: string, notes: string) {
  const sql = getSql();
  await sql`
    UPDATE orders SET notes = ${notes} WHERE id = ${orderId}::uuid
  `;
}

export async function updateOrderCost(orderId: string, cost: number) {
  const sql = getSql();
  await sql`
    UPDATE orders SET cost = ${cost} WHERE id = ${orderId}::uuid
  `;
}

export async function deleteOrder(orderId: string) {
  const sql = getSql();
  await sql`
    DELETE FROM orders WHERE id = ${orderId}::uuid
  `;
}

// ============================================
// SETTINGS
// ============================================

export async function getSetting(key: string): Promise<string | null> {
  await ensureSettingsTable();
  const sql = getSql();
  const rows = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(key: string, value: string) {
  await ensureSettingsTable();
  const sql = getSql();
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = ${value}
  `;
}

export async function getStripeSettings() {
  const secret = await getSetting('stripe_secret_key');
  const publishable = await getSetting('stripe_publishable_key');
  return { secretKey: secret, publishableKey: publishable };
}

export async function updateStripeSettings(secretKey: string, publishableKey: string) {
  await setSetting('stripe_secret_key', secretKey);
  await setSetting('stripe_publishable_key', publishableKey);
}

export type PricingSettings = {
  base: number;
  customSong: number;
  expressDelivery: number;
};

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  base: 19.99,
  customSong: 9.99,
  expressDelivery: 7.99,
};

export async function getPricingSettings(): Promise<PricingSettings> {
  const base = await getSetting('price_base');
  const customSong = await getSetting('price_custom_song');
  const expressDelivery = await getSetting('price_express_delivery');

  const parsedBase = base != null ? Number.parseFloat(base) : NaN;
  const parsedCustomSong = customSong != null ? Number.parseFloat(customSong) : NaN;
  const parsedExpress = expressDelivery != null ? Number.parseFloat(expressDelivery) : NaN;

  return {
    base: Number.isFinite(parsedBase) ? parsedBase : DEFAULT_PRICING_SETTINGS.base,
    customSong: Number.isFinite(parsedCustomSong) ? parsedCustomSong : DEFAULT_PRICING_SETTINGS.customSong,
    expressDelivery: Number.isFinite(parsedExpress) ? parsedExpress : DEFAULT_PRICING_SETTINGS.expressDelivery,
  };
}

export async function updatePricingSettings(input: Partial<PricingSettings>) {
  const current = await getPricingSettings();
  const next: PricingSettings = {
    base: input.base ?? current.base,
    customSong: input.customSong ?? current.customSong,
    expressDelivery: input.expressDelivery ?? current.expressDelivery,
  };

  await setSetting('price_base', String(next.base));
  await setSetting('price_custom_song', String(next.customSong));
  await setSetting('price_express_delivery', String(next.expressDelivery));
}

// ============================================
// PROMO CODES
// ============================================

export type PromoCode = {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

export async function getAllPromoCodes(): Promise<PromoCode[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM promo_codes ORDER BY created_at DESC`;
  return rows as PromoCode[];
}

export async function createPromoCode(data: {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses?: number;
  expiresAt?: string;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, expires_at)
    VALUES (${data.code}, ${data.discountType}, ${data.discountValue}, ${data.maxUses ?? null}, ${data.expiresAt ?? null}::timestamptz)
  `;
}

export async function updatePromoCode(id: string, data: {
  code?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}) {
  const sql = getSql();
  // Build dynamic update - for simplicity, update all fields
  await sql`
    UPDATE promo_codes SET
      code = COALESCE(${data.code ?? null}, code),
      discount_type = COALESCE(${data.discountType ?? null}, discount_type),
      discount_value = COALESCE(${data.discountValue ?? null}, discount_value),
      max_uses = COALESCE(${data.maxUses}, max_uses),
      expires_at = COALESCE(${data.expiresAt}::timestamptz, expires_at),
      is_active = COALESCE(${data.isActive ?? null}, is_active)
    WHERE id = ${id}::uuid
  `;
}

export async function deletePromoCode(id: string) {
  const sql = getSql();
  await sql`DELETE FROM promo_codes WHERE id = ${id}::uuid`;
}

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM promo_codes 
    WHERE code = ${code} 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR current_uses < max_uses)
  `;
  return rows.length > 0 ? (rows[0] as PromoCode) : null;
}

export async function incrementPromoCodeUsage(code: string) {
  const sql = getSql();
  await sql`UPDATE promo_codes SET current_uses = current_uses + 1 WHERE code = ${code}`;
}

// ============================================
// GOOGLE ADS EXPENSES
// ============================================

export type GoogleAdsExpense = {
  month: string;
  amount: number;
};

export async function getAllGoogleAdsExpenses(): Promise<GoogleAdsExpense[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM google_ads_expenses ORDER BY month DESC`;
  return rows as GoogleAdsExpense[];
}

export async function setGoogleAdsExpense(month: string, amount: number) {
  const sql = getSql();
  await sql`
    INSERT INTO google_ads_expenses (month, amount) VALUES (${month}, ${amount})
    ON CONFLICT (month) DO UPDATE SET amount = ${amount}
  `;
}
