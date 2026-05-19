import Image from "next/image";
import { Mail, Instagram, Heart, ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const navHrefs = [
  { href: "/how-to-order", key: "Header.nav.howItWorks" },
  { href: "/our-story", key: "Header.nav.ourStory" },
  { href: "/faq", key: "Header.nav.faq" },
] as const;

const legalHrefs = [
  { href: "/about", key: "Footer.links.about" },
  { href: "/privacy", key: "Footer.links.privacy" },
  { href: "/refund", key: "Footer.links.refunds" },
  { href: "/terms", key: "Footer.links.terms" },
] as const;

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
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    ),
  },
];

export default async function Footer() {
  const tFooter = await getTranslations("Footer");
  const tNav = await getTranslations("Header.nav");

  const navLabel = (key: (typeof navHrefs)[number]["key"]) => {
    if (key === "Header.nav.howItWorks") return tNav("howItWorks");
    if (key === "Header.nav.ourStory") return tNav("ourStory");
    return tNav("faq");
  };

  const legalLabel = (key: (typeof legalHrefs)[number]["key"]) => {
    if (key === "Footer.links.about") return tFooter("links.about");
    if (key === "Footer.links.privacy") return tFooter("links.privacy");
    if (key === "Footer.links.refunds") return tFooter("links.refunds");
    return tFooter("links.terms");
  };

  return (
    <footer className="relative bg-dark border-t border-white/5">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />

      <div className="section-container relative py-10 md:py-16 px-4">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-6 md:gap-8 lg:gap-12">
          <div className="col-span-2 md:col-span-4">
            <Link href="/" className="inline-block group mb-4 md:mb-6" aria-label="AfroBirthday home">
              <Image
                src="/logo.png"
                alt="AfroBirthday"
                width={80}
                height={80}
                className="w-14 h-14 md:w-20 md:h-20 transition-transform duration-300 group-hover:scale-110"
              />
            </Link>
            <p className="text-white/70 text-xs md:text-sm max-w-xs leading-relaxed">
              {tFooter("brand")}
            </p>

            <div className="flex gap-3 mt-4 md:mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-full bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 flex items-center justify-center text-white/80 hover:text-primary transition-all duration-300"
                  aria-label={social.label}
                >
                  <social.icon />
                </a>
              ))}
            </div>
          </div>

          <div className="col-span-1 md:col-span-2">
            <h4 className="font-display font-semibold text-white mb-3 md:mb-4 text-xs md:text-sm uppercase tracking-wider">
              {tFooter("navigate")}
            </h4>
            <ul className="space-y-2 md:space-y-3">
              {navHrefs.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/70 hover:text-white text-xs md:text-sm transition-colors duration-200 flex items-center gap-1 group py-1"
                  >
                    {navLabel(link.key)}
                    <ArrowUpRight
                      size={12}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-1 md:col-span-2">
            <h4 className="font-display font-semibold text-white mb-3 md:mb-4 text-xs md:text-sm uppercase tracking-wider">
              {tFooter("legal")}
            </h4>
            <ul className="space-y-2 md:space-y-3">
              {legalHrefs.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/70 hover:text-white text-xs md:text-sm transition-colors duration-200 py-1 inline-block"
                  >
                    {legalLabel(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-4">
            <h4 className="font-display font-semibold text-white mb-3 md:mb-4 text-xs md:text-sm uppercase tracking-wider">
              {tFooter("getInTouch")}
            </h4>
            <a
              href="mailto:support@afrobirthday.com"
              className="inline-flex items-center gap-2 text-white/80 hover:text-primary transition-colors text-xs md:text-sm mb-4 md:mb-6"
            >
              <Mail size={16} aria-hidden="true" />
              support@afrobirthday.com
            </a>

            <div className="glass-card p-4 mt-3 md:mt-4">
              <p className="text-white/80 text-xs md:text-sm mb-3">
                {tFooter("ctaLine")}
              </p>
              <Link
                href="/#order"
                className="btn-primary w-full text-center text-sm py-3 min-h-[44px] flex items-center justify-center"
              >
                {tFooter("ctaButton")}
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 md:mt-12 pt-6 md:pt-8 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
          <p className="text-white/60 text-xs md:text-sm">
            © {new Date().getFullYear()} AfroBirthday. {tFooter("copyright")}
          </p>
          <p className="text-white/60 text-xs md:text-sm flex items-center gap-1">
            {tFooter("madeWith")} <Heart size={14} className="text-primary" aria-hidden="true" /> {tFooter("inAfrica")}
          </p>
        </div>
      </div>
    </footer>
  );
}
