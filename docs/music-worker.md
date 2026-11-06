# Musique : téléchargement gratuit sur le VPS

Ce flux remplace RapidAPI/Cobalt. Aucun abonnement ni API payante. Prérequis : serveur média existant, Python 3.11+, `ffmpeg`, `ffprobe`, `bws`, systemd utilisateur et accès en écriture au stockage média. Ne pas modifier la crontab ni le serveur d'upload existant.

## Flux

- Un MP3 client (`music_file_url`) ou un téléchargement déjà enregistré est transmis directement dans la notification habituelle ; pas de re-téléchargement.
- Un lien personnalisé seul crée un petit fichier chiffré AES-256-GCM dans `orders/music-jobs/<uuid>.json` via l'upload signé existant. La notification précise « MP3 en cours ».
- `scripts/music-worker.py` surveille ce dossier toutes les trois secondes et traite un fichier à la fois. Il ne lit ni n'écrit directement dans PostgreSQL. Un verrou empêche deux instances simultanées.
- Spotify fournit uniquement le titre, l'artiste et la durée. Recherche exacte sur Bandcamp, puis YouTube. Aucun extrait, titre approximatif, version live/remix substituée ou téléchargement payant : titre/artiste exacts et durée à trois secondes près. Les liens directs YouTube, SoundCloud et Bandcamp sont traités par yt-dlp.
- Le worker valide taille, durée, codec MP3 et décodage intégral, puis publie atomiquement `orders/music/<orderId>-<jobId>.mp3`.
- Le callback HMAC `/api/internal/music-result` (signature valable cinq minutes) vérifie la commande payée, son lien inchangé, l'absence de MP3 client et le fichier sur le seul hôte média autorisé. Il enregistre `downloaded_music_url` puis appelle le **même** `sendTelegramAudio` que le bot des commandes. Succès uniquement avec accusé de réception Telegram (`messageId`, `botUsername`, `chatId`).
- En cas de téléchargement refusé, le même bot reçoit une alerte **MP3 MANQUANT**, exigeant une récupération manuelle. Un fournisseur peut bloquer : ne jamais promettre 100 % de téléchargements automatiques.

## Installation sur ce VPS

Après accord de publication et tests, créer `%h/.local/lib/afrobirthday-music/venv` et installer `scripts/music-worker-requirements.txt` dedans. Copier `scripts/afrobirthday-music.service` dans `%h/.config/systemd/user/`, puis `systemctl --user daemon-reload` et `systemctl --user enable --now afrobirthday-music.service`. Les fichiers métier restent versionnés dans le dépôt principal, pas dans le scratch. `Linger=yes` est nécessaire pour survivre aux déconnexions.

Le service lit uniquement la référence Bitwarden non secrète du secret admin existant et la variable de connexion au coffre du profil AfroBirthday. Le secret admin n'est jamais écrit sur disque ni journalisé. `ADMIN_TOKEN_SECRET` en production Vercel doit être identique à cette référence. Les variables Vercel de type **sensitive** ne sont pas exportées par `vercel env run` : une valeur absente dans cette commande ne prouve pas qu'elle manque au runtime. Ne pas réécrire les tokens Telegram pour ce motif.

## Suivi et reprise

- `systemctl --user status afrobirthday-music.service` et `journalctl --user -u afrobirthday-music.service` : IDs, résultat et reçu Telegram seulement ; pas de tokens ni d'URL CDN signée.
- État et reçus : `%h/.local/state/afrobirthday-music/<jobId>.json` (privé). Si callback échoué, MP3 conservé, reprise automatique avec délai croissant (maximum 30 min), sans re-téléchargement. La file n'est supprimée qu'après résultat confirmé ou commande modifiée.
- Temporaires : scratch du profil, recréé au besoin, chaque dossier audio supprimé après traitement. Aucun serveur de test persistant.
- Une coupure après l'envoi Telegram mais avant sauvegarde du reçu peut provoquer un doublon. Ce système ne promet pas l'exactement-une-fois entre services. Un nouveau job peut également renvoyer un fichier : ne pas relancer la commande de paiement pour un simple renvoi.
- Limites : 30 Mio, 15 min par morceau, un job à la fois. Les jobs invalides ou vieux de plus de sept jours sont mis en quarantaine dans le dossier d'état. Aucun achat ni contournement de protection audio.
- Arrêt réversible : `systemctl --user disable --now afrobirthday-music.service`. `DISABLE_MUSIC_AUTO_DOWNLOAD=true` côté site arrête la mise en file et signale explicitement la récupération manuelle ; il faut republier pour changer cette variable en production. Réactivation : remettre le service et retirer ce drapeau. Aucun ancien MP3 n'est effacé.

## Contrôles isolés

`env -u DATABASE_URL node scripts/check-music.mjs` : vraies fonctions du site et du callback, frontières externes simulées (aucun TTS/paiement/Telegram/stockage/base de production).

`<venv>/bin/python scripts/check-music-worker.py` avec `TMPDIR` dans un scratch dédié : chiffrement, allowlist, correspondance du morceau, extraits rejetés, reprise sans re-téléchargement, alerte et quarantaine, sans réseau.

Le build Next est réalisé sans `DATABASE_URL` ni clé Stripe. Pour un contrôle réel demandé sur une commande, lire son ID unique via `db-ro.py`, obtenir le « oui » requis avant toute écriture ou envoi, créer un job chiffré et vérifier séparément le reçu Telegram, le fichier média et `downloaded_music_url`. Ne pas compter un fichier disponible comme un fichier reçu par le bot.
