#!/usr/bin/env node

/**
 * Video Optimization Script for AfroBirthday
 *
 * Converts .MOV files to optimized MP4 and WebM formats
 * Requires FFmpeg installed: https://ffmpeg.org/download.html
 *
 * Usage: node scripts/optimize-videos.js
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const BACKUP_DIR = path.join(PUBLIC_DIR, 'original-videos');
const PORTABLE_FFMPEG = path.join(__dirname, '..', 'ffmpeg', 'bin', 'ffmpeg.exe');

// Video optimization settings
const SETTINGS = {
  mp4: {
    // H.264 codec, CRF 28 for good quality/size balance
    command: '-c:v libx264 -crf 28 -preset slow -movflags +faststart -c:a aac -b:a 128k',
    ext: '.mp4',
  },
  webm: {
    // VP9 codec for smaller file sizes
    command: '-c:v libvpx-vp9 -crf 32 -b:v 0 -c:a libopus -b:a 128k',
    ext: '.webm',
  },
};

async function getFFmpegCommand() {
  // Check for portable FFmpeg first
  try {
    await fs.access(PORTABLE_FFMPEG);
    console.log('✅ Using portable FFmpeg\n');
    return `"${PORTABLE_FFMPEG}"`;
  } catch {}

  // Check system FFmpeg
  try {
    await execAsync('ffmpeg -version');
    console.log('✅ Using system FFmpeg\n');
    return 'ffmpeg';
  } catch {}

  return null;
}

async function checkFFmpeg() {
  const ffmpegCmd = await getFFmpegCommand();

  if (!ffmpegCmd) {
    console.error('❌ FFmpeg not found. Please install it first:\n');
    console.error('   Option 1: Run portable download');
    console.error('   powershell -ExecutionPolicy Bypass -File scripts/download-ffmpeg.ps1\n');
    console.error('   Option 2: Install system-wide');
    console.error('   - Windows: choco install ffmpeg');
    console.error('   - Mac: brew install ffmpeg');
    console.error('   - Linux: sudo apt install ffmpeg\n');
    console.error('   Option 3: Manual conversion (see scripts/convert-manual.md)\n');
    return false;
  }

  return true;
}

async function getVideoFiles() {
  const files = await fs.readdir(PUBLIC_DIR);
  return files.filter(file => /\.(MOV|mov|mp4|MP4)$/i.test(file));
}

async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return (stats.size / (1024 * 1024)).toFixed(2); // MB
}

async function ensureBackupDir() {
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}\n`);
  }
}

async function backupOriginal(fileName) {
  const sourcePath = path.join(PUBLIC_DIR, fileName);
  const backupPath = path.join(BACKUP_DIR, fileName);

  try {
    await fs.access(backupPath);
    console.log(`   ℹ️  Backup already exists: ${fileName}`);
  } catch {
    await fs.copyFile(sourcePath, backupPath);
    console.log(`   💾 Backed up: ${fileName}`);
  }
}

async function convertVideo(inputFile, format) {
  const baseName = path.parse(inputFile).name;
  const outputFile = `${baseName}${SETTINGS[format].ext}`;
  const inputPath = path.join(PUBLIC_DIR, inputFile);
  const outputPath = path.join(PUBLIC_DIR, outputFile);

  // Skip if already exists and is recent
  try {
    await fs.access(outputPath);
    console.log(`   ⏭️  ${format.toUpperCase()} already exists: ${outputFile}`);
    return outputFile;
  } catch {
    // File doesn't exist, proceed with conversion
  }

  console.log(`   🔄 Converting to ${format.toUpperCase()}...`);

  const ffmpegCmd = await getFFmpegCommand();
  const command = `${ffmpegCmd} -i "${inputPath}" ${SETTINGS[format].command} "${outputPath}"`;

  try {
    await execAsync(command);
    const outputSize = await getFileSize(outputPath);
    console.log(`   ✅ Created ${outputFile} (${outputSize} MB)`);
    return outputFile;
  } catch (error) {
    console.error(`   ❌ Failed to convert to ${format}:`, error.message);
    return null;
  }
}

async function optimizeAllVideos() {
  console.log('🎬 AfroBirthday Video Optimizer\n');
  console.log('=================================\n');

  // Check FFmpeg
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    process.exit(1);
  }

  // Ensure backup directory exists
  await ensureBackupDir();

  // Get all video files
  const videoFiles = await getVideoFiles();
  console.log(`📹 Found ${videoFiles.length} video files:\n`);

  const results = [];

  for (const file of videoFiles) {
    const originalSize = await getFileSize(path.join(PUBLIC_DIR, file));
    console.log(`\n📽️  Processing: ${file} (${originalSize} MB)`);

    // Backup original if it's a MOV file
    if (/\.(MOV|mov)$/i.test(file)) {
      await backupOriginal(file);
    }

    // Convert to MP4 and WebM
    const mp4File = await convertVideo(file, 'mp4');
    const webmFile = await convertVideo(file, 'webm');

    if (mp4File) {
      const mp4Size = await getFileSize(path.join(PUBLIC_DIR, mp4File));
      const savings = ((originalSize - mp4Size) / originalSize * 100).toFixed(1);
      results.push({
        original: file,
        originalSize,
        mp4: mp4File,
        mp4Size,
        webm: webmFile,
        savings,
      });
    }
  }

  // Summary
  console.log('\n\n📊 OPTIMIZATION SUMMARY');
  console.log('=================================\n');

  results.forEach(({ original, originalSize, mp4, mp4Size, webm, savings }) => {
    console.log(`${original}:`);
    console.log(`  Original: ${originalSize} MB`);
    console.log(`  MP4:      ${mp4Size} MB (${savings}% reduction)`);
    console.log(`  WebM:     ${webm || 'Failed'}`);
    console.log('');
  });

  const totalOriginal = results.reduce((sum, r) => sum + parseFloat(r.originalSize), 0);
  const totalOptimized = results.reduce((sum, r) => sum + parseFloat(r.mp4Size), 0);
  const totalSavings = ((totalOriginal - totalOptimized) / totalOriginal * 100).toFixed(1);

  console.log(`Total size before: ${totalOriginal.toFixed(2)} MB`);
  console.log(`Total size after:  ${totalOptimized.toFixed(2)} MB`);
  console.log(`Total savings:     ${totalSavings}%`);
  console.log('\n✨ Optimization complete!\n');
  console.log('💡 Next steps:');
  console.log('   1. Update video references in your code');
  console.log('   2. Test videos on staging environment');
  console.log('   3. Delete .MOV files from /public after verification');
  console.log(`   4. Original files backed up in: ${BACKUP_DIR}\n`);
}

// Run the script
optimizeAllVideos().catch(console.error);
