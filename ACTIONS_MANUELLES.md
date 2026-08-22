# Actions manuelles restantes

Ce fichier liste tout ce qui a été identifié dans le backlog mais que je n'ai
**pas** corrigé moi-même dans cette passe — soit parce que ça nécessite un
accès externe (Vercel, FFmpeg), soit parce que c'est trop risqué à faire sans
pouvoir tester en conditions réelles (paiement), soit parce que c'est une
décision produit/business/design que seul toi peux trancher.

Voir aussi le backlog complet : https://claude.ai/code/artifact/4d9fbe6d-b99c-41e0-98f6-2f6f996ade5d

Chaque correctif appliqué automatiquement est un commit séparé sur `main`
(rien n'a été poussé sur le remote — voir la fin de ce fichier).

---

## 🍎 Apple Pay — vérification de domaine requise (action Stripe Dashboard)

Le parcours d'achat a été refait de A à Z (formulaire en 3 étapes + modal de
paiement modernisé avec `PaymentElement`/`ExpressCheckoutElement`). Le code
est prêt pour Apple Pay/Google Pay — ils s'affichent **automatiquement** dans
le modal de paiement dès qu'ils sont éligibles (Safari/iOS avec une carte
dans le Wallet pour Apple Pay, Chrome avec Google Pay configuré). Aucun code
supplémentaire n'est nécessaire de mon côté.

Mais Apple Pay ne s'activera pas tant que tu n'as pas fait, toi-même, la
vérification de domaine côté Stripe (impossible à automatiser, ça nécessite
un accès à ton dashboard Stripe) :

