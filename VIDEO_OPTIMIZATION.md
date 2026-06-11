# 🎬 Guide d'optimisation des vidéos - AfroBirthday

## 📊 État actuel

### Vidéos avant optimisation
| Fichier | Taille | Format |
|---------|--------|--------|
| `blessing_video_principal.mp4` | 42 MB | MP4 |
| `blessing_video1.mp4` | 9.6 MB | MP4 |
| `blessing_video2.mp4` | 14 MB | MP4 |
| `blessing_video3.MOV` | 21 MB | MOV |
| `blessing_video4.MOV` | 9.2 MB | MOV |
| **TOTAL** | **~95.8 MB** | - |

### Problèmes identifiés
- ❌ Fichiers `.MOV` (format QuickTime, non optimisé pour le web)
- ❌ Compression insuffisante (certains MP4 peuvent être réduits)
- ❌ Pas de format WebM (meilleure compression que MP4)
- ⚠️ Impact sur les performances : temps de chargement élevé sur mobile

---

## ✅ Solution implémentée

### 1. Script d'optimisation automatique

**Fichier** : `scripts/optimize-videos.js`

**Fonctionnalités** :
- Conversion automatique des `.MOV` en `.mp4` optimisé
- Génération de versions `.webm` (30-50% plus léger que MP4)
- Sauvegarde des fichiers originaux dans `/public/original-videos`
- Compression intelligente avec FFmpeg :
  - **MP4** : H.264, CRF 28, faststart pour streaming
  - **WebM** : VP9, CRF 32, Opus audio

### 2. Composant OptimizedVideo amélioré

**Fichier** : `src/components/OptimizedVideo.tsx`

**Améliorations** :
- ✅ **Lazy loading** : chargement uniquement quand la vidéo est visible (Intersection Observer)
- ✅ **Multi-format** : WebM en priorité, MP4 en fallback
- ✅ **Poster image** : affichage instantané de l'image avant le chargement
- ✅ **Transition fluide** : fade-in progressif
- ✅ **Preload intelligent** : `metadata` pour hero, `none` pour le reste

### 3. Mise à jour des références

**Fichiers modifiés** :
- `src/components/sections/ProductShowcaseSection.tsx` : changement des `.MOV` en `.mp4`
- `.gitignore` : exclusion des fichiers `.MOV` et du dossier de backup

---

## 🚀 Utilisation

### Prérequis : Installer FFmpeg

**Windows** :
```bash
# Avec Chocolatey
choco install ffmpeg

# Ou télécharger : https://ffmpeg.org/download.html
```

**Mac** :
```bash
brew install ffmpeg
```

**Linux** :
```bash
sudo apt install ffmpeg
```

### Lancer l'optimisation

```bash
npm run optimize:videos
```

**Ce que fait le script** :
1. Détecte tous les fichiers vidéo dans `/public`
2. Sauvegarde les originaux dans `/public/original-videos`
3. Génère des versions `.mp4` optimisées (H.264, CRF 28)
4. Génère des versions `.webm` optimisées (VP9, CRF 32)
5. Affiche un rapport de compression avec économies en %

### Exemple de sortie

```
🎬 AfroBirthday Video Optimizer

=================================

✅ FFmpeg detected

📁 Created backup directory: /public/original-videos

📹 Found 5 video files:

📽️  Processing: blessing_video3.MOV (21.00 MB)
   💾 Backed up: blessing_video3.MOV
   🔄 Converting to MP4...
   ✅ Created blessing_video3.mp4 (8.2 MB)
   🔄 Converting to WEBM...
   ✅ Created blessing_video3.webm (5.8 MB)

...

📊 OPTIMIZATION SUMMARY
=================================

blessing_video3.MOV:
  Original: 21.00 MB
  MP4:      8.2 MB (60.9% reduction)
  WebM:     5.8 MB (72.4% reduction)

Total size before: 95.80 MB
Total size after:  34.20 MB
Total savings:     64.3%

✨ Optimization complete!
```

---

## 📈 Résultats attendus

### Tailles après optimisation (estimation)

