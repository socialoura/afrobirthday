"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

type Testimonial = {
  name: string;
  location: string;
  text: string;
  rating: number;
  avatar: string;
};

export default function TestimonialsSection() {
  const t = useTranslations("Testimonials");
  const testimonials = t.raw("items") as Testimonial[];

  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section className="py-16 md:py-24 bg-dark relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="section-container">
        <div className="text-center mb-8 md:mb-12 px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-white">{t("title")}</h2>
          <p className="text-white/60 text-sm md:text-base">{t("subtitle")}</p>
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-4 lg:gap-6 px-4">
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <div
              key={index}
              className="glass-card p-6 hover:bg-white/10 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10"
                />
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-sm text-white/50">{testimonial.location}</p>
                </div>
              </div>
              <div className="flex mb-3">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={16} className="text-secondary fill-secondary" />
                ))}
              </div>
              <p className="text-white/80">&ldquo;{testimonial.text}&rdquo;</p>
            </div>
          ))}
        </div>

        {/* Mobile Carousel */}
        <div className="md:hidden relative">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-300"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className="w-full flex-shrink-0 px-2"
                >
                  <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Image
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10"
                      />
                      <div>
                        <p className="font-semibold text-white">{testimonial.name}</p>
                        <p className="text-sm text-white/50">{testimonial.location}</p>
                      </div>
                    </div>
                    <div className="flex mb-3">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} size={16} className="text-secondary fill-secondary" />
                      ))}
                    </div>
                    <p className="text-white/80">&ldquo;{testimonial.text}&rdquo;</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <button
            onClick={prevTestimonial}
            aria-label={t("aria.prev")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-11 h-11 bg-white/10 border border-white/10 backdrop-blur shadow-lg rounded-full flex items-center justify-center hover:bg-white/20 text-white touch-manipulation"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextTestimonial}
            aria-label={t("aria.next")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-11 h-11 bg-white/10 border border-white/10 backdrop-blur shadow-lg rounded-full flex items-center justify-center hover:bg-white/20 text-white touch-manipulation"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots */}
          <div className="flex justify-center gap-3 mt-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                aria-label={t("aria.goTo", { index: index + 1 })}
                className={`w-3 h-3 rounded-full transition-colors touch-manipulation ${
                  index === currentIndex ? "bg-primary" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
