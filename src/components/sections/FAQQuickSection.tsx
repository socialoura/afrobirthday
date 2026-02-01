import Link from "next/link";
import { ChevronRight } from "lucide-react";

const quickFaqs = [
  {
    question: "How fast is delivery?",
    answer: "Your personalized video will be delivered within 24-48 hours (or 12-24 hours with Express delivery).",
  },
  {
    question: "What if I don't like the video?",
    answer: "We offer a 100% money-back guarantee within 7 days. No questions asked!",
  },
  {
    question: "Can I customize everything?",
    answer: "Yes! You can add your own message, upload a photo, and even provide your own music.",
  },
];

export default function FAQQuickSection() {
  return (
    <section className="py-24 bg-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="section-container">
        <div className="text-center mb-10">
          <h2 className="heading-2 mb-4 text-white">Quick Answers</h2>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {quickFaqs.map((faq, index) => (
            <div
              key={index}
              className="glass-card p-6 rounded-2xl"
            >
              <h3 className="font-semibold text-lg mb-2 text-white">{faq.question}</h3>
              <p className="text-white/60">{faq.answer}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/faq"
            className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
          >
            See all FAQs
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
