# 🎵 Configuration du téléchargement automatique de musique

## 🎯 Fonctionnalité

Lorsqu'un client fournit un **lien YouTube/Spotify/SoundCloud** pour sa musique personnalisée :
1. ✅ La musique est **automatiquement téléchargée** et convertie en MP3
2. ✅ Le fichier MP3 est **envoyé directement sur Discord** en pièce jointe
3. ✅ Vous recevez le fichier prêt à l'emploi dans votre canal Discord

**Plateformes supportées** :
- ✅ YouTube (youtube.com, youtu.be)
- ✅ Spotify (spotify.com)
- ✅ SoundCloud (soundcloud.com)
- ✅ Et bien d'autres via l'API

---

## 🔧 Configuration requise

### 1. API de téléchargement

Le système utilise **Cobalt API** par défaut (gratuit, sans authentification).

**Aucune configuration nécessaire !** Ça marche out-of-the-box.

**Alternative (optionnelle)** : Rapidapi YouTube MP3

Si vous voulez plus de fiabilité, vous pouvez utiliser Rapidapi :

1. Créer un compte : https://rapidapi.com/
2. S'abonner à : https://rapidapi.com/ytjar/api/youtube-mp36
3. Copier votre clé API
4. Ajouter à `.env` :

```bash
RAPIDAPI_KEY=your_api_key_here
```

### 2. Discord Webhook (déjà configuré)

Vous avez déjà votre webhook Discord configuré dans :
```bash
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

Rien à faire de plus !

---

## 🚀 Comment ça marche

### Flow automatique

```
Client passe commande avec lien YouTube
         ↓
Paiement confirmé (Stripe/PayPal)
         ↓
Webhook appelé automatiquement
         ↓
1. Téléchargement du lien → MP3 (5-15 secondes)
2. Upload sur Vercel Blob
3. Envoi sur Discord avec fichier MP3 attaché
         ↓
Vous recevez sur Discord :
  - Notification de commande
  - Photo du client (inline)
  - Fichier MP3 (téléchargeable)
  - Lien original (backup)
```

### Exemple de notification Discord

```
🎉 New paid order

Birthday message:
> "Joyeux anniversaire Sarah !"

Order ID:    abc-123-def
Email:       client@example.com
Amount:      $29.99 USD
Delivery:    Express
Music:       Custom song
Provider:    Stripe
Device:      Mobile
Country:     FR

🎵 Music link:
https://youtube.com/watch?v=dQw4w9WgXcQ

✅ Music MP3:
Downloaded and attached below

🖼️ Photo:
https://vercel-blob.com/...

[📎 abc-123-def-music.mp3]  ← Fichier téléchargeable
```

---

## 🧪 Test en local

### 1. Tester le téléchargement

```bash
npm run dev
```

Dans un autre terminal :

```bash
curl -X POST http://localhost:3000/api/download-music \
  -H "Content-Type: application/json" \
  -d '{
    "musicLink": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "orderId": "test-123"
  }'
