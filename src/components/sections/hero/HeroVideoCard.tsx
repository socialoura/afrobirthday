"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import OptimizedVideo from "@/components/OptimizedVideo";
import { siteMedia } from "@/lib/siteMedia";

/** The hero's phone-style video card: the only interactive part is the sound toggle. */
export default function HeroVideoCard() {
  const tHero = useTranslations("Hero");
  const [isMuted, setIsMuted] = useState(true);

  return (
    <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 bg-black aspect-[9/16] lg:rotate-2 transition-transform duration-500 hover:rotate-0">
      <OptimizedVideo
        src={siteMedia("blessing_video_principal.mp4")}
        poster={siteMedia("showcase_1-poster.webp")}
        isHero
        muted={isMuted}
        className="w-full h-full"
      />

      {/* Gradient overlay for legibility */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none"
        aria-hidden="true"
      />

      {/* Caption at bottom of card */}
      <div className="absolute bottom-0 inset-x-0 p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white text-xs font-bold">
            AB
          </div>
          <div>
            <p className="text-sm font-semibold">@afrobirthday</p>
            <p className="text-[11px] text-white/70">{tHero("videoCaption")}</p>
          </div>
        </div>
      </div>

      {/* Sound toggle */}
      <button
        type="button"
        onClick={() => setIsMuted((m) => !m)}
        className="absolute top-4 end-4 w-11 h-11 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/25 transition-colors touch-manipulation"
        aria-label={isMuted ? tHero("soundOn") : tHero("soundOff")}
      >
        {isMuted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}
