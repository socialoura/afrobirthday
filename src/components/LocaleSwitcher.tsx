"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_LABELS, locales, type AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

export default function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [isOpen]);

  const change = (next: AppLocale) => {
    if (next === locale) {
      setIsOpen(false);
      return;
    }
    startTransition(() => {
      router.replace(pathname, { locale: next });
      setIsOpen(false);
    });
  };

  const current = LOCALE_LABELS[locale];

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Change language"
        disabled={isPending}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Globe size={16} />
        <span className="text-sm font-medium">{current.native}</span>
        <ChevronDown
          size={14}
          className={cn("transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && (
        <ul
          role="listbox"
          aria-label="Languages"
          className="absolute end-0 mt-2 min-w-[12rem] max-h-[60vh] overflow-y-auto rounded-2xl bg-dark/95 backdrop-blur-xl border border-white/10 shadow-2xl py-1 z-50"
        >
          {locales.map((code) => {
            const label = LOCALE_LABELS[code];
            const selected = code === locale;
            return (
              <li key={code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => change(code)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors",
                    selected
                      ? "text-primary bg-primary/10"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-white/40 w-6">
                      {label.flag}
                    </span>
                    {label.native}
                  </span>
                  {selected && <Check size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
