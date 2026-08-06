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

**Pour pousser ces commits en production** : `git push` (déclenche un déploiement
Vercel immédiat) — je ne l'ai pas fait automatiquement, dis-moi quand tu veux
que je le fasse.
