import Image from "next/image";
import Link from "next/link";
import { Upload, CreditCard, Gift, ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Order",
  description:
    "How to order your AfroBirthday personalized birthday video: upload a photo, add a message, pay securely, and receive your video by email in 12–48 hours.",
  alternates: {
    canonical: "/how-to-order",
  },
  openGraph: {
    title: "How to Order",
    description:
      "How to order your AfroBirthday personalized birthday video: upload a photo, add a message, pay securely, and receive your video by email in 12–48 hours.",
    url: "/how-to-order",
    images: [{ url: "/logo.png" }],
  },
  twitter: {
    title: "How to Order",
    description:
      "How to order your AfroBirthday personalized birthday video: upload a photo, add a message, pay securely, and receive your video by email in 12–48 hours.",
    images: ["/logo.png"],
  },
};

const steps = [
  {
    icon: Upload,
    number: "01",
    title: "Fill Out the Form",
    description: "Upload a clear photo of the birthday person, write your personalized message (up to 100 characters), and choose your music preference.",
    tips: [
      "Use a high-quality photo with good lighting",
      "Keep your message short and clear",
      "Choose 'We choose music' for faster delivery",
    ],
  },
  {
    icon: CreditCard,
    number: "02",
    title: "Pay Securely",
    description: "Complete your payment through our secure checkout. We accept all major credit cards and Apple Pay.",
    tips: [
      "All payments are encrypted and secure",
      "You'll receive an instant confirmation email",
      "Your video enters production immediately",
    ],
  },
  {
    icon: Gift,
    number: "03",
    title: "Receive Your Video",
    description: "Within 24-48 hours (or 12-24 hours with Express), you'll receive your personalized birthday video via email.",
    tips: [
      "Video delivered as a downloadable link",
      "Share directly to WhatsApp, social media",
      "100% money-back guarantee if not satisfied",
    ],
  },
];

export default function HowToOrderPage() {
  return (
    <main className="pt-24 pb-20 bg-dark relative overflow-hidden">
      <div className="section-container relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none -z-10" />
        {/* Header */}
        <div className="text-center mb-16 relative">
          <h1 className="heading-1 mb-4">
            How To Order Your Birthday Video 🎬
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Getting your personalized birthday video is simple, fast, and fun.
            Follow these 3 easy steps!
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto space-y-12 mb-16">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex flex-col md:flex-row gap-8 items-start"
            >
              {/* Step Number & Icon */}
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center relative">
                  <step.icon size={36} className="text-primary" />
                  <span className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {step.number}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <h2 className="heading-3 mb-3 text-white">{step.title}</h2>
                <p className="text-white/60 mb-4">{step.description}</p>
                <div className="glass-card p-4 rounded-xl">
                  <p className="font-medium text-sm text-white/80 mb-2">Tips:</p>
                  <ul className="space-y-1">
                    {step.tips.map((tip, tipIndex) => (
                      <li key={tipIndex} className="text-sm text-white/60 flex items-start gap-2">
                        <span className="text-primary mt-1">✓</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline Graphic */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="bg-dark text-white p-8 rounded-2xl text-center">
            <h3 className="heading-3 mb-4">Delivery Timeline ⚡</h3>
            <div className="flex justify-center items-center gap-4 flex-wrap">
              <div className="bg-white/10 px-6 py-4 rounded-xl">
                <p className="text-secondary font-bold text-2xl">24-48h</p>
                <p className="text-white/70 text-sm">Standard</p>
              </div>
              <span className="text-white/50">or</span>
              <div className="bg-primary px-6 py-4 rounded-xl">
                <p className="text-white font-bold text-2xl">12-24h</p>
                <p className="text-white/80 text-sm">Express (+€5.99)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Badges */}
        <div className="text-center mb-16">
          <h3 className="font-semibold mb-4 text-white">Secure & Trusted</h3>
          <div className="flex justify-center items-center gap-8 flex-wrap">
            <div className="flex items-center gap-2 text-white/60">
              <span className="text-2xl">🔒</span>
              <span className="text-sm">SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <span className="text-2xl">💳</span>
              <span className="text-sm">Credit Card Payments</span>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <span className="text-2xl">💯</span>
              <span className="text-sm">Satisfaction Guaranteed</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/#order" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2">
            Ready to create magic? Order now
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>
    </main>
  );
}