```

Réponse attendue :
```json
{
  "success": true,
  "mp3Url": "https://vercel-blob.com/...",
  "info": {
    "title": "Rick Astley - Never Gonna Give You Up",
    "duration": 213
  }
}
```

### 2. Tester le webhook complet

Créer une fausse commande et confirmer le paiement :
- Aller sur http://localhost:3000
- Passer commande avec un lien YouTube
- Utiliser carte test Stripe : `4242 4242 4242 4242`
- Vérifier Discord

---

## 📊 Limites et performance

### Cobalt API (gratuit, par défaut)
- ✅ Gratuit
- ✅ Pas d'authentification
- ⚠️ Limité à ~100 requêtes/jour par IP
- ⏱️ Téléchargement : 5-15 secondes

### Rapidapi (payant, optionnel)
- 💰 Freemium : 100 requêtes/mois gratuites
- ✅ Plus fiable
- ✅ Support multi-plateforme
- ⏱️ Téléchargement : 3-10 secondes

### Taille des fichiers
- Maximum Discord : **25 MB** (gratuit) ou **500 MB** (Nitro)
- Limite Vercel Blob : **500 MB** par fichier
- Durée musicale recommandée : **≤ 5 minutes**

Si un fichier dépasse 25 MB, le lien sera toujours envoyé (backup).

---

## 🔧 Dépannage

### Erreur : "Download failed"

**Cause** : Le lien n'est pas accessible ou format non supporté

**Solutions** :
1. Vérifier que le lien est public (pas de vidéo privée)
2. Essayer avec un lien YouTube direct
3. Vérifier les logs : `vercel logs`

### Erreur : "Discord webhook with file failed"

**Cause** : Fichier trop gros (> 25 MB)

**Solution** :
- Le lien est quand même envoyé sur Discord
- Vous pouvez télécharger manuellement depuis le lien
- Ou activer Discord Nitro (limite 500 MB)

### Téléchargement trop lent

**Cause** : Cobalt API surchargé

**Solution** :
1. Passer à Rapidapi (voir Configuration)
2. Ou self-host yt-dlp (voir ci-dessous)

---

## 🚀 Options avancées

### Self-host yt-dlp (pour volume élevé)

Si vous avez beaucoup de commandes (> 100/jour), vous pouvez héberger votre propre service :

1. Déployer sur Railway/Render : https://github.com/yt-dlp/yt-dlp
2. Ajouter à `.env` :

```bash
MUSIC_DOWNLOAD_API_URL=https://your-ytdlp-service.com/api
```

### Désactiver le téléchargement automatique

Si vous préférez télécharger manuellement :

Dans `.env` :
```bash
DISABLE_MUSIC_AUTO_DOWNLOAD=true
```

Le lien sera toujours envoyé sur Discord, mais sans fichier MP3 attaché.

---

## 📝 Fichiers modifiés

```
src/lib/musicDownloader.ts              → Service de téléchargement
src/lib/discordWebhook.ts               → Envoi avec fichier
src/app/api/download-music/route.ts     → API endpoint
src/app/api/stripe-webhook/route.ts     → Hook Stripe
src/app/api/paypal/capture-order/route.ts → Hook PayPal
```

---

## ✅ Checklist de déploiement

Avant de push en production :

- [ ] `DISCORD_WEBHOOK_URL` configuré dans Vercel
- [ ] Test en local réussi
- [ ] Test avec vraie commande Stripe
- [ ] Vérifier notification Discord
- [ ] Télécharger le MP3 depuis Discord

Optionnel :
- [ ] `RAPIDAPI_KEY` pour plus de fiabilité
- [ ] `MUSIC_DOWNLOAD_API_URL` pour self-host

---

## 💡 Utilisation quotidienne

### Quand vous recevez une commande

1. **Notification Discord** : Vous êtes alerté immédiatement
2. **Fichier MP3** : Téléchargeable directement depuis Discord
3. **Créer la vidéo** : Utilisez le MP3 téléchargé
4. **Upload et envoi** : Via le panel admin

### Si le téléchargement échoue

Le lien YouTube/Spotify est **toujours envoyé** sur Discord comme backup.
Vous pouvez :
- Cliquer sur le lien
- Utiliser un outil comme `youtube-dl` ou `4K Video Downloader`
- Convertir en MP3 manuellement

---

## 🎉 Résumé

**Avant** :
1. Recevoir notification Discord
2. Copier le lien YouTube
3. Aller sur youtube-dl ou site de conversion
4. Télécharger → Convertir → Sauvegarder
⏱️ Temps : ~3-5 minutes par commande

**Après** :
1. Recevoir notification Discord
2. Télécharger le MP3 directement
⏱️ Temps : ~10 secondes par commande

**Gain de temps** : **30× plus rapide** ! 🚀

---

**Tout est déjà configuré et prêt à l'emploi !** 

Prochain déploiement → La fonctionnalité sera active automatiquement.
