"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Menu, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import OrderCtaLink from "@/components/OrderCtaLink";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default function Header() {
  const tNav = useTranslations("Header.nav");
  const tHeader = useTranslations("Header");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const navLinks = [
    { href: "/how-to-order", label: tNav("howItWorks") },
    { href: "/our-story", label: tNav("ourStory") },
    { href: "/faq", label: tNav("faq") },
  ];

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
          <Link href="/" className="flex items-center group" aria-label="AfroBirthday home">
            <div className="relative h-12 w-32 md:h-14 md:w-52">
              <Image
                src="/logo.png"
                alt="AfroBirthday"
                fill
                priority
                sizes="(max-width: 768px) 128px, 208px"
                className="object-contain transition-transform duration-300 scale-150 md:scale-175 group-hover:scale-[1.9]"
              />
              <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-5 py-2.5 text-white/80 hover:text-white font-medium transition-all duration-300 rounded-full hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <LocaleSwitcher className="ms-2" />
            <OrderCtaLink className="ms-2 btn-primary flex items-center gap-2 text-sm">
              <Sparkles size={16} aria-hidden="true" />
              {tHeader("cta")}
            </OrderCtaLink>
          </div>

          <div className="lg:hidden flex items-center gap-2">
            <LocaleSwitcher />
            <button
              type="button"
              className="p-3 text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        <div
          id="mobile-menu"
          className={cn(
            "lg:hidden overflow-hidden transition-all duration-500 ease-out",
            mobileMenuOpen ? "max-h-96 opacity-100 mt-4" : "max-h-0 opacity-0"
          )}
        >
          <div className="glass-card p-6 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-xl font-medium transition-all"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <OrderCtaLink
              className="btn-primary w-full text-center flex items-center justify-center gap-2 mt-4"
              onNavigate={() => setMobileMenuOpen(false)}
            >
              <Sparkles size={16} aria-hidden="true" />
              {tHeader("cta")}
            </OrderCtaLink>
          </div>
        </div>
      </nav>
    </header>
  );
}
