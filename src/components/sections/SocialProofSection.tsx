import Image from "next/image";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sophie M.",
    location: "Paris, France",
    text: "My mom cried tears of joy! Best birthday gift ever. The energy was incredible!",
    avatar: "/showcase_1.jpg",
  },
  {
    name: "James K.",
    location: "London, UK",
    text: "Went viral on TikTok! My friend couldn't believe her eyes. Pure happiness!",
    avatar: "/showcase_2.jpg",
  },
  {
    name: "Aisha B.",
    location: "Berlin, Germany",
    text: "So authentic and heartfelt. The dancers made my daughter's 18th unforgettable!",
    avatar: "/showcase_3.jpg",
  },
];

export default function SocialProofSection() {
  return (
    <section className="py-16 bg-white">
      <div className="section-container">
        {/* Stats */}
        <div className="flex flex-wrap justify-center items-center gap-8 mb-12">
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={20}
                  className="text-secondary fill-secondary"
                />
              ))}
            </div>
            <span className="font-semibold">4.9/5</span>
          </div>
          <div className="h-6 w-px bg-gray-300 hidden sm:block" />
          <p className="text-dark/70">
            Join <span className="font-semibold text-dark">500+</span> happy customers
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-light p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold text-dark">{testimonial.name}</p>
                  <p className="text-sm text-dark/60">{testimonial.location}</p>
                </div>
              </div>
              <p className="text-dark/80 italic">&ldquo;{testimonial.text}&rdquo;</p>
              <div className="flex mt-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={14}
                    className="text-secondary fill-secondary"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
