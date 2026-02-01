"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, Check, Loader2, Lock, ShieldCheck, Clock, Sparkles, CreditCard } from "lucide-react";
import { cn, formatPrice, type CurrencyCode, PRICES } from "@/lib/utils";
import { useExchangeRates } from "@/lib/useExchangeRates";

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

const orderSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  message: z
    .string()
    .min(3, "Message must be at least 3 characters")
    .max(100, "Message must be at most 100 characters"),
  musicOption: z.enum(["default", "custom"]),
  musicLink: z.string().url().optional().or(z.literal("")),
  deliveryMethod: z.enum(["standard", "express"]),
  giftNote: z.string().max(200).optional(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms" }),
  }),
});

type OrderFormData = z.infer<typeof orderSchema>;

export default function OrderFormSection() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localCurrency, setLocalCurrency] = useState<CurrencyCode>("USD");
  const { rates, fetchedAt, loading: ratesLoading } = useExchangeRates();

  useEffect(() => {
    setLocalCurrency(currencyFromLocale(navigator.language || "en-US"));
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      musicOption: "default",
      deliveryMethod: "standard",
    },
  });

  const musicOption = watch("musicOption");
  const deliveryMethod = watch("deliveryMethod");
  const message = watch("message") || "";

  const totalPrice =
    PRICES.base +
    (musicOption === "custom" ? PRICES.customSong : 0) +
    (deliveryMethod === "express" ? PRICES.expressDelivery : 0);

  const formatLocal = useMemo(() => {
    return (priceUsd: number) => {
      if (localCurrency === "USD") return formatPrice(priceUsd, "USD");
      const converted = priceUsd * rates[localCurrency];
      return new Intl.NumberFormat(navigator.language || "en-US", {
        style: "currency",
        currency: localCurrency,
        maximumFractionDigits: 2,
      }).format(converted);
    };
  }, [localCurrency, rates]);

  const ratesNote = useMemo(() => {
    if (localCurrency === "USD") return null;
    if (ratesLoading) return "Rates updating…";
    if (!fetchedAt) return "Live rates unavailable. Showing estimated rates.";
    const dt = new Date(fetchedAt);
    if (Number.isNaN(dt.getTime())) return "Rates updated recently";
    return `Rates updated ${dt.toLocaleString(navigator.language || "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }, [fetchedAt, localCurrency, ratesLoading]);

  const handlePhotoDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handlePhotoSelect(file);
    }
  }, []);

  const handlePhotoSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert("Photo must be less than 5MB");
      return;
    }
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: OrderFormData) => {
    if (!photo) {
      alert("Please upload a photo");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const orderId = crypto.randomUUID();

      const photoForm = new FormData();
      photoForm.append("file", photo);
      photoForm.append("folder", "orders/photos");

      const photoUploadRes = await fetch("/api/upload", {
        method: "POST",
        body: photoForm,
      });

      if (!photoUploadRes.ok) {
        throw new Error("Photo upload failed");
      }

      const { url: photoUrl } = await photoUploadRes.json();
      if (!photoUrl) {
        throw new Error("Missing photo URL");
      }

      let musicFileUrl: string | undefined;
      if (musicFile) {
        const musicForm = new FormData();
        musicForm.append("file", musicFile);
        musicForm.append("folder", "orders/music");

        const musicUploadRes = await fetch("/api/upload", {
          method: "POST",
          body: musicForm,
        });

        if (!musicUploadRes.ok) {
          throw new Error("Music upload failed");
        }

        const { url } = await musicUploadRes.json();
        if (url) musicFileUrl = url;
      }

      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          ...data,
          photoUrl,
          musicFileUrl,
          totalPrice,
          hasCustomSong: musicOption === "custom",
          isExpress: deliveryMethod === "express",
        }),
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="order" className="py-24 bg-dark relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

      <div className="section-container relative">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Order Now
          </span>
          <h2 className="heading-2 text-white mb-4">Create Your Birthday Video</h2>
          <p className="text-white/60 max-w-xl mx-auto">
            Fill out the form below and we&apos;ll create a personalized video just for you!
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-6">
              {/* Photo Upload */}
              <div className="glass-card p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <label className="block font-semibold text-white">
                      Upload Photo <span className="text-error">*</span>
                    </label>
                    <p className="text-white/40 text-sm mt-1">
                      A clear photo helps us personalize the video perfectly.
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-white/40 text-sm">
                    <ShieldCheck size={16} className="text-accent" />
                    Private & secure
                  </div>
                </div>

                <div
                  onDrop={handlePhotoDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all",
                    photoPreview
                      ? "border-success bg-success/10"
                      : "border-white/20 hover:border-primary bg-white/5"
                  )}
                >
                  {photoPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="max-h-56 rounded-2xl mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null);
                          setPhotoPreview(null);
                        }}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-error text-white rounded-full flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="mx-auto w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                        <Upload size={26} className="text-white/60" />
                      </div>
                      <p className="text-white/80 font-medium">Drop your image here</p>
                      <p className="text-white/40 text-sm mt-1">
                        or <span className="text-primary font-semibold">browse files</span>
                      </p>
                      <p className="text-xs text-white/30 mt-3">
                        JPG, PNG, WebP • Max 5MB
                      </p>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoSelect(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Custom Message */}
              <div className="glass-card p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <label className="block font-semibold text-white">
                      Birthday Message <span className="text-error">*</span>
                    </label>
                    <p className="text-white/40 text-sm mt-1">
                      Keep it short and clear. We&apos;ll shout it with energy.
                    </p>
                  </div>
                  <div className={cn("text-sm", message.length > 90 ? "text-error" : "text-white/40")}>
                    {message.length}/100
                  </div>
                </div>

                <textarea
                  {...register("message")}
                  placeholder="E.g., 'Happy 30th Birthday Sarah!'"
                  maxLength={100}
                  rows={3}
                  className={cn(
                    "w-full px-4 py-3 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-white/5 text-white placeholder:text-white/30",
                    errors.message ? "border-error" : "border-white/20"
                  )}
                />
                {errors.message && (
                  <p className="text-error text-sm mt-2">{errors.message.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="glass-card p-6">
                <label className="block font-semibold mb-2 text-white">
                  Email <span className="text-error">*</span>
                </label>
                <p className="text-white/40 text-sm mb-4">
                  We&apos;ll deliver the final video to this email.
                </p>
                <input
                  type="email"
                  {...register("email")}
                  placeholder="birthday.person@email.com"
                  className={cn(
                    "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-white/5 text-white placeholder:text-white/30",
                    errors.email ? "border-error" : "border-white/20"
                  )}
                />
                {errors.email && (
                  <p className="text-error text-sm mt-2">{errors.email.message}</p>
                )}
              </div>

              {/* Music Selection */}
              <div className="glass-card p-6">
                <label className="block font-semibold mb-4 text-white">Music Selection</label>
                <div className="space-y-3">
                <label
                  className={cn(
                    "flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all",
                    musicOption === "default"
                      ? "border-primary bg-primary/10"
                      : "border-white/20 hover:border-primary/50 bg-white/5"
                  )}
                >
                  <input
                    type="radio"
                    {...register("musicOption")}
                    value="default"
                    className="w-5 h-5 text-primary"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">🎵 We choose music for you</p>
                    <p className="text-sm text-white/50">
                      Faster order, better dancing
                    </p>
                  </div>
                  <span className="font-semibold text-primary">FREE</span>
                </label>

                <label
                  className={cn(
                    "flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all",
                    musicOption === "custom"
                      ? "border-primary bg-primary/10"
                      : "border-white/20 hover:border-primary/50 bg-white/5"
                  )}
                >
                  <input
                    type="radio"
                    {...register("musicOption")}
                    value="custom"
                    className="w-5 h-5 text-primary"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">🎶 I want to provide my own song</p>
                    <p className="text-sm text-white/50">
                      Upload or paste a link
                    </p>
                  </div>
                  <span className="font-semibold text-primary">
                    +{formatLocal(PRICES.customSong)}
                  </span>
                </label>
              </div>

              {musicOption === "custom" && (
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    {...register("musicLink")}
                    placeholder="Paste YouTube or Spotify link"
                    className="w-full px-4 py-3 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-white/5 text-white placeholder:text-white/30"
                  />
                  <div className="text-center text-white/40 text-sm">or</div>
                  <div className="border border-white/20 rounded-xl p-4 bg-white/5">
                    <label className="cursor-pointer flex items-center justify-center gap-2">
                      <Upload size={20} className="text-white/40" />
                      <span className="text-white/60">
                        {musicFile ? musicFile.name : "Upload music file (MP3, WAV)"}
                      </span>
                      <input
                        type="file"
                        accept="audio/mpeg,audio/wav"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setMusicFile(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
              </div>

              {/* Delivery Method */}
              <div className="glass-card p-6">
                <label className="block font-semibold mb-4 text-white">Delivery Speed</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={cn(
                    "flex flex-col items-center p-4 border rounded-xl cursor-pointer transition-all text-center",
                    deliveryMethod === "standard"
                      ? "border-primary bg-primary/10"
                      : "border-white/20 hover:border-primary/50 bg-white/5"
                  )}
                >
                  <input
                    type="radio"
                    {...register("deliveryMethod")}
                    value="standard"
                    className="sr-only"
                  />
                  <p className="font-medium text-white">Standard</p>
                  <p className="text-sm text-white/50">24-48 hours</p>
                  <p className="text-primary font-semibold mt-1">Included</p>
                  {deliveryMethod === "standard" && (
                    <Check size={20} className="text-primary mt-2" />
                  )}
                </label>

                <label
                  className={cn(
                    "flex flex-col items-center p-4 border rounded-xl cursor-pointer transition-all text-center",
                    deliveryMethod === "express"
                      ? "border-primary bg-primary/10"
                      : "border-white/20 hover:border-primary/50 bg-white/5"
                  )}
                >
                  <input
                    type="radio"
                    {...register("deliveryMethod")}
                    value="express"
                    className="sr-only"
                  />
                  <p className="font-medium text-white">Express ⚡</p>
                  <p className="text-sm text-white/50">12-24 hours</p>
                  <p className="text-primary font-semibold mt-1">
                    +{formatLocal(PRICES.expressDelivery)}
                  </p>
                  {deliveryMethod === "express" && (
                    <Check size={20} className="text-primary mt-2" />
                  )}
                </label>
              </div>
              </div>

              {/* Gift Note */}
              <div className="glass-card p-6">
                <label className="block font-semibold mb-2 text-white">
                  Gift Note (Optional)
                </label>
                <p className="text-white/40 text-sm mb-4">
                  Optional text we can add to the video delivery message.
                </p>
                <textarea
                  {...register("giftNote")}
                  placeholder="E.g., 'You deserve all the joy!'"
                  maxLength={200}
                  rows={2}
                  className="w-full px-4 py-3 border border-white/20 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-white/5 text-white placeholder:text-white/30"
                />
              </div>

            </div>

            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24 space-y-4">

            {/* Price Summary */}
            <div className="bg-gradient-to-r from-primary/20 to-accent/20 border border-white/10 text-white p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Order Summary</h3>
                <Sparkles size={18} className="text-secondary" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Birthday Video</span>
                  <span>{formatLocal(PRICES.base)}</span>
                </div>
                {musicOption === "custom" && (
                  <div className="flex justify-between">
                    <span>Custom Song</span>
                    <span>+{formatLocal(PRICES.customSong)}</span>
                  </div>
                )}
                {deliveryMethod === "express" && (
                  <div className="flex justify-between">
                    <span>Express Delivery</span>
                    <span>+{formatLocal(PRICES.expressDelivery)}</span>
                  </div>
                )}
                <div className="border-t border-white/20 pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-secondary">{formatLocal(totalPrice)}</span>
                  </div>
                  <p className="text-white/50 text-xs mt-2">Charged in USD at checkout</p>
                  {localCurrency !== "USD" && (
                    <p className="text-white/40 text-xs mt-1">
                      Prices are estimates in your local currency.
                    </p>
                  )}
                  {ratesNote && (
                    <p className="text-white/30 text-xs mt-1">{ratesNote}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="glass-card p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("termsAccepted")}
                  className="w-5 h-5 mt-0.5 text-primary rounded"
                />
                <span className="text-sm text-white/60">
                  I agree to the{" "}
                  <a href="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </a>{" "}
                  &{" "}
                  <a href="/refund" className="text-primary hover:underline">
                    Refund Policy
                  </a>
                </span>
              </label>
              {errors.termsAccepted && (
                <p className="text-error text-sm mt-2">
                  {errors.termsAccepted.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  Pay {formatLocal(totalPrice)}
                </>
              )}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-white/50">
              <div className="flex items-center gap-2 glass-card px-3 py-2">
                <Lock size={14} className="text-accent" />
                Secure credit card
              </div>
              <div className="flex items-center gap-2 glass-card px-3 py-2">
                <ShieldCheck size={14} className="text-accent" />
                Private & safe
              </div>
              <div className="flex items-center gap-2 glass-card px-3 py-2">
                <Clock size={14} className="text-accent" />
                24h delivery
              </div>
            </div>

              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
