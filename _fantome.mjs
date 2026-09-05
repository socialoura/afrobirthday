import postgres from "postgres"; import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>/^[A-Z0-9_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,"")];}));
const sql = postgres(env.POSTGRES_URL,{prepare:false,ssl:"require",max:3});

// Une commande "fantome" : en attente, alors que la MEME adresse a une commande
// payee creee dans les 2 heures qui suivent.
const rows = await sql`
  SELECT p.id::text AS id, p.email, p.created_at AS pending_at, q.created_at AS paid_at,
         EXTRACT(EPOCH FROM (q.created_at - p.created_at))/60 AS minutes,
         p.total_usd AS pending_usd, q.total_usd AS paid_usd, p.currency AS pc, q.currency AS qc
  FROM orders p
  JOIN orders q ON lower(trim(q.email)) = lower(trim(p.email))
               AND q.status = 'paid'
               AND q.created_at >= p.created_at
               AND q.created_at <= p.created_at + interval '2 hours'
  WHERE p.status = 'pending'
  ORDER BY p.created_at DESC`;

const [tot] = await sql`SELECT count(*) AS n FROM orders WHERE status='pending'`;
const [all] = await sql`SELECT count(*) AS n FROM orders`;
console.log("commandes totales :", all.n, "| en attente :", tot.n);
console.log("dont fantomes (doublon d'un achat abouti) :", rows.length,
            `= ${(100*rows.length/Number(tot.n)).toFixed(0)}% des commandes en attente`);
console.log("\ndelai entre la tentative abandonnee et l'achat :");
const mins = rows.map(r=>Number(r.minutes)).sort((a,b)=>a-b);
if (mins.length) {
  console.log("  median :", mins[Math.floor(mins.length/2)].toFixed(1), "min | max :", mins.at(-1).toFixed(1), "min");
  console.log("  moins de 15 min :", mins.filter(m=>m<15).length, "sur", mins.length);
}
console.log("\nles 8 plus recents :");
for (const r of rows.slice(0,8))
  console.log(`  ${r.pending_at.toISOString().slice(0,16)}  ${r.email.padEnd(30)} ${Number(r.minutes).toFixed(0).padStart(4)} min  ${r.pc} ${r.pending_usd} -> ${r.qc} ${r.paid_usd}`);
await sql.end();
