import Link from "next/link";
import { CheckCircle, Mail, Clock, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

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
    <main className="pt-24 pb-20 min-h-screen bg-gradient-to-b from-light to-white">
      <div className="section-container max-w-2xl text-center">
        <div className="mb-8">
          <CheckCircle size={80} className="mx-auto text-success" />
        </div>

        <h1 className="heading-1 mb-4">
          Payment Successful! 🎉
        </h1>

        <p className="text-lg text-dark/70 mb-8">
          Thank you for your order! We&apos;re already working on creating your 
          personalized birthday video.
        </p>

        <div className="bg-white p-8 rounded-2xl shadow-lg mb-8">
          <h2 className="heading-3 mb-6">What happens next?</h2>
          
          <div className="space-y-6 text-left">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Check your email</h3>
                <p className="text-dark/70 text-sm">
                  You&apos;ll receive a confirmation email with your order details shortly.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Clock size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Video creation</h3>
                <p className="text-dark/70 text-sm">
                  Our talented team will create your personalized video within 24-48 hours 
                  (or 12-24 hours for Express orders).
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
                <CheckCircle size={20} className="text-success" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Receive your video</h3>
                <p className="text-dark/70 text-sm">
                  You&apos;ll get an email with your download link as soon as it&apos;s ready!
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-secondary/10 p-6 rounded-xl mb-8">
          <p className="text-dark/80">
            <strong>Questions?</strong> Contact us at{" "}
            <a href="mailto:support@afrobirthday.com" className="text-primary hover:underline">
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
