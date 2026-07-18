/**
 * Music downloader service for AfroBirthday
 * Downloads music from YouTube, Spotify, etc. and converts to MP3
 */

import { getSupabaseAdmin, publicUrlFor, STORAGE_BUCKET } from "@/lib/storage";

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
    const mp3Buffer = await downloadAudio(musicLink, platform);

    if (!mp3Buffer) {
      return { success: false, error: "Download failed" };
    }

    // Upload to Supabase Storage
    const filename = `orders/music/${orderId}-custom.mp3`;
    const { error } = await getSupabaseAdmin()
      .storage.from(STORAGE_BUCKET)
      .upload(filename, mp3Buffer, { contentType: "audio/mpeg", upsert: true });
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, mp3Url: publicUrlFor(filename) };
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
 * Picks the best available download backend. For YouTube we prefer the
 * RapidAPI youtube-mp36 service when a key is configured (the legacy public
 * Cobalt instance at co.wuk.sh is dead), and fall back to the Cobalt-style API
 * otherwise / for non-YouTube platforms.
 */
async function downloadAudio(
  url: string,
  platform: "youtube" | "spotify" | "soundcloud"
): Promise<Buffer | null> {
  if (platform === "youtube" && process.env.RAPIDAPI_KEY) {
    const viaRapid = await downloadWithRapidapi(url);
    if (viaRapid) return viaRapid;
    console.warn("Rapidapi download failed, falling back to Cobalt API");
  }
  return downloadFromApi(url, platform);
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

  const videoId = extractYoutubeId(url);
  if (!videoId) {
    console.error("Rapidapi: could not extract YouTube video id from", url);
    return null;
  }

  const endpoint = `https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`;
  const headers = {
    "X-RapidAPI-Key": apiKey,
    "X-RapidAPI-Host": "youtube-mp36.p.rapidapi.com",
  };

  // youtube-mp36 transcodes asynchronously: the first call usually returns
  // status "processing" / "in process", so poll a few times until the MP3 link
  // is ready (kept within the route's 60s maxDuration).
  const MAX_ATTEMPTS = 6;
  const POLL_DELAY_MS = 4000;

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const response = await fetch(endpoint, { method: "GET", headers });

      if (!response.ok) {
        console.error(
          "Rapidapi HTTP error:",
          response.status,
          await response.text().catch(() => "")
        );
        return null;
      }

      const data = (await response.json()) as {
        status?: string;
        link?: string;
        msg?: string;
      };

      if (data.status === "ok" && data.link) {
        // The mirror hosts (e.g. 123tokyo.xyz) return 404 unless the request
        // carries a Referer pointing back at the API host — hotlink protection.
        const audioResponse = await fetch(data.link, {
          headers: {
            Referer: "https://youtube-mp36.p.rapidapi.com/",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        if (!audioResponse.ok) {
          console.error("Rapidapi audio download error:", audioResponse.status);
          return null;
        }
        const arrayBuffer = await audioResponse.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }

      // Still transcoding — wait and retry.
      if (data.status === "processing" || data.status === "in process") {
        await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
        continue;
      }

      // "fail" or any unexpected status: stop and fall back.
      console.error("Rapidapi status:", data.status, data.msg ?? "");
      return null;
    }

    console.error("Rapidapi: still processing after max attempts");
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
