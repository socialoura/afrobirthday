import Link from "next/link";
import Image from "next/image";
import { Mail, Instagram } from "lucide-react";

const quickLinks = [
  { href: "/how-to-order", label: "How To Order" },
  { href: "/our-story", label: "Our Story" },
  { href: "/faq", label: "FAQ" },
];

const legalLinks = [
  { href: "/about", label: "About Us" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund", label: "Refund Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export default function Footer() {
  return (
    <footer className="bg-dark text-white py-12">
      <div className="section-container">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.png"
                alt="AfroBirthday"
                width={40}
                height={40}
                className="w-10 h-10"
              />
              <span className="font-display font-bold text-xl">
                AfroBirthday 🎂
              </span>
            </Link>
            <p className="text-white/70 text-sm">
              Making every birthday viral with authentic African energy and joy.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/70 hover:text-primary transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/70 hover:text-primary transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold mb-4">Connect With Us</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:hello@afrobirthday.com"
                  className="flex items-center gap-2 text-white/70 hover:text-primary transition-colors text-sm"
                >
                  <Mail size={18} />
                  hello@afrobirthday.com
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/afrobirthday"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white/70 hover:text-primary transition-colors text-sm"
                >
                  <Instagram size={18} />
                  @afrobirthday
                </a>
              </li>
              <li>
                <a
                  href="https://tiktok.com/@afrobirthday"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white/70 hover:text-primary transition-colors text-sm"
                >
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                  @afrobirthday
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/10 mt-8 pt-8 text-center">
          <p className="text-white/50 text-sm">
            © {new Date().getFullYear()} AfroBirthday. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
