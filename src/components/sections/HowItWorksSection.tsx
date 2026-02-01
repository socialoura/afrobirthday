import { Upload, Film, PartyPopper, ArrowRight } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    icon: Upload,
    number: "01",
    title: "Customize",
    description: "Upload a photo and write your personalized birthday message. Choose your music and style.",
    color: "from-primary to-primary/70",
  },
  {
    icon: Film,
    number: "02",
    title: "We Create",
    description: "Our talented African dancers film your unique birthday video with authentic energy and joy.",
    color: "from-accent to-accent/70",
  },
  {
    icon: PartyPopper,
    number: "03",
    title: "Celebrate",
    description: "Receive your video within 24 hours. Share it and watch their face light up with pure joy!",
    color: "from-secondary to-secondary/70",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-16 md:py-24 bg-[#151515] relative overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="section-container relative">
        <div className="text-center mb-10 md:mb-16 px-4">
          <span className="inline-block px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            Simple Process
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-white/50 max-w-xl mx-auto text-sm md:text-base">
            Three simple steps to create an unforgettable birthday moment
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6 lg:gap-8 mb-10 md:mb-16 px-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative group"
            >
              {/* Connector line (hidden on mobile, shown on md+) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-[60%] w-full h-px bg-gradient-to-r from-white/20 to-transparent z-0" />
              )}

              <div className="glass-card p-5 md:p-8 hover:bg-white/10 transition-all duration-500 relative z-10 h-full">
                {/* Step number */}
                <span className="absolute top-6 right-6 text-6xl font-bold text-white/5 font-display">
                  {step.number}
                </span>

                {/* Icon */}
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon size={24} className="text-white md:w-7 md:h-7" />
                </div>

                <h3 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-3">{step.title}</h3>
                <p className="text-white/60 leading-relaxed text-sm md:text-base">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center px-4">
          <Link
            href="#order"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold hover:opacity-90 transition group min-h-[48px] w-full sm:w-auto"
          >
            Start Creating Now
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-white/40 text-xs md:text-sm mt-4">No account needed • Pay securely by credit card</p>
        </div>
      </div>
    </section>
  );
}
