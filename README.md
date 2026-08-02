# 🎉 AfroBirthday

Plateforme e-commerce pour commander des vidéos d'anniversaire personnalisées créées par des danseurs africains.

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Build pour production
npm run build
npm start
```

## ⚙️ Configuration

Copiez `.env.example` vers `.env.local` et renseignez les vraies valeurs
(Stripe, PayPal, Supabase, Resend, Telegram, OpenAI, PostHog...). Chaque
variable est commentée avec son usage et si elle est requise ou optionnelle.

```bash
cp .env.example .env.local
```

## 🎬 Optimisation des vidéos

Les vidéos du site sont automatiquement optimisées pour réduire la taille et améliorer les performances.

```bash
# Optimiser toutes les vidéos (nécessite FFmpeg)
npm run optimize:videos
```

📖 Voir [VIDEO_OPTIMIZATION.md](./VIDEO_OPTIMIZATION.md) pour plus de détails.

## 🌍 Langues supportées

10 langues disponibles : EN, FR, ES, DE, IT, PT, NL, AR, HI, ZH

## 🛠️ Technologies

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Stripe + PayPal
- Supabase (Postgres + Storage)
- PostHog + Vercel Analytics

## 📚 Documentation

- [Guide d'optimisation vidéo](./VIDEO_OPTIMIZATION.md)

---

**Version** : 0.1.0