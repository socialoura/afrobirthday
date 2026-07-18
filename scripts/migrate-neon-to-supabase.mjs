// One-off (but re-runnable) data migration: copies the `settings`,
// `promo_codes`, `google_ads_expenses` and `orders` tables from the old Neon
// Postgres database into the new Supabase Postgres database.
//
// Idempotent: every insert uses ON CONFLICT ... DO UPDATE, so this is safe to
// re-run any number of times (e.g. a final delta pass right before cutover).
//
// Usage:
//   NEON_POSTGRES_URL=... SUPABASE_POSTGRES_URL_NON_POOLING=... node scripts/migrate-neon-to-supabase.mjs
//
// Keep the schema block below in sync with ensureOrdersTable/ensureSettingsTable/
// initAdminTables in src/lib/db.ts if the schema changes before cutover.

import postgres from "postgres";

const neonUrl = process.env.NEON_POSTGRES_URL;
const supabaseUrl = process.env.SUPABASE_POSTGRES_URL_NON_POOLING;

if (!neonUrl || !supabaseUrl) {
  console.error(
    "Missing NEON_POSTGRES_URL or SUPABASE_POSTGRES_URL_NON_POOLING env vars."
  );
  process.exit(1);
}

const src = postgres(neonUrl, { ssl: "require" });
const dst = postgres(supabaseUrl, { ssl: "require" });

async function ensureSchema(sql) {
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
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS country text`;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS total_local numeric(12,2),
    ADD COLUMN IF NOT EXISTS exchange_rate numeric(14,6)
  `;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS device text`;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS voiceover_url text,
    ADD COLUMN IF NOT EXISTS downloaded_music_url text
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key text PRIMARY KEY,
      value text NOT NULL
    )
  `;

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

  await sql`
    CREATE TABLE IF NOT EXISTS google_ads_expenses (
      month text PRIMARY KEY,
      amount numeric(10,2) NOT NULL DEFAULT 0
    )
  `;

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
    ADD COLUMN IF NOT EXISTS final_video_url text,
    ADD COLUMN IF NOT EXISTS final_video_sent_at timestamptz
  `;
}

// Belt-and-suspenders against schema drift between the live Neon DB and the
// DDL hardcoded above (e.g. columns added by hand outside of db.ts): copy any
// column that exists on the source table but not the destination.
async function syncMissingColumns(table) {
  const srcCols = await src`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
  const dstCols = await dst`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
  const existing = new Set(dstCols.map((c) => c.column_name));
  for (const col of srcCols) {
    if (existing.has(col.column_name)) continue;
    console.log(`  adding missing column ${table}.${col.column_name} (${col.data_type})`);
    await dst.unsafe(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "${col.column_name}" ${col.data_type}`
    );
  }
}

async function copyTable(table, conflictCol) {
  const rows = await src`SELECT * FROM ${src(table)}`;
  if (rows.length === 0) return 0;

  const columns = Object.keys(rows[0]);
  const setClause = columns
    .filter((c) => c !== conflictCol)
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await dst`
      INSERT INTO ${dst(table)} ${dst(chunk, ...columns)}
      ON CONFLICT (${dst.unsafe(conflictCol)}) DO UPDATE SET ${dst.unsafe(setClause)}
    `;
  }
  return rows.length;
}

async function verify(table) {
  const [{ count: a }] = await src`SELECT count(*) FROM ${src(table)}`;
  const [{ count: b }] = await dst`SELECT count(*) FROM ${dst(table)}`;
  console.log(`${table}: neon=${a} supabase=${b} ${a === b ? "OK" : "MISMATCH"}`);
}

const tables = [
  ["settings", "key"],
  ["promo_codes", "id"],
  ["google_ads_expenses", "month"],
  ["orders", "id"],
];

await ensureSchema(dst);

for (const [table] of tables) {
  await syncMissingColumns(table);
}

for (const [table, conflictCol] of tables) {
  const n = await copyTable(table, conflictCol);
  console.log(`copied ${n} rows into ${table}`);
}

console.log("--- verification ---");
for (const [table] of tables) {
  await verify(table);
}

await src.end();
await dst.end();
