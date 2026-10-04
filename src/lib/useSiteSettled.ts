"use client";

import { useEffect, useState } from "react";
import { whenPageSettled } from "@/lib/pageSettled";

/** True once third-party code may load (see pageSettled.ts). */
export function useSiteSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let alive = true;
    whenPageSettled().then(() => {
      if (alive) setSettled(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return settled;
}
