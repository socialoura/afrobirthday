import Link from "next/link";
import Image from "next/image";
import { Mail, Instagram, Heart, ArrowUpRight } from "lucide-react";

const quickLinks = [
  { href: "/how-to-order", label: "How It Works" },
  { href: "/our-story", label: "Our Story" },
  { href: "/faq", label: "FAQ" },
];

const legalLinks = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund", label: "Refunds" },
  { href: "/terms", label: "Terms" },
];

const socialLinks = [
  {
    href: "https://instagram.com/afrobirthday",
    label: "Instagram",
    icon: Instagram,
  },
  {
    href: "https://tiktok.com/@afrobirthday",
    label: "TikTok",
    icon: () => (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="relative bg-dark border-t border-white/5">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />

      <div className="section-container relative py-16">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand - Logo only, enlarged */}
          <div className="col-span-2 md:col-span-4">
            <Link href="/" className="inline-block group mb-6">
              <Image
                src="/logo.png"
                alt="AfroBirthday"
                width={80}
                height={80}
                className="w-16 h-16 md:w-20 md:h-20 transition-transform duration-300 group-hover:scale-110"
              />
            </Link>
            <p className="text-white/50 text-sm max-w-xs leading-relaxed">
              Spreading authentic African joy to birthdays worldwide. Every video is crafted with love.
            </p>

            {/* Social Links */}
            <div className="flex gap-3 mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 flex items-center justify-center text-white/60 hover:text-primary transition-all duration-300"
                  aria-label={social.label}
                >
                  <social.icon />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-display font-semibold text-white/90 mb-4 text-sm uppercase tracking-wider">
              Navigate
            </h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/50 hover:text-white text-sm transition-colors duration-200 flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-display font-semibold text-white/90 mb-4 text-sm uppercase tracking-wider">
              Legal
            </h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/50 hover:text-white text-sm transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & CTA */}
          <div className="col-span-2 md:col-span-4">
            <h4 className="font-display font-semibold text-white/90 mb-4 text-sm uppercase tracking-wider">
              Get in Touch
            </h4>
            <a
              href="mailto:hello@afrobirthday.com"
              className="inline-flex items-center gap-2 text-white/70 hover:text-primary transition-colors text-sm mb-6"
            >
              <Mail size={16} />
              hello@afrobirthday.com
            </a>

            <div className="glass-card p-4 mt-4">
              <p className="text-white/70 text-sm mb-3">
                Ready to make someone&apos;s day unforgettable?
              </p>
              <Link
                href="/#order"
                className="btn-primary w-full text-center text-sm py-3"
              >
                Order Your Video
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/5 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/30 text-sm">
            © {new Date().getFullYear()} AfroBirthday. All rights reserved.
          </p>
          <p className="text-white/30 text-sm flex items-center gap-1">
            Made with <Heart size={14} className="text-primary" /> in Africa
          </p>
        </div>
      </div>
    </footer>
  );
}
