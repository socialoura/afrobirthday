import postgres from "postgres";
import { timingSafeEqual } from "node:crypto";
import type { Duplex } from "node:stream";
import { Client as SshClient } from "ssh2";

const DATABASE_URL = process.env.DATABASE_URL;

let cachedSql: ReturnType<typeof postgres> | null = null;

function openDatabaseTunnel(hosts: string[], ports: number[]): Promise<Duplex> {
  const [databaseHost] = hosts;
  const [databasePort] = ports;
  const sshHost = process.env.DATABASE_SSH_HOST;
  const sshUser = process.env.DATABASE_SSH_USER;
  const privateKey = process.env.DATABASE_SSH_PRIVATE_KEY;
  const expectedFingerprint = process.env.DATABASE_SSH_HOST_KEY_SHA256?.toLowerCase();

  if (!databaseHost || !databasePort || !sshHost || !sshUser || !privateKey) {
    throw new Error("PostgreSQL SSH tunnel configuration is missing.");
  }
  if (!expectedFingerprint || !/^[a-f0-9]{64}$/.test(expectedFingerprint)) {
    throw new Error("DATABASE_SSH_HOST_KEY_SHA256 must be a SHA-256 hex fingerprint.");
  }

  return new Promise((resolve, reject) => {
    const ssh = new SshClient();
    let settled = false;
    let forwardedSocket: Duplex | undefined;
    let forwardOutTimer: ReturnType<typeof setTimeout> | undefined;
    const clearForwardOutTimer = () => {
      if (forwardOutTimer) clearTimeout(forwardOutTimer);
      forwardOutTimer = undefined;
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearForwardOutTimer();
      ssh.end();
      reject(error);
    };

    ssh.once("error", fail);
    ssh.once("close", () => {
      if (!settled) {
        fail(new Error("SSH closed before the PostgreSQL tunnel was opened."));
      } else if (forwardedSocket && !forwardedSocket.destroyed) {
        forwardedSocket.destroy(new Error("PostgreSQL SSH tunnel was closed."));
      }
    });
    ssh.once("ready", () => {
      forwardOutTimer = setTimeout(() => fail(new Error("Timed out opening the PostgreSQL SSH tunnel.")), 8_000);
      ssh.forwardOut("127.0.0.1", 0, databaseHost, databasePort, (error, socket) => {
        clearForwardOutTimer();
        if (settled) {
          socket?.destroy();
          return;
        }
        if (error) return fail(error);
        settled = true;
        forwardedSocket = socket;
        let inactivityTimer: ReturnType<typeof setTimeout>;
        const refreshInactivityTimer = () => {
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => (socket as Duplex).destroy(new Error("The PostgreSQL SSH tunnel is unresponsive.")), 15_000);
        };
        socket.on("data", refreshInactivityTimer);
        socket.once("close", () => clearTimeout(inactivityTimer));
        refreshInactivityTimer();
        ssh.removeListener("error", fail);
        ssh.on("error", () => {
          if (!socket.destroyed) socket.destroy();
        });
        socket.once("close", () => ssh.end());
        resolve(socket);
      });
    });

    const sshPort = Number(process.env.DATABASE_SSH_PORT || 22);
    if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65_535) {
      fail(new Error("DATABASE_SSH_PORT must be a valid port."));
      return;
    }
    ssh.connect({
      host: sshHost,
      port: sshPort,
      username: sshUser,
      privateKey,
      hostHash: "sha256",
      algorithms: { serverHostKey: ["ssh-ed25519"] },
      hostVerifier: (fingerprint: string | Buffer) => {
        if (typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/i.test(fingerprint)) return false;
        return timingSafeEqual(Buffer.from(fingerprint, "hex"), Buffer.from(expectedFingerprint, "hex"));
      },
      readyTimeout: 10_000,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 2,
    });
  });
}

export function getSql() {
  if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
  }
  if (!cachedSql) {
    const databaseHost = new URL(DATABASE_URL).hostname;
    const usesSshTunnel = Boolean(process.env.DATABASE_SSH_HOST);
    const databaseIsLocal = ["127.0.0.1", "localhost", "::1"].includes(databaseHost);
    if (process.env.VERCEL && databaseIsLocal && !usesSshTunnel) {
      throw new Error("DATABASE_URL targets localhost on Vercel but DATABASE_SSH_HOST is missing.");
    }
    const options = {
      prepare: false,
      max: 1,
      max_pipeline: 1,
      idle_timeout: process.env.VERCEL === "1" ? 1 : 20,
      max_lifetime: process.env.VERCEL === "1" ? 30 : 1800,
      connect_timeout: 15,
      ssl: usesSshTunnel || databaseIsLocal ? false : "verify-full",
      ...(usesSshTunnel
        ? { socket: (connection: { host: string[]; port: number[] }) => openDatabaseTunnel(connection.host, connection.port) }
        : {}),
    } as NonNullable<Parameters<typeof postgres>[1]> & {
      socket?: (connection: { host: string[]; port: number[] }) => Promise<Duplex>;
    };
    cachedSql = postgres(DATABASE_URL, options);
  }
  return cachedSql;
}

