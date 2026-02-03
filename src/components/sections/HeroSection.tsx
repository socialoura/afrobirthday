"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Play, Sparkles, Star, Clock, Shield } from "lucide-react";
import OptimizedVideo from "@/components/OptimizedVideo";
import { type CurrencyCode, PRICES } from "@/lib/utils";
import { useExchangeRates } from "@/lib/useExchangeRates";
import { useTranslations } from "next-intl";

function currencyFromLocale(locale: string): CurrencyCode {
  const region = locale.split("-")[1]?.toUpperCase();
  if (region === "GB") return "GBP";
  if (region === "CA") return "CAD";
  if (region === "AU") return "AUD";
  if (
    region === "FR" ||
    region === "DE" ||
    region === "ES" ||
    region === "IT" ||
    region === "NL" ||
    region === "BE" ||
    region === "PT" ||
    region === "IE" ||
    region === "AT" ||
    region === "FI" ||
    region === "GR" ||
    region === "LU"
  ) {
    return "EUR";
  }
  return "USD";
}

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
      const converted = localCurrency === "USD" ? priceUsd : priceUsd * rates[localCurrency];
      return new Intl.NumberFormat(browserLocale, {
        style: "currency",
        currency: localCurrency,
        maximumFractionDigits: 2,
      }).format(converted);
    };
  }, [browserLocale, localCurrency, rates]);

  const displayPrice = useMemo(() => formatLocal(basePriceUsd), [basePriceUsd, formatLocal]);
  const displayOriginalPrice = useMemo(() => formatLocal(39.99), [formatLocal]);

  return (
    <section className="relative min-h-[100svh] md:min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background gradients */}
      <div className="absolute inset-0 bg-dark">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Video Background with overlay */}
      <div className="absolute inset-0 overflow-hidden opacity-40">
        <OptimizedVideo
          src="/blessing_video_principal.MOV"
          poster="/showcase_1.jpg"
          isHero={true}
          className="w-full h-full scale-110"
        />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Content */}
      <div className="relative z-10 section-container text-center pt-24 pb-16 md:pt-32 md:pb-20 px-4">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8">
          <Star size={14} className="text-secondary fill-secondary" />
          <span className="text-white/80 text-sm font-medium">{tHero("badge")}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 md:mb-6 max-w-5xl mx-auto">
          <span className="text-white">{tHero("title1")}</span>
          <br />
          <span className="gradient-text animate-gradient bg-gradient-to-r from-primary via-secondary to-accent">{tHero("title2")}</span>
        </h1>

        <p className="text-base md:text-lg lg:text-xl text-white/60 mb-6 md:mb-10 max-w-2xl mx-auto leading-relaxed px-2">
          {tHero("subtitle1")}
          <br className="hidden md:block" />
          {tHero("subtitle2")}
        </p>

        {/* Price highlight */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-6 md:mb-8">
          <span className="text-white/40 line-through text-base md:text-lg">{displayOriginalPrice}</span>
          <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{displayPrice}</span>
          <span className="px-2 md:px-3 py-1 rounded-full bg-primary/20 text-primary text-xs md:text-sm font-semibold">50% OFF</span>
        </div>

        {localCurrency !== "USD" && (
          <p className="text-white/50 text-xs md:text-sm mb-6 md:mb-8">
            {tHero("localCurrencyNote")}
          </p>
        )}

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center mb-8 md:mb-12 px-4">
          <Link href="#order" className="btn-primary text-base md:text-lg group min-h-[48px] flex items-center justify-center">
            <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
            {tHero("ctaOrder")}
          </Link>
          <Link href="#showcase" className="btn-secondary text-base md:text-lg group flex items-center justify-center gap-2 min-h-[48px]">
            <Play size={20} className="group-hover:scale-110 transition-transform" />
            {tHero("ctaWatch")}
          </Link>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-white/50 text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-accent" />
            <span>{tHero("trust.delivery")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <span>{tHero("trust.guarantee")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Star size={16} className="text-secondary fill-secondary" />
            <span>{tHero("trust.rating")}</span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/40 rounded-full mt-2 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
