"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, Check, Loader2, Lock, ShieldCheck, Clock, Sparkles, CreditCard, Wallet, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import posthog from "posthog-js";
import { cn, currencyFromLocale, type CurrencyCode, PRICES, ORDER_DRAFT_STORAGE_KEY } from "@/lib/utils";
import { useExchangeRates } from "@/lib/useExchangeRates";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import dynamic from "next/dynamic";

const InlineStripePayment = dynamic(() => import("@/components/InlineStripePayment"), { ssr: false });

type MusicEmbed = { platform: "youtube" | "spotify" | "soundcloud"; embedUrl: string };

/** Turns a pasted YouTube/Spotify/SoundCloud link into an embeddable preview URL, client-side only. */
function getMusicEmbed(link: string): MusicEmbed | null {
  const trimmed = link.trim();
  if (!trimmed) return null;

  const youtubeMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  if (youtubeMatch) {
    return { platform: "youtube", embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}` };
  }

  const spotifyMatch = trimmed.match(/open\.spotify\.com\/(?:intl-\w+\/)?track\/([A-Za-z0-9]+)/);
  if (spotifyMatch) {
    return { platform: "spotify", embedUrl: `https://open.spotify.com/embed/track/${spotifyMatch[1]}` };
  }

  if (/soundcloud\.com\//.test(trimmed)) {
    return {
      platform: "soundcloud",
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmed)}&auto_play=false&color=%23ff5500&show_teaser=false`,
    };
  }

  return null;
}

const createOrderSchema = (t: ReturnType<typeof useTranslations>) =>
  z.object({
    email: z.string().email(t("errors.emailInvalid")),
    message: z
      .string()
      .min(3, t("errors.messageMin"))
      .max(100, t("errors.messageMax")),
    paymentMethod: z.enum(["card", "paypal"]),
    musicOption: z.enum(["default", "custom"]),
    musicLink: z.string().url().optional().or(z.literal("")),
    deliveryMethod: z.enum(["standard", "express"]),
    danceExtended: z.boolean().default(false),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: t("errors.termsRequired") }),
    }),
  });

type OrderFormData = z.infer<ReturnType<typeof createOrderSchema>>;

/**
 * Downscales/re-encodes large photos client-side before upload, cutting
 * upload time and storage cost. Uses createImageBitmap's imageOrientation
 * option so EXIF-rotated phone photos don't come out sideways. Returns null
 * (meaning: use the original file) if compression isn't worth it, isn't
 * supported, or fails for any reason — never blocks the upload.
 */
async function compressImageIfPossible(file: File): Promise<File | null> {
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") {
    return null;
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const maxDim = 2000;
    const { width, height } = bitmap;

    if (width <= maxDim && height <= maxDim && file.size <= 1.5 * 1024 * 1024) {
      bitmap.close?.();
      return null;
    }

    const scale = Math.min(1, maxDim / Math.max(width, height));
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
    );
    if (!blob || blob.size >= file.size) return null;

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return null;
  }
}

function VisaLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-auto" style={{ color: "#1434CB" }}>
      <title>Visa</title>
      <path
        fill="currentColor"
        d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"
      />
    </svg>
  );
}

function MastercardLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-auto">
      <title>Mastercard</title>
      <circle cx="9" cy="12" r="7" fill="#EB001B" />
      <circle cx="15" cy="12" r="7" fill="#F79E1B" />
      <path fill="#FF5F00" d="M12 17.5a7 7 0 010-11 7 7 0 000 11z" />
    </svg>
  );
}

function AmexLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-auto" style={{ color: "#2E77BC" }}>
      <title>American Express</title>
      <rect width="24" height="24" rx="2" fill="currentColor" />
      <text x="12" y="14" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">
        AMEX
      </text>
    </svg>
  );
}

function PayPalLogo() {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PayPal"
      className="h-5 w-auto"
      style={{ color: "#003087" }}
    >
      <title>PayPal</title>
      <path
        fill="currentColor"
        d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"
      />
    </svg>
  );
}

function CardLogos() {
  return (
    <div className="flex items-center gap-2">
      <VisaLogo />
      <MastercardLogo />
      <AmexLogo />
    </div>
  );
}

function StepIndicator({
  currentStep,
  labels,
}: {
  currentStep: 1 | 2 | 3;
  labels: [string, string, string];
}) {
  return (
    <div className="flex items-start" aria-label="Progress">
      {labels.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const isComplete = step < currentStep;
        const isActive = step === currentStep;
        return (
          <div key={step} className={cn("flex items-center", step < 3 ? "flex-1" : "")}>
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors shrink-0",
                  isComplete
                    ? "bg-primary text-white"
                    : isActive
                    ? "bg-primary/15 border-2 border-primary text-primary"
                    : "bg-white/5 border border-white/15 text-white/40"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {isComplete ? <Check size={16} /> : step}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isActive || isComplete ? "text-white" : "text-white/40"
                )}
              >
                {label}
              </span>
            </div>
            {step < 3 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 mb-5",
                  isComplete ? "bg-primary" : "bg-white/10"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderFormSection() {
  const t = useTranslations("OrderForm");
  const activeLocale = useLocale();
  const orderSchema = useMemo(() => createOrderSchema(t), [t]);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  // react-hook-form + zodResolver can populate a field's error the instant
  // it first mounts (e.g. the terms checkbox has no defaultValue), before
  // the user ever tried to submit. Only surface validation errors after a
  // genuine submit attempt so nothing looks broken on arrival at step 3.
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [paymentSetupError, setPaymentSetupError] = useState<string | null>(null);
  const [localCurrency, setLocalCurrency] = useState<CurrencyCode>("USD");
  const [browserLocale, setBrowserLocale] = useState("en-US");
  const [pricing, setPricing] = useState<{ base: number; customSong: number; expressDelivery: number; danceExtended: number }>(() => ({
    base: PRICES.base,
    customSong: PRICES.customSong,
    expressDelivery: PRICES.expressDelivery,
    danceExtended: PRICES.danceExtended,
  }));
  const [priceOverrides, setPriceOverrides] = useState<
    Partial<Record<CurrencyCode, Partial<{ base: number; customSong: number; expressDelivery: number; danceExtended: number }>>>
  >({});
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
  } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const { rates, fetchedAt, loading: ratesLoading } = useExchangeRates();

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
        const data = (await res.json()) as Partial<{
          base: number;
          customSong: number;
          expressDelivery: number;
          danceExtended: number;
          overrides: Partial<Record<CurrencyCode, Partial<{ base: number; customSong: number; expressDelivery: number; danceExtended: number }>>>;
          promoEnabled: boolean;
        }>;

        if (!isMounted) return;

        setPromoEnabled(data.promoEnabled === true);

        setPricing((prev) => ({
          base: typeof data.base === "number" && Number.isFinite(data.base) ? data.base : prev.base,
          customSong:
            typeof data.customSong === "number" && Number.isFinite(data.customSong)
              ? data.customSong
              : prev.customSong,
          expressDelivery:
            typeof data.expressDelivery === "number" && Number.isFinite(data.expressDelivery)
              ? data.expressDelivery
              : prev.expressDelivery,
          danceExtended:
            typeof data.danceExtended === "number" && Number.isFinite(data.danceExtended)
              ? data.danceExtended
              : prev.danceExtended,
        }));

        if (data.overrides && typeof data.overrides === "object") {
          setPriceOverrides(data.overrides);
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

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      paymentMethod: "card",
      musicOption: "default",
      deliveryMethod: "standard",
      danceExtended: false,
    },
  });

  // react-hook-form + zodResolver can populate an error for a field the
  // instant it first mounts (e.g. the terms checkbox, since it has no
  // defaultValue) even though the user hasn't interacted with it yet or
  // tried to submit. Clear that premature error each time step 3 mounts —
  // a real submit attempt without checking it will correctly re-flag it.
  const paymentMethod = watch("paymentMethod");
  const musicOption = watch("musicOption");
  const musicLinkValue = watch("musicLink");
  const musicEmbed = useMemo(() => getMusicEmbed(musicLinkValue ?? ""), [musicLinkValue]);
  const deliveryMethod = watch("deliveryMethod");
  const danceExtended = watch("danceExtended");
  const message = watch("message") || "";
  const email = watch("email") || "";
  const termsAccepted = watch("termsAccepted");

  // The inline Stripe pay button sets a manual termsAccepted error (RHF's
  // schema validation doesn't run for it, since there's no form submit) —
  // clear it as soon as the box is actually checked so it doesn't linger.
  useEffect(() => {
    if (termsAccepted) clearErrors("termsAccepted");
  }, [termsAccepted, clearErrors]);

  // Restore an in-progress draft (email/message/options — never the photo
  // file itself, which can't be persisted) so an accidental refresh doesn't
  // wipe out what the customer already typed.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<OrderFormData>;
      // Only restore what the customer typed (safe to bring back silently).
      // Never restore paid toggles (custom song, express delivery, dance
      // extended) or the payment method — those must always be an active
      // choice on the current visit, not silently re-applied from a stale
      // draft, or someone could be charged for options they forgot about.
      if (draft.email) setValue("email", draft.email);
      if (draft.message) setValue("message", draft.message);
      if (draft.musicLink) setValue("musicLink", draft.musicLink);
    } catch {
      // ignore malformed/unavailable storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the draft on every change (debounced by the browser's own event
  // loop via react-hook-form's watch subscription — cheap, no extra timers).
  useEffect(() => {
    const subscription = watch((values) => {
      try {
        localStorage.setItem(ORDER_DRAFT_STORAGE_KEY, JSON.stringify(values));
      } catch {
        // ignore (e.g. storage disabled/full)
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const hasStartedOrderRef = useRef(false);
  const trackOrderStarted = useCallback(() => {
    if (hasStartedOrderRef.current) return;
    hasStartedOrderRef.current = true;
    posthog.capture("order_form_started");
  }, []);

  // Cached across setup attempts so returning to step 3 (or a retry) doesn't
  // re-upload files that are already sitting in storage from a prior attempt.
  const photoUrlRef = useRef<string | null>(null);
  const musicFileUrlRef = useRef<string | null>(null);
  const paymentSetupInFlightRef = useRef(false);

  const isFirstMusicOptionRender = useRef(true);
  useEffect(() => {
    if (isFirstMusicOptionRender.current) {
      isFirstMusicOptionRender.current = false;
      return;
    }
    if (musicOption === "custom") {
      posthog.capture("music_selected", { music_option: "custom" });
    }
  }, [musicOption]);

  const totalPrice =
    pricing.base +
    (musicOption === "custom" ? pricing.customSong : 0) +
    (deliveryMethod === "express" ? pricing.expressDelivery : 0) +
    (danceExtended ? pricing.danceExtended : 0);

  // Resolves a price component in the active local currency: a manual admin
  // override for that currency wins, otherwise the USD price is converted with
  // the live rate. Mirrors the server-side resolveLocalCharge logic.
  const localComponent = useMemo(() => {
    const override = priceOverrides[localCurrency];
    const rate = localCurrency === "USD" ? 1 : rates[localCurrency] ?? 1;
    return (key: "base" | "customSong" | "expressDelivery" | "danceExtended") => {
      const ov = override?.[key];
      if (typeof ov === "number" && Number.isFinite(ov) && ov >= 0) return ov;
      return pricing[key] * rate;
    };
  }, [priceOverrides, localCurrency, rates, pricing]);

  const localTotal =
    localComponent("base") +
    (musicOption === "custom" ? localComponent("customSong") : 0) +
    (deliveryMethod === "express" ? localComponent("expressDelivery") : 0) +
    (danceExtended ? localComponent("danceExtended") : 0);

  // Client-side estimate only, for display — the server always re-validates
  // the code and recomputes the discounted charge from scratch.
  const discountLocal = useMemo(() => {
    if (!appliedPromo) return 0;
    const rate = localCurrency === "USD" ? 1 : rates[localCurrency] ?? 1;
    const raw =
      appliedPromo.discountType === "percentage"
        ? localTotal * (appliedPromo.discountValue / 100)
        : appliedPromo.discountValue * rate;
    return Math.min(localTotal, Math.max(0, raw));
  }, [appliedPromo, localTotal, localCurrency, rates]);

  const finalTotal = Math.max(0, localTotal - discountLocal);

  // True when at least one component of the displayed total is auto-converted
  // (no manual override) — i.e. the live exchange rate actually applies.
  const usesLiveRate = useMemo(() => {
    if (localCurrency === "USD") return false;
    const override = priceOverrides[localCurrency];
    const overridden = (key: "base" | "customSong" | "expressDelivery" | "danceExtended") =>
      typeof override?.[key] === "number";
    if (!overridden("base")) return true;
    if (musicOption === "custom" && !overridden("customSong")) return true;
    if (deliveryMethod === "express" && !overridden("expressDelivery")) return true;
    if (danceExtended && !overridden("danceExtended")) return true;
    return false;
  }, [priceOverrides, localCurrency, musicOption, deliveryMethod, danceExtended]);

  const formatMoney = useMemo(() => {
    return (value: number) =>
      new Intl.NumberFormat(localCurrency === "USD" ? "en-US" : browserLocale, {
        style: "currency",
        currency: localCurrency,
        maximumFractionDigits: 2,
      }).format(value);
  }, [browserLocale, localCurrency]);

  const ratesNote = useMemo(() => {
    if (localCurrency === "USD") return null;
    if (ratesLoading) return t("rates.updating");
    if (!fetchedAt) return t("rates.unavailable");
    const dt = new Date(fetchedAt);
    if (Number.isNaN(dt.getTime())) return t("rates.recent");
    return t("rates.updatedAt", {
      time: dt.toLocaleString(browserLocale, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }, [browserLocale, fetchedAt, localCurrency, ratesLoading]);

  const handleApplyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code) return;

    setPromoChecking(true);
    setPromoError(null);

    try {
      const res = await fetch("/api/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as {
        valid: boolean;
        code?: string;
        discountType?: "percentage" | "fixed";
        discountValue?: number;
      };

      if (data.valid && data.code && data.discountType && typeof data.discountValue === "number") {
        setAppliedPromo({ code: data.code, discountType: data.discountType, discountValue: data.discountValue });
        posthog.capture("promo_code_applied", { code: data.code });
      } else {
        setAppliedPromo(null);
        setPromoError(t("promo.invalid"));
      }
    } catch {
      setAppliedPromo(null);
      setPromoError(t("promo.invalid"));
    } finally {
      setPromoChecking(false);
    }
  }, [promoInput, t]);

  const handleRemovePromo = useCallback(() => {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError(null);
  }, []);

  const handlePhotoDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handlePhotoSelect(file);
    }
  }, []);

  const handlePhotoSelect = async (file: File) => {
    trackOrderStarted();
    if (file.size > 5 * 1024 * 1024) {
      alert(t("alerts.photoTooLarge"));
      return;
    }

    const compressed = await compressImageIfPossible(file);
    const finalFile = compressed ?? file;

    setPhoto(finalFile);
    setPhotoError(null);
    photoUrlRef.current = null;
    setStripeClientSecret(null);
    posthog.capture("photo_selected", { file_size_kb: Math.round(finalFile.size / 1024) });
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(finalFile);
  };

  const scrollToOrderTop = () => {
    document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Manual field-scoped validation (not RHF's trigger()) — with a zod
  // resolver, trigger() re-runs the whole schema and can populate errors for
  // fields on OTHER steps (e.g. termsAccepted) before the user ever sees them.
  const goToStep2 = () => {
    let ok = true;

    if (!photo) {
      setPhotoError(t("alerts.photoMissing"));
      ok = false;
    } else {
      setPhotoError(null);
    }

    clearErrors(["message", "email"]);
    const messageValue = getValues("message") ?? "";
    if (messageValue.trim().length < 3) {
      setError("message", { type: "manual", message: t("errors.messageMin") });
      ok = false;
    } else if (messageValue.length > 100) {
      setError("message", { type: "manual", message: t("errors.messageMax") });
      ok = false;
    }
    const emailValue = getValues("email") ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setError("email", { type: "manual", message: t("errors.emailInvalid") });
      ok = false;
    }

    if (!ok) return;
    posthog.capture("order_form_step_completed", { step: 1 });
    setCurrentStep(2);
    scrollToOrderTop();
  };

  const goToStep3 = () => {
    clearErrors(["musicLink"]);
    const linkValue = (getValues("musicLink") ?? "").trim();
    if (linkValue) {
      try {
        new URL(linkValue);
      } catch {
        setError("musicLink", { type: "manual", message: t("errors.musicLinkInvalid") });
        return;
      }
    }
    posthog.capture("order_form_step_completed", { step: 2 });
    setCurrentStep(3);
    scrollToOrderTop();
  };

  const goBack = () => {
    setCurrentStep((step) => {
      if (step === 3) {
        // Leaving the payment step — any price-affecting choice below (music,
        // delivery, dance extended, promo) can change on step 1/2, so force a
        // fresh order + PaymentIntent next time step 3 is reached.
        setStripeClientSecret(null);
        setCurrentOrderId(null);
        setPaymentSetupError(null);
      }
      return step > 1 ? ((step - 1) as 1 | 2) : step;
    });
    scrollToOrderTop();
  };

  // PayPal only — its checkout is an external redirect, not a Stripe Element,
  // so it stays behind the generic form submit rather than the eager,
  // inline setup used for card (see setupCardPayment below).
  const onSubmit = async (data: OrderFormData) => {
    if (!photo) {
      alert(t("alerts.photoMissing"));
      return;
    }
    if (data.paymentMethod !== "paypal") return;

    posthog.capture("checkout_initiated", {
      payment_method: data.paymentMethod,
      music_option: musicOption,
      delivery_method: deliveryMethod,
      total_price: totalPrice,
      currency: localCurrency,
      ...(appliedPromo ? { promo_code: appliedPromo.code } : {}),
    });
    posthog.identify(data.email, { email: data.email });

    setIsSubmitting(true);

    try {
      const orderId = crypto.randomUUID();
      setCurrentOrderId(orderId);

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

      const response = await fetch("/api/paypal/create-order", {
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
          promoCode: appliedPromo?.code,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "PayPal checkout failed");
      }

      const payload = (await response.json()) as { url?: string };
      if (payload.url) {
        window.location.href = payload.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert(t("alerts.genericError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Card path: as soon as the customer reaches step 3 with "Card" selected,
  // upload the photo/music and create the order + Stripe PaymentIntent so the
  // payment form can render inline right there — no separate click-to-reveal
  // step, no popup.
  const setupCardPayment = useCallback(async () => {
    if (!photo || paymentSetupInFlightRef.current) return;
    paymentSetupInFlightRef.current = true;
    setIsPreparingPayment(true);
    setPaymentSetupError(null);

    try {
      let photoUrl = photoUrlRef.current;
      if (!photoUrl) {
        const photoForm = new FormData();
        photoForm.append("file", photo);
        photoForm.append("folder", "orders/photos");
        const photoUploadRes = await fetch("/api/upload", { method: "POST", body: photoForm });
        if (!photoUploadRes.ok) throw new Error("Photo upload failed");
        const uploaded = (await photoUploadRes.json()) as { url?: string };
        if (!uploaded.url) throw new Error("Missing photo URL");
        photoUrl = uploaded.url;
        photoUrlRef.current = photoUrl;
      }

      let musicFileUrl = musicFileUrlRef.current ?? undefined;
      if (musicFile && !musicFileUrl) {
        const musicForm = new FormData();
        musicForm.append("file", musicFile);
        musicForm.append("folder", "orders/music");
        const musicUploadRes = await fetch("/api/upload", { method: "POST", body: musicForm });
        if (!musicUploadRes.ok) throw new Error("Music upload failed");
        const uploaded = (await musicUploadRes.json()) as { url?: string };
        if (uploaded.url) {
          musicFileUrl = uploaded.url;
          musicFileUrlRef.current = uploaded.url;
        }
      }

      const orderId = crypto.randomUUID();
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          email,
          message,
          musicOption,
          musicLink: musicLinkValue,
          deliveryMethod,
          danceExtended,
          photoUrl,
          musicFileUrl,
          totalPrice,
          currency: localCurrency,
          hasCustomSong: musicOption === "custom",
          isExpress: deliveryMethod === "express",
          promoCode: appliedPromo?.code,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Payment failed");
      }

      const payload = (await response.json()) as { clientSecret?: string };
      if (!payload.clientSecret) throw new Error("Missing payment client secret");

      posthog.capture("checkout_initiated", {
        payment_method: "card",
        music_option: musicOption,
        delivery_method: deliveryMethod,
        total_price: totalPrice,
        currency: localCurrency,
        ...(appliedPromo ? { promo_code: appliedPromo.code } : {}),
      });
      posthog.identify(email, { email });

      setCurrentOrderId(orderId);
      setStripeClientSecret(payload.clientSecret);
    } catch (err) {
      console.error("Payment setup error:", err);
      setPaymentSetupError(t("payment.setupError"));
    } finally {
      setIsPreparingPayment(false);
      paymentSetupInFlightRef.current = false;
    }
  }, [
    photo,
    musicFile,
    email,
    message,
    musicOption,
    musicLinkValue,
    deliveryMethod,
    danceExtended,
    totalPrice,
    localCurrency,
    appliedPromo,
    t,
  ]);

  useEffect(() => {
    if (currentStep !== 3) return;
    if (paymentMethod !== "card") return;
    if (!photo) return;
    if (stripeClientSecret || paymentSetupError || paymentSetupInFlightRef.current) return;
    setupCardPayment();
  }, [currentStep, paymentMethod, photo, stripeClientSecret, paymentSetupError, setupCardPayment]);

  const handlePaymentSuccess = useCallback(() => {
    const orderId = currentOrderId;
    const value = finalTotal;
    const currency = localCurrency;
    const qs = new URLSearchParams();
    if (orderId) qs.set("orderId", orderId);
    if (Number.isFinite(value)) qs.set("value", String(value));
    if (currency) qs.set("currency", currency);
    window.location.href = `/${activeLocale}/success?${qs.toString()}`;
  }, [currentOrderId, finalTotal, localCurrency, activeLocale]);

  return (
    <section id="order" className="py-24 bg-dark relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

      <div className="section-container relative">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {t("badge")}
          </span>
          <h2 className="heading-2 text-white mb-4">{t("title")}</h2>
          <p className="text-white/60 max-w-xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        <div className="max-w-6xl mx-auto mb-10">
          <StepIndicator
            currentStep={currentStep}
            labels={[t("sections.video"), t("sections.customize"), t("sections.payment")]}
          />
        </div>

        <div className="max-w-6xl mx-auto">
          <form
            onSubmit={handleSubmit(onSubmit, () => setHasAttemptedSubmit(true))}
            className="grid gap-8 lg:grid-cols-12"
          >
            <div className="lg:col-span-7 space-y-6">
              {currentStep === 1 && (
              <div className="glass-card p-6 space-y-6">
                {/* Photo Upload */}
                <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <label className="block font-semibold text-white">
                      {t("photo.label")} <span className="text-error">*</span>
                    </label>
                    <p className="text-white/70 text-sm mt-1">
                      {t("photo.help")}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-white/70 text-sm">
                    <ShieldCheck size={16} className="text-accent" />
                    {t("photo.private")}
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
                        alt={t("photo.previewAlt")}
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
                      <p className="text-white/80 font-medium">{t("photo.dropHere")}</p>
                      <p className="text-white/70 text-sm mt-1">
                        {t("photo.or")} <span className="text-primary font-semibold">{t("photo.browse")}</span>
                      </p>
                      <p className="text-xs text-white/60 mt-3">
                        {t("photo.formats")}
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
                {photoError && (
                  <p className="text-error text-sm mt-2">{photoError}</p>
                )}
              </div>

              {/* Custom Message */}
              <div className="border-t border-white/10 pt-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <label htmlFor="order-message" className="block font-semibold text-white">
                      {t("message.label")} <span className="text-error">*</span>
                    </label>
                    <p className="text-white/70 text-sm mt-1">
                      {t("message.help")}
                    </p>
                  </div>
                  <div className={cn("text-sm", message.length > 90 ? "text-error" : "text-white/70")}>
                    {message.length}/100
                  </div>
                </div>

                <textarea
                  id="order-message"
                  {...register("message")}
                  onFocus={trackOrderStarted}
                  placeholder={t("message.placeholder")}
                  maxLength={100}
                  rows={3}
                  className={cn(
                    "w-full px-4 py-3 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-white/5 text-white placeholder:text-white/50 text-base min-h-[100px]",
                    errors.message ? "border-error" : "border-white/20"
                  )}
                />
                {errors.message && (
                  <p className="text-error text-sm mt-2">{errors.message.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="border-t border-white/10 pt-6">
                <label htmlFor="order-email" className="block font-semibold mb-2 text-white">
                  {t("email.label")} <span className="text-error">*</span>
                </label>
                <p className="text-white/70 text-sm mb-4">
                  {t("email.help")}
                </p>
                <input
                  id="order-email"
                  type="email"
                  {...register("email")}
                  onFocus={trackOrderStarted}
                  placeholder={t("email.placeholder")}
                  className={cn(
                    "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-white/5 text-white placeholder:text-white/50 text-base h-12",
                    errors.email ? "border-error" : "border-white/20"
                  )}
                />
                {errors.email && (
                  <p className="text-error text-sm mt-2">{errors.email.message}</p>
                )}
                </div>
              </div>
              )}

              {currentStep === 2 && (
              <>
              {/* Music Selection */}
              <div className="glass-card p-6">
                <label className="block font-semibold mb-4 text-white">{t("music.label")}</label>
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
                    <p className="font-medium text-white">🎵 {t("music.default.title")}</p>
                    <p className="text-sm text-white/80">
                      {t("music.default.subtitle")}
                    </p>
                  </div>
                  <span className="font-semibold text-primary">{t("music.default.price")}</span>
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
                    <p className="font-medium text-white">🎶 {t("music.custom.title")}</p>
                    <p className="text-sm text-white/80">
                      {t("music.custom.subtitle")}
                    </p>
                  </div>
                  <span className="font-semibold text-primary">
                    +{formatMoney(localComponent("customSong"))}
                  </span>
                </label>
              </div>

              {musicOption === "custom" && (
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    {...register("musicLink")}
                    placeholder={t("music.linkPlaceholder")}
                    className={cn(
                      "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-white/5 text-white placeholder:text-white/50 text-base h-12",
                      errors.musicLink ? "border-error" : "border-white/20"
                    )}
                  />
                  {errors.musicLink && (
                    <p className="text-error text-sm">{errors.musicLink.message}</p>
                  )}
                  {musicEmbed?.platform === "youtube" && (
                    <div className="rounded-xl overflow-hidden border border-white/20 bg-black/20">
                      <iframe
                        key={musicEmbed.embedUrl}
                        src={musicEmbed.embedUrl}
                        className="w-full aspect-video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Aperçu musique"
                      />
                    </div>
                  )}
                  {musicEmbed?.platform === "spotify" && (
                    <iframe
                      key={musicEmbed.embedUrl}
                      src={musicEmbed.embedUrl}
                      className="w-full rounded-xl"
                      style={{ height: 152 }}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      title="Aperçu musique"
                    />
                  )}
                  {musicEmbed?.platform === "soundcloud" && (
                    <div className="rounded-xl overflow-hidden border border-white/20 bg-black/20">
                      <iframe
                        key={musicEmbed.embedUrl}
                        src={musicEmbed.embedUrl}
                        className="w-full h-[166px]"
                        allow="autoplay"
                        title="Aperçu musique"
                      />
                    </div>
                  )}
                  <div className="text-center text-white/70 text-sm">{t("music.or")}</div>
                  <div className="border border-white/20 rounded-xl p-4 bg-white/5">
                    <label className="cursor-pointer flex items-center justify-center gap-2">
                      <Upload size={20} className="text-white/70" />
                      <span className="text-white/60">
                        {musicFile ? musicFile.name : t("music.filePlaceholder")}
                      </span>
                      <input
                        type="file"
                        accept="audio/mpeg,audio/wav"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setMusicFile(file);
                            musicFileUrlRef.current = null;
                            setStripeClientSecret(null);
                          }
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
                <label className="block font-semibold mb-4 text-white">{t("delivery.label")}</label>
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
                  <p className="font-medium text-white">{t("delivery.standard.title")}</p>
                  <p className="text-sm text-white/80">{t("delivery.standard.time")}</p>
                  <p className="text-primary font-semibold mt-1">{t("delivery.standard.price")}</p>
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
                  <p className="font-medium text-white">{t("delivery.express.title")}</p>
                  <p className="text-sm text-white/80">{t("delivery.express.time")}</p>
                  <p className="text-primary font-semibold mt-1">
                    +{formatMoney(localComponent("expressDelivery"))}
                  </p>
                  {deliveryMethod === "express" && (
                    <Check size={20} className="text-primary mt-2" />
                  )}
                </label>
              </div>
              </div>

              {/* Dance Extended */}
              <div className="glass-card p-6">
                <label
                  className={cn(
                    "flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all",
                    danceExtended
                      ? "border-primary bg-primary/10"
                      : "border-white/20 hover:border-primary/50 bg-white/5"
                  )}
                >
                  <input
                    type="checkbox"
                    {...register("danceExtended")}
                    className="w-5 h-5 text-primary rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">{t("danceExtended.title")}</p>
                    <p className="text-sm text-white/80">{t("danceExtended.subtitle")}</p>
                  </div>
                  <span className="font-semibold text-primary">
                    +{formatMoney(localComponent("danceExtended"))}
                  </span>
                </label>
              </div>

              {/* Promo code — settled here, before step 3, so the payment
                  form (created the instant step 3 loads) always reflects the
                  final price. */}
              {promoEnabled && (
                <div className="glass-card p-6">
                  <label htmlFor="order-promo" className="block font-semibold text-white mb-3">
                    {t("promo.label")}
                  </label>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-success bg-success/10 text-sm">
                      <span className="text-white">
                        {t("promo.appliedLabel")}: <span className="font-semibold">{appliedPromo.code}</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="text-white/70 hover:text-white underline"
                      >
                        {t("promo.remove")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        id="order-promo"
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder={t("promo.placeholder")}
                        className="flex-1 min-w-0 px-4 py-3 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-white/5 text-white placeholder:text-white/50 text-base h-12"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={promoChecking || !promoInput.trim()}
                        className="px-4 rounded-xl border border-white/20 bg-white/5 text-white font-medium hover:border-primary/50 disabled:opacity-50 shrink-0"
                      >
                        {promoChecking ? t("promo.applying") : t("promo.apply")}
                      </button>
                    </div>
                  )}
                  {promoError && <p className="text-error text-sm mt-2">{promoError}</p>}
                </div>
              )}
              </>
              )}

              {currentStep === 3 && (
              <>
              {/* Payment Method */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-primary" />
                  <label className="font-semibold text-white">{t("payment.label")}</label>
                </div>
                <p className="text-white/60 text-xs mt-1 mb-4">{t("payment.help")}</p>

                <div className="space-y-3">
                  {/* Credit card */}
                  <label
                    className={cn(
                      "relative flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-all",
                      paymentMethod === "card"
                        ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-lg shadow-primary/10"
                        : "border-white/15 hover:border-primary/40 hover:bg-white/[0.07] bg-white/5"
                    )}
                  >
                    <input
                      type="radio"
                      {...register("paymentMethod")}
                      value="card"
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        paymentMethod === "card" ? "border-primary bg-primary" : "border-white/30"
                      )}
                    >
                      {paymentMethod === "card" && (
                        <Check size={12} strokeWidth={3} className="text-white" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                        paymentMethod === "card" ? "bg-primary/20" : "bg-white/10"
                      )}
                    >
                      <CreditCard
                        size={20}
                        className={paymentMethod === "card" ? "text-primary" : "text-white/60"}
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{t("payment.card.title")}</p>
                      <p className="text-xs text-white/60">{t("payment.card.subtitle")}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-2 shrink-0">
                      <CardLogos />
                    </div>
                  </label>

                  {/* PayPal */}
                  <label
                    className={cn(
                      "relative flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-all",
                      paymentMethod === "paypal"
                        ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-lg shadow-primary/10"
                        : "border-white/15 hover:border-primary/40 hover:bg-white/[0.07] bg-white/5"
                    )}
                  >
                    <input
                      type="radio"
                      {...register("paymentMethod")}
                      value="paypal"
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        paymentMethod === "paypal" ? "border-primary bg-primary" : "border-white/30"
                      )}
                    >
                      {paymentMethod === "paypal" && (
                        <Check size={12} strokeWidth={3} className="text-white" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                        paymentMethod === "paypal" ? "bg-primary/20" : "bg-white/10"
                      )}
                    >
                      <Wallet
                        size={20}
                        className={paymentMethod === "paypal" ? "text-primary" : "text-white/60"}
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">PayPal</p>
                      <p className="text-xs text-white/60">{t("payment.paypal.subtitle")}</p>
                    </div>
                    <div className="hidden sm:flex items-center bg-white rounded-lg px-2.5 py-2 shrink-0">
                      <PayPalLogo />
                    </div>
                  </label>
                </div>

                {/* Inline Stripe payment — appears the moment the order/
                    PaymentIntent is ready, right here in step 3, styled to
                    match the rest of the form (no popup). */}
                {paymentMethod === "card" && (
                  <>
                    {paymentSetupError ? (
                      <div className="mt-5 pt-5 border-t border-white/10 text-center flex flex-col items-center gap-3">
                        <AlertTriangle size={22} className="text-primary" aria-hidden="true" />
                        <p className="text-sm text-white/80">{paymentSetupError}</p>
                        <button
                          type="button"
                          onClick={setupCardPayment}
                          className="btn-secondary py-2.5 px-5 text-sm"
                        >
                          {t("payment.retry")}
                        </button>
                      </div>
                    ) : !stripeClientSecret ? (
                      <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-center gap-3 text-white/60 text-sm">
                        <Loader2 size={18} className="animate-spin text-primary" />
                        {t("payment.preparing")}
                      </div>
                    ) : (
                      <InlineStripePayment
                        clientSecret={stripeClientSecret}
                        amount={formatMoney(finalTotal)}
                        orderId={currentOrderId}
                        termsAccepted={termsAccepted === true}
                        onTermsRequired={() => {
                          setHasAttemptedSubmit(true);
                          setError("termsAccepted", { type: "manual", message: t("errors.termsRequired") });
                          document
                            .getElementById("order-terms")
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        onSuccess={handlePaymentSuccess}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Terms */}
              <div id="order-terms" className="glass-card p-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("termsAccepted")}
                    className="w-6 h-6 mt-0.5 text-primary rounded flex-shrink-0"
                  />
                  <span className="text-sm text-white/60">
                    {t("terms.prefix")}{" "}
                    <Link href="/terms" className="text-primary hover:underline">
                      {t("terms.terms")}
                    </Link>{" "}
                    {t("terms.and")}{" "}
                    <Link href="/refund" className="text-primary hover:underline">
                      {t("terms.refund")}
                    </Link>
                  </span>
                </label>
                {hasAttemptedSubmit && errors.termsAccepted && (
                  <p className="text-error text-sm mt-2">
                    {errors.termsAccepted.message}
                  </p>
                )}
              </div>
              </>
              )}

              {/* Step navigation */}
              <div className="flex gap-3 pt-2">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="btn-secondary py-4 px-6 flex items-center justify-center gap-2 shrink-0"
                  >
                    <ArrowLeft size={18} />
                    {t("nav.back")}
                  </button>
                )}

                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={currentStep === 1 ? goToStep2 : goToStep3}
                    className="btn-primary flex-1 py-4 text-base flex items-center justify-center gap-2 min-h-[56px]"
                  >
                    {t("nav.next")}
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  // Card pays inline above (InlineStripePayment carries its own
                  // pay button); only PayPal — an external redirect — still
                  // needs this generic submit.
                  paymentMethod === "paypal" && (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary flex-1 py-4 text-base md:text-lg flex items-center justify-center gap-2 min-h-[56px]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          {t("submit.processing")}
                        </>
                      ) : (
                        <>
                          <Wallet size={18} />
                          {t("submit.paypal")}
                        </>
                      )}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24 space-y-4">

            {/* Price Summary */}
            <div className="bg-gradient-to-r from-primary/20 to-accent/20 border border-white/10 text-white p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{t("summary.title")}</h3>
                <Sparkles size={18} className="text-secondary" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{t("summary.items.base")}</span>
                  <span>{formatMoney(localComponent("base"))}</span>
                </div>
                {musicOption === "custom" && (
                  <div className="flex justify-between">
                    <span>{t("summary.items.customSong")}</span>
                    <span>+{formatMoney(localComponent("customSong"))}</span>
                  </div>
                )}
                {deliveryMethod === "express" && (
                  <div className="flex justify-between">
                    <span>{t("summary.items.express")}</span>
                    <span>+{formatMoney(localComponent("expressDelivery"))}</span>
                  </div>
                )}
                {danceExtended && (
                  <div className="flex justify-between">
                    <span>{t("summary.items.danceExtended")}</span>
                    <span>+{formatMoney(localComponent("danceExtended"))}</span>
                  </div>
                )}
                {appliedPromo && discountLocal > 0 && (
                  <div className="flex justify-between text-success">
                    <span>{t("summary.discount", { code: appliedPromo.code })}</span>
                    <span>-{formatMoney(discountLocal)}</span>
                  </div>
                )}
                <div className="border-t border-white/20 pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t("summary.total")}</span>
                    <span className="text-secondary">{formatMoney(finalTotal)}</span>
                  </div>
                  {usesLiveRate && ratesNote && (
                    <p className="text-white/60 text-xs mt-2">{ratesNote}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-2 glass-card px-3 py-4 text-center">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/15 border border-accent/30">
                  <Lock size={18} className="text-accent" />
                </span>
                <span className="text-xs font-medium text-white/80 leading-tight">
                  {t("trust.secure")}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 glass-card px-3 py-4 text-center">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-success/15 border border-success/30">
                  <ShieldCheck size={18} className="text-success" />
                </span>
                <span className="text-xs font-medium text-white/80 leading-tight">
                  {t("trust.private")}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 glass-card px-3 py-4 text-center">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary/15 border border-secondary/30">
                  <Clock size={18} className="text-secondary" />
                </span>
                <span className="text-xs font-medium text-white/80 leading-tight">
                  {t("trust.delivery")}
                </span>
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
