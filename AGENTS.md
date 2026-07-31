# AGENTS.md — Contexte repo AfroBirthday

Analyse code-first du repo (croisée avec les `.md` racine) au **2026-07-30**. Quand une doc racine contredit ce fichier, **le code réel gagne**.

## 1) Vue rapide du projet

AfroBirthday est une app e-commerce Next.js pour commander des vidéos d'anniversaire personnalisées :

- storefront multilingue (`next-intl`, 10 locales) avec formulaire de commande ;
- upload photo/musique vers **Supabase Storage** ;
- paiement **Stripe** (flux actuel UI = PaymentIntent + modale custom) ou **PayPal** ;
- après paiement : email client (Resend), notification équipe **Telegram**, téléchargement best-effort de la musique custom, génération best-effort d'un vocal OpenAI si le message n'est pas jugé anglais ;
- production via dashboard admin ou liens magiques signés (upload/review récap) ;
- livraison finale : upload vidéo vers Supabase, email client avec lien `/v/<orderId>` qui redirige vers `final_video_url`.

## 2) Stack technique et dépendances principales

- **Framework** : Next.js **16.1.6** App Router + Turbopack, React **18.3.1**, TypeScript strict.
- **Styles** : Tailwind CSS 3.4, `tailwind-merge`, `clsx`, classes utilitaires custom (`glass-card`, `btn-primary`, `section-container`, etc.).
- **i18n** : `next-intl` 4.8 ; locales dans `messages/*.json` ; config dans `src/i18n/config.ts` ; middleware `localePrefix: "always"`.
- **DB** : Postgres via package `postgres` (pas d'ORM), code-first DDL dans `src/lib/db.ts`.
- **Storage** : Supabase Storage bucket `orders` via `@supabase/supabase-js` **service role** côté serveur.
- **Paiements** : `stripe` 16 + `@stripe/react-stripe-js` / `@stripe/stripe-js` ; PayPal via REST `api-m.paypal.com` / sandbox.
- **Emails** : Resend API HTTP directe (`src/lib/resend.ts`).
- **Notifications** : Telegram Bot API (`src/lib/telegramBot.ts`) ; le module Discord existe mais est **désactivé** (`DISCORD_DISABLED = true`).
- **IA** : OpenAI TTS pour vocaux (`src/lib/voiceover.ts`) ; Anthropic via AWS Bedrock pour le chatbot Telegram (`src/lib/telegramAI.ts`).
- **Validation formulaires** : `react-hook-form` + `zod` + `@hookform/resolvers`.
- **Analytics** : Vercel Analytics/Speed Insights + tags Google publics codés en dur dans `src/app/layout.tsx`.

Versions/pièges d'environnement :

- Node local utilisé pendant l'analyse : **v20.20.2**. `npm install` affiche des warnings `EBADENGINE` car `@supabase/*@2.110.7` déclare Node `>=22`.
- `npm audit` rapportait **17 vulnérabilités** (1 low, 3 moderate, 13 high) après install.
- `eslint-config-next` est resté en **14.2.5** alors que Next est en 16 ; `npm run lint` est actuellement cassé (voir §12).

## 3) Structure des dossiers

```text
.
├── middleware.ts                  # next-intl middleware ; exclut api/admin/success/paypal/v/fichiers
├── next.config.mjs                # images, cache headers, optimizePackageImports
├── vercel.json                    # cron quotidien /api/cron/check-overdue à 09:00 UTC
├── package.json                   # scripts dev/build/start/lint + scripts vidéo
├── messages/                      # traductions next-intl (10 langues)
├── public/                        # assets statiques + vidéos optimisées
├── scripts/
│   ├── upload-link.mjs            # génère liens signés upload/recap (ADMIN_TOKEN_SECRET)
│   ├── migrate-neon-to-supabase.mjs
│   ├── verify-upload-flow.mts
│   └── optimize/check videos + install FFmpeg (scripts Windows PowerShell)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # metadata, fonts, Analytics, tags Google
│   │   ├── page.tsx               # redirect / -> /en (fallback si middleware off)
│   │   ├── [locale]/              # pages publiques localisées + success
│   │   ├── admin/                 # login, dashboard, pages magiques upload/recap
│   │   ├── api/                   # 27 route handlers (voir §6)
│   │   ├── paypal/success/        # retour PayPal -> capture côté client
│   │   └── v/[id]/route.ts        # redirect public vers final_video_url
│   ├── components/                # sections landing, payment modal, admin analytics
│   ├── i18n/                      # locales, navigation, request config
│   └── lib/                       # db, storage, paiements, emails, telegram, voiceover, etc.
└── docs racine (*.md/*.txt)       # historiques ; plusieurs sont obsolètes (voir §11)
```

Particularités :

- Il existe des fichiers parasites avec des noms type `C:Users...claude...` à la racine et sous `ffmpeg/` ; ils ne font pas partie du flux app.
- `ffmpeg/bin/*.exe` sont des binaires Windows ; les scripts d'optimisation sont Windows-oriented.

## 4) Points d'entrée de l'app

- `middleware.ts` : applique `next-intl` sur les pages publiques ; matcher exclut `api`, `_next`, `admin`, `success`, `paypal`, `v/`, fichiers statiques.
- `src/app/layout.tsx` : layout racine, metadata SEO, fonts, Vercel Analytics/Speed Insights, scripts Google.
- `src/app/page.tsx` : redirect de secours vers `/${defaultLocale}` (`en`).
- `src/app/[locale]/layout.tsx` : provider `next-intl`, `Header`, `Footer`, `ChatWidgetWrapper`.
- `src/app/[locale]/page.tsx` : home = `HeroSection`, `ProductShowcaseSection`, `OrderFormSection`, `HowItWorksSection`, `FAQQuickSection`, `TestimonialsSection`, `StructuredData`.
- `src/components/sections/OrderFormSection.tsx` : formulaire commande client ; upload photo/musique ; choix Stripe/PayPal.
- `src/components/CustomPaymentModal.tsx` : paiement carte via Stripe PaymentIntent.
- `src/app/admin/page.tsx` + `src/app/admin/dashboard/page.tsx` : login admin et dashboard client-side (token en `localStorage`).
- `src/app/admin/upload/[orderId]/page.tsx` : page mobile magic-link pour uploader la vidéo finale.
- `src/app/admin/recap/[orderId]/page.tsx` : page magic-link récap opérateur (photo/message/musique/vocal, partage WeChat).
- `src/app/v/[id]/route.ts` : livraison client ; valide UUID puis redirect 302 vers `final_video_url`.
- `scripts/upload-link.mjs` : seul moyen supporté de générer les liens `upload:`/`recap:` signés ; ne pas fabriquer les tokens à la main.

## 5) Logique métier centrale / flux critiques

### Commande + paiement carte (flux UI actuel)

1. `OrderFormSection` génère `orderId = crypto.randomUUID()` côté client.
2. Upload photo obligatoire vers `/api/upload` (`orders/photos`), puis upload musique fichier optionnel (`orders/music`).
3. Appel **`/api/create-payment-intent`** avec les infos commande.
4. Le serveur recalcule le prix depuis `settings` (`getPricingSettings`) + overrides devises (`getPricingOverrides`) + taux Frankfurter (`resolveLocalCharge`) ; il ne fait jamais confiance à `totalPrice` client.
5. `createOrder()` insère la commande avec `status='pending'` (paiement) ; `ON CONFLICT (id) DO NOTHING`.
6. Stripe PaymentIntent créé avec metadata `orderId` ; la modale custom confirme la carte.
7. Si succès, le client appelle **`/api/confirm-payment`** : vérifie le PaymentIntent chez Stripe, vérifie que `metadata.orderId` matche, puis dédup `wasAlreadyPaid`.
8. Premier passage seulement : `markOrderPaid`, email de confirmation Resend, `notifyOrderPaid`.

`/api/stripe-webhook` fait le même traitement idempotent pour `payment_intent.succeeded`, `checkout.session.completed`, `payment_intent.canceled`, `checkout.session.expired`. Il peut donc confirmer une commande même si l'appel client `/api/confirm-payment` échoue.

### Flux Stripe alternatif présent mais non utilisé par l'UI actuelle

- **`/api/create-checkout`** crée une Stripe Checkout Session embedded (`ui_mode: "embedded"`). Aucun composant actuel ne l'appelle ; le flux UI utilise `create-payment-intent` + `CustomPaymentModal`.

### PayPal

1. `OrderFormSection` appelle **`/api/paypal/create-order`** après uploads.
2. Le serveur crée la commande DB en USD seulement (pas de conversion devise locale PayPal), puis crée l'ordre PayPal (`src/lib/paypal.ts`).
3. Redirection PayPal ; retour sur `/paypal/success?orderId=...&token=...`.
4. `PayPalSuccessClient` appelle **`/api/paypal/capture-order`** ; le serveur capture puis marque paid, envoie email + notification.
5. Le retour client passe ensuite à `/success` avec `value=1.0&currency=USD` pour la conversion Google Ads : valeur analytics probablement fausse pour les montants réels.

### Post-paiement : musique + vocal + notifications

`notifyOrderPaid` (`src/lib/discordWebhook.ts`, nom historique) :

- tente `downloadMusicFromLink` si `music_option='custom'` et `music_link` présent ; résultat uploadé dans Supabase `orders/music/<orderId>-custom.mp3` et persisté dans `downloaded_music_url` ;
- tente `generateVoiceoverIfNonEnglish` si message présent ; uploadé dans `orders/voiceover/<orderId>-voiceover.mp3` et persisté dans `voiceover_url` ;
- envoie la notification Telegram (`sendNewOrderNotification`) avec liens magic `upload` + `recap` ;
- les appels Discord sont no-op (`DISCORD_DISABLED = true`).

### Livraison finale

- Admin dashboard : `/api/admin/orders/upload-video` crée une signed upload URL Supabase ; ensuite `/api/admin/orders/update` écrit `final_video_url`, puis `/api/admin/orders/send-final-email`.
- Magic link mobile : `/api/upload-final/order` lit la commande, `/api/admin/orders/upload-video` upload vers `final-videos/<orderId>/...`, `/api/upload-final/save` écrit `final_video_url` et peut appeler `deliverFinalVideoEmail`.
- `deliverFinalVideoEmail` envoie un email avec lien `/v/<orderId>` puis `markFinalVideoSent` => `final_video_sent_at=now()` et `order_status='completed'`.

### Production / relances

- Définition "en attente" utilisée par Telegram : `status='paid'`, `order_status` ni `completed` ni `cancelled`, `final_video_url` vide.
- Cron Vercel `0 9 * * *` -> `/api/cron/check-overdue` ; alerte Telegram si express > 24h ou standard > 48h.
- Bot Telegram : `/orders`, `/overdue`, `/stats`, `/vocal [id]`, `/chatid`, sinon Q/R via AWS Bedrock avec outils `query_orders`/`get_stats`.

### Promo codes

Les tables/routes admin promo existent, mais `validatePromoCode` / `incrementPromoCodeUsage` ne sont appelés nulle part. Les champs `promo_code` et `discount_amount` ne sont pas écrits par le checkout actuel.

## 6) Routes API existantes

27 route handlers sous `src/app/api/**/route.ts`.

| Route | Méthodes | Auth / rôle |
|---|---:|---|
| `/api/admin/google-ads-expenses` | GET, PUT | Bearer admin ; dépenses Ads par mois |
| `/api/admin/login` | POST | rate-limit IP ; vérifie `ADMIN_USERNAME`/`ADMIN_PASSWORD`, renvoie token HMAC |
| `/api/admin/orders` | GET | Bearer admin ; `initAdminTables` + liste toutes commandes |
| `/api/admin/orders/delete` | DELETE | Bearer admin ; `?id=` |
| `/api/admin/orders/send-final-email` | POST | Bearer admin ; `deliverFinalVideoEmail` |
| `/api/admin/orders/update` | PUT | Bearer admin ; statut/notes/coût/finalVideoUrl |
| `/api/admin/orders/upload-video` | POST | Bearer admin **ou** upload token order-scoped ; crée signed upload URL Supabase |
| `/api/admin/pricing` | GET, PUT | Bearer admin ; prix + overrides devises |
| `/api/admin/promo-codes` | GET, POST, PUT, DELETE | Bearer admin ; CRUD promo |
| `/api/admin/promo-settings` | GET, PUT | Bearer admin ; toggle `promo_enabled` |
| `/api/admin/stripe-settings` | GET, PUT | Bearer admin ; stocke clés Stripe en table `settings` (mais voir piège §11) |
| `/api/confirm-payment` | POST | public ; vérifie PaymentIntent Stripe puis marque paid |
| `/api/create-checkout` | POST | public ; Stripe Checkout Session embedded (non utilisé UI actuelle) |
| `/api/create-payment-intent` | POST | public ; flux carte UI actuel |
| `/api/cron/check-overdue` | GET | Bearer `CRON_SECRET` si défini ; alertes retard |
| `/api/download-music` | POST | public ; wrapper download musique externe (utilisé aussi en interne après paiement) |
| `/api/exchange-rates` | GET | public ; taux Frankfurter + fallback statique |
| `/api/paypal/capture-order` | POST | public ; capture PayPal puis marque paid |
| `/api/paypal/create-order` | POST | public ; crée commande + ordre PayPal |
| `/api/pricing` | GET | public ; prix + overrides pour affichage |
| `/api/recap/download` | GET | upload token ; proxy download photo/musique/vocal |
| `/api/recap/regenerate-voiceover` | POST | upload token ; régénère vocal OpenAI |
| `/api/stripe-webhook` | POST | signature Stripe `STRIPE_WEBHOOK_SECRET` |
| `/api/telegram/webhook` | POST | public ; webhook bot Telegram |
| `/api/upload` | POST | public rate-limit ; folders allowlistés ; `admin/videos` exige admin |
| `/api/upload-final/order` | GET | upload token ; résumé commande pour pages magiques |
| `/api/upload-final/save` | POST | upload token ; save final video + option email client |

## 7) Base de données réelle (code-first)

Il **n'existe pas** de `schema.sql` ni dossier `migrations/` dans le repo. Le schéma de référence est le DDL exécuté par `src/lib/db.ts` (`ensureOrdersTable`, `ensureSettingsTable`, `initAdminTables`) et reproduit dans `scripts/migrate-neon-to-supabase.mjs`. La DB live n'a pas été interrogée ici (aucune variable DB dans l'environnement d'analyse), donc le schéma ci-dessous est celui que le code garantit à l'exécution.

Connexion DB (`getSql`) :

- ordre de lecture : `SUPABASE_POSTGRES_URL` > `POSTGRES_URL` > `DATABASE_URL` ;
- `prepare: false`, `ssl: "require"`, pool max 10 ;
- erreur si aucune URL : `Missing POSTGRES_URL`.

### Table `orders`

Colonnes garanties par le code :

| Colonne | Type / défaut | Sens |
|---|---|---|
| `id` | `uuid` PK | ID commande complet ; les 8 premiers chars servent d'ID court |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | date commande |
| `status` | `text NOT NULL DEFAULT 'pending'` | statut paiement (`pending`, `paid`, `canceled`) |
| `email` | `text NOT NULL` | email client |
| `message` | `text NOT NULL` | message à intégrer |
| `music_option` | `text NOT NULL` | `custom` ou autre (`default` côté UI) |
| `music_link` | `text NULL` | lien musique custom |
| `music_file_url` | `text NULL` | MP3 uploadé par le client |
| `delivery_method` | `text NOT NULL` | `standard`/`express` |
| `photo_url` | `text NOT NULL` | photo client |
| `total_usd` | `numeric(10,2) NOT NULL` | total USD recalculé serveur |
| `stripe_session_id` | `text NULL` | session Checkout éventuelle |
| `stripe_payment_intent_id` | `text NULL` | PaymentIntent Stripe |
| `payment_provider` | `text NULL` | `stripe`/`paypal` |
| `paypal_order_id` | `text NULL` | ordre PayPal |
| `paypal_capture_id` | `text NULL` | capture PayPal |
| `country` | `text NULL` | pays Vercel `x-vercel-ip-country` |
| `currency` | `text NOT NULL DEFAULT 'USD'` | devise facturée Stripe |
| `total_local` | `numeric(12,2) NULL` | montant local |
| `exchange_rate` | `numeric(14,6) NULL` | taux USD->devise utilisé |
| `device` | `text NULL` | mobile/tablet/desktop déduit user-agent |
| `voiceover_url` | `text NULL` | vocal OpenAI uploadé |
| `downloaded_music_url` | `text NULL` | MP3 téléchargé depuis `music_link` |
| `order_status` | `text DEFAULT 'pending'` | production (`pending`, `processing`, `completed`, `cancelled`) |
| `notes` | `text NULL` | notes admin |
| `cost` | `numeric(10,2) DEFAULT 0` | coût production |
| `promo_code` | `text NULL` | présent mais non alimenté au checkout |
| `discount_amount` | `numeric(10,2) DEFAULT 0` | présent mais non alimenté au checkout |
| `final_video_url` | `text NULL` | URL Supabase vidéo finale |
| `final_video_sent_at` | `timestamptz NULL` | date envoi email final |

### Table `settings`

```sql
key text PRIMARY KEY,
value text NOT NULL
```

Clés utilisées : `stripe_secret_key`, `stripe_publishable_key`, `price_base`, `price_custom_song`, `price_express_delivery`, `price_overrides`, `promo_enabled`.

### Table `promo_codes`

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
code text UNIQUE NOT NULL,
discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
discount_value numeric(10,2) NOT NULL,
max_uses integer,
current_uses integer NOT NULL DEFAULT 0,
expires_at timestamptz,
is_active boolean NOT NULL DEFAULT true,
created_at timestamptz NOT NULL DEFAULT now()
```

### Table `google_ads_expenses`

```sql
month text PRIMARY KEY,
amount numeric(10,2) NOT NULL DEFAULT 0
```

Prix par défaut si settings absents : `base=19.99`, `customSong=9.99`, `expressDelivery=7.99` (aussi en fallback client `PRICES` dans `src/lib/utils.ts`).

## 8) Variables d'environnement attendues

Aucun `.env*` n'est tracké (`.gitignore` exclut `.env*` / `.env*.local`). Variables référencées par le code :

### Site / DB / storage

- `NEXT_PUBLIC_SITE_URL` : base publique ; fallback code `https://afrobirthday.com`.
- `SUPABASE_POSTGRES_URL` : prioritaire pour la DB.
- `POSTGRES_URL`, `DATABASE_URL` : fallback DB.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` : storage serveur obligatoire.
- `SUPABASE_POSTGRES_URL_NON_POOLING`, `NEON_POSTGRES_URL` : script migration seulement.

### Stripe / PayPal

- `STRIPE_SECRET_KEY` : utilisé par les routes Stripe actuelles.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` : modale carte.
- `STRIPE_WEBHOOK_SECRET` : vérification webhook.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` : REST PayPal.
- `PAYPAL_ENV` : `sandbox` par défaut ; `live` pour production.

### Emails / notifications / IA

- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` : envois emails.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` : bot et notifications.
- `OPENAI_API_KEY` : TTS vocal.
- `OPENAI_TTS_MODEL` (défaut `gpt-4o-mini-tts`), `OPENAI_TTS_VOICE` (défaut `nova`), `OPENAI_TTS_SPEED` (défaut `0.75`).
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_SESSION_TOKEN`, `BEDROCK_MODEL` : chatbot Telegram via Bedrock.
- `DISCORD_WEBHOOK_URL` : lu mais inutilisé tant que `DISCORD_DISABLED = true`.

### Admin / cron / musique externe

- `ADMIN_USERNAME`, `ADMIN_PASSWORD` : login dashboard.
- `ADMIN_TOKEN_SECRET` : obligatoire, >= 32 chars ; signe sessions admin et magic links upload/recap.
- `CRON_SECRET` : si défini, requis en Bearer sur `/api/cron/check-overdue`.
- `RAPIDAPI_KEY` : backend YouTube MP3 préféré si présent.
- `MUSIC_DOWNLOAD_API_URL` : fallback/endpoint Cobalt-style ; défaut historique `https://co.wuk.sh/api/json`.
- `DISABLE_MUSIC_AUTO_DOWNLOAD=true` : désactive le téléchargement auto.
- `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` : fallback pour reconstruire l'URL publique.

## 9) Conventions de code utilisées

- TypeScript strict (`"strict": true`), alias `@/* -> ./src/*`, `moduleResolution: "bundler"`.
- App Router ; route handlers majoritairement `export const runtime = "nodejs"` ; certaines routes longues fixent `maxDuration = 60`.
- Pas d'ORM : SQL tagged templates `postgres` ; noms DB snake_case, types TS camelCase avec mapping explicite.
- UI client components marqués `"use client"` ; formulaires avec `react-hook-form` + `zodResolver`.
- Traductions centralisées dans `messages/<locale>.json` ; composants serveur utilisent `getTranslations`, clients `useTranslations`.
- Auth admin : token HMAC `payload.signature`, TTL 24h ; magic upload token même secret mais scope `upload`, TTL 14 jours, limité à `final-videos/<orderId>/`.
- Emails : templates séparés dans `src/lib/orderEmailTemplates.ts`, envoi via `sendEmailWithResend`.
- Notifications : ne pas appeler Discord pour du nouveau code métier ; la voie active est Telegram.
- Erreurs API : `NextResponse.json({ error: ... }, { status: ... })` ; beaucoup de `console.error` côté serveur.

## 10) Sécurité

- Scan du code courant (patterns Stripe live/test, `whsec_`, Discord webhook URL, AWS `AKIA`, private keys, GitHub tokens, Resend `re_`, etc.) : **aucun secret fonctionnel trouvé en clair** dans les fichiers texte du repo. Les seules correspondances `git grep` étaient dans les binaires FFmpeg, non interprétables comme secrets.
- Les IDs Google Analytics/Ads dans `layout.tsx` sont des identifiants publics, pas des secrets.
- Les webhooks Stripe sont vérifiés par signature ; PayPal n'a pas de webhook, la capture est faite côté serveur au retour client.
- Uploads publics `/api/upload` : allowlist dossiers/types/tailles + rate-limit mémoire par IP ; le dossier `admin/videos` exige un admin.
- Liens magiques : HMAC, scope par commande, TTL 14 jours ; ne jamais les fabriquer hors `scripts/upload-link.mjs`.
- `/v/[id]` exige un UUID valide et ne redirect que si `final_video_url` existe.
- `SUPABASE_SERVICE_ROLE_KEY`, clés Stripe/PayPal/Resend/OpenAI/AWS doivent rester server-only.
- Attention : `/api/admin/stripe-settings` permet de stocker des clés Stripe en DB, mais les routes de paiement lisent `process.env.STRIPE_SECRET_KEY` (voir §11).

## 11) Docs existantes fausses / obsolètes / contradictoires

1. **README dit “Neon PostgreSQL”** : obsolète. Le code préfère `SUPABASE_POSTGRES_URL`, le storage est Supabase, et `scripts/migrate-neon-to-supabase.mjs` documente une migration Neon -> Supabase.
2. **Docs musique (`MUSIC_DOWNLOAD_SETUP.md`, `FEATURE_MUSIC_DOWNLOAD.md`) parlent de Discord + Vercel Blob** : obsolète. Le code upload sur Supabase Storage et notifie Telegram ; Discord est désactivé dans `src/lib/discordWebhook.ts`.
3. **Ces mêmes docs présentent Cobalt `co.wuk.sh` comme voie normale** : partiellement obsolète. Le code commente que l'instance publique legacy est morte et préfère `RAPIDAPI_KEY` pour YouTube ; `co.wuk.sh` reste seulement le défaut si `MUSIC_DOWNLOAD_API_URL` absent.
4. **`DISCORD_MOBILE_COPY.md`** : utile historiquement, mais la cible "vérifier Discord" est obsolète ; le message copiable existe encore dans le module Discord désactivé et la logique équivalente est envoyée sur Telegram.
5. **Docs FFmpeg (`ETAT_OPTIMISATION.md`, `QUICK_START.txt`, `RESUME_FINAL.txt`, `OPTIMIZATIONS_SUMMARY.md`)** : écrites comme si FFmpeg restait à installer et orientées Windows/Chocolatey ; le repo contient déjà `ffmpeg/bin/*.exe` Windows et des vidéos optimisées dans `public/`. À traiter comme docs de chantier, pas comme état courant fiable.
6. **`.hermes.md`** : globalement exact pour la table `orders` et les liens magiques, mais incomplet : il manque `device`, `currency`, `total_local`, `exchange_rate`, `voiceover_url`, `downloaded_music_url`, `cost`, `final_video_sent_at`, et les tables `settings`, `promo_codes`, `google_ads_expenses`.
7. **Stripe settings admin vs paiement** : le dashboard peut sauvegarder `stripe_secret_key`/`stripe_publishable_key` en DB, mais `/api/create-payment-intent`, `/api/create-checkout`, `/api/confirm-payment`, `/api/stripe-webhook` utilisent `process.env.STRIPE_SECRET_KEY`. Le formulaire admin Stripe ne pilote donc pas les clés réellement utilisées.
8. **Promo codes** : admin + tables présents, mais aucun flux checkout ne valide/applique un code ni n'incrémente l'usage. `promo_enabled` n'a pas d'effet visible dans `OrderFormSection`.
9. **Deux flux Stripe coexistent** : `/api/create-checkout` existe mais n'est pas appelé par le client actuel ; le flux réel est `/api/create-payment-intent` + `/api/confirm-payment`.
10. **Devises** : Stripe facture en devise locale calculée serveur ; PayPal crée toujours l'ordre en USD. Le commentaire `currencyFromLocale` dit "always charging in USD" alors que Stripe charge désormais en local.
11. **Lint** : `package.json` garde `"lint": "next lint"` avec Next 16 ; `npm run lint` échoue (`Invalid project directory ... /workspace/lint`). Utiliser `npx tsc` et/ou moderniser ESLint.
12. **Build en petit conteneur** : `npm run build` compile puis est tué (`exit 137`) pendant "Running TypeScript" dans cet environnement ; `npx tsc --noEmit --incremental false` passe avec plus de heap. Ce n'est pas une contradiction de doc, mais un piège de vérification.
13. **README/langues** : correct — 10 locales : EN, FR, ES, DE, IT, PT, NL, AR, HI, ZH.
14. **README/technologies** : incomplet — manque Supabase Storage/DB, Resend, Telegram, OpenAI, AWS Bedrock, RapidAPI, cron Vercel.

## 12) Commandes de vérification avant de terminer une tâche

```bash
# 1. Dépendances
npm install
# Note: npm install peut ajouter une entrée nested @swc/helpers dans package-lock.json ;
# si la modif lockfile est sans rapport avec la tâche, la revert avant commit.

# 2. Types (vérification la plus fiable ici)
NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit --pretty false --incremental false

# 3. Build production (peut être tué exit 137 en conteneur limité)
NODE_OPTIONS=--max-old-space-size=4096 npm run build

# 4. Lint : NE PAS utiliser `npm run lint` tant qu'il appelle `next lint` sous Next 16.
# À remplacer/moderniser avant de s'y fier.

# 5. Scan secrets rapide avant commit
git grep -n -E 'sk_live_|sk_test_|whsec_|discord(app)?\.com/api/webhooks|AKIA[0-9A-Z]{16}|BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|re_[A-Za-z0-9]{20,}|pk_live_|pk_test_' -- . ':!package-lock.json' ':!AGENTS.md' ':!ffmpeg/bin/*' || true

# 6. Liens magiques (ne pas inventer de token)
node scripts/upload-link.mjs <orderId> [<orderId> ...]

# 7. Avant commit
git status --short
git diff --stat
```

## 13) Résumé nouvel agent — 7 points essentiels

1. Le flux carte réel de l'UI est `/api/create-payment-intent` -> `CustomPaymentModal` -> `/api/confirm-payment` ; `/api/create-checkout` existe mais semble legacy/non câblé.
2. La DB est code-first dans `src/lib/db.ts` ; pas de `schema.sql`/migrations. Connexion `SUPABASE_POSTGRES_URL` > `POSTGRES_URL` > `DATABASE_URL`.
3. Supabase est utilisé pour DB + Storage bucket `orders` ; Discord est désactivé, Telegram est le canal actif.
4. Les montants clients ne sont jamais fiables : le serveur recalcule base/customSong/express + overrides + taux avant de créer Stripe/PayPal.
5. Les liens upload/recap sont des tokens HMAC order-scoped de 14 jours ; utilise uniquement `node scripts/upload-link.mjs <orderId>` pour les générer.
6. Promo codes, Stripe settings DB et certaines docs racine sont des pièges : présents mais pas branchés ou obsolètes ; vérifie le code avant d'agir.
7. Vérification la plus utile : `npx tsc --noEmit --incremental false` avec heap augmenté ; `npm run build` peut être tué à l'étape TypeScript dans un petit conteneur, et `npm run lint` est cassé sous Next 16.
