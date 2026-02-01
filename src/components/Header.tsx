"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/how-to-order", label: "How It Works" },
  { href: "/our-story", label: "Our Story" },
  { href: "/faq", label: "FAQ" },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-dark/90 backdrop-blur-xl border-b border-white/10 py-3"
          : "bg-transparent py-5"
      )}
    >
      <nav className="section-container">
        <div className="flex items-center justify-between">
          {/* Logo - Enlarged, no text */}
          <Link href="/" className="flex items-center group">
            <div className="relative">
              <Image
                src="/logo.png"
                alt="AfroBirthday"
                width={70}
                height={70}
                className="w-14 h-14 md:w-16 md:h-16 transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-5 py-2.5 text-white/70 hover:text-white font-medium transition-all duration-300 rounded-full hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/#order"
              className="ml-4 btn-primary flex items-center gap-2 text-sm"
            >
              <Sparkles size={16} />
              Get Your Video
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-3 text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-500 ease-out",
            mobileMenuOpen ? "max-h-80 opacity-100 mt-4" : "max-h-0 opacity-0"
          )}
        >
          <div className="glass-card p-6 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-xl font-medium transition-all"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/#order"
              className="btn-primary w-full text-center flex items-center justify-center gap-2 mt-4"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Sparkles size={16} />
              Get Your Video
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