1. Dans le [Stripe Dashboard](https://dashboard.stripe.com/settings/payment_methods),
   section "Apple Pay", clique sur "Add a new domain".
2. Ajoute `afrobirthday.com` (et éventuellement `www.afrobirthday.com` si
   utilisé).
3. Stripe te fournit un fichier de vérification
   (`apple-developer-merchantid-domain-association`) à héberger sur
   `https://afrobirthday.com/.well-known/apple-developer-merchantid-domain-association` —
   dis-le-moi et je le place dans `public/.well-known/` une fois que tu me
   donnes le fichier (même mécanique que la vérification de domaine
   PostHog faite plus tôt dans ce fichier).
4. Une fois vérifié, Apple Pay apparaîtra automatiquement pour les visiteurs
   Safari/iOS éligibles — pas de redéploiement necessaire de mon côté au-delà
   de l'étape 3.

**Correction** (2026-08-07) : j'avais dit plus haut que Google Pay n'a besoin
d'aucune vérification de domaine — c'est inexact. Tu l'as activé dans le
Stripe Dashboard le 2026-08-07 et Stripe affiche la même mécanique que pour
Apple Pay : un bouton "Configurer les domaines" avec un texte demandant
d'enregistrer les domaines de confiance avant utilisation. Même chose à
faire que pour Apple Pay ci-dessus : ajoute `afrobirthday.com` (et
`www.afrobirthday.com` si utilisé) dans cette section du dashboard. Le code
n'a rien à changer de mon côté — `ExpressCheckoutElement` détecte déjà
dynamiquement les moyens de paiement activés/éligibles.

---

## 🟠 Trop risqué à faire sans test réel en conditions de paiement

1. **Aligner la devise PayPal sur le prix local affiché** — PayPal facture
   toujours en USD alors que l'UI affiche un prix converti dans la devise
   locale. Le corriger nécessite de savoir quelles devises ton compte
   marchand PayPal peut réellement recevoir (visible seulement dans ton
   dashboard PayPal — tous les comptes ne supportent pas INR/CNY/ZAR/SAR par
   exemple), puis de tester en sandbox. Risque réel de casser complètement le
   paiement PayPal pour certains pays si la devise n'est pas supportée par
   ton compte — je préfère te laisser vérifier ça toi-même avant qu'on code
   le changement.

---

## 🧪 Implémenté mais à valider avec de vrais tests de paiement

- **Codes promo au checkout** — c'est fait : champ visible sur le formulaire
  (seulement si tu actives `promo_enabled` dans l'onglet "Promo" de l'admin),
  validation via un nouvel endpoint public `/api/validate-promo`, remise
  appliquée et re-vérifiée côté serveur dans les 3 chemins de paiement
  (`create-checkout`, `create-payment-intent`, `paypal/create-order` — le
  montant envoyé par le client n'est jamais utilisé tel quel), et
  `incrementPromoCodeUsage` n'est appelé qu'au moment où le paiement est
  confirmé (webhook Stripe / `confirm-payment` / capture PayPal), pas à la
  création de la commande. Un code "fixed" est traité en USD (comme l'admin
  l'affiche déjà : "Fixed ($)").
  Je n'ai pas pu faire de vraie transaction Stripe test-mode / PayPal
  sandbox ici pour vérifier le montant réellement débité de bout en bout —
  à faire toi-même avant de compter dessus en production :
  1. Créé un code promo test dans l'admin (ex. `-10%` ou `-5$`).
  2. Passer une commande en mode test Stripe avec ce code, vérifier dans le
     dashboard Stripe que le montant débité correspond bien au prix réduit.
  3. Faire pareil en sandbox PayPal.
  4. Vérifier que `current_uses` du code n'augmente qu'une fois par
     commande (recharger `/success` ne doit pas le réincrémenter).

---

## 🟡 Décisions produit / contenu (pas à moi de trancher)

2. **`SocialProofSection.tsx`** — composant complet ("500+ clients, 50+ pays,
   4.9/5") mais jamais affiché sur le site, et non traduit. Je ne l'ai pas
   réactivé : je ne peux pas confirmer que ces chiffres sont exacts
   aujourd'hui. À toi de me donner les vrais chiffres (ou de me dire de les
   retirer/supprimer le composant) et je le branche.

3. **Deux jeux de témoignages différents et non synchronisés**
   (`TestimonialsSection.tsx` vs `SocialProofSection.tsx`) — lequel garder,
   lequel des deux fusionner dedans ?

4. **`reviewCount` du schema JSON-LD** — j'ai corrigé le nombre codé en dur
   (500) pour qu'il reflète le vrai nombre de témoignages affichés. Mais si
   ces témoignages eux-mêmes ne sont pas des avis clients vérifiables, le
   schema `AggregateRating` reste un risque vis-à-vis des règles de Google
   sur les avis — à voir si tu veux brancher une vraie plateforme d'avis
   (Trustpilot etc.) plus tard.

5. **Le "-50%" permanent dans le hero** — prix barré fixe, sans vraie logique
   temporelle. Décision marketing, pas un bug technique.

6. **Schema `VideoObject` pour les vidéos showcase** — je n'ai pas ajouté ce
   schema (pourtant un vrai gain SEO potentiel) car il demande une vraie
   `uploadDate` par vidéo pour être éligible aux rich results Google.
   Inventer une date aurait recréé exactement le problème du `reviewCount`
   factice que je viens de corriger. Donne-moi les vraies dates de mise en
   ligne des 4 vidéos showcase et je l'ajoute.

---

## 🎨 Design (mis de côté sur ta demande — à faire quand tu pourras diriger chaque choix)

- Apple Pay / Google Pay (bouton de paiement express)
- Modale de paiement plein écran sur mobile
- Logo de carte dynamique pendant la saisie
- CTA sticky mobile permanent
- Bannière de consentement cookies (RGPD)
- Mode clair / thème alternatif
- Couche de tokens sémantiques pour les couleurs de texte (`text-muted` etc.
  au lieu des opacités `/60`, `/70` ad hoc)
- Moyens de paiement locaux (Mobile Money, UPI, Alipay, iDEAL...)

---

## ⚙️ Nécessite un compte/service externe que je n'ai pas

- **Sentry (ou équivalent)** pour le monitoring d'erreurs — besoin d'un DSN
  réel, je ne peux pas configurer et vérifier un SDK sans compte.
- **Rate limiting distribué** (Upstash/Vercel KV) pour `/api/upload` et
  `/api/admin/login` — nécessite de provisionner un service externe.
- **Pixel Meta / TikTok** — nécessite tes comptes Business Meta/TikTok.

---

## ℹ️ Correction à une affirmation précédente de ce fichier/backlog

- **`/api/admin/login` a en fait déjà un rate limiting** (5 tentatives / 15
  min, comparaison en temps constant) — j'avais dit le contraire plus tôt à
  tort. Reste la même limite que `/api/upload` : en mémoire, donc pas partagé
  entre instances serverless. Pas d'action nécessaire sauf si tu veux du
  vrai rate limiting distribué (voir section "Nécessite un compte externe").

---

## 🧪 Trop gros pour cette passe

- **Suite de tests automatisés** (aucune n'existe) — un vrai chantier à part,
  pas quelque chose à improviser sans risquer des tests fragiles/faux-positifs.
- **Modernisation des dépendances** (React 18→19, Stripe SDK, Zod v3→v4,
  Tailwind v3→v4, ESLint 8→9) — chacune peut avoir des breaking changes,
  à faire une par une avec vérification, pas en bloc.
- **Fusionner les deux implémentations Stripe parallèles**
  (`create-checkout` vs `create-payment-intent`) — refactor structurel du
  code de paiement, même remarque que les points 3/4 ci-dessus.
- **Contenu blog / SEO editorial** — travail éditorial, pas du code.
- **Nettoyer les fichiers markdown à la racine** (`SOUL.md`,
  `HERMES-PROMPTS.md`, `AGENTS.md`, `QUICK_START.txt`, etc.) — je ne les ai
  pas touchés : certains ressemblent à de la config pour un autre agent
  IA/automatisation sur ce projet ("Hermes"), les déplacer sans savoir s'ils
  sont référencés ailleurs pourrait casser quelque chose que je ne vois pas.
  À toi de me dire si je peux les réorganiser en sécurité.

---

## 📧 5 emails automatiques ajoutés — actions restantes avant activation

Implémentés : demande d'avis Trustpilot, panier abandonné, cross-sell
"autre anniversaire ?", rappel annuel, parrainage (codes personnels +
récompense). Chacun suit le même pattern (cron + toggle admin + template) —
voir l'onglet Settings du dashboard admin, bloc "Automated Emails".

Avant de laisser tourner en prod :

1. **Relire chaque texte d'email dans une vraie boîte de réception** avant
   d'activer son toggle — seul celui de la demande d'avis (Trustpilot) est
   activé par défaut, sur ta demande explicite ; les 4 autres sont désactivés
   par défaut.
2. **Créer le code `winback_promo_code`** dans l'onglet Promo (ex.
   `COMEBACK15`), puis le renseigner dans le champ correspondant du bloc
   Automated Emails — sans ça, les emails cross-sell et rappel annuel restent
   no-op (le cron saute l'envoi si le champ est vide).
3. **Vercel Hobby ne permet qu'une fréquence de cron quotidienne** — les 5
   nouveaux cron jobs tournent chacun une fois par jour (`vercel.json`,
   décalés d'une heure). Le délai réglé dans l'admin (ex. "3 heures" pour le
   panier abandonné) est donc une condition d'éligibilité, pas une garantie
   d'envoi exact à l'heure près — l'email part au prochain passage du cron
   après que le délai soit dépassé.
4. **Parrainage** : testé uniquement en lecture de code, pas avec une vraie
   commande sandbox Stripe/PayPal utilisant un code de parrainage — à valider
   toi-même avant de compter dessus (vérifier que `promo_code_redemptions`
   reçoit bien une ligne et que le parrain reçoit son email de récompense).

---

## 🚫 Désabonnement des emails automatiques — action immédiate demandée

Déclencheur : plainte client du 22/08/2026 (Tanja Schachner,
`tanja.schachner@gmx.de`) — « The review is gonna be negative, if you won't
stop sending me these emails! ». Les 5 emails automatiques n'avaient **aucun
moyen de se désabonner** : l'en-tête `List-Unsubscribe` pointait vers un
`mailto:support@`, donc même en cliquant « Se désabonner » dans Gmail, rien
n'arrêtait les envois — et le pied de page n'avait aucun lien.

Ce qui a été ajouté (code) :

- Table `email_optouts` (liste de suppression) + endpoint public
  `/api/unsubscribe` : lien dans le pied de page de chaque email automatique,
  et désabonnement en un clic (RFC 8058) depuis le bouton natif de
  Gmail/Outlook. L'adresse est signée (HMAC, même secret que l'admin), donc
  personne ne peut désabonner l'adresse de quelqu'un d'autre.
- Les 5 crons ignorent désormais les adresses désabonnées.
- Un client avec 2 commandes ne reçoit plus 2 fois chaque email : la
  suppression se fait par **adresse**, plus seulement par commande.
- Les emails transactionnels (confirmation de commande, vidéo finale) ne sont
  **pas** concernés : un client désabonné reçoit toujours ce qu'il a payé.

**Cause racine trouvée le 22/08/2026, bien plus grave que la plainte** : la
migration du commit a970267 n'avait **jamais tourné en production**. Les
colonnes `*_email_sent_at` n'existaient pas dans la base Supabase. Comme
`getAllOrders()` fait un `SELECT *`, `order.review_email_sent_at` valait
`undefined` → le garde-fou anti-doublon passait toujours → **106 clients
recevaient l'email Trustpilot tous les jours** depuis le déploiement (Tanja :
~6 copies depuis le 17/08). `markReviewEmailSent()` plantait à chaque envoi,
mais l'erreur était avalée par le `try/catch` du cron, donc rien de visible
dans les logs à part une trace par commande.

Pourquoi la migration n'avait pas tourné : `initAdminTables()` n'est appelée
que par les routes `/api/admin/*`. Les crons ne l'appellent jamais. Tant que
le dashboard admin n'est pas ouvert après un déploiement, les nouvelles
colonnes n'existent pas — mais les crons, eux, tournent quand même.

Fait directement en base de prod (Supabase, le 22/08/2026) :

- Migration a970267 appliquée : les 5 colonnes `*_email_sent_at`,
  `promo_codes.owner_email`, table `promo_code_redemptions`.
- 163 commandes (les 106 adresses déjà spammées, toutes leurs commandes)
  marquées `review_email_sent_at = now()` → le cron passe de 109 envois par
  jour à **0**. Vérifié après coup. Réversible : remettre à NULL.
- `tanja.schachner@gmx.de` ajoutée à `email_optouts`.

Côté code, en plus du système de désabonnement : les 5 crons appellent
maintenant `ensureAutomatedEmailColumns()` avant de lire les commandes, pour
que le garde-fou ne puisse plus échouer en silence. Un bloc « Email opt-outs »
a été ajouté dans l'onglet Settings du dashboard admin (ajout/retrait manuel
d'une adresse, en plus du lien de désabonnement côté client).

À faire toi-même :

1. **Répondre à Tanja** — c'est la partie qui sauve l'avis, pas le code. Je ne
   peux pas répondre depuis ta boîte Gmail ; brouillon fourni dans le chat.
   Techniquement elle ne recevra plus rien, c'est déjà effectif (marquage en
   base), même sans déploiement.
2. **Déployer** (`git push`) : le marquage en base arrête l'hémorragie, mais
   le lien de désabonnement dans les emails et le respect de la liste
   `email_optouts` par les crons n'arrivent qu'avec le déploiement.
3. **Vérifier `ADMIN_TOKEN_SECRET`** en prod : le lien de désabonnement est
   signé avec (déjà utilisé par le login admin, donc normalement en place).
4. **Vérifier la sortie du cron `delete-old-photos` après 15h00 UTC** : il
   devrait rapporter `deleted: 25, unmapped: 0`. Historique de ce bug, corrigé
   le 22/08/2026 : `orders.photo_url` était encore `NOT NULL` en prod alors
   que le code prévoit `DROP NOT NULL` (bff5368), donc `clearOrderPhoto()`
   plantait. Mais surtout, `keyFromPublicUrl()` ne reconnaît que les URLs
   Supabase Storage — **105 photos sont encore sur Vercel Blob** (l'ancien
   stockage) et n'étaient supprimées par rien du tout. Une fois la contrainte
   retirée, le cron aurait vidé `photo_url` pour 23 d'entre elles sans
   supprimer le fichier : photos publiquement accessibles à vie, sans pointeur
   pour les retrouver, rétention 30 jours silencieusement non tenue. Corrigé
   par `deletePhotoByUrl()` qui gère les deux stockages et refuse d'effacer un
   pointeur qu'il ne sait pas supprimer. Dépendance ajoutée : `@vercel/blob`
   (nécessite `BLOB_READ_WRITE_TOKEN` côté Vercel — vérifié valide en local,
   pas vérifiable en prod d'ici).

5. **Décision prise le 22/08/2026** : un email automatique donné n'est envoyé
   qu'**une seule fois par adresse, à vie** — y compris le panier abandonné
   (choix confirmé, comportement actuel du code).

---

## 🌍 Moyens de paiement locaux par pays — selon la base de données (action Stripe Dashboard)

Recap demandé le 2026-08-07, **vérifié directement dans la table `orders`**
(PostHog n'avait qu'une semaine de tracking — pas fiable). Sur 199 commandes
au total depuis février 2026, **95 sont payées** (`status = 'paid'`), sur 35
pays différents. Top 15 par nombre de commandes payées :

| Pays | Commandes payées | Revenu (USD) | Devise utilisée sur le site |
|---|---|---|---|
| 🇺🇸 États-Unis | 19 | 503,67 $ | USD |
| 🇨🇦 Canada | 6 | 129,93 $ | CAD |
| 🇪🇸 Espagne | 5 | 133,91 $ | EUR |
| 🇮🇹 Italie | 5 | 125,92 $ | EUR |
| 🇩🇪 Allemagne | 5 | 109,94 $ | EUR |
| 🇭🇺 Hongrie | 4 | 99,94 $ | USD (pas de HUF supporté) |
| 🇨🇭 Suisse | 4 | 97,94 $ | USD (pas de CHF supporté) |
| 🇬🇧 Royaume-Uni | 4 | 95,94 $ | GBP |
| 🇸🇰 Slovaquie | 3 | 67,96 $ | EUR |
| 🇳🇴 Norvège | 3 | 59,97 $ | USD (pas de NOK supporté) |
| 🇦🇺 Australie | 3 | 93,93 $ | AUD |
| 🇫🇷 France | 2 | 49,97 $ | EUR |
| 🇦🇹 Autriche | 2 | 57,96 $ | EUR |
| 🇸🇪 Suède | 2 | 39,98 $ | USD (pas de SEK supporté) |
| 🇹🇭 Thaïlande | 2 | 47,97 $ | USD (pas de THB supporté) |

(+ 20 autres pays à 1 commande chacun : UAE, Lituanie, Brésil, Luxembourg,
Pérou, Singapour, Slovénie, Corée du Sud, Japon, Kazakhstan, Mexique,
Pays-Bas, Argentine, Liban, Pologne, Malaisie, Israël, Turquie, Croatie,
Égypte.)

**Les États-Unis dominent largement** (20% des commandes payées, à eux
seuls) — c'est le marché prioritaire pour tout enrichissement de moyens de
paiement. Viennent ensuite un groupe de pays européens assez homogène
(Espagne/Italie/Allemagne/UK/France/Autriche, tous déjà en EUR ou GBP) et un
groupe de pays "USD par défaut" faute de devise locale supportée (Hongrie,
Suisse, Norvège, Suède, Thaïlande) — ces derniers ne perdent rien de
critique niveau carte bancaire, mais ne peuvent pas bénéficier des moyens de
paiement locaux Stripe tant que leur devise n'est pas ajoutée au code.

**Gain rapide, sans code** — active dans le
[Stripe Dashboard](https://dashboard.stripe.com/settings/payment_methods)
(Settings → Payment methods), déjà compatible avec les devises supportées
(`automatic_payment_methods` est actif côté code, donc apparition immédiate
dans le `PaymentElement` sans redéploiement) :
- **Klarna** — couvre US, Espagne, Italie, Allemagne, UK, France, Autriche :
  7 des 11 premiers pays du classement, y compris le #1 (États-Unis).
- **giropay** — Allemagne (#5, 5 commandes), moyen de paiement par virement
  bancaire très utilisé localement.
- **Afterpay/Clearpay** — US, UK, Australie (couvre le #1, #8 et #11).
- **EPS** — Autriche (#12, virement bancaire local).

**Plus gros chantiers** (nécessitent d'ajouter une devise dans
`CurrencyCode`/`currencyFromLocale` de `src/lib/utils.ts` avant de pouvoir
activer le moyen de paiement local correspondant côté Stripe — ce sont les
seuls que je peux faire moi-même si tu veux avancer dessus) :
- **Suisse (#7, 4 commandes)** : nécessite le CHF. Pas de moyen de paiement
  local Stripe fort à ma connaissance (TWINT n'est pas garanti disponible
  selon les comptes, à vérifier toi-même) — le principal gain serait juste
  d'afficher les prix en CHF plutôt qu'en USD.
- **Hongrie (#6, 4 commandes)** et **Norvège (#10, 3 commandes)** : HUF/NOK
  non supportés, pas de moyen de paiement local Stripe notable pour ces
  pays à ma connaissance — carte + wallets restent la meilleure option,
  probablement pas prioritaire.
- **Thaïlande (2 commandes)** : `PromptPay` (QR/virement, très préféré à la
  carte) nécessite le THB — volume encore faible, à surveiller avant
  d'investir.

Aucune activation Stripe Dashboard ne peut être faite par moi (accès à ton
compte Stripe requis).

**Mise à jour (2026-08-07)** : tu as activé Google Pay, Revolut Pay et
Satispay dans le Stripe Dashboard. Côté code, j'ai ajouté une rangée de
logos "Also available" dans l'étape Paiement du formulaire de commande
(`src/components/sections/OrderFormSection.tsx`), affichée juste sous le
choix "Credit card" :
- Apple Pay et Google Pay : toujours affichés.
- Revolut Pay : affiché si la devise détectée du client est EUR ou GBP
  (Europe/UK).
- Satispay : affiché uniquement si le navigateur du client est en italien
  (`it`/`it-IT`).

C'est purement une rangée d'aperçu (teaser) — les vrais boutons de paiement
express restent affichés dynamiquement par Stripe dans
`ExpressCheckoutElement` selon ce qui est réellement disponible sur
l'appareil du client, indépendamment de cette logique de détection pays
côté front. Pense à faire la vérification de domaine Google Pay ci-dessus
avant que le bouton Google Pay n'apparaisse réellement au paiement.

---

## ✅ Ce qui a été fait automatiquement (pour référence)

Chaque ligne = un commit séparé sur `main`, en local (rien poussé sur le
remote pour l'instant) :

- Bug PayPal : fausse valeur de conversion ($1 au lieu du vrai montant)
- Lien WhatsApp cassé → masqué proprement
- `reviewCount` codé en dur → vrai nombre de témoignages
- Alerte Telegram si `/api/confirm-payment` échoue silencieusement
- Accessibilité de la modale de paiement (dialog, focus trap, Échap)
- Suppression de la case "conditions" en double dans la modale
- Association `htmlFor`/`id` sur les champs email/message
- Cache HTTP sur `/api/pricing`
- `poweredByHeader` désactivé
- Suppression du WebM cassé (68,9 Mo) de la vidéo hero + 2 `.MOV` morts (31 Mo)
- Page 404 de `/v/[id]` remplacée par une vraie page à l'identité du site
- Fermeture du chat au clavier (Échap)
- Bundle admin optimisé (`recharts` dans `optimizePackageImports`)
- CI ajoutée (`.github/workflows/ci.yml` — lint/typecheck/build sur chaque PR)
- Suppression du panneau admin "Clés API Stripe" (non fonctionnel, trompeur)
- Metadata SEO localisée sur `faq`/`privacy`/`refund`/`terms` (36 URLs
  affichaient un titre/description anglais quelle que soit la langue)
- Traductions manquantes complétées pour 6 langues sur 10 (`Chat.*` +
  plusieurs textes de confiance du Hero)
- Compression des photos côté client avant upload (limite 2000px, JPEG q=0.85,
  respect de l'orientation EXIF)
- Suppression de `getStripeSettings`/`updateStripeSettings` (orphelines
  depuis la suppression du panneau admin)
- `/api/exchange-rates` : le client profite maintenant du cache HTTP au lieu
  de forcer `no-store` sur chaque appel
- `BreadcrumbList` (structured data) ajouté sur toutes les pages marketing/
  légales — 6 pages n'avaient strictement aucune donnée structurée avant
- Alerte Telegram si le webhook Stripe (source de vérité des paiements) ou
  la capture PayPal échoue — même logique que l'alerte `confirm-payment`
- Sauvegarde du brouillon de commande (email/message/options) en
  localStorage, restauré si la page est rechargée par accident
- `totalVisitors` dans le dashboard admin branché sur un vrai chiffre
  PostHog (via la clé `POSTHOG` que tu as ajoutée) au lieu d'un 1000 codé en
  dur — le taux de conversion affiché est maintenant réel
- `CRON_SECRET` et `POSTHOG` ajoutés sur Vercel (Production + Preview)
- `.env.example` créé (n'existait jamais) + correction du `.gitignore` qui
  l'aurait bloqué + README mis à jour (stack technique obsolète : disait
  encore "Neon PostgreSQL")
- Dependabot configuré (PRs hebdomadaires groupées mineur/patch, majeures
  séparées) — pour la modernisation des dépendances sans upgrade en bloc
- Analyseur de bundle ajouté (`npm run analyze`), aucun effet sur le build
  normal
- Codes promo branchés de bout en bout (formulaire → validation serveur →
  3 chemins de paiement → incrémentation à la confirmation) — voir la
  section "À valider avec de vrais tests de paiement" ci-dessus avant mise
  en prod
- Vidéo hero ré-encodée : 43,6 Mo → 3,6 Mo (-91%), FFmpeg installé via
  winget, qualité vérifiée par comparaison de frames avant/après
  (`public/original-videos/blessing_video_principal.mp4` garde l'original)
- Les 4 vidéos showcase ré-encodées : 52 Mo → 28,3 Mo au total (-46%),
  même méthode, qualité vérifiée, originaux dans `public/original-videos/`
- 5 emails automatiques (demande d'avis Trustpilot, panier abandonné,
  cross-sell, rappel annuel, parrainage avec codes personnels + récompense) —
  voir la section dédiée ci-dessus pour les actions restantes avant activation
- Parcours d'achat refait de A à Z : formulaire en 3 étapes (Ta vidéo →
  Personnalisation → Paiement) avec indicateur de progression visuel, au lieu
  d'un long mur de cartes identiques ; validation par étape (sans le bug
  connu de react-hook-form + zodResolver qui pouvait afficher "vous devez
  accepter les conditions" avant même que l'utilisateur arrive à l'étape
  paiement — corrigé en n'affichant les erreurs qu'après une vraie tentative
  de soumission)
- Modal de paiement modernisé : remplacement des champs carte "faits main"
  (`CardNumberElement`/`CardExpiryElement`/`CardCvcElement`) par le
  `PaymentElement` officiel de Stripe + `ExpressCheckoutElement` — affiche
  automatiquement Apple Pay, Google Pay, Link et les moyens de paiement
  locaux (Bancontact, EPS, etc. selon le pays) quand ils sont éligibles sur
  l'appareil du visiteur. Voir la section Apple Pay ci-dessus pour l'étape
  de vérification de domaine à faire toi-même
- Bandeau "500+ birthdays made unforgettable" (statique, jamais vérifié)
  remplacé par un vrai compteur "X commandes livrées cette semaine" basé sur
  les données réelles de la base
- Tag "Real video" retiré de la vidéo hero (affirmation invérifiable)
- Pile de 5 avatars factices retirée du hero (photos showcase réutilisées en
  boucle, pas de vrais clients)
- Mention "24h delivery" corrigée en "24-48 hour delivery" (le délai standard
  réel, cohérent avec le reste du site — "24h" sous-entendait à tort le délai
  Express)
- Clignotement du prix dans le hero corrigé (affichait brièvement un mauvais
  montant/devise pendant le chargement des taux de change et des prix admin
  avant de se stabiliser) — un skeleton s'affiche maintenant le temps que
  tout soit chargé, une seule valeur finale montrée
- Audit de vitesse du site : les 3 photos showcase (`showcase_1/2/3.jpg`)
  pesaient 1,75 Mo / 414 Ko / 764 Ko pour une résolution 1600-1920px alors
  qu'elles ne sont jamais affichées au-delà de ~400px (poster vidéo hero,
  vignettes, grille 3 colonnes) — recompressées à 900px max, -87%/-67%/-84%
  (2,9 Mo → 481 Ko au total), qualité vérifiée visuellement, originaux dans
  `public/original-images/`. C'était le point le plus critique : la vidéo
  hero utilise `showcase_1.jpg` comme `poster` HTML natif (pas optimisé par
  next/image), donc ce fichier faisait tout le poids du premier rendu visible
  (LCP) de la page d'accueil. Ajouté aussi le prop `sizes` manquant sur les
  images `fill` des pages About/Our Story (elles se faisaient servir une
  version pleine largeur alors qu'affichées à ~33% de l'écran). Le reste
  (polices via next/font, scripts tiers en `afterInteractive`, vidéos déjà
  re-encodées, lazy loading déjà en place) était déjà bien optimisé.

**Pour pousser ces commits en production** : `git push` (déclenche un déploiement
Vercel immédiat) — je ne l'ai pas fait automatiquement, dis-moi quand tu veux
que je le fasse.
