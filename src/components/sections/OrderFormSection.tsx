"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, Check, Loader2, Lock, ShieldCheck, Clock, Sparkles, CreditCard, Wallet } from "lucide-react";
import posthog from "posthog-js";
import { cn, currencyFromLocale, type CurrencyCode, PRICES, ORDER_DRAFT_STORAGE_KEY } from "@/lib/utils";
import { useExchangeRates } from "@/lib/useExchangeRates";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import dynamic from "next/dynamic";

const CustomPaymentModal = dynamic(() => import("@/components/CustomPaymentModal"), { ssr: false });

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
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Visa"
      className="h-5 w-8 shrink-0 text-white/85"
    >
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
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Mastercard"
      className="h-5 w-8 shrink-0 text-white/85"
    >
      <title>Mastercard</title>
      <path
        fill="currentColor"
        d="M11.343 18.031c.058.049.12.098.181.146-1.177.783-2.59 1.238-4.107 1.238C3.32 19.416 0 16.096 0 12c0-4.095 3.32-7.416 7.416-7.416 1.518 0 2.931.456 4.105 1.238-.06.051-.12.098-.165.15C9.6 7.489 8.595 9.688 8.595 12c0 2.311 1.001 4.51 2.748 6.031zm5.241-13.447c-1.52 0-2.931.456-4.105 1.238.06.051.12.098.165.15C14.4 7.489 15.405 9.688 15.405 12c0 2.31-1.001 4.507-2.748 6.031-.058.049-.12.098-.181.146 1.177.783 2.588 1.238 4.107 1.238C20.68 19.416 24 16.096 24 12c0-4.094-3.32-7.416-7.416-7.416zM12 6.174c-.096.075-.189.15-.28.231C10.156 7.764 9.169 9.765 9.169 12c0 2.236.987 4.236 2.551 5.595.09.08.185.158.28.232.096-.074.189-.152.28-.232 1.563-1.359 2.551-3.359 2.551-5.595 0-2.235-.987-4.236-2.551-5.595-.09-.08-.184-.156-.28-.231z"
      />
    </svg>
  );
}