// Both schema guards below sit on the checkout path and used to replay their
// DDL on every single request — 8 statements for orders, 1 per settings read.
// The statements are all IF NOT EXISTS, so running them once per process is
// enough; a cold start still re-runs them, and a failure clears the cache so
// the next request retries.
let ordersTableReady: Promise<void> | null = null;
let settingsTableReady: Promise<void> | null = null;

export function ensureOrdersTable(): Promise<void> {
  if (!ordersTableReady) {
    ordersTableReady = runEnsureOrdersTable().catch((err) => {
      ordersTableReady = null;
      throw err;
    });
  }
  return ordersTableReady;
}

async function runEnsureOrdersTable() {
  const sql = getSql();

  // Fast path: every ALTER below takes an ACCESS EXCLUSIVE lock on orders even
  // when the column exists, and each is a round trip through the SSH tunnel on
  // the checkout's cold start. If the newest column is already there, the
  // whole schema is. Keep this sentinel pointed at the LAST column added below.
  const [{ ready }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'client_user_agent'
    ) AS ready
  `;
  if (ready) return;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'pending',

      email text NOT NULL,
      message text NOT NULL,

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

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS country text
  `;

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS total_local numeric(12,2),
    ADD COLUMN IF NOT EXISTS exchange_rate numeric(14,6)
  `;

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS device text
  `;

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS voiceover_url text,
    ADD COLUMN IF NOT EXISTS downloaded_music_url text
  `;

  // Also created by initAdminTables(), but createOrder() needs these columns
  // even if the admin dashboard was never opened on this database.
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS promo_code text,
    ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0
  `;

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS dance_extended boolean NOT NULL DEFAULT false
  `;

  // First-touch attribution. Declared here, on the guard createOrder() actually
  // awaits — a column declared only in the admin's schema helper would be
  // missing on the very first order after deploy.
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS attribution_source text,
    ADD COLUMN IF NOT EXISTS attribution_medium text,
    ADD COLUMN IF NOT EXISTS attribution_campaign text,
    ADD COLUMN IF NOT EXISTS attribution_landing text,
    ADD COLUMN IF NOT EXISTS attribution_referrer text,
    ADD COLUMN IF NOT EXISTS attribution_first_seen_at timestamptz
  `;

  // The currency the customer was shown, as opposed to the one charged.
  // PayPal bills every order in USD, so without this a European who paid by
  // PayPal was indistinguishable from an American — and the price test could
  // not tell which arm they were in.
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS display_currency text
  `;

  // Set once the order confirmation email is accepted by Resend, so a failed
  // send can be retried instead of being lost after the paid claim.
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz
  `;

  // Orders paid before the column existed must be backfilled exactly once,
  // otherwise the retry cron would email every recent customer a second
  // time. The settings row is the "done" marker: only the cold start that
  // inserts it runs the backfill, and a failed backfill removes it so the
  // next cold start tries again. (A plpgsql DO block was used first; plain
  // statements avoid depending on dollar-quoting through the driver.)
  await ensureSettingsTable();
  const backfillClaim = await sql`
    INSERT INTO settings (key, value)
    VALUES ('confirmation_email_backfilled_at', now()::text)
    ON CONFLICT (key) DO NOTHING
    RETURNING key
  `;
  if (backfillClaim.length === 1) {
    try {
      await sql`
        UPDATE orders SET confirmation_email_sent_at = created_at
        WHERE status = 'paid' AND confirmation_email_sent_at IS NULL
      `;
    } catch (err) {
      await sql`DELETE FROM settings WHERE key = 'confirmation_email_backfilled_at'`.catch(() => {});
      throw err;
    }
  }

  // Ads measurement: full first touch (term/content/click id), the last
  // marketing touch before the order, the storefront locale, and what the
  // ChatGPT Ads Conversions API needs (consent, IP, user agent, OpenAI ref).
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS locale text,
    ADD COLUMN IF NOT EXISTS attribution_term text,
    ADD COLUMN IF NOT EXISTS attribution_content text,
    ADD COLUMN IF NOT EXISTS attribution_click_id text,
    ADD COLUMN IF NOT EXISTS last_touch_source text,
    ADD COLUMN IF NOT EXISTS last_touch_medium text,
    ADD COLUMN IF NOT EXISTS last_touch_campaign text,
    ADD COLUMN IF NOT EXISTS last_touch_click_id text,
    ADD COLUMN IF NOT EXISTS last_touch_at timestamptz,
    ADD COLUMN IF NOT EXISTS ads_consent boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS oai_ref text,
    ADD COLUMN IF NOT EXISTS client_ip text,
    ADD COLUMN IF NOT EXISTS client_user_agent text
  `;
}

export async function ensurePromoCodesTable() {
  const sql = getSql();
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
}

export function ensureSettingsTable(): Promise<void> {
  if (!settingsTableReady) {
    settingsTableReady = runEnsureSettingsTable().catch((err) => {
      settingsTableReady = null;
      throw err;
    });
  }
  return settingsTableReady;
}

async function runEnsureSettingsTable() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key text PRIMARY KEY,
      value text NOT NULL
    )
  `;

  // Roll back the September price test exactly once. The marker keeps later
  // price changes made from the admin dashboard from being overwritten on
  // every cold start.
  await sql.begin(async (transaction) => {
    const applied = await transaction`
      INSERT INTO settings (key, value)
      VALUES ('migration_price_base_20_20260921', ${new Date().toISOString()})
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `;

    if (applied.length === 0) return;

    await transaction`
      INSERT INTO settings (key, value)
      VALUES ('price_base', '20')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;

    const priceTests = await transaction`
      SELECT value FROM settings WHERE key = 'price_test'
    `;
    if (priceTests.length === 0) return;

    try {
      const priceTest = JSON.parse(priceTests[0].value) as Record<string, unknown>;
      if (!priceTest.endedAt) {
        priceTest.endedAt = new Date().toISOString();
        await transaction`
          UPDATE settings
          SET value = ${JSON.stringify(priceTest)}
          WHERE key = 'price_test'
        `;
      }
    } catch {
      // A malformed analytics definition must not prevent the price rollback.
    }
  });
}

export type OrderCreateInput = {
  id: string;
  email: string;
  message: string;
  musicOption: string;
  musicLink?: string;
  musicFileUrl?: string;
  deliveryMethod: string;
  photoUrl: string;
  totalUsd: number;
  country?: string;
  /** Currency actually charged to the customer (defaults to USD). */
  currency?: string;
  /** Currency the customer was shown; differs from `currency` on PayPal. */
  displayCurrency?: string;
  /** Amount charged in the local currency (defaults to totalUsd). */
  totalLocal?: number;
  /** USD -> currency rate used at checkout time. */
  exchangeRate?: number;
  /** Device the order was placed from: mobile | tablet | desktop. */
  device?: string;
  /** Promo code applied at checkout, if any (canonical stored casing). */
  promoCode?: string;
  /** Discount amount in USD, matching the total_usd reference price. */
  discountAmount?: number;
  /** Dance extended version add-on (video is more than 2 minutes long). */
  danceExtended?: boolean;
  /** First-touch attribution, already narrowed and truncated by the caller. */
  attribution?: OrderAttribution;
  /** Storefront locale the order was placed from (en, fr, ...). */
  locale?: string;
  /** Visitor accepted ad measurement (or is outside the opt-in countries). */
  adsConsent?: boolean;
  /** For the ChatGPT Ads Conversions API; only stored with adsConsent. */
  oaiRef?: string;
  clientIp?: string;
  clientUserAgent?: string;
};

/**
 * The only attribution fields that are allowed into the database.
 *
 * The values originate in browser storage, which the visitor can edit, so the
 * server copies known keys and drops everything else rather than spreading an
 * arbitrary object into the row.
 */
export type OrderAttribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landing: string | null;
  referrer: string | null;
  firstSeenAt: string | null;
  term: string | null;
  content: string | null;
  clickId: string | null;
  last: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    clickId: string | null;
    at: string | null;
  } | null;
};

const ATTRIBUTION_LIMITS = {
  source: 120,
  medium: 120,
  campaign: 120,
  landing: 200,
  referrer: 200,
  term: 120,
  content: 120,
  clickId: 300,
} as const;

function sanitizeDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const parsed = new Date(raw);
  // A visitor-supplied date can be anything; only a real one is kept, and
  // never one in the future.
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now() + 60_000) return null;
  return parsed.toISOString();
}

export function sanitizeAttribution(raw: unknown): OrderAttribution | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const input = raw as Record<string, unknown>;

  const take = (key: keyof typeof ATTRIBUTION_LIMITS, from: Record<string, unknown> = input) => {
    const value = from[key];
    if (typeof value !== "string") return null;
    const trimmed = value.trim().slice(0, ATTRIBUTION_LIMITS[key]);
    return trimmed.length ? trimmed : null;
  };

  const firstSeenAt = sanitizeDate(input.firstSeenAt);
  const rawLast =
    input.last && typeof input.last === "object" ? (input.last as Record<string, unknown>) : null;
  const last = rawLast
    ? {
        source: take("source", rawLast),
        medium: take("medium", rawLast),
        campaign: take("campaign", rawLast),
        clickId: take("clickId", rawLast),
        at: sanitizeDate(rawLast.at),
      }
    : null;

  const out: OrderAttribution = {
    source: take("source"),
    medium: take("medium"),
    campaign: take("campaign"),
    landing: take("landing"),
    referrer: take("referrer"),
    firstSeenAt,
    term: take("term"),
    content: take("content"),
    clickId: take("clickId"),
    last: last && Object.values(last).some((v) => v !== null) ? last : null,
  };

  const hasSomething = Object.values(out).some((v) => v !== null);
  return hasSomething ? out : undefined;
}

export async function createOrder(input: OrderCreateInput) {
  const sql = getSql();

  await sql`
    INSERT INTO orders (
      id,
      email,
      message,
      music_option,
      music_link,
      music_file_url,
      delivery_method,
      photo_url,
      total_usd,
      country,
      currency,
      total_local,
      exchange_rate,
      device,
      promo_code,
      discount_amount,
      dance_extended,
      attribution_source,
      attribution_medium,
      attribution_campaign,
      attribution_landing,
      attribution_referrer,
      attribution_first_seen_at,
      display_currency,
      locale,
      attribution_term,
      attribution_content,
      attribution_click_id,
      last_touch_source,
      last_touch_medium,
      last_touch_campaign,
      last_touch_click_id,
      last_touch_at,
      ads_consent,
      oai_ref,
      client_ip,
      client_user_agent
    ) VALUES (
      ${input.id}::uuid,
      ${input.email},
      ${input.message},
      ${input.musicOption},
      ${input.musicLink ?? null},
      ${input.musicFileUrl ?? null},
      ${input.deliveryMethod},
      ${input.photoUrl},
      ${input.totalUsd},
      ${input.country ?? null},
      ${input.currency ?? "USD"},
      ${input.totalLocal ?? input.totalUsd},
      ${input.exchangeRate ?? 1},
      ${input.device ?? null},
      ${input.promoCode ?? null},
      ${input.discountAmount ?? 0},
      ${input.danceExtended ?? false},
      ${input.attribution?.source ?? null},
      ${input.attribution?.medium ?? null},
      ${input.attribution?.campaign ?? null},
      ${input.attribution?.landing ?? null},
      ${input.attribution?.referrer ?? null},
      ${input.attribution?.firstSeenAt ?? null},
      ${input.displayCurrency ?? input.currency ?? "USD"},
      ${input.locale ?? null},
      ${input.attribution?.term ?? null},
      ${input.attribution?.content ?? null},
      ${input.attribution?.clickId ?? null},
      ${input.attribution?.last?.source ?? null},
      ${input.attribution?.last?.medium ?? null},
      ${input.attribution?.last?.campaign ?? null},
      ${input.attribution?.last?.clickId ?? null},
      ${input.attribution?.last?.at ?? null},
      ${input.adsConsent ?? false},
      ${input.adsConsent ? input.oaiRef ?? null : null},
      ${input.adsConsent ? input.clientIp ?? null : null},
      ${input.adsConsent ? input.clientUserAgent ?? null : null}
    )
    -- One customer, one order row. The client keeps a stable id for the whole
    -- form session, so switching from card to PayPal — or stepping back to
    -- change the delivery speed — updates the attempt instead of leaving a
    -- duplicate behind. 38% of pending orders were such duplicates.
    --
    -- Guarded on status: a replayed request must never rewrite the amount of an
    -- order that has already been paid.
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      message = EXCLUDED.message,
      music_option = EXCLUDED.music_option,
      music_link = EXCLUDED.music_link,
      music_file_url = EXCLUDED.music_file_url,
      delivery_method = EXCLUDED.delivery_method,
      photo_url = EXCLUDED.photo_url,
      total_usd = EXCLUDED.total_usd,
      currency = EXCLUDED.currency,
      total_local = EXCLUDED.total_local,
      exchange_rate = EXCLUDED.exchange_rate,
      promo_code = EXCLUDED.promo_code,
      discount_amount = EXCLUDED.discount_amount,
      dance_extended = EXCLUDED.dance_extended,
      display_currency = EXCLUDED.display_currency,
      locale = EXCLUDED.locale,
      ads_consent = EXCLUDED.ads_consent,
      oai_ref = EXCLUDED.oai_ref,
      client_ip = EXCLUDED.client_ip,
      client_user_agent = EXCLUDED.client_user_agent
    WHERE orders.status = 'pending'
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

/**
 * Atomically marks a Stripe order as paid and claims its post-payment work.
 *
 * Stripe can call the webhook at the same time as the browser calls
 * /api/confirm-payment. A separate read followed by an unconditional update
 * lets both requests observe `pending` and send the email/Telegram bundle
 * twice. The conditional UPDATE is the single source of truth: exactly one
 * concurrent caller receives a row and may run the side effects.
 */
export async function markOrderPaid(
  orderId: string,
  paymentIntentId: string | null
): Promise<boolean> {
  const sql = getSql();

  const claimed = await sql`
    UPDATE orders
    SET status = 'paid', payment_provider = 'stripe', stripe_payment_intent_id = ${paymentIntentId}
    WHERE id = ${orderId}::uuid AND status <> 'paid'
    RETURNING id
  `;

  return claimed.length === 1;
}

export async function attachPayPalOrderToOrder(orderId: string, paypalOrderId: string) {
  const sql = getSql();

  await sql`
    UPDATE orders
    SET payment_provider = 'paypal', paypal_order_id = ${paypalOrderId}
    WHERE id = ${orderId}::uuid
  `;
}

/** PayPal equivalent of markOrderPaid; see its concurrency note above. */
export async function markOrderPaidPayPal(
  orderId: string,
  paypalCaptureId: string | null
): Promise<boolean> {
  const sql = getSql();

  const claimed = await sql`
    UPDATE orders
    SET status = 'paid', payment_provider = 'paypal', paypal_capture_id = ${paypalCaptureId}
    WHERE id = ${orderId}::uuid AND status <> 'paid'
    RETURNING id
  `;

  return claimed.length === 1;
}

/**
 * Cancels an unpaid order when the given Stripe intent/session is the one the
 * order currently points at. One order can accumulate several intents (each
 * return to the payment step creates one); a stale one being canceled after
 * the customer paid with another must never flip a paid order to canceled.
 */
export async function markOrderCanceled(
  orderId: string,
  ref: { paymentIntentId?: string; sessionId?: string }
) {
  const sql = getSql();
  const paymentIntentId = ref.paymentIntentId ?? null;
  const sessionId = ref.sessionId ?? null;

  await sql`
    UPDATE orders
    SET status = 'canceled'
    WHERE id = ${orderId}::uuid
      AND status = 'pending'
      AND (${paymentIntentId}::text IS NULL OR stripe_payment_intent_id = ${paymentIntentId})
      AND (${sessionId}::text IS NULL OR stripe_session_id = ${sessionId})
  `;
}

export async function markConfirmationEmailSent(orderId: string) {
  const sql = getSql();
  await sql`
    UPDATE orders SET confirmation_email_sent_at = now()
    WHERE id = ${orderId}::uuid
  `;
}

/**
 * Paid orders whose confirmation email never went out. The grace period keeps
 * the retry cron from racing the payment request that is still sending it.
 */
export async function getPaidOrdersMissingConfirmationEmail(): Promise<Order[]> {
  await ensureOrdersTable();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM orders
    WHERE status = 'paid'
      AND confirmation_email_sent_at IS NULL
      AND created_at > now() - interval '7 days'
      AND created_at < now() - interval '10 minutes'
    ORDER BY created_at ASC
    LIMIT 50
  `;
  return rows as unknown as Order[];
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
  await ensurePromoCodesTable();

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

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS country text
  `;

  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS final_video_url text,
    ADD COLUMN IF NOT EXISTS final_video_sent_at timestamptz
  `;

  // Automated post-delivery emails: one nullable "sent_at" column per email
  // type, doubling as the idempotency guard for its cron job.
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS review_email_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS abandoned_cart_email_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS cross_sell_email_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS annual_reminder_email_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS referral_email_sent_at timestamptz
  `;

  // photo_url was NOT NULL at table creation; the photo-cleanup cron nulls
  // it out once purged from storage, so the constraint has to go.
  await sql`
    ALTER TABLE orders ALTER COLUMN photo_url DROP NOT NULL
  `;

  // Referral codes: promo_codes.owner_email links a code back to the
  // customer it was generated for (NULL for regular admin-created codes).
  await sql`
    ALTER TABLE promo_codes
    ADD COLUMN IF NOT EXISTS owner_email text
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS promo_code_redemptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL,
      order_id uuid NOT NULL,
      referred_email text NOT NULL,
      redeemed_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await ensureEmailOptOutsTable();
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
  music_option: string;
  music_link: string | null;
  music_file_url: string | null;
  delivery_method: string;
  photo_url: string | null;
  total_usd: number;
  currency: string;
  total_local: number | null;
  exchange_rate: number | null;
  device: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_provider: string | null;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  notes: string | null;
  cost: number;
  promo_code: string | null;
  discount_amount: number;
  dance_extended: boolean;
  country: string | null;
  final_video_url: string | null;
  final_video_sent_at: string | null;
  confirmation_email_sent_at: string | null;
  voiceover_url: string | null;
  downloaded_music_url: string | null;
  review_email_sent_at: string | null;
  abandoned_cart_email_sent_at: string | null;
  cross_sell_email_sent_at: string | null;
  annual_reminder_email_sent_at: string | null;
  referral_email_sent_at: string | null;
  attribution_source: string | null;
  attribution_medium: string | null;
  attribution_campaign: string | null;
  attribution_landing: string | null;
  attribution_referrer: string | null;
  attribution_first_seen_at: string | null;
  locale: string | null;
  ads_consent: boolean;
  oai_ref: string | null;
  client_ip: string | null;
  client_user_agent: string | null;
};

// Persist best-effort media generated at payment time (voiceover MP3, and the
// MP3 auto-downloaded from a custom music link) so the recap page can show them.
export async function setOrderMedia(
  orderId: string,
  media: { voiceoverUrl?: string | null; downloadedMusicUrl?: string | null }
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE orders
    SET voiceover_url = COALESCE(${media.voiceoverUrl ?? null}, voiceover_url),
        downloaded_music_url = COALESCE(${media.downloadedMusicUrl ?? null}, downloaded_music_url)
    WHERE id = ${orderId}::uuid
  `;
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM orders WHERE id = ${orderId}::uuid LIMIT 1`;
  return rows.length > 0 ? (rows[0] as unknown as Order) : null;
}

export async function getAllOrders(): Promise<Order[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM orders ORDER BY created_at DESC
  `;
  return rows as unknown as Order[];
}

/** Count of orders delivered (final video sent) in the last N days — used for the public "recent activity" trust badge. */
export async function getRecentlyDeliveredOrdersCount(days: number): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM orders
    WHERE final_video_sent_at IS NOT NULL
      AND final_video_sent_at >= now() - (${days} || ' days')::interval
  `;
  return rows.length > 0 ? Number(rows[0].count) : 0;
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

export async function updateOrderFinalVideoUrl(orderId: string, url: string | null) {
  const sql = getSql();
  await sql`
    UPDATE orders SET final_video_url = ${url} WHERE id = ${orderId}::uuid
  `;
}

export async function markFinalVideoSent(orderId: string) {
  const sql = getSql();
  await sql`
    UPDATE orders
    SET final_video_sent_at = now(),
        order_status = 'completed'
    WHERE id = ${orderId}::uuid
  `;
}

export async function markReviewEmailSent(orderId: string) {
  const sql = getSql();
  await sql`
    UPDATE orders SET review_email_sent_at = now() WHERE id = ${orderId}::uuid
  `;
}

export async function markAbandonedCartEmailSent(orderId: string) {
  const sql = getSql();
  await sql`
    UPDATE orders SET abandoned_cart_email_sent_at = now() WHERE id = ${orderId}::uuid
  `;
}

export async function markCrossSellEmailSent(orderId: string) {
  const sql = getSql();
  await sql`
    UPDATE orders SET cross_sell_email_sent_at = now() WHERE id = ${orderId}::uuid
  `;
}

export async function markAnnualReminderEmailSent(orderId: string) {
  const sql = getSql();
  await sql`
    UPDATE orders SET annual_reminder_email_sent_at = now() WHERE id = ${orderId}::uuid
  `;
}

export async function markReferralEmailSent(orderId: string) {
  const sql = getSql();
  await sql`
    UPDATE orders SET referral_email_sent_at = now() WHERE id = ${orderId}::uuid
  `;
}

export async function deleteOrder(orderId: string) {
  const sql = getSql();
  await sql`
    DELETE FROM orders WHERE id = ${orderId}::uuid
  `;
}

export async function clearOrderPhoto(orderId: string) {
  const sql = getSql();
  await sql`
    UPDATE orders SET photo_url = NULL WHERE id = ${orderId}::uuid
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

export type PricingSettings = {
  base: number;
  customSong: number;
  expressDelivery: number;
  danceExtended: number;
};

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  base: 20,
  customSong: 9.99,
  expressDelivery: 7.99,
  danceExtended: 20,
};

export async function getPricingSettings(): Promise<PricingSettings> {
  await ensureSettingsTable();
  const sql = getSql();
  const rows = await sql`
    SELECT key, value FROM settings
    WHERE key IN ('price_base', 'price_custom_song', 'price_express_delivery', 'price_dance_extended')
  `;
  const values = new Map(rows.map((r) => [r.key as string, r.value as string]));
  const base = values.get('price_base') ?? null;
  const customSong = values.get('price_custom_song') ?? null;
  const expressDelivery = values.get('price_express_delivery') ?? null;
  const danceExtended = values.get('price_dance_extended') ?? null;

  const parsedBase = base != null ? Number.parseFloat(base) : NaN;
  const parsedCustomSong = customSong != null ? Number.parseFloat(customSong) : NaN;
  const parsedExpress = expressDelivery != null ? Number.parseFloat(expressDelivery) : NaN;
  const parsedDanceExtended = danceExtended != null ? Number.parseFloat(danceExtended) : NaN;

  return {
    base: Number.isFinite(parsedBase) ? parsedBase : DEFAULT_PRICING_SETTINGS.base,
    customSong: Number.isFinite(parsedCustomSong) ? parsedCustomSong : DEFAULT_PRICING_SETTINGS.customSong,
    expressDelivery: Number.isFinite(parsedExpress) ? parsedExpress : DEFAULT_PRICING_SETTINGS.expressDelivery,
    danceExtended: Number.isFinite(parsedDanceExtended) ? parsedDanceExtended : DEFAULT_PRICING_SETTINGS.danceExtended,
  };
}

export async function updatePricingSettings(input: Partial<PricingSettings>) {
  const current = await getPricingSettings();
  const next: PricingSettings = {
    base: input.base ?? current.base,
    customSong: input.customSong ?? current.customSong,
    expressDelivery: input.expressDelivery ?? current.expressDelivery,
    danceExtended: input.danceExtended ?? current.danceExtended,
  };

  await setSetting('price_base', String(next.base));
  await setSetting('price_custom_song', String(next.customSong));
  await setSetting('price_express_delivery', String(next.expressDelivery));
  await setSetting('price_dance_extended', String(next.danceExtended));
}

/**
 * Manual per-currency price overrides. When a currency (and component) has a
 * value here, it is charged as-is instead of converting the USD price with live
 * rates. Keyed by ISO currency code; each field is optional.
 */
export type CurrencyPriceOverride = Partial<PricingSettings>;
export type PricingOverrides = Record<string, CurrencyPriceOverride>;

export async function getPricingOverrides(): Promise<PricingOverrides> {
  const raw = await getSetting('price_overrides');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as PricingOverrides) : {};
  } catch {
    return {};
  }
}

