#!/usr/bin/env node
// Génère les liens "upload direct" (et "recap") SIGNÉS pour une ou plusieurs
// commandes, à partir de leur ID. Reproduit fidèlement createUploadToken de
// src/lib/auth.ts (payload {orderId, scope:"upload", exp}, HMAC-SHA256 base64url).
// Si tu modifies la logique de token dans auth.ts, mets ce script à jour aussi.
//
// Usage:
//   node scripts/upload-link.mjs <orderId> [<orderId> ...]
//
// Variables d'env lues (depuis l'environnement, sinon .env.local puis .env):
//   ADMIN_TOKEN_SECRET   (obligatoire, >= 32 caractères)
//   NEXT_PUBLIC_SITE_URL (sinon https://afrobirthday.com)

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const UPLOAD_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 jours, comme auth.ts

// --- Chargement minimal d'un .env si la variable n'est pas déjà dans l'env ----
function loadEnvFile(file) {
  try {
    const txt = readFileSync(resolve(process.cwd(), file), "utf-8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      if (process.env[key]) continue; // l'env réel a priorité
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    // fichier absent → on ignore
  }
}

if (!process.env.ADMIN_TOKEN_SECRET) loadEnvFile(".env.local");
if (!process.env.ADMIN_TOKEN_SECRET) loadEnvFile(".env");

// --- Logique de token (identique à src/lib/auth.ts) --------------------------
function base64UrlEncode(buf) {
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getSecret() {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    console.error(
      "ERREUR: ADMIN_TOKEN_SECRET manquant ou trop court (>= 32 caractères requis)."
    );
    process.exit(1);
  }
  return secret;
}

function sign(payload) {
  return base64UrlEncode(
    createHmac("sha256", getSecret()).update(payload).digest()
  );
}

function createUploadToken(orderId) {
  const payload = { orderId, scope: "upload", exp: Date.now() + UPLOAD_TOKEN_TTL_MS };
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf-8"));
  return `${body}.${sign(body)}`;
}

// --- Sortie ------------------------------------------------------------------
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://afrobirthday.com").replace(/\/$/, "");
const ids = process.argv.slice(2).filter(Boolean);

if (ids.length === 0) {
  console.error("Usage: node scripts/upload-link.mjs <orderId> [<orderId> ...]");
  process.exit(1);
}

for (const id of ids) {
  const t = createUploadToken(id);
  console.log(`Commande ${String(id).slice(0, 8)}`);
  console.log(`  upload: ${siteUrl}/admin/upload/${id}?t=${t}`);
  console.log(`  recap:  ${siteUrl}/admin/recap/${id}?t=${t}`);
}
