"use client";

import { useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

const videos = [
  {
    src: "/blessing_video1.mp4",
    poster: "/showcase_1.jpg",
    title: "Birthday for Sarah",
    views: "2.1M views",
  },
  {
    src: "/blessing_video2.mp4",
    poster: "/showcase_2.jpg",
    title: "From Kenya with love",
    views: "1.8M views",
  },
  {
    src: "/blessing_video3.MOV",
    poster: "/showcase_3.jpg",
    title: "Mom's 60th surprise",
    views: "956K views",
  },
  {
    src: "/blessing_video4.MOV",
    poster: "/showcase_1.jpg",
    title: "Corporate celebration",
    views: "723K views",
  },
];

export default function ProductShowcaseSection() {
  const [activeVideo, setActiveVideo] = useState<number | null>(null);

  return (
    <section id="showcase" className="py-24 bg-dark relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-primary/10 to-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="section-container relative">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Video Gallery
          </span>
          <h2 className="heading-2 text-white mb-4">See The Magic In Action</h2>
          <p className="text-white/60 max-w-2xl mx-auto">
            Every video is handcrafted with authentic African energy.
            Watch real examples from happy customers worldwide.
          </p>
        </div>

        {/* Main Video Player */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="relative aspect-video rounded-3xl overflow-hidden glass-card glow-primary">
            {activeVideo !== null ? (
              <video
                src={videos[activeVideo].src}
                poster={videos[activeVideo].poster}
                controls
                autoPlay
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                <video
                  src="/blessing_video1.mp4"
                  poster="/showcase_1.jpg"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-dark/20 to-transparent" />
                <button
                  onClick={() => setActiveVideo(0)}
                  className="absolute inset-0 flex items-center justify-center group"
                >
                  <div className="w-24 h-24 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-2xl shadow-primary/30">
                    <Play size={48} className="text-white ml-2" fill="white" />
                  </div>
                </button>
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="text-white font-semibold text-lg mb-1">Watch a sample birthday blessing</p>
                  <p className="text-white/60 text-sm">Click to play • Full energy guaranteed</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Video Thumbnails */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {videos.map((video, index) => (
            <button
              key={index}
              onClick={() => setActiveVideo(index)}
              className={`relative aspect-video rounded-2xl overflow-hidden group transition-all duration-300 ${
                activeVideo === index 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-dark scale-[1.02]" 
                  : "hover:scale-[1.02]"
              }`}
            >
              <video
                src={video.src}
                poster={video.poster}
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  activeVideo === index 
                    ? "bg-primary scale-100" 
                    : "bg-white/20 backdrop-blur-sm group-hover:bg-primary group-hover:scale-110"
                }`}>
                  <Play size={20} className="text-white ml-0.5" fill="white" />
                </div>
              </div>
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-white text-sm font-medium truncate">{video.title}</p>
                <p className="text-white/50 text-xs">{video.views}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
