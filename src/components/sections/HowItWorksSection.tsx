import { Upload, Film, PartyPopper } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "1. Customize",
    description: "Upload a photo and write your personalized birthday message. Choose your music preference.",
  },
  {
    icon: Film,
    title: "2. We Film",
    description: "Our talented African dancers create your unique birthday video with energy and joy.",
  },
  {
    icon: PartyPopper,
    title: "3. You Celebrate",
    description: "Receive your video within 24-48 hours. Share and watch the smiles unfold!",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-20 bg-white">
      <div className="section-container">
        <div className="text-center mb-12">
          <h2 className="heading-2 mb-4">How It Works ✨</h2>
          <p className="text-dark/70 max-w-xl mx-auto">
            Getting your personalized birthday video is as easy as 1-2-3!
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="text-center p-8 rounded-2xl bg-light hover:shadow-xl transition-shadow group"
            >
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary group-hover:scale-110 transition-all">
                <step.icon
                  size={36}
                  className="text-primary group-hover:text-white transition-colors"
                />
              </div>
              <h3 className="heading-3 mb-3">{step.title}</h3>
              <p className="text-dark/70">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
