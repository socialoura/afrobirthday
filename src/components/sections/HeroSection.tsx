"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Play,
  Sparkles,
  Star,
  ShieldCheck,
  Clock,
  Zap,
  ArrowRight,
} from "lucide-react";
import OptimizedVideo from "@/components/OptimizedVideo";
import { type CurrencyCode, currencyFromLocale, PRICES } from "@/lib/utils";
import { useExchangeRates } from "@/lib/useExchangeRates";
import { useTranslations } from "next-intl";

const AVATARS = [
  "/showcase_1.jpg",
  "/showcase_2.jpg",
  "/showcase_3.jpg",
  "/showcase_1.jpg",
  "/showcase_2.jpg",
];

export default function HeroSection() {
  const tHero = useTranslations("Hero");

  const [localCurrency, setLocalCurrency] = useState<CurrencyCode>("USD");
  const [browserLocale, setBrowserLocale] = useState("en-US");
  const [basePriceUsd, setBasePriceUsd] = useState<number>(PRICES.base);
  const { rates } = useExchangeRates();

  useEffect(() => {
    const nextLocale = navigator.language || "en-US";
    setBrowserLocale(nextLocale);
    setLocalCurrency(currencyFromLocale(nextLocale));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPricing = async () => {
      try {
        const res = await fetch("/api/pricing", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<{ base: number }>;
        if (!isMounted) return;
        if (typeof data.base === "number" && Number.isFinite(data.base)) {
          setBasePriceUsd(data.base);
        }
      } catch {
        // ignore
      }
    };

    loadPricing();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatLocal = useMemo(() => {
    return (priceUsd: number) => {
      const converted =
        localCurrency === "USD" ? priceUsd : priceUsd * rates[localCurrency];
      return new Intl.NumberFormat(browserLocale, {
        style: "currency",
        currency: localCurrency,
        maximumFractionDigits: 2,
      }).format(converted);
    };
  }, [browserLocale, localCurrency, rates]);

  const displayPrice = useMemo(
    () => formatLocal(basePriceUsd),
    [basePriceUsd, formatLocal]
  );
  const displayOriginalPrice = useMemo(() => formatLocal(39.99), [formatLocal]);

  return (
    <section className="relative min-h-[100svh] lg:min-h-screen overflow-hidden bg-dark">
      {/* Atmospheric backdrop — subtler than before, focused on the right side */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-10%] end-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-primary/25 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-[-15%] start-[-10%] w-[55vw] h-[55vw] max-w-[600px] max-h-[600px] bg-accent/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "2.5s" }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,10,10,0.5)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:80px_80px] mask-image-radial" />
      </div>

      <div className="relative z-10 section-container pt-28 pb-16 lg:pt-32 lg:pb-24">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* ───────── LEFT: Copy + CTAs + Social proof ───────── */}
          <div className="lg:col-span-7 text-center lg:text-start">
            {/* Top badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              <span className="text-white/90 text-sm font-medium">
                {tHero("badge")}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.05] mb-5">
              <span className="text-white block">{tHero("title1")}</span>
              <span className="block gradient-text animate-gradient bg-gradient-to-r from-primary via-secondary to-accent">
                {tHero("title2")}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg lg:text-xl text-white/80 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-7">
              {tHero("subtitle1")} {tHero("subtitle2")}
            </p>

            {/* Price block */}
            <div className="inline-flex items-center gap-3 mb-7 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-white/60 line-through text-base">
                {displayOriginalPrice}
              </span>
              <span className="text-3xl sm:text-4xl font-bold text-white">
                {displayPrice}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-white text-xs font-bold">
                -50%
              </span>
            </div>

            {localCurrency !== "USD" && (
              <p className="text-white/60 text-xs sm:text-sm mb-6 -mt-3">
                {tHero("localCurrencyNote")}
              </p>
            )}

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8 sm:items-center sm:justify-center lg:justify-start">
              <Link
                href="#order"
                className="btn-primary text-base group min-h-[52px] flex items-center justify-center gap-2"
              >
                <Sparkles
                  size={18}
                  aria-hidden="true"
                  className="group-hover:rotate-12 transition-transform"
                />
                {tHero("ctaOrder")}
                <ArrowRight
                  size={18}
                  aria-hidden="true"
                  className="group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform"
                />
              </Link>
              <Link
                href="#showcase"
                className="inline-flex items-center justify-center gap-2 text-white/90 hover:text-white text-base font-medium px-5 py-3 rounded-full hover:bg-white/5 transition-colors group min-h-[52px]"
              >
                <Play
                  size={18}
                  aria-hidden="true"
                  className="group-hover:scale-110 transition-transform"
                />
                {tHero("ctaWatch")}
              </Link>
            </div>

            {/* Social proof — avatar stack + rating */}
            <div className="flex flex-col sm:flex-row items-center lg:items-center gap-4 mb-6 justify-center lg:justify-start">
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {AVATARS.map((src, i) => (
                  <div
                    key={i}
                    className="relative w-9 h-9 rounded-full ring-2 ring-dark overflow-hidden bg-white/10"
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-cover"
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex" aria-hidden="true">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className="text-secondary fill-secondary"
                    />
                  ))}
                </div>
                <span className="text-white/90 text-sm font-semibold">
                  {tHero("trust.rating")}
                </span>
                <span className="text-white/60 text-sm">·</span>
                <span className="text-white/80 text-sm">
                  {tHero("ordersThisYear")}
                </span>
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
          <div className="lg:col-span-5 relative">
            <div className="relative max-w-[360px] mx-auto lg:max-w-none">
              {/* Glow halo behind card */}
              <div
                className="absolute -inset-6 bg-gradient-to-tr from-primary/30 via-secondary/20 to-accent/30 rounded-[2rem] blur-2xl"
                aria-hidden="true"
              />

              {/* Phone-style video card */}
              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 bg-black aspect-[9/16] lg:rotate-2 transition-transform duration-500 hover:rotate-0">
                <OptimizedVideo
                  src="/blessing_video_principal.mp4"
                  poster="/showcase_1.jpg"
                  isHero
                  className="w-full h-full"
                />

                {/* Gradient overlay for legibility */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none"
                  aria-hidden="true"
                />

                {/* Live tag */}
                <div className="absolute top-4 start-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/90 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {tHero("liveTag")}
                </div>

                {/* Caption at bottom of card */}
                <div className="absolute bottom-0 inset-x-0 p-5 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white text-xs font-bold">
                      AB
                    </div>
                    <div>
                      <p className="text-sm font-semibold">@afrobirthday</p>
                      <p className="text-[11px] text-white/70">
                        {tHero("videoCaption")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sound indicator */}
                <div className="absolute top-4 end-4 w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white">
                  <span className="text-base" aria-hidden="true">🔊</span>
                </div>
              </div>

              {/* Floating proof card — bottom: mini review */}
              <div
                className="hidden sm:flex absolute -bottom-6 start-1/4 max-w-[260px] items-start gap-3 px-4 py-3 rounded-2xl bg-white shadow-2xl rotate-[-3deg] animate-float"
                style={{ animationDelay: "1.7s" }}
              >
                <Image
                  src="/showcase_2.jpg"
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <div className="flex gap-0.5 mb-0.5" aria-hidden="true">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={10}
                        className="text-yellow-400 fill-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-slate-900 text-sm font-semibold leading-tight">
                    &ldquo;{tHero("miniReview.text")}&rdquo;
                  </p>
                  <p className="text-slate-500 text-xs">
                    {tHero("miniReview.name")}
                  </p>
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
