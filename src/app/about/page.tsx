import Image from "next/image";
import Link from "next/link";
import { Mail, Instagram } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="pt-24 pb-20">
      <div className="section-container max-w-4xl">
        <h1 className="heading-1 text-center mb-8">About AfroBirthday 🎂</h1>

        <div className="prose prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="heading-2 mb-4">Who We Are</h2>
            <p className="text-dark/80 mb-4">
              AfroBirthday is a celebration platform that connects people around the world 
              with authentic African joy and energy. We create personalized birthday video 
              messages performed by talented African dancers who bring genuine happiness 
              to every celebration.
            </p>
            <p className="text-dark/80">
              Founded with a mission to spread joy globally while supporting African artists, 
              we&apos;ve delivered over 500 personalized videos to customers in more than 50 countries.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="heading-2 mb-4">Our Mission</h2>
            <p className="text-dark/80">
              We believe every birthday deserves a moment of pure joy. Our mission is to 
              create unforgettable birthday experiences that connect cultures, spread happiness, 
              and support talented creators in Africa.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="heading-2 mb-4">Our Team</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <Image src="/showcase_1.jpg" alt="Our team" fill className="object-cover" />
              </div>
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <Image src="/showcase_2.jpg" alt="Creating videos" fill className="object-cover" />
              </div>
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <Image src="/showcase_3.jpg" alt="Celebrations" fill className="object-cover" />
              </div>
            </div>
            <p className="text-dark/80">
              Our team consists of passionate dancers, choreographers, and video creators 
              based in Kenya and across Africa. Every team member brings their unique energy 
              and cultural authenticity to each video we create.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="heading-2 mb-4">Contact Us</h2>
            <div className="bg-light p-6 rounded-xl">
              <div className="space-y-3">
                <a 
                  href="mailto:hello@afrobirthday.com" 
                  className="flex items-center gap-3 text-dark/80 hover:text-primary transition-colors"
                >
                  <Mail size={20} />
                  hello@afrobirthday.com
                </a>
                <a 
                  href="https://instagram.com/afrobirthday" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-dark/80 hover:text-primary transition-colors"
                >
                  <Instagram size={20} />
                  @afrobirthday
                </a>
              </div>
            </div>
          </section>

          <div className="text-center">
            <Link href="/#order" className="btn-primary inline-block">
              Create Your Birthday Video
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
