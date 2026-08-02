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

## 🔴 Accès externe requis (je ne peux pas le faire moi-même)

1. **Ajouter `CRON_SECRET` sur Vercel** — déjà généré et ajouté à `.env.local`
   (`CRON_SECRET=bc2f3d3efbce444ef9195752e830b86f5b1a9b210e787626da0e58ed70b995a4`).
   Vercel → projet `afrobirthday` → Settings → Environment Variables → ajoute
   `CRON_SECRET` avec cette valeur pour **Production** et **Preview**, puis
   redéploie.

2. **Ré-encoder vraiment la vidéo hero sous les 5 Mo** — le WebM cassé (68,9 Mo)
   a été supprimé, donc Chrome/Firefox/Edge chargent déjà 25 Mo de moins. Mais
   le MP4 (43,6 Mo) reste le plus gros problème de perf du site. FFmpeg n'est
   pas installé sur cette machine :
   ```bash
   choco install ffmpeg   # ou https://ffmpeg.org/download.html
   npm run optimize:videos
   npm run check:videos
   ```

---

## 🟠 Trop risqué à faire sans test réel en conditions de paiement

3. **Brancher les codes promo au checkout** — toute l'infra existe déjà côté
   admin/DB (`validatePromoCode`, `incrementPromoCodeUsage`, colonnes
   `promo_code`/`discount_amount`), mais rien ne l'appelle. Le brancher
   correctement touche 3 chemins de paiement différents en parallèle
   (`create-checkout`, `create-payment-intent`, `paypal/create-order`) + il
   faut incrémenter l'usage seulement sur paiement confirmé (webhook), pas à
   la création de commande. Je n'ai pas de moyen de tester une vraie
   transaction Stripe/PayPal ici — un bug dans ce genre de code a un impact
   financier direct. À faire en supervisant chaque étape avec de vrais tests
   de paiement (mode test Stripe + sandbox PayPal).

4. **Aligner la devise PayPal sur le prix local affiché** — PayPal facture
   toujours en USD alors que l'UI affiche un prix converti dans la devise
   locale. Le corriger nécessite de savoir quelles devises ton compte
   marchand PayPal peut réellement recevoir (visible seulement dans ton
   dashboard PayPal — tous les comptes ne supportent pas INR/CNY/ZAR/SAR par
   exemple), puis de tester en sandbox. Risque réel de casser complètement le
   paiement PayPal pour certains pays si la devise n'est pas supportée par
   ton compte — je préfère te laisser vérifier ça toi-même avant qu'on code
   le changement.

---

## 🟡 Décisions produit / contenu (pas à moi de trancher)

5. **`SocialProofSection.tsx`** — composant complet ("500+ clients, 50+ pays,
   4.9/5") mais jamais affiché sur le site, et non traduit. Je ne l'ai pas
   réactivé : je ne peux pas confirmer que ces chiffres sont exacts
   aujourd'hui. À toi de me donner les vrais chiffres (ou de me dire de les
   retirer/supprimer le composant) et je le branche.

6. **Deux jeux de témoignages différents et non synchronisés**
   (`TestimonialsSection.tsx` vs `SocialProofSection.tsx`) — lequel garder,
   lequel des deux fusionner dedans ?

7. **`reviewCount` du schema JSON-LD** — j'ai corrigé le nombre codé en dur
   (500) pour qu'il reflète le vrai nombre de témoignages affichés. Mais si
   ces témoignages eux-mêmes ne sont pas des avis clients vérifiables, le
   schema `AggregateRating` reste un risque vis-à-vis des règles de Google
   sur les avis — à voir si tu veux brancher une vraie plateforme d'avis
   (Trustpilot etc.) plus tard.

8. **Le "-50%" permanent dans le hero** — prix barré fixe, sans vraie logique
   temporelle. Décision marketing, pas un bug technique.

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

**Pour pousser ces commits en production** : `git push` (déclenche un déploiement
Vercel immédiat) — je ne l'ai pas fait automatiquement, dis-moi quand tu veux
que je le fasse.
