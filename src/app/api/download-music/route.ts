import { NextRequest, NextResponse } from "next/server";
import { downloadMusicFromLink, getMusicInfo } from "@/lib/musicDownloader";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds max for download

/**
 * Downloads music from a URL (YouTube, Spotify, etc.) and returns MP3 URL
 * Used internally after payment confirmation
 */
export async function POST(request: NextRequest) {
  try {
    const { musicLink, orderId } = await request.json();

    if (!musicLink || typeof musicLink !== "string") {
      return NextResponse.json({ error: "Missing musicLink" }, { status: 400 });
    }

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    // Get music info first (title, duration)
    const info = await getMusicInfo(musicLink);

    // Download and convert to MP3
    const result = await downloadMusicFromLink(musicLink, orderId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Download failed",
          info,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mp3Url: result.mp3Url,
      info,
    });
  } catch (error) {
    console.error("Download music error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