| Fichier | Avant | MP4 | WebM | Économie |
|---------|-------|-----|------|----------|
| `blessing_video_principal` | 42 MB | ~18 MB | ~12 MB | ~57-71% |
| `blessing_video1` | 9.6 MB | ~6 MB | ~4 MB | ~38-58% |
| `blessing_video2` | 14 MB | ~8 MB | ~5.5 MB | ~43-61% |
| `blessing_video3` | 21 MB | ~8 MB | ~5.5 MB | ~62-74% |
| `blessing_video4` | 9.2 MB | ~5.5 MB | ~3.8 MB | ~40-59% |
| **TOTAL** | **95.8 MB** | **~45 MB** | **~30 MB** | **~53-69%** |

### Impact sur les performances

- **Temps de chargement 4G** : -60% (de ~10s à ~4s)
- **Temps de chargement 3G** : -65% (de ~30s à ~10s)
- **Score Lighthouse** : +15-25 points
- **Bande passante économisée** : ~65 MB par visite (économie serveur + utilisateur)

---

## 🔧 Vérification post-optimisation

### 1. Tester les vidéos localement

```bash
npm run dev
```

Vérifiez que :
- ✅ La vidéo Hero charge rapidement
- ✅ Les vidéos showcase apparaissent au scroll
- ✅ Le fallback MP4 fonctionne si WebM n'est pas supporté
- ✅ Pas d'erreurs dans la console

### 2. Vérifier les formats

**Chrome/Edge** : Charge WebM (optimal)
**Safari** : Charge MP4 (fallback)
**Firefox** : Charge WebM (optimal)

### 3. Tester les performances

Ouvrez Chrome DevTools > Lighthouse :
- **Performance** : devrait passer de 70-80 à 85-95
- **Best Practices** : 100 (formats web optimisés)

### 4. Nettoyer les fichiers originaux

**Après vérification en production** :

```bash
# Supprimer les .MOV du dossier public (déjà backupés)
rm public/*.MOV
rm public/*.mov

# Optionnel : compresser les backups
cd public/original-videos
tar -czf video-backups-$(date +%Y%m%d).tar.gz *.MOV
```

---

## 🎯 Bonnes pratiques pour l'avenir

### Ajout de nouvelles vidéos

1. **Avant de committer** :
   ```bash
   npm run optimize:videos
   ```

2. **Nommage** :
   - Utiliser des noms descriptifs : `blessing_video_birthday.mp4`
   - Pas d'espaces ni caractères spéciaux

3. **Taille recommandée** :
   - **Durée** : ≤ 30 secondes
   - **Résolution** : 1080p max (1920×1080)
   - **Poids cible** : ≤ 15 MB avant compression

4. **Formats sources acceptés** :
   - MP4, MOV, AVI (le script les convertira)
   - Éviter les formats exotiques (WMV, FLV)

### Outils de compression en ligne (alternatifs)

Si FFmpeg n'est pas disponible :
- [HandBrake](https://handbrake.fr/) (gratuit, interface graphique)
- [CloudConvert](https://cloudconvert.com/mp4-to-webm) (en ligne)
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) (dans le navigateur)

---

## 🐛 Dépannage

### Erreur : "FFmpeg not found"
**Solution** : Installer FFmpeg (voir section Prérequis)

### Vidéo ne charge pas en WebM
**Cause** : Safari ne supporte pas WebM
**Solution** : Normal, le fallback MP4 sera utilisé automatiquement

### Qualité dégradée après compression
**Ajustement** : Modifier le CRF dans `scripts/optimize-videos.js`
- CRF 28 → CRF 23 (meilleure qualité, fichiers plus gros)
- CRF 28 → CRF 32 (qualité inférieure, fichiers plus petits)

### Vidéo ne se lance pas automatiquement
**Cause** : Politique autoplay du navigateur
**Solution** : Normal sur mobile (nécessite interaction utilisateur)

---

## 📚 Ressources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [WebM Best Practices](https://developers.google.com/web/fundamentals/media/mobile-web-video-playback)
- [MDN Video Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video)
- [Lazy Loading Videos](https://web.dev/lazy-loading-video/)

---

**Dernière mise à jour** : 2026-06-11
**Version** : 1.0.0
