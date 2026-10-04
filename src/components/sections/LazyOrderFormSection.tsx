"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const OrderFormSection = dynamic(() => import("@/components/sections/OrderFormSection"), {
  ssr: false,
});

/**
 * The order form is by far the largest client component on the page (form
 * library, validation, upload and payment logic). Hydrating it with the rest
 * of the page kept slow phones busy for seconds before the hero could paint
 * or respond (TBT ~2.9 s on a 4x-throttled phone, Oct 2026). It now loads as
 * soon as the browser is idle, when the section gets near the viewport, or
 * immediately when someone follows an #order link — whichever comes first.
 */
export default function LazyOrderFormSection() {
  const [load, setLoad] = useState(false);
  const placeholderRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (load) return;
    if (window.location.hash === "#order") {
      setLoad(true);
      return;
    }

    const start = () => setLoad(true);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) start();
      },
      { rootMargin: "1200px 0px" }
    );
    if (placeholderRef.current) observer.observe(placeholderRef.current);

    const onHash = () => {
      if (window.location.hash === "#order") start();
    };
    window.addEventListener("hashchange", onHash);

    const ric =
      (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback;
    const idleId = ric ? ric(start, { timeout: 4000 }) : window.setTimeout(start, 2500);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", onHash);
      const cancel = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (ric && cancel) cancel(idleId);
      else window.clearTimeout(idleId);
    };
  }, [load]);

  // The placeholder was the #order target; once the real form replaces it,
  // land the visitor on the form again so the swap does not leave them mid-page.
  useEffect(() => {
    if (!load || window.location.hash !== "#order") return;
    const id = window.setTimeout(() => {
      document.getElementById("order")?.scrollIntoView({ block: "start" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [load]);

  return <div id="order-section">{load ? <OrderFormSection /> : <Placeholder sectionRef={placeholderRef} />}</div>;
}

function Placeholder({ sectionRef }: { sectionRef: React.RefObject<HTMLElement> }) {
  return (
    <section
      id="order"
      ref={sectionRef}
      className="py-24 bg-dark relative min-h-[1400px] flex items-start justify-center"
      aria-busy="true"
    >
      <Loader2 size={28} className="mt-24 animate-spin text-white/40" aria-hidden="true" />
    </section>
  );
}
