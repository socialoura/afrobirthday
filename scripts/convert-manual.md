# 🎬 Conversion manuelle des vidéos (sans FFmpeg)

Si FFmpeg ne peut pas être installé, voici comment convertir manuellement les vidéos.

## 📹 Vidéos à convertir

Les vidéos suivantes nécessitent une conversion :

1. **blessing_video3.MOV** (21 MB)
2. **blessing_video4.MOV** (9.2 MB)

Les autres sont déjà en MP4 :
- ✅ blessing_video_principal.mp4 (42 MB)
- ✅ blessing_video1.mp4 (9.6 MB)
- ✅ blessing_video2.mp4 (14 MB)

## 🌐 Option 1 : CloudConvert (Recommandé)

### MP4 Conversion

1. Allez sur : https://cloudconvert.com/mov-to-mp4
2. Upload `public/blessing_video3.MOV`
3. Paramètres :
   - **Codec** : H.264
   - **Quality** : Medium (CRF 28)
   - **Format** : MP4
4. Téléchargez → Sauvegardez comme `public/blessing_video3.mp4`
5. Répétez pour `blessing_video4.MOV`

### WebM Conversion (Optionnel, mais recommandé)

1. Allez sur : https://cloudconvert.com/mov-to-webm
2. Upload les mêmes fichiers .MOV
3. Paramètres :
   - **Codec** : VP9
   - **Quality** : Medium
4. Téléchargez comme :
   - `public/blessing_video3.webm`
   - `public/blessing_video4.webm`

## 🖥️ Option 2 : HandBrake (Gratuit, Offline)

### Installation

Télécharger : https://handbrake.fr/downloads.php

### Utilisation

1. Ouvrir HandBrake
2. **Source** → Sélectionner `blessing_video3.MOV`
3. **Destination** → `public/blessing_video3.mp4`
4. **Presets** → Sélectionner "Fast 1080p30"
5. **Video** :
   - Codec : H.264 (x264)
   - Quality : RF 28
   - Framerate : Same as source
6. **Audio** :
   - Codec : AAC
   - Bitrate : 128
7. Cliquer **Start Encode**
8. Répéter pour blessing_video4.MOV

## 📱 Option 3 : VLC Media Player

Si vous avez VLC installé :

1. Ouvrir VLC
2. **Media** → **Convert/Save**
3. **Add** → Sélectionner `blessing_video3.MOV`
4. **Convert/Save** → **Convert**
5. **Profile** : Video - H.264 + MP3 (MP4)
6. **Destination** : `public/blessing_video3.mp4`
7. **Start**
8. Répéter pour blessing_video4.MOV

## ✅ Vérification après conversion

Après conversion, vérifier que vous avez :

```
public/
  ├── blessing_video_principal.mp4 ✅
  ├── blessing_video_principal.webm (optionnel)
  ├── blessing_video1.mp4 ✅
  ├── blessing_video1.webm (optionnel)
  ├── blessing_video2.mp4 ✅
  ├── blessing_video2.webm (optionnel)
  ├── blessing_video3.mp4 ✅ (nouveau)
  ├── blessing_video3.webm (optionnel, nouveau)
  ├── blessing_video4.mp4 ✅ (nouveau)
  └── blessing_video4.webm (optionnel, nouveau)
```

Lancer la vérification :

```bash
npm run check:videos
```

Résultat attendu :
```
✅ All videos are ready!
```

## 🗑️ Nettoyage (après vérification)

Une fois que tout fonctionne, vous pouvez déplacer les .MOV originaux :

```bash
# Créer dossier de backup
mkdir public/original-videos

# Déplacer les originaux
mv public/blessing_video3.MOV public/original-videos/
mv public/blessing_video4.MOV public/original-videos/
```

Ou les supprimer si vous êtes sûr :

```bash
rm public/blessing_video3.MOV
rm public/blessing_video4.MOV
```

## 🎯 Objectif des tailles

| Vidéo | Original | Cible MP4 | Cible WebM |
|-------|----------|-----------|------------|
| blessing_video3 | 21 MB | ~8-10 MB | ~5-7 MB |
| blessing_video4 | 9.2 MB | ~5-6 MB | ~3-4 MB |

Si les fichiers convertis sont plus gros, c'est OK tant qu'ils fonctionnent.

## 📚 Prochaine étape

Après conversion → Tester en local :

```bash
npm run dev
```

Vérifier que les vidéos se chargent correctement.
