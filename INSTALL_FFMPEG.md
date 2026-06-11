# 🎥 Installation de FFmpeg

FFmpeg est requis pour optimiser les vidéos du site.

## Windows

### Option 1 : Chocolatey (Recommandé)

```powershell
# Installer Chocolatey si pas déjà installé
# https://chocolatey.org/install

# Installer FFmpeg
choco install ffmpeg
```

### Option 2 : Téléchargement manuel

1. Télécharger FFmpeg : https://www.gyan.dev/ffmpeg/builds/
2. Extraire l'archive (ex: `C:\ffmpeg`)
3. Ajouter au PATH :
   - Panneau de configuration → Système → Variables d'environnement
   - Modifier `Path` → Ajouter `C:\ffmpeg\bin`
4. Redémarrer le terminal

### Vérification

```bash
ffmpeg -version
```

Vous devriez voir :
```
ffmpeg version 6.x.x ...
```

## Mac

```bash
# Avec Homebrew
brew install ffmpeg
```

## Linux

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# Fedora
sudo dnf install ffmpeg

# Arch
sudo pacman -S ffmpeg
```

## ✅ Après installation

Lancer l'optimisation :

```bash
npm run optimize:videos
```

---

**Besoin d'aide ?** Consultez [VIDEO_OPTIMIZATION.md](./VIDEO_OPTIMIZATION.md)
