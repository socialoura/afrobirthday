/**
 * Music downloader service for AfroBirthday
 * Downloads music from YouTube, Spotify, etc. and converts to MP3
 */

import { put } from "@vercel/blob";

type DownloadResult = {
  success: boolean;
  mp3Url?: string;
  error?: string;
};

/**
 * Downloads music from a URL and converts it to MP3
 * Supports: YouTube, Spotify (via external API)
 */
export async function downloadMusicFromLink(
  musicLink: string,
  orderId: string
): Promise<DownloadResult> {
  // Check if auto-download is disabled
  if (process.env.DISABLE_MUSIC_AUTO_DOWNLOAD === "true") {
    console.log("Music auto-download disabled, skipping");
    return { success: false, error: "Auto-download disabled" };
  }

  try {
    // Detect the platform
    const platform = detectPlatform(musicLink);

    if (!platform) {
      return { success: false, error: "Unsupported platform" };
    }

    // Use external API to download (yt-dlp as a service)
    const mp3Buffer = await downloadFromApi(musicLink, platform);

    if (!mp3Buffer) {
      return { success: false, error: "Download failed" };
    }

    // Upload to Vercel Blob
    const filename = `orders/music/${orderId}-custom.mp3`;
    const blob = await put(filename, mp3Buffer, {
      access: "public",
      contentType: "audio/mpeg",
    });

    return { success: true, mp3Url: blob.url };
  } catch (error) {
    console.error("Music download error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Detects the music platform from URL
 */
function detectPlatform(url: string): "youtube" | "spotify" | "soundcloud" | null {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  }
  if (url.includes("spotify.com")) {
    return "spotify";
  }
  if (url.includes("soundcloud.com")) {
    return "soundcloud";
  }
  return null;
}

/**
 * Downloads audio from URL using external API
 * Uses Rapidapi's YouTube to MP3 API or similar
 */
async function downloadFromApi(
  url: string,
  platform: "youtube" | "spotify" | "soundcloud"
): Promise<Buffer | null> {
  // Option 1: Rapidapi YouTube to MP3
  // https://rapidapi.com/ytjar/api/youtube-mp36

  // Option 2: Self-hosted yt-dlp service
  // You can deploy yt-dlp on Vercel/Railway/Render

  // Option 3: Cobalt API (free, no auth required)
  // https://co.wuk.sh/

  const apiUrl = process.env.MUSIC_DOWNLOAD_API_URL || "https://co.wuk.sh/api/json";

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url,
        vCodec: "h264",
        vQuality: "720",
        aFormat: "mp3",
        filenamePattern: "basic",
        isAudioOnly: true,
      }),
    });

    if (!response.ok) {
      console.error("API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();

    // Cobalt API returns download URL
    if (data.status === "redirect" || data.status === "stream") {
      const downloadUrl = data.url;
      const audioResponse = await fetch(downloadUrl);

      if (!audioResponse.ok) {
        console.error("Download error:", audioResponse.status);
        return null;
      }

      const arrayBuffer = await audioResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    return null;
  } catch (error) {
    console.error("API request error:", error);
    return null;
  }
}

/**
 * Alternative: Use Rapidapi YouTube MP3 (requires API key)
 */
async function downloadWithRapidapi(url: string): Promise<Buffer | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.warn("RAPIDAPI_KEY not set, skipping Rapidapi download");
    return null;
  }

  try {
    const response = await fetch(
      "https://youtube-mp36.p.rapidapi.com/dl?id=" + extractYoutubeId(url),
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "youtube-mp36.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status === "ok" && data.link) {
      const audioResponse = await fetch(data.link);
      const arrayBuffer = await audioResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    return null;
  } catch (error) {
    console.error("Rapidapi error:", error);
    return null;
  }
}

/**
 * Extract YouTube video ID from URL
 */
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Get music info (title, artist) for display
 */
export async function getMusicInfo(url: string): Promise<{
  title?: string;
  artist?: string;
  duration?: number;
} | null> {
  try {
    const apiUrl = process.env.MUSIC_DOWNLOAD_API_URL || "https://co.wuk.sh/api/json";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      title: data.title || data.filename || "Unknown",
      artist: data.artist,
      duration: data.duration,
    };
  } catch {
    return null;
  }
}
