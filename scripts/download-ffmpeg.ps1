# Download FFmpeg directly for Windows (Portable version)
# Run with: powershell -ExecutionPolicy Bypass -File scripts/download-ffmpeg.ps1

$ErrorActionPreference = "Stop"

Write-Host "`n🎬 FFmpeg Portable Downloader`n" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

$ffmpegDir = "$PSScriptRoot\..\ffmpeg"
$ffmpegBin = "$ffmpegDir\bin"
$ffmpegExe = "$ffmpegBin\ffmpeg.exe"

# Check if already downloaded
if (Test-Path $ffmpegExe) {
    Write-Host "✅ FFmpeg already exists at: $ffmpegExe`n" -ForegroundColor Green
    & $ffmpegExe -version | Select-Object -First 1
    Write-Host "`n✅ Ready to use! Run: npm run optimize:videos`n" -ForegroundColor Green
    exit 0
}

Write-Host "📥 Downloading FFmpeg (essentials build, ~85MB)..." -ForegroundColor Yellow
Write-Host "    This may take a few minutes...`n" -ForegroundColor Gray

$downloadUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$zipFile = "$env:TEMP\ffmpeg.zip"

try {
    # Download
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile -UseBasicParsing
    Write-Host "✅ Download complete`n" -ForegroundColor Green

    Write-Host "📦 Extracting..." -ForegroundColor Yellow

    # Extract
    Expand-Archive -Path $zipFile -DestinationPath "$env:TEMP\ffmpeg-extract" -Force

    # Find the extracted folder (format: ffmpeg-X.X-essentials_build)
    $extractedFolder = Get-ChildItem "$env:TEMP\ffmpeg-extract" -Directory | Select-Object -First 1

    if ($null -eq $extractedFolder) {
        throw "Extraction failed - folder not found"
    }

    # Move to project directory
    New-Item -ItemType Directory -Force -Path $ffmpegDir | Out-Null
    Copy-Item -Path "$($extractedFolder.FullName)\bin" -Destination $ffmpegDir -Recurse -Force

    Write-Host "✅ Extraction complete`n" -ForegroundColor Green

    # Cleanup
    Remove-Item $zipFile -Force
    Remove-Item "$env:TEMP\ffmpeg-extract" -Recurse -Force

    Write-Host "✅ FFmpeg installed successfully!`n" -ForegroundColor Green
    Write-Host "📍 Location: $ffmpegBin`n" -ForegroundColor Cyan

    # Test
    if (Test-Path $ffmpegExe) {
        Write-Host "🧪 Testing FFmpeg..." -ForegroundColor Yellow
        & $ffmpegExe -version | Select-Object -First 1
        Write-Host "`n✅ FFmpeg is working!`n" -ForegroundColor Green

        Write-Host "🚀 Next step: npm run optimize:videos`n" -ForegroundColor Cyan
    } else {
        throw "FFmpeg executable not found after installation"
    }

} catch {
    $errorMsg = $_.Exception.Message
    Write-Host ""
    Write-Host "Error: $errorMsg" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please try manual installation:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -ForegroundColor Gray
    Write-Host "  2. Extract to folder: $ffmpegDir" -ForegroundColor Gray
    Write-Host "  3. Ensure ffmpeg.exe is in bin folder" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
