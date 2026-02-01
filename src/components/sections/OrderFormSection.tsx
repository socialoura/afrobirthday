"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, Check, Loader2, Lock } from "lucide-react";
import { cn, formatPrice, PRICES } from "@/lib/utils";

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
    <section id="order" className="py-20 bg-gradient-to-b from-light to-white">
      <div className="section-container">
        <div className="text-center mb-12">
          <h2 className="heading-2 mb-4">Create Your Birthday Video 🎬</h2>
          <p className="text-dark/70 max-w-xl mx-auto">
            Fill out the form below and we&apos;ll create a personalized video just for you!
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Photo Upload */}
            <div>
              <label className="block font-semibold mb-2">
                Upload your birthday person&apos;s photo 📸 <span className="text-error">*</span>
              </label>
              <div
                onDrop={handlePhotoDrop}
                onDragOver={(e) => e.preventDefault()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                  photoPreview
                    ? "border-success bg-success/5"
                    : "border-gray-300 hover:border-primary"
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
                    <Upload size={40} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-dark/70">
                      Drag & drop or{" "}
                      <span className="text-primary font-medium">browse</span>
                    </p>
                    <p className="text-sm text-dark/50 mt-1">
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
              <label className="block font-semibold mb-2">
                What would you like them to shout enthusiastically? 🎤{" "}
                <span className="text-error">*</span>
              </label>
              <textarea
                {...register("message")}
                placeholder="E.g., 'Happy 30th Birthday Sarah!'"
                maxLength={100}
                rows={3}
                className={cn(
                  "w-full px-4 py-3 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary",
                  errors.message ? "border-error" : "border-gray-300"
                )}
              />
              <div className="flex justify-between mt-1">
                <p className="text-sm text-dark/50">
                  Keep it fun, positive, and clear!
                </p>
                <p
                  className={cn(
                    "text-sm",
                    message.length > 90 ? "text-error" : "text-dark/50"
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
              <label className="block font-semibold mb-2">
                What email should we send the video to? 📧{" "}
                <span className="text-error">*</span>
              </label>
              <input
                type="email"
                {...register("email")}
                placeholder="birthday.person@email.com"
                className={cn(
                  "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary",
                  errors.email ? "border-error" : "border-gray-300"
                )}
              />
              {errors.email && (
                <p className="text-error text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Music Selection */}
            <div>
              <label className="block font-semibold mb-3">Music Selection 🎵</label>
              <div className="space-y-3">
                <label
                  className={cn(
                    "flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all",
                    musicOption === "default"
                      ? "border-primary bg-primary/5"
                      : "border-gray-300 hover:border-primary/50"
                  )}
                >
                  <input
                    type="radio"
                    {...register("musicOption")}
                    value="default"
                    className="w-5 h-5 text-primary"
                  />
                  <div className="flex-1">
                    <p className="font-medium">🎵 We choose music for you</p>
                    <p className="text-sm text-dark/60">
                      Faster order, better dancing
                    </p>
                  </div>
                  <span className="font-semibold text-primary">
                    {formatPrice(PRICES.base)}
                  </span>
                </label>

                <label
                  className={cn(
                    "flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all",
                    musicOption === "custom"
                      ? "border-primary bg-primary/5"
                      : "border-gray-300 hover:border-primary/50"
                  )}
                >
                  <input
                    type="radio"
                    {...register("musicOption")}
                    value="custom"
                    className="w-5 h-5 text-primary"
                  />
                  <div className="flex-1">
                    <p className="font-medium">🎶 I want to provide my own song</p>
                    <p className="text-sm text-dark/60">
                      Upload or paste a link
                    </p>
                  </div>
                  <span className="font-semibold text-primary">
                    +{formatPrice(PRICES.customSong)}
                  </span>
                </label>
              </div>

              {musicOption === "custom" && (
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    {...register("musicLink")}
                    placeholder="Paste YouTube or Spotify link"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="text-center text-dark/50 text-sm">or</div>
                  <div className="border border-gray-300 rounded-xl p-4">
                    <label className="cursor-pointer flex items-center justify-center gap-2">
                      <Upload size={20} className="text-gray-400" />
                      <span className="text-dark/70">
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
              <label className="block font-semibold mb-3">Delivery Speed ⚡</label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={cn(
                    "flex flex-col items-center p-4 border rounded-xl cursor-pointer transition-all text-center",
                    deliveryMethod === "standard"
                      ? "border-primary bg-primary/5"
                      : "border-gray-300 hover:border-primary/50"
                  )}
                >
                  <input
                    type="radio"
                    {...register("deliveryMethod")}
                    value="standard"
                    className="sr-only"
                  />
                  <p className="font-medium">Standard</p>
                  <p className="text-sm text-dark/60">24-48 hours</p>
                  <p className="text-primary font-semibold mt-1">Included</p>
                  {deliveryMethod === "standard" && (
                    <Check size={20} className="text-primary mt-2" />
                  )}
                </label>

                <label
                  className={cn(
                    "flex flex-col items-center p-4 border rounded-xl cursor-pointer transition-all text-center",
                    deliveryMethod === "express"
                      ? "border-primary bg-primary/5"
                      : "border-gray-300 hover:border-primary/50"
                  )}
                >
                  <input
                    type="radio"
                    {...register("deliveryMethod")}
                    value="express"
                    className="sr-only"
                  />
                  <p className="font-medium">Express ⚡</p>
                  <p className="text-sm text-dark/60">12-24 hours</p>
                  <p className="text-primary font-semibold mt-1">
                    +{formatPrice(PRICES.expressDelivery)}
                  </p>
                  {deliveryMethod === "express" && (
                    <Check size={20} className="text-primary mt-2" />
                  )}
                </label>
              </div>
            </div>

            {/* Gift Note */}
            <div>
              <label className="block font-semibold mb-2">
                Gift Note (Optional) 💝
              </label>
              <textarea
                {...register("giftNote")}
                placeholder="E.g., 'You deserve all the joy!'"
                maxLength={200}
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Price Summary */}
            <div className="bg-dark text-white p-6 rounded-2xl">
              <h3 className="font-semibold mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Birthday Video</span>
                  <span>{formatPrice(PRICES.base)}</span>
                </div>
                {musicOption === "custom" && (
                  <div className="flex justify-between">
                    <span>Custom Song</span>
                    <span>+{formatPrice(PRICES.customSong)}</span>
                  </div>
                )}
                {deliveryMethod === "express" && (
                  <div className="flex justify-between">
                    <span>Express Delivery</span>
                    <span>+{formatPrice(PRICES.expressDelivery)}</span>
                  </div>
                )}
                <div className="border-t border-white/20 pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-secondary">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("termsAccepted")}
                  className="w-5 h-5 mt-0.5 text-primary rounded"
                />
                <span className="text-sm text-dark/70">
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
                <>Pay {formatPrice(totalPrice)} with Stripe</>
              )}
            </button>

            <p className="text-center text-sm text-dark/50 flex items-center justify-center gap-1">
              <Lock size={14} />
              Secure checkout powered by Stripe 🔒
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
