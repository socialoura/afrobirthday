"use client";

import { useState } from "react";
import { Play } from "lucide-react";

const videos = [
  {
    src: "/blessing_video1.mp4",
    poster: "/showcase_1.jpg",
    title: "Birthday for Sarah, 25 years",
  },
  {
    src: "/blessing_video2.mp4",
    poster: "/showcase_2.jpg",
    title: "From Kenya with love",
  },
  {
    src: "/blessing_video3.MOV",
    poster: "/showcase_3.jpg",
    title: "Surprise for Mom's 60th",
  },
  {
    src: "/blessing_video4.MOV",
    poster: "/showcase_1.jpg",
    title: "Corporate celebration",
  },
];

export default function ProductShowcaseSection() {
  const [activeVideo, setActiveVideo] = useState<number | null>(null);

  return (
    <section id="showcase" className="py-20 bg-light">
      <div className="section-container">
        <div className="text-center mb-12">
          <h2 className="heading-2 mb-4">See Real Birthday Blessings 🎉</h2>
          <p className="text-dark/70 max-w-2xl mx-auto">
            Every video is unique, personalized, and filled with authentic African joy.
            Watch what our customers received!
          </p>
        </div>

        {/* Main Video */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="relative aspect-video bg-dark rounded-2xl overflow-hidden shadow-xl">
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
                <button
                  onClick={() => setActiveVideo(0)}
                  className="absolute inset-0 flex items-center justify-center bg-dark/30 hover:bg-dark/40 transition-colors group"
                >
                  <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play size={40} className="text-white ml-1" fill="white" />
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {videos.map((video, index) => (
            <button
              key={index}
              onClick={() => setActiveVideo(index)}
              className={`relative aspect-video rounded-xl overflow-hidden group ${
                activeVideo === index ? "ring-4 ring-primary" : ""
              }`}
            >
              <video
                src={video.src}
                poster={video.poster}
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-dark/40 group-hover:bg-dark/20 transition-colors flex items-center justify-center">
                <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play size={20} className="text-primary ml-0.5" fill="currentColor" />
                </div>
              </div>
              <p className="absolute bottom-2 left-2 right-2 text-white text-xs font-medium truncate">
                {video.title}
              </p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