export async function updatePricingOverrides(overrides: PricingOverrides) {
  await setSetting('price_overrides', JSON.stringify(overrides));
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
  /** Set for auto-generated referral codes; NULL for regular admin codes. */
  owner_email: string | null;
};

export async function getAllPromoCodes(): Promise<PromoCode[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM promo_codes ORDER BY created_at DESC`;
  return rows as unknown as PromoCode[];
}

export async function createPromoCode(data: {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses?: number;
  expiresAt?: string;
  ownerEmail?: string;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, expires_at, owner_email)
    VALUES (${data.code}, ${data.discountType}, ${data.discountValue}, ${data.maxUses ?? null}, ${data.expiresAt ?? null}::timestamptz, ${data.ownerEmail ?? null})
  `;
}

export async function getPromoCodeByCode(code: string): Promise<PromoCode | null> {
  await ensurePromoCodesTable();
  const sql = getSql();
  const rows = await sql`SELECT * FROM promo_codes WHERE UPPER(code) = UPPER(${code}) LIMIT 1`;
  return rows.length > 0 ? (rows[0] as unknown as PromoCode) : null;
}

export async function recordPromoCodeRedemption(data: {
  code: string;
  orderId: string;
  referredEmail: string;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO promo_code_redemptions (code, order_id, referred_email)
    VALUES (${data.code}, ${data.orderId}::uuid, ${data.referredEmail})
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
      max_uses = COALESCE(${data.maxUses ?? null}, max_uses),
      expires_at = COALESCE(${data.expiresAt ?? null}::timestamptz, expires_at),
      is_active = COALESCE(${data.isActive ?? null}, is_active)
    WHERE id = ${id}::uuid
  `;
}

export async function deletePromoCode(id: string) {
  const sql = getSql();
  await sql`DELETE FROM promo_codes WHERE id = ${id}::uuid`;
}

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
  await ensurePromoCodesTable();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM promo_codes
    WHERE UPPER(code) = UPPER(${code})
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR current_uses < max_uses)
  `;
  return rows.length > 0 ? (rows[0] as unknown as PromoCode) : null;
}

/**
 * Atomically consumes one use of a promo code at payment time. Checkout only
 * checks `current_uses < max_uses`, so several concurrent checkouts can all
 * pass with a single-use code; this returns false for the ones beyond the cap.
 */
export async function claimPromoCodeUse(code: string): Promise<boolean> {
  await ensurePromoCodesTable();
  const sql = getSql();
  const rows = await sql`
    UPDATE promo_codes SET current_uses = current_uses + 1
    WHERE UPPER(code) = UPPER(${code})
      AND (max_uses IS NULL OR current_uses < max_uses)
    RETURNING id
  `;
  return rows.length === 1;
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
  return rows as unknown as GoogleAdsExpense[];
}

export async function setGoogleAdsExpense(month: string, amount: number) {
  const sql = getSql();
  await sql`
    INSERT INTO google_ads_expenses (month, amount) VALUES (${month}, ${amount})
    ON CONFLICT (month) DO UPDATE SET amount = ${amount}
  `;
}

// ============================================
// EMAIL OPT-OUTS
// ============================================
// Suppression list for the automated marketing emails. Transactional mail
// (order confirmation, final video delivery) ignores it — a customer who
// opted out of marketing still has to receive the thing they paid for.

export type EmailOptOut = {
  email: string;
  created_at: string;
  source: string;
};

/**
 * The automated-email crons run without ever touching initAdminTables, so on
 * 2026-08-22 they ran against a production database where these columns had
 * never been added: `order.review_email_sent_at` came back undefined, the
 * idempotency guard silently passed, and 106 customers got the review request
 * every single day. The guard has to be able to fail closed, so every cron
 * ensures its own columns before reading orders.
 */
export async function ensureAutomatedEmailColumns() {
  const sql = getSql();
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS review_email_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS abandoned_cart_email_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS cross_sell_email_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS annual_reminder_email_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS referral_email_sent_at timestamptz
  `;
}

export async function ensureEmailOptOutsTable() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS email_optouts (
      email text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      source text NOT NULL DEFAULT 'link'
    )
  `;
}

/** Lowercased + trimmed: the suppression list is keyed on this everywhere. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function addEmailOptOut(email: string, source = "link") {
  await ensureEmailOptOutsTable();
  const sql = getSql();
  await sql`
    INSERT INTO email_optouts (email, source)
    VALUES (${normalizeEmail(email)}, ${source})
    ON CONFLICT (email) DO NOTHING
  `;
}

export async function removeEmailOptOut(email: string) {
  await ensureEmailOptOutsTable();
  const sql = getSql();
  await sql`DELETE FROM email_optouts WHERE email = ${normalizeEmail(email)}`;
}

export async function isEmailOptedOut(email: string): Promise<boolean> {
  await ensureEmailOptOutsTable();
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM email_optouts WHERE email = ${normalizeEmail(email)} LIMIT 1
  `;
  return rows.length > 0;
}

export async function getOptedOutEmails(): Promise<Set<string>> {
  await ensureEmailOptOutsTable();
  const sql = getSql();
  const rows = await sql`SELECT email FROM email_optouts`;
  return new Set(rows.map((r) => r.email as string));
}

export async function getAllEmailOptOuts(): Promise<EmailOptOut[]> {
  await ensureEmailOptOutsTable();
  const sql = getSql();
  const rows = await sql`
    SELECT email, created_at, source FROM email_optouts ORDER BY created_at DESC
  `;
  return rows as unknown as EmailOptOut[];
}
