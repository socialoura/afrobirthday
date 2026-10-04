import { preload } from "react-dom";
import { ArrowRight, Clock, Play, ShieldCheck, Sparkles, Star, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import RecentOrdersBadge from "@/components/RecentOrdersBadge";
import TrackedAnchor from "@/components/TrackedAnchor";
import HeroPrice from "@/components/sections/hero/HeroPrice";
import HeroVideoCard from "@/components/sections/hero/HeroVideoCard";
import { siteMedia } from "@/lib/siteMedia";

/**
 * Server component. It used to be one client component (state for the price,
 * the mute button and the CTA tracking), so all of its markup had to be
 * hydrated before slow phones could respond; field data showed the hero text
 * painting ~2.7 s after the HTML arrived. Only the price, the video card and
 * the order button are client islands now.
 */
export default async function HeroSection() {
  const tHero = await getTranslations("Hero");
  // The poster is the desktop LCP element; announcing it in the document head
  // lets the browser fetch it before the hero markup is even parsed.
  preload(siteMedia("showcase_1-poster.webp"), { as: "image", fetchPriority: "high" });

  const reviewName = tHero("miniReview.name");
  const reviewInitials = reviewName
    .split("·")[0]
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word)[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="relative min-h-[100svh] lg:min-h-screen overflow-hidden bg-dark">
      {/* Atmospheric backdrop — subtler than before, focused on the right side */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Static radial gradients, same colours and positions as the former
            blurred, pulsing circles: blur-3xl on 700px elements kept phones
            repainting and delayed the first paint of the hero text by ~2.7 s
            (PostHog LCP attribution, Oct 2026). */}
        <div className="absolute inset-0 hero-glow" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,10,10,0.5)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:80px_80px] mask-image-radial" />
      </div>

      <div className="relative z-10 section-container pt-28 pb-16 lg:pt-32 lg:pb-24">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* ───────── LEFT: Copy + CTAs + Social proof ───────── */}
          {/* Copy first on mobile too: with the video first, the title, price
              and order button all sat below the fold on a phone. */}
          <div className="order-1 lg:col-span-7 text-center lg:text-start">
            {/* Top badge — real count of orders delivered this week */}
            <RecentOrdersBadge />

            {/* Title */}
            <h1 className="font-display font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.05] mb-5">
              <span className="text-white block">{tHero("title1")}</span>
              <span className="block gradient-text md:animate-gradient bg-gradient-to-r from-primary via-secondary to-accent">
                {tHero("title2")}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg lg:text-xl text-white/80 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-7">
              {tHero("subtitle1")} {tHero("subtitle2")}
            </p>

            {/* Price block (client: visitor's currency) */}
            <HeroPrice />

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8 sm:items-center sm:justify-center lg:justify-start">
              <TrackedAnchor
                id="hero-cta"
                href="#order"
                location="hero"
                className="btn-primary text-base group min-h-[52px] flex items-center justify-center gap-2"
              >
                <Sparkles size={18} aria-hidden="true" className="group-hover:rotate-12 transition-transform" />
                {tHero("ctaOrder")}
                <ArrowRight
                  size={18}
                  aria-hidden="true"
                  className="group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform"
                />
              </TrackedAnchor>
              <a
                href="#showcase"
                className="inline-flex items-center justify-center gap-2 text-white/90 hover:text-white text-base font-medium px-5 py-3 rounded-full hover:bg-white/5 transition-colors group min-h-[52px]"
              >
                <Play size={18} aria-hidden="true" className="group-hover:scale-110 transition-transform" />
                {tHero("ctaWatch")}
              </a>
            </div>

            {/* Social proof — rating */}
            <div className="flex flex-col sm:flex-row items-center lg:items-center gap-4 mb-6 justify-center lg:justify-start">
              <div className="flex items-center gap-2">
                <div className="flex" aria-hidden="true">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="text-secondary fill-secondary" />
                  ))}
                </div>
                <span className="text-white/90 text-sm font-semibold">{tHero("trust.rating")}</span>
                <span className="text-white/60 text-sm">·</span>
                <span className="text-white/80 text-sm">{tHero("ordersThisYear")}</span>
              </div>
            </div>

            {/* Trust line */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 text-white/70 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} className="text-accent" aria-hidden="true" />
                {tHero("trust.delivery")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-accent" aria-hidden="true" />
                {tHero("trust.guarantee")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap size={14} className="text-accent" aria-hidden="true" />
                {tHero("trust.payment")}
              </span>
            </div>
          </div>

          {/* ───────── RIGHT: Video preview card + floating proof ───────── */}
          <div className="order-2 lg:col-span-5 relative">
            <div className="relative max-w-[360px] mx-auto lg:max-w-none">
              {/* Glow halo behind card */}
              <div className="absolute -inset-6 rounded-[2rem] card-glow" aria-hidden="true" />

              {/* Phone-style video card (client: sound toggle) */}
              <HeroVideoCard />

              {/* Floating proof card — bottom: mini review */}
              <div
                className="hidden sm:flex absolute -bottom-6 start-1/4 max-w-[260px] items-start gap-3 px-4 py-3 rounded-2xl bg-white shadow-2xl rotate-[-3deg] animate-float"
                style={{ animationDelay: "1.7s" }}
              >
                {/* Initials, not a photo: the photo was of the dancers, not Marie. */}
                <div
                  aria-hidden="true"
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                >
                  {reviewInitials}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-0.5" aria-hidden="true">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={10} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-slate-900 text-sm font-semibold leading-tight">
                    &ldquo;{tHero("miniReview.text")}&rdquo;
                  </p>
                  <p className="text-slate-500 text-xs">{reviewName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade to next section */}
      <div
        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-dark pointer-events-none"
        aria-hidden="true"
      />
    </section>
  );
}
