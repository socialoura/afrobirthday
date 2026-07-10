# Exemples de questions à poser au bot (mêmes capacités que le bot actuel)

SOUL.md / .hermes.md / hermes-tools.json donnent l'identité, le contexte et les
outils. Tu poses juste tes questions en langage naturel, comme aujourd'hui.

## Commandes

```
Montre-moi la dernière commande.
```
```
Combien de commandes en attente de production ?
```
```
Liste les commandes express pas encore livrées.
```
```
Une commande avec le prénom "Awa" dans le message ?
```
```
Les commandes du client dont l'email contient "gmail" cette semaine.
```

## Stats / business

```
Quel est le revenu total payé ?
```
```
Répartition des commandes par pays ce mois-ci.
```
```
Combien d'express vs standard ?
```
```
Panier moyen sur les 30 derniers jours ?
```

---

## Branchement des outils (à faire une fois)

`query_orders` et `get_stats` doivent lire ta base. Le plus simple vu ton stack :
réutiliser `getAllOrders` de `src/lib/db.ts` via un petit endpoint HTTP protégé
que l'agent appelle. La logique de filtres/stats existe déjà dans
`src/lib/telegramAI.ts` (`applyFilters`, `computeStats`) — on peut la réexposer.
