# FFmpeg Installation Script for Windows
# Run with: powershell -ExecutionPolicy Bypass -File scripts/install-ffmpeg.ps1

Write-Host "`n🎬 FFmpeg Installation for AfroBirthday`n" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Check if Chocolatey is installed
$chocoInstalled = $null -ne (Get-Command choco -ErrorAction SilentlyContinue)

if ($chocoInstalled) {
    Write-Host "✅ Chocolatey detected" -ForegroundColor Green
    Write-Host "`n📦 Installing FFmpeg via Chocolatey...`n" -ForegroundColor Yellow

    choco install ffmpeg -y

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ FFmpeg installed successfully!" -ForegroundColor Green
        Write-Host "`n🔄 Refreshing environment variables...`n" -ForegroundColor Yellow

        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

        Write-Host "✅ Done! Restart your terminal and run: npm run optimize:videos`n" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Installation failed. Try manually.`n" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Chocolatey not found`n" -ForegroundColor Red
    Write-Host "📖 Installation Options:`n" -ForegroundColor Yellow

    Write-Host "Option 1: Install Chocolatey (Recommended)" -ForegroundColor Cyan
    Write-Host "  1. Open PowerShell as Administrator"
    Write-Host "  2. Run: Set-ExecutionPolicy Bypass -Scope Process -Force"
    Write-Host "  3. Run: iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    Write-Host "  4. Run: choco install ffmpeg -y"
    Write-Host ""

    Write-Host "Option 2: Manual Download" -ForegroundColor Cyan
    Write-Host "  1. Download: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    Write-Host "  2. Extract to C:\ffmpeg"
    Write-Host "  3. Add C:\ffmpeg\bin to System PATH"
    Write-Host "  4. Restart terminal"
    Write-Host ""

    Write-Host "Option 3: Use Online Converter (No installation)" -ForegroundColor Cyan
    Write-Host "  - CloudConvert: https://cloudconvert.com/mov-to-mp4"
    Write-Host "  - Convert blessing_video3.MOV and blessing_video4.MOV"
    Write-Host "  - Download and replace in /public folder"
    Write-Host ""
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
