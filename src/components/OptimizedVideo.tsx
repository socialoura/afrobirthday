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
}

export default function OptimizedVideo({
  src,
  poster,
  isHero = false,
  className,
  autoPlay = true,
  muted = true,
  loop = true,
}: OptimizedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(isHero);
  const [isLoaded, setIsLoaded] = useState(false);

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

  useEffect(() => {
    if (isVisible && videoRef.current && autoPlay) {
      videoRef.current.play().catch(() => {});
    }
  }, [isVisible, autoPlay]);

  const isMov = /\.mov$/i.test(src);
  const mimeType = isMov ? "video/quicktime" : "video/mp4";

  return (
    <div className={cn("relative", className)}>
      {poster && !isLoaded && (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
      )}
      <video
        ref={videoRef}
        autoPlay={isHero && autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        poster={poster}
        preload={isHero ? "metadata" : "none"}
        onLoadedData={() => setIsLoaded(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-500",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      >
        {isVisible && <source src={src} type={mimeType} />}
      </video>
    </div>
  );
}
