"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, Check, Loader2, Lock } from "lucide-react";
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
  const { rates } = useExchangeRates();

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
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
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

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-8 space-y-6">
            {/* Photo Upload */}
            <div>
              <label className="block font-semibold mb-2 text-white">
                Upload Photo <span className="text-error">*</span>
              </label>
              <div
                onDrop={handlePhotoDrop}
                onDragOver={(e) => e.preventDefault()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
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
                      className="max-h-48 rounded-lg mx-auto"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoPreview(null);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-error text-white rounded-full flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload size={40} className="mx-auto mb-2 text-white/40" />
                    <p className="text-white/70">
                      Drag & drop or{" "}
                      <span className="text-primary font-medium">browse</span>
                    </p>
                    <p className="text-sm text-white/40 mt-1">
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
            <div>
              <label className="block font-semibold mb-2 text-white">
                Birthday Message <span className="text-error">*</span>
              </label>
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
              <div className="flex justify-between mt-1">
                <p className="text-sm text-white/40">
                  E.g., "Happy 30th Birthday Sarah!"
                </p>
                <p
                  className={cn(
                    "text-sm",
                    message.length > 90 ? "text-error" : "text-white/40"
                  )}
                >
                  {message.length}/100
                </p>
              </div>
              {errors.message && (
                <p className="text-error text-sm mt-1">{errors.message.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block font-semibold mb-2 text-white">
                Email <span className="text-error">*</span>
              </label>
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
                <p className="text-error text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Music Selection */}
            <div>
              <label className="block font-semibold mb-3 text-white">Music Selection</label>
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
                  <span className="font-semibold text-primary">
                    {formatLocal(PRICES.base)}
                  </span>
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
            <div>
              <label className="block font-semibold mb-3 text-white">Delivery Speed</label>
              <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block font-semibold mb-2 text-white">
                Gift Note (Optional)
              </label>
              <textarea
                {...register("giftNote")}
                placeholder="E.g., 'You deserve all the joy!'"
                maxLength={200}
                rows={2}
                className="w-full px-4 py-3 border border-white/20 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-white/5 text-white placeholder:text-white/30"
              />
            </div>

            {/* Price Summary */}
            <div className="bg-gradient-to-r from-primary/20 to-accent/20 border border-white/10 text-white p-6 rounded-2xl">
              <h3 className="font-semibold mb-4">Order Summary</h3>
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
                </div>
              </div>
            </div>

            {localCurrency !== "USD" && (
              <p className="text-center text-sm text-white/40">
                Prices are estimates in your local currency. You will be charged in USD.
              </p>
            )}

            {/* Terms */}
            <div>
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
                <p className="text-error text-sm mt-1">
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
                <>Pay {formatPrice(totalPrice, "USD")} with Stripe</>
              )}
            </button>

            <p className="text-center text-sm text-white/40 flex items-center justify-center gap-1">
              <Lock size={14} />
              Secure checkout powered by Stripe 🔒
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
