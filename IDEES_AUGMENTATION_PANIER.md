# Idées pour augmenter le panier moyen (AOV)

Brainstorm de pistes pour augmenter le montant dépensé par client, organisé
par catégorie et relié à ce qui existe déjà techniquement (pricing,
codes promo, formulaire de commande) pour être facile à chiffrer/implémenter.

Voir aussi le backlog complet : https://claude.ai/code/artifact/4d9fbe6d-b99c-41e0-98f6-2f6f996ade5d

---

## Upsells directs sur le formulaire de commande

Le plus rapide à tester — s'ajoute aux add-ons existants (chanson perso,
livraison express).

- **Vidéo plus longue** — palier premium (ex. 60s au lieu de 30s).
- **Plusieurs photos dans la vidéo** — actuellement une seule photo acceptée ;
  permettre 2-3 photos (montage) à un prix supérieur.
- **Plus de danseurs / équipe plus nombreuse** — palier "groupe VIP" vs le
  crew standard.
- **Paroles 100% personnalisées chantées** (pas juste une chanson externe
  uploadée) — add-on premium à plus forte marge perçue.
- **Livraison ultra-express** au-dessus de l'actuelle (ex. "3h" à prix fort)
  — capte les acheteurs de dernière minute, très forte disposition à payer.

---

## Order bump post-paiement

Le plus gros levier ROI/effort — l'infra codes promo existe déjà (validation
serveur, remise appliquée aux 3 chemins de paiement), donc techniquement
simple à brancher.

- Sur la page `/success`, avant ou juste après confirmation : "Offrez la même
  surprise à quelqu'un d'autre — 20% de réduction sur une 2e vidéo commandée
  maintenant." Un code promo auto-généré à usage unique appliqué sur cette
  page ferait le job.
- Petit add-on à cocher en un clic (carte cadeau PDF imprimable, certificat
  "happy birthday" personnalisé) sans repasser par tout le formulaire.

---

## Bundles / multi-vidéos

- Pack "3 vidéos pour 3 proches" avec dégressif (ex. -15% dès la 2e).
  Réutilise directement l'infra codes promo/percentage déjà en place.
- Carte cadeau prépayée (crédit à utiliser plus tard) — souvent pousse le
  panier moyen car les gens arrondissent au montant supérieur.

---

## Tarification en paliers (good/better/best)

- Remplacer la liste actuelle d'add-ons cochables par 3 offres nommées
  (Essentiel / Populaire / Premium) avec le palier du milieu mis en avant
  visuellement — effet d'ancrage classique, augmente le taux de sélection du
  palier supérieur sans qu'il soit imposé.

---

## Cross-sell après achat (email/CRM)

- Séquence email J+7 : "Cette vidéo pour un autre anniversaire à venir ?"
  avec code promo dédié — capte les usages récurrents (anniversaires
  familiaux répétés dans l'année).
- Rappel automatique un an après pour la même personne (la base de données a
  déjà `email` + `created_at` par commande, exploitable).

---

## Prochaine étape

Dis-moi lesquelles t'intéressent le plus. Options :
- Les ajouter au backlog Artifact pour y réfléchir tranquillement.
- Commencer à implémenter directement celles qui ne touchent pas au design
  (l'order bump post-paiement et le pack multi-vidéos sont les plus rapides
  à coder proprement sans image).
