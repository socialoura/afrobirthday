import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20">
      {/* Video Background */}
      <div className="absolute inset-0 overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/showcase_1.jpg"
          className="w-full h-full object-cover"
        >
          <source src="/blessing_video_principal.MOV" type="video/quicktime" />
          <source src="/blessing_video_principal.MOV" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-dark/70 via-dark/50 to-dark/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 section-container text-center text-white">
        <h1 className="heading-1 text-4xl md:text-5xl lg:text-6xl mb-6 text-balance">
          Make Every Birthday{" "}
          <span className="text-secondary">VIRAL</span> 🎂💃
        </h1>
        <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
          Real African dancers, real energy, 24-hour delivery.
          <br />
          <span className="text-secondary font-medium">Personalized birthday videos</span> that create unforgettable moments.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="#order" className="btn-primary text-lg px-8 py-4">
            Order Now - €49.99
          </Link>
          <Link href="#showcase" className="btn-outline border-white text-white hover:bg-white hover:text-dark px-8 py-4">
            See Examples
          </Link>
        </div>
        <p className="mt-8 text-white/70 text-sm">
          ⚡ Delivered within 24-48 hours • 💯 100% Money-back guarantee
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
