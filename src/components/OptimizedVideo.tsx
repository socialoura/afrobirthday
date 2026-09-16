"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface OptimizedVideoProps {
  src: string;
  poster?: string;
  isHero?: boolean;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
}

/**
 * Optimized video component with:
 * - Lazy loading (Intersection Observer)
 * - Multi-format support (WebM + MP4 fallback)
 * - Poster image preload
 * - Smooth fade-in transition
 */
export default function OptimizedVideo({
  src,
  poster,
  isHero = false,
  className,
  autoPlay = true,
  muted = true,
  loop = true,
  controls = false,
}: OptimizedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(isHero);
  const [isLoaded, setIsLoaded] = useState(false);

  // Lazy loading via Intersection Observer
  useEffect(() => {
    if (isHero || !videoRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25, rootMargin: "100px" }
    );

    observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, [isHero]);

  // Auto-play when visible
  useEffect(() => {
    if (isVisible && videoRef.current && autoPlay) {
      videoRef.current.play().catch(() => {
        // Auto-play may be blocked by browser policy
      });
    }
  }, [isVisible, autoPlay]);

  // React doesn't reliably sync the `muted` DOM property on <video> after
  // mount (a well-known media-element quirk), so set it imperatively too.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  // MP4 only. There was a WebM <source> listed first here, but no .webm file
  // has ever been built: the request fell through to the [locale] route, which
  // answered 200 with the whole HTML page as `text/html`. The browser
  // downloaded that, failed to decode it, and only then fell back to the MP4 —
  // a wasted round trip and a wasted payload on the critical path of every
  // video on the site, the hero included.
  const baseSrc = src.replace(/\.(MOV|mov|mp4|MP4)$/i, "");
  const mp4Src = `${baseSrc}.mp4`;

  return (
    <div className={cn("relative", className)}>
      {/* Poster image shown until video loads */}
      {poster && !isLoaded && (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
          decoding="async"
          loading={isHero ? "eager" : "lazy"}
        />
      )}
      <video
        ref={videoRef}
        autoPlay={isHero && autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        controls={controls}
        poster={poster}
        preload={isHero ? "metadata" : "none"}
        onLoadedData={() => setIsLoaded(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-500",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Only load sources when video is visible (lazy loading) */}
        {isVisible && <source src={mp4Src} type="video/mp4" />}
      </video>
    </div>
  );
}
