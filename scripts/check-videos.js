#!/usr/bin/env node

/**
 * Quick video files checker for AfroBirthday
 * Verifies that optimized videos exist and reports sizes
 */

const fs = require('fs').promises;
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const EXPECTED_VIDEOS = [
  'blessing_video_principal',
  'blessing_video1',
  'blessing_video2',
  'blessing_video3',
  'blessing_video4',
];

async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return (stats.size / (1024 * 1024)).toFixed(2);
  } catch {
    return null;
  }
}

async function checkVideos() {
  console.log('🎬 AfroBirthday Video Checker\n');
  console.log('=================================\n');

  let totalMp4 = 0;
  let totalWebm = 0;
  let missingCount = 0;

  for (const video of EXPECTED_VIDEOS) {
    const mp4Path = path.join(PUBLIC_DIR, `${video}.mp4`);
    const webmPath = path.join(PUBLIC_DIR, `${video}.webm`);

    const mp4Size = await getFileSize(mp4Path);
    const webmSize = await getFileSize(webmPath);

    console.log(`📹 ${video}`);

    if (mp4Size) {
      console.log(`   ✅ MP4:  ${mp4Size} MB`);
      totalMp4 += parseFloat(mp4Size);
    } else {
      console.log(`   ❌ MP4:  Missing`);
      missingCount++;
    }

    if (webmSize) {
      console.log(`   ✅ WebM: ${webmSize} MB`);
      totalWebm += parseFloat(webmSize);
    } else {
      console.log(`   ⚠️  WebM: Missing (optional)`);
    }

    console.log('');
  }

  console.log('=================================');
  console.log(`\n📊 Total MP4 size:  ${totalMp4.toFixed(2)} MB`);
  console.log(`📊 Total WebM size: ${totalWebm.toFixed(2)} MB\n`);

  if (missingCount > 0) {
    console.log(`⚠️  ${missingCount} MP4 file(s) missing!`);
    console.log('   Run: npm run optimize:videos\n');
    process.exit(1);
  } else {
    console.log('✅ All videos are ready!\n');
  }
}

checkVideos().catch(console.error);
