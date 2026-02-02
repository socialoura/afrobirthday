"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";

const videos = [
  {
    src: "/blessing_video1.mp4",
    poster: "/showcase_1.jpg",
    titleKey: "videos.0.title",
    viewsKey: "videos.0.views",
  },
  {
    src: "/blessing_video2.mp4",
    poster: "/showcase_2.jpg",
    titleKey: "videos.1.title",
    viewsKey: "videos.1.views",
  },
  {
    src: "/blessing_video3.MOV",
    poster: "/showcase_3.jpg",
    titleKey: "videos.2.title",
    viewsKey: "videos.2.views",
  },
  {
    src: "/blessing_video4.MOV",
    poster: "/showcase_1.jpg",
    titleKey: "videos.3.title",
    viewsKey: "videos.3.views",
  },
];

export default function ProductShowcaseSection() {
  const t = useTranslations("ProductShowcase");
  const [activeVideo, setActiveVideo] = useState<number | null>(null);

  return (
    <section id="showcase" className="py-16 md:py-24 bg-dark relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-primary/10 to-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="section-container relative">
        <div className="text-center mb-10 md:mb-16 px-4">
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {t("badge")}
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">{t("title")}</h2>
          <p className="text-white/60 max-w-2xl mx-auto text-sm md:text-base">
            {t("subtitle")}
          </p>
        </div>

        {/* Main Video Player */}
        <div className="max-w-4xl mx-auto mb-8 md:mb-12 px-4">
          <div className="relative aspect-video rounded-2xl md:rounded-3xl overflow-hidden glass-card glow-primary">
            {activeVideo !== null ? (
              <video
                src={videos[activeVideo].src}
                poster={videos[activeVideo].poster}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                <Image
                  src="/showcase_1.jpg"
                  alt={t("hero.imageAlt")}
                  fill
                  sizes="(max-width: 768px) 100vw, 896px"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-dark/20 to-transparent" />
                <button
                  onClick={() => setActiveVideo(0)}
                  className="absolute inset-0 flex items-center justify-center group"
                  aria-label={t("aria.playHero")}
                >
                  <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-2xl shadow-primary/30">
                    <Play size={32} className="text-white ml-1 md:ml-2 md:w-12 md:h-12" fill="white" />
                  </div>
                </button>
                <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6">
                  <p className="text-white font-semibold text-base md:text-lg mb-1">{t("hero.title")}</p>
                  <p className="text-white/60 text-xs md:text-sm">{t("hero.subtitle")}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Video Thumbnails */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 px-4">
          {videos.map((video, index) => (
            <button
              key={index}
              onClick={() => setActiveVideo(index)}
              aria-label={t("aria.play", { title: t(video.titleKey as never) })}
              className={`relative aspect-video rounded-xl md:rounded-2xl overflow-hidden group transition-all duration-300 min-h-[80px] ${
                activeVideo === index 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-dark scale-[1.02]" 
                  : "hover:scale-[1.02]"
              }`}
            >
              <Image
                src={video.poster}
                alt={t(video.titleKey as never)}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  activeVideo === index 
                    ? "bg-primary scale-100" 
                    : "bg-white/20 backdrop-blur-sm group-hover:bg-primary group-hover:scale-110"
                }`}>
                  <Play size={16} className="text-white ml-0.5 md:w-5 md:h-5" fill="white" />
                </div>
              </div>
              <div className="absolute bottom-2 left-2 right-2 md:bottom-3 md:left-3 md:right-3">
                <p className="text-white text-xs md:text-sm font-medium truncate">{t(video.titleKey as never)}</p>
                <p className="text-white/50 text-[10px] md:text-xs">{t(video.viewsKey as never)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
