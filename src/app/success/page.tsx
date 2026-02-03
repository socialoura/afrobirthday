import Link from "next/link";
import { CheckCircle, Mail, Clock, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import GoogleAdsPurchaseConversion from "./GoogleAdsPurchaseConversion";

export const metadata: Metadata = {
  title: "Payment Successful",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function SuccessPage() {
  return (
    <main className="pt-24 pb-20 min-h-screen bg-dark relative overflow-hidden">
      <GoogleAdsPurchaseConversion />
      {/* Background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <div className="section-container max-w-2xl text-center relative z-10">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30">
            <CheckCircle size={48} className="text-white" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
          <span className="gradient-text animate-gradient bg-gradient-to-r from-primary via-secondary to-accent">
            Payment Successful!
          </span>{" "}
          🎉
        </h1>

        <p className="text-lg text-white/70 mb-10">
          Thank you for your order! We&apos;re already working on creating your 
          personalized birthday video.
        </p>

        <div className="glass-card p-8 rounded-2xl mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-6">What happens next?</h2>
          
          <div className="space-y-6 text-left">
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                <Mail size={22} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Check your email</h3>
                <p className="text-white/60 text-sm">
                  You&apos;ll receive a confirmation email with your order details shortly.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center border border-secondary/30">
                <Clock size={22} className="text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Video creation</h3>
                <p className="text-white/60 text-sm">
                  Our talented team will create your personalized video within 24-48 hours 
                  (or 12-24 hours for Express orders).
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center border border-green-500/30">
                <CheckCircle size={22} className="text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Receive your video</h3>
                <p className="text-white/60 text-sm">
                  You&apos;ll get an email with your download link as soon as it&apos;s ready!
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-xl mb-8 backdrop-blur-sm">
          <p className="text-white/80">
            <strong className="text-white">Questions?</strong> Contact us at{" "}
            <a href="mailto:support@afrobirthday.com" className="text-primary hover:text-primary/80 transition-colors">
              support@afrobirthday.com
            </a>
          </p>
        </div>

        <Link href="/" className="btn-primary inline-flex items-center gap-2">
          Back to Home
          <ArrowRight size={18} />
        </Link>
      </div>
    </main>
  );
}
