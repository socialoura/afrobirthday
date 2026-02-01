"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "How long does it take to receive my video?",
    answer: "Your personalized birthday video will be delivered within 24-48 hours from order confirmation. With our Express option (+€5.99), you can receive it in just 12-24 hours!",
  },
  {
    question: "What if I don't like the video?",
    answer: "We offer a 100% money-back guarantee within 7 days. If you're not completely satisfied with your video, simply email us at support@afrobirthday.com with your order ID, and we'll process a full refund - no questions asked!",
  },
  {
    question: "Can I request a specific style or costume?",
    answer: "Absolutely! You can add any special requests in the custom message field of our order form. Our team will do their best to accommodate your wishes.",
  },
  {
    question: "What if the text is wrong in the video?",
    answer: "We double-check all text before filming. However, if there's an error on our part, we'll remake the video for free within 24 hours.",
  },
  {
    question: "Is my photo safe?",
    answer: "Yes! Your photo is encrypted during upload and stored securely. We delete all personal photos from our servers within 30 days after video delivery. We never share your data with third parties.",
  },
  {
    question: "Can I download the video?",
    answer: "Yes! You'll receive a direct download link via email. The video is yours to keep forever and share however you like - on WhatsApp, social media, or save it for memories.",
  },
  {
    question: "What if I want multiple videos?",
    answer: "You can order as many videos as you need! Simply complete the order form multiple times. For bulk orders (5+ videos), contact us at support@afrobirthday.com for special pricing.",
  },
  {
    question: "Can I use this for corporate events?",
    answer: "Absolutely! Many companies use our videos for employee birthdays and celebrations. Email support@afrobirthday.com for custom corporate pricing and branding options.",
  },
  {
    question: "Is the video watermarked?",
    answer: "By default, videos include a small, tasteful AfroBirthday logo. If you prefer no watermark, just mention it in your order notes - we're happy to accommodate!",
  },
  {
    question: "What music options are available?",
    answer: "You can either let us choose the perfect birthday music (included in base price) or provide your own song choice for an additional €8.56. You can upload an MP3 file or share a YouTube/Spotify link.",
  },
  {
    question: "Can I gift this to someone?",
    answer: "Yes! During checkout, you can enter the recipient's email address, and we'll send the video directly to them. You can also add a personalized gift message.",
  },
  {
    question: "Do you ship physical DVDs?",
    answer: "Not currently - all our videos are delivered digitally for the fastest possible delivery. However, if you're interested in physical copies, let us know at support@afrobirthday.com!",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left hover:text-primary transition-colors text-white"
      >
        <span className="font-medium pr-4">{question}</span>
        <ChevronDown
          size={20}
          className={cn(
            "flex-shrink-0 transition-transform duration-200 text-white/70",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-96 pb-5" : "max-h-0"
        )}
      >
        <p className="text-white/60">{answer}</p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  return (
    <main className="pt-24 pb-20 bg-dark relative overflow-hidden">
      <div className="section-container relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none -z-10" />
        {/* Header */}
        <div className="text-center mb-12 relative">
          <h1 className="heading-1 mb-4 text-white">Frequently Asked Questions ❓</h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Everything you need to know about AfroBirthday. Can&apos;t find the answer you&apos;re looking for?{" "}
            <a href="mailto:support@afrobirthday.com" className="text-primary hover:underline">
              Contact us
            </a>
          </p>
        </div>

        {/* FAQ List */}
        <div className="max-w-3xl mx-auto glass-card rounded-2xl p-6 md:p-8 mb-12 relative">
          {faqs.map((faq, index) => (
            <FAQItem key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>

        {/* Still have questions */}
        <div className="text-center relative">
          <div className="glass-card p-8 rounded-2xl max-w-xl mx-auto mb-8">
            <h3 className="heading-3 mb-3 text-white">Still have questions?</h3>
            <p className="text-white/60 mb-4">
              We&apos;re here to help! Reach out to us anytime.
            </p>
            <a
              href="mailto:support@afrobirthday.com"
              className="btn-outline inline-block"
            >
              Email Us
            </a>
          </div>

          <Link href="/#order" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2">
            Ready to order?
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>
    </main>
  );
}
