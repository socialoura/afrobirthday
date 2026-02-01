import Image from "next/image";
import { Star, Quote, TrendingUp, Users, Zap } from "lucide-react";

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
    text: "Went viral on TikTok with 2M views! My friend couldn't believe her eyes.",
    avatar: "/showcase_2.jpg",
  },
  {
    name: "Aisha B.",
    location: "Berlin, Germany",
    text: "So authentic and heartfelt. The dancers made my daughter's 18th unforgettable!",
    avatar: "/showcase_3.jpg",
  },
];

const stats = [
  { value: "500+", label: "Happy Customers", icon: Users },
  { value: "50+", label: "Countries Reached", icon: TrendingUp },
  { value: "24h", label: "Fast Delivery", icon: Zap },
];

export default function SocialProofSection() {
  return (
    <section className="py-24 bg-dark relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <div className="section-container relative">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 md:gap-8 mb-20">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10 mb-4">
                <stat.icon size={20} className="text-primary" />
              </div>
              <p className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-white/50 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="heading-2 text-white mb-4">What Our Customers Say</h2>
          <div className="flex justify-center items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={20} className="text-secondary fill-secondary" />
              ))}
            </div>
            <span className="text-white/70 ml-2">4.9/5 from 500+ reviews</span>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="glass-card p-6 hover:bg-white/10 transition-all duration-300 group"
            >
              <Quote size={24} className="text-primary/50 mb-4" />
              <p className="text-white/80 mb-6 leading-relaxed">{testimonial.text}</p>
              <div className="flex items-center gap-3">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10"
                />
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-sm text-white/50">{testimonial.location}</p>
                </div>
              </div>
              <div className="flex mt-4 pt-4 border-t border-white/5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={14} className="text-secondary fill-secondary" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