function AmexLogo() {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="American Express"
      className="h-5 w-8 shrink-0 text-white/85"
    >
      <title>American Express</title>
      <path
        fill="currentColor"
        d="M16.015 14.378c0-.32-.135-.496-.344-.622-.21-.12-.464-.135-.81-.135h-1.543v2.82h.675v-1.027h.72c.24 0 .39.024.478.125.12.13.104.38.104.55v.35h.66v-.555c-.002-.25-.017-.376-.108-.516-.06-.08-.18-.18-.33-.234l.02-.008c.18-.072.48-.297.48-.747zm-.87.407l-.028-.002c-.09.053-.195.058-.33.058h-.81v-.63h.824c.12 0 .24 0 .33.05.098.048.156.147.15.255 0 .12-.045.215-.134.27zM20.297 15.837H19v.6h1.304c.676 0 1.05-.278 1.05-.884 0-.28-.066-.448-.187-.582-.153-.133-.392-.193-.73-.207l-.376-.015c-.104 0-.18 0-.255-.03-.09-.03-.15-.105-.15-.21 0-.09.017-.166.09-.21.083-.046.177-.066.272-.06h1.23v-.602h-1.35c-.704 0-.958.437-.958.84 0 .9.776.855 1.407.87.104 0 .18.015.225.06.046.03.082.106.082.18 0 .077-.035.15-.08.18-.06.053-.15.07-.277.07zM0 0v10.096L.81 8.22h1.75l.225.464V8.22h2.043l.45 1.02.437-1.013h6.502c.295 0 .56.057.756.236v-.23h1.787v.23c.307-.17.686-.23 1.12-.23h2.606l.24.466v-.466h1.918l.254.465v-.466h1.858v3.948H20.87l-.36-.6v.585h-2.353l-.256-.63h-.583l-.27.614h-1.213c-.48 0-.84-.104-1.08-.24v.24h-2.89v-.884c0-.12-.03-.12-.105-.135h-.105v1.036H6.067v-.48l-.21.48H4.69l-.202-.48v.465H2.235l-.256-.624H1.4l-.256.624H0V24h23.786v-7.108c-.27.135-.613.18-.973.18H21.09v-.255c-.21.165-.57.255-.914.255H14.71v-.9c0-.12-.018-.12-.12-.12h-.075v1.022h-1.8v-1.066c-.298.136-.643.15-.928.136h-.214v.915h-2.18l-.54-.617-.57.6H4.742v-3.93h3.61l.518.602.554-.6h2.412c.28 0 .74.03.942.225v-.24h2.177c.202 0 .644.045.903.225v-.24h3.265v.24c.163-.164.508-.24.803-.24h1.89v.24c.194-.15.464-.24.84-.24h1.176V0H0zM21.156 14.955c.004.005.006.012.01.016.01.01.024.01.032.02l-.042-.035zM23.828 13.082h.065v.555h-.065zM23.865 15.03v-.005c-.03-.025-.046-.048-.075-.07-.15-.153-.39-.215-.764-.225l-.36-.012c-.12 0-.194-.007-.27-.03-.09-.03-.15-.105-.15-.21 0-.09.03-.16.09-.204.076-.045.15-.05.27-.05h1.223v-.588h-1.283c-.69 0-.96.437-.96.84 0 .9.78.855 1.41.87.104 0 .18.015.224.06.046.03.076.106.076.18 0 .07-.034.138-.09.18-.045.056-.136.07-.27.07h-1.288v.605h1.287c.42 0 .734-.118.9-.36h.03c.09-.134.135-.3.135-.523 0-.24-.045-.39-.135-.526zM18.597 14.208v-.583h-2.235V16.458h2.235v-.585h-1.57v-.57h1.533v-.584h-1.532v-.51M13.51 8.787h.685V11.6h-.684zM13.126 9.543l-.007.006c0-.314-.13-.5-.34-.624-.217-.125-.47-.135-.81-.135H10.43v2.82h.674v-1.034h.72c.24 0 .39.03.487.12.122.136.107.378.107.548v.354h.677v-.553c0-.25-.016-.375-.11-.516-.09-.107-.202-.19-.33-.237.172-.07.472-.3.472-.75zm-.855.396h-.015c-.09.054-.195.056-.33.056H11.1v-.623h.825c.12 0 .24.004.33.05.09.04.15.128.15.25s-.047.22-.134.266zM15.92 9.373h.632v-.6h-.644c-.464 0-.804.105-1.02.33-.286.3-.362.69-.362 1.11 0 .512.123.833.36 1.074.232.238.645.31.97.31h.78l.255-.627h1.39l.262.627h1.36v-2.11l1.272 2.11h.95l.002.002V8.786h-.684v1.963l-1.18-1.96h-1.02V11.4L18.11 8.744h-1.004l-.943 2.22h-.3c-.177 0-.362-.03-.468-.134-.125-.15-.186-.36-.186-.662 0-.285.08-.51.194-.63.133-.135.272-.165.516-.165zm1.668-.108l.464 1.118v.002h-.93l.466-1.12zM2.38 10.97l.254.628H4V9.393l.972 2.205h.584l.973-2.202.015 2.202h.69v-2.81H6.118l-.807 1.904-.876-1.905H3.343v2.663L2.205 8.787h-.997L.01 11.597h.72l.26-.626h1.39zm-.688-1.705l.46 1.118-.003.002h-.915l.457-1.12zM11.856 13.62H9.714l-.85.923-.825-.922H5.346v2.82H8l.855-.932.824.93h1.302v-.94h.838c.6 0 1.17-.164 1.17-.945l-.006-.003c0-.78-.598-.93-1.128-.93zM7.67 15.853l-.014-.002H6.02v-.557h1.47v-.574H6.02v-.51H7.7l.733.82-.764.824zm2.642.33l-1.03-1.147 1.03-1.108v2.253zm1.553-1.258h-.885v-.717h.885c.24 0 .42.098.42.344 0 .243-.15.372-.42.372zM9.967 9.373v-.586H7.73V11.6h2.237v-.58H8.4v-.564h1.527V9.88H8.4v-.507"
      />
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
      className="h-5 w-8 shrink-0 text-white/85"
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

export default function OrderFormSection() {
  const t = useTranslations("OrderForm");
  const activeLocale = useLocale();
  const orderSchema = useMemo(() => createOrderSchema(t), [t]);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [localCurrency, setLocalCurrency] = useState<CurrencyCode>("USD");
  const [browserLocale, setBrowserLocale] = useState("en-US");
  const [pricing, setPricing] = useState<{ base: number; customSong: number; expressDelivery: number }>(() => ({
    base: PRICES.base,
    customSong: PRICES.customSong,
    expressDelivery: PRICES.expressDelivery,
  }));
  const [priceOverrides, setPriceOverrides] = useState<
    Partial<Record<CurrencyCode, Partial<{ base: number; customSong: number; expressDelivery: number }>>>
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
          overrides: Partial<Record<CurrencyCode, Partial<{ base: number; customSong: number; expressDelivery: number }>>>;
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

  useEffect(() => {
    if (!isStripeModalOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isStripeModalOpen]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      paymentMethod: "card",
      musicOption: "default",
      deliveryMethod: "standard",
    },
  });

  const paymentMethod = watch("paymentMethod");
  const musicOption = watch("musicOption");
  const deliveryMethod = watch("deliveryMethod");
  const message = watch("message") || "";

  // Restore an in-progress draft (email/message/options — never the photo
  // file itself, which can't be persisted) so an accidental refresh doesn't
  // wipe out what the customer already typed.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<OrderFormData>;
      if (draft.email) setValue("email", draft.email);
      if (draft.message) setValue("message", draft.message);
      if (draft.musicOption) setValue("musicOption", draft.musicOption);
      if (draft.musicLink) setValue("musicLink", draft.musicLink);
      if (draft.deliveryMethod) setValue("deliveryMethod", draft.deliveryMethod);
      if (draft.paymentMethod) setValue("paymentMethod", draft.paymentMethod);
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
    (deliveryMethod === "express" ? pricing.expressDelivery : 0);

  // Resolves a price component in the active local currency: a manual admin
  // override for that currency wins, otherwise the USD price is converted with
  // the live rate. Mirrors the server-side resolveLocalCharge logic.
  const localComponent = useMemo(() => {
    const override = priceOverrides[localCurrency];
    const rate = localCurrency === "USD" ? 1 : rates[localCurrency] ?? 1;
    return (key: "base" | "customSong" | "expressDelivery") => {
      const ov = override?.[key];
      if (typeof ov === "number" && Number.isFinite(ov) && ov >= 0) return ov;
      return pricing[key] * rate;
    };
  }, [priceOverrides, localCurrency, rates, pricing]);

  const localTotal =
    localComponent("base") +
    (musicOption === "custom" ? localComponent("customSong") : 0) +
    (deliveryMethod === "express" ? localComponent("expressDelivery") : 0);

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
    const overridden = (key: "base" | "customSong" | "expressDelivery") =>
      typeof override?.[key] === "number";
    if (!overridden("base")) return true;
    if (musicOption === "custom" && !overridden("customSong")) return true;
    if (deliveryMethod === "express" && !overridden("expressDelivery")) return true;
    return false;
  }, [priceOverrides, localCurrency, musicOption, deliveryMethod]);

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
    posthog.capture("photo_selected", { file_size_kb: Math.round(finalFile.size / 1024) });
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(finalFile);
  };

  const onSubmit = async (data: OrderFormData) => {
    if (!photo) {
      alert(t("alerts.photoMissing"));
      return;
    }

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

      if (data.paymentMethod === "paypal") {
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
        return;
      }

      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          ...data,
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
      if (!payload.clientSecret) {
        throw new Error("Missing payment client secret");
      }

      setStripeClientSecret(payload.clientSecret);
      setIsStripeModalOpen(true);
    } catch (error) {
      console.error("Checkout error:", error);
      alert(t("alerts.genericError"));
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
            {t("badge")}
          </span>
          <h2 className="heading-2 text-white mb-4">{t("title")}</h2>
          <p className="text-white/60 max-w-xl mx-auto">
            {t("subtitle")}
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
              </div>

              {/* Custom Message */}
              <div className="glass-card p-6">
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
              <div className="glass-card p-6">
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
                    className="w-full px-4 py-3 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-white/5 text-white placeholder:text-white/50 text-base h-12"
                  />
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

            </div>

            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24 space-y-4">

            {/* Payment Method */}
            <div className="glass-card p-5">
              <label className="block font-semibold text-white">{t("payment.label")}</label>
              <p className="text-white/60 text-xs mt-1 mb-4">{t("payment.help")}</p>
              <div className="space-y-3">
                {/* Credit card */}
                <label
                  className={cn(
                    "relative flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all",
                    paymentMethod === "card"
                      ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                      : "border-white/20 hover:border-primary/50 hover:bg-white/[0.07] bg-white/5"
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
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{t("payment.card.title")}</p>
                    <p className="text-xs text-white/70">{t("payment.card.subtitle")}</p>
                  </div>
                  <CardLogos />
                </label>

                {/* PayPal */}
                <label
                  className={cn(
                    "relative flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all",
                    paymentMethod === "paypal"
                      ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                      : "border-white/20 hover:border-primary/50 hover:bg-white/[0.07] bg-white/5"
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
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">PayPal</p>
                    <p className="text-xs text-white/70">{t("payment.paypal.subtitle")}</p>
                  </div>
                  <PayPalLogo />
                </label>
              </div>
            </div>

            {/* Promo code */}
            {promoEnabled && (
              <div className="glass-card p-5">
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

            {/* Terms */}
            <div className="glass-card p-5">
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
              className="w-full btn-primary py-4 text-base md:text-lg flex items-center justify-center gap-2 min-h-[56px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {t("submit.processing")}
                </>
              ) : (
                <>
                  {paymentMethod === "paypal" ? <Wallet size={18} /> : <CreditCard size={18} />}
                  {paymentMethod === "paypal"
                    ? t("submit.paypal")
                    : t("submit.pay", { amount: formatMoney(finalTotal) })}
                </>
              )}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-white/80">
              <div className="flex items-center gap-2 glass-card px-3 py-2">
                <Lock size={14} className="text-accent" />
                {t("trust.secure")}
              </div>
              <div className="flex items-center gap-2 glass-card px-3 py-2">
                <ShieldCheck size={14} className="text-accent" />
                {t("trust.private")}
              </div>
              <div className="flex items-center gap-2 glass-card px-3 py-2">
                <Clock size={14} className="text-accent" />
                {t("trust.delivery")}
              </div>
            </div>

              </div>
            </div>
          </form>
        </div>
      </div>

      {stripeClientSecret && (
        <CustomPaymentModal
          isOpen={isStripeModalOpen}
          onClose={() => {
            setIsStripeModalOpen(false);
            setStripeClientSecret(null);
            setCurrentOrderId(null);
          }}
          clientSecret={stripeClientSecret}
          amount={formatMoney(finalTotal)}
          productName={t("productName")}
          orderId={currentOrderId}
          onSuccess={() => {
            const orderId = currentOrderId;
            const value = finalTotal;
            const currency = localCurrency;
            const qs = new URLSearchParams();
            if (orderId) qs.set("orderId", orderId);
            if (Number.isFinite(value)) qs.set("value", String(value));
            if (currency) qs.set("currency", currency);
            window.location.href = `/${activeLocale}/success?${qs.toString()}`;
          }}
        />
      )}
    </section>
  );
}
