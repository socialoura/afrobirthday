"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  {
    name: "Marie L.",
    location: "Brussels, Belgium",
    text: "I ordered for my dad's 65th birthday and he was speechless! The dancers were so energetic and the personalization was perfect. Best gift ever!",
    rating: 5,
    avatar: "/showcase_1.jpg",
  },
  {
    name: "Thomas H.",
    location: "Amsterdam, Netherlands",
    text: "My girlfriend thought I hired actual dancers! The video quality is amazing and it arrived in less than 24 hours. Highly recommend!",
    rating: 5,
    avatar: "/showcase_2.jpg",
  },
  {
    name: "Fatima A.",
    location: "London, UK",
    text: "So authentic and heartfelt. My mother cried happy tears. The African energy really comes through in the video!",
    rating: 5,
    avatar: "/showcase_3.jpg",
  },
  {
    name: "Lucas M.",
    location: "Paris, France",
    text: "Used it for a corporate birthday celebration. Everyone in the office loved it! Already planning to order more.",
    rating: 5,
    avatar: "/showcase_1.jpg",
  },
  {
    name: "Emma S.",
    location: "Munich, Germany",
    text: "The custom song option was worth every penny. They nailed the vibe perfectly. 10/10 would recommend!",
    rating: 5,
    avatar: "/showcase_2.jpg",
  },
];

export default function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section className="py-20 bg-gradient-to-b from-white to-light">
      <div className="section-container">
        <div className="text-center mb-12">
          <h2 className="heading-2 mb-4">What Our Customers Say 💬</h2>
          <p className="text-dark/70">Real reviews from real happy customers</p>
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-dark/60">{testimonial.location}</p>
                </div>
              </div>
              <div className="flex mb-3">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={16} className="text-secondary fill-secondary" />
                ))}
              </div>
              <p className="text-dark/80">&ldquo;{testimonial.text}&rdquo;</p>
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
                  <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <Image
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-semibold">{testimonial.name}</p>
                        <p className="text-sm text-dark/60">{testimonial.location}</p>
                      </div>
                    </div>
                    <div className="flex mb-3">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} size={16} className="text-secondary fill-secondary" />
                      ))}
                    </div>
                    <p className="text-dark/80">&ldquo;{testimonial.text}&rdquo;</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <button
            onClick={prevTestimonial}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextTestimonial}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? "bg-primary" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
