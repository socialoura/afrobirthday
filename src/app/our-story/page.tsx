import Image from "next/image";
import Link from "next/link";
import { Heart, Globe, Users, Sparkles, ChevronRight } from "lucide-react";

const values = [
  {
    icon: Heart,
    title: "Authenticity",
    description: "Real people, real culture, real joy. Every video is created by talented African artists who bring genuine energy.",
  },
  {
    icon: Sparkles,
    title: "Joy",
    description: "We believe every birthday deserves a moment of pure happiness. That's our mission - spreading smiles globally.",
  },
  {
    icon: Users,
    title: "Impact",
    description: "Fair compensation for our creators. Every purchase supports African artists and their communities.",
  },
  {
    icon: Globe,
    title: "Quality",
    description: "Excellence in every video. We take pride in delivering high-quality, personalized content every time.",
  },
];

const metrics = [
  { number: "500+", label: "Happy Customers" },
  { number: "100+", label: "Creators Supported" },
  { number: "50+", label: "Countries Reached" },
  { number: "4.9", label: "Average Rating" },
];

export default function OurStoryPage() {
  return (
    <main className="pt-24 pb-20">
      <div className="section-container">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="heading-1 mb-4">The Story Behind AfroBirthday 🌍</h1>
          <p className="text-dark/70 text-lg max-w-2xl mx-auto">
            Connecting people across continents with authentic African energy and celebration.
          </p>
        </div>

        {/* Mission */}
        <div className="max-w-3xl mx-auto mb-20">
          <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-8 md:p-12 rounded-3xl text-center">
            <h2 className="heading-2 mb-6">Our Mission</h2>
            <p className="text-lg text-dark/80 leading-relaxed">
              We believe every birthday deserves a moment of pure joy. That&apos;s why we created 
              AfroBirthday — to connect people across continents with authentic African energy 
              and celebration. Our talented team of dancers and creators pour their hearts into 
              every video, making your special day truly unforgettable.
            </p>
          </div>
        </div>

        {/* Values */}
        <div className="mb-20">
          <h2 className="heading-2 text-center mb-10">Our Core Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow text-center"
              >
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <value.icon size={28} className="text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                <p className="text-dark/70 text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team Photos */}
        <div className="mb-20">
          <h2 className="heading-2 text-center mb-10">Meet Our Creators 💃🕺</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden group">
              <Image
                src="/showcase_1.jpg"
                alt="Our team in action"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/70 to-transparent" />
              <p className="absolute bottom-4 left-4 text-white font-medium">
                Creating magic in Kenya 🇰🇪
              </p>
            </div>
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden group">
              <Image
                src="/showcase_2.jpg"
                alt="Dance rehearsal"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/70 to-transparent" />
              <p className="absolute bottom-4 left-4 text-white font-medium">
                Rehearsing new choreography
              </p>
            </div>
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden group">
              <Image
                src="/showcase_3.jpg"
                alt="Team celebration"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/70 to-transparent" />
              <p className="absolute bottom-4 left-4 text-white font-medium">
                Celebrating every milestone
              </p>
            </div>
          </div>
          <div className="text-center mt-8">
            <p className="text-dark/70 italic">
              &ldquo;It&apos;s not just a job, it&apos;s our passion. Every video we create carries a piece of our heart.&rdquo;
            </p>
            <p className="font-medium mt-2">— The AfroBirthday Team</p>
          </div>
        </div>

        {/* Impact Metrics */}
        <div className="bg-dark text-white p-8 md:p-12 rounded-3xl mb-16">
          <h2 className="heading-2 text-center mb-10">Our Impact ✨</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {metrics.map((metric, index) => (
              <div key={index} className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-secondary mb-2">
                  {metric.number}
                </p>
                <p className="text-white/70">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h3 className="heading-3 mb-4">Want to create magic?</h3>
          <Link href="/#order" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2">
            Order your video now
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>
    </main>
  );
}
