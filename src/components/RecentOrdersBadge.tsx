"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function RecentOrdersBadge() {
  const t = useTranslations("Hero");
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/recent-orders-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && typeof data.count === "number") {
          setCount(data.count);
        }
      })
      .catch(() => {
        // ignore — badge just doesn't render
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!count) return null;

  return (
    <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-success/10 border border-success/30 backdrop-blur-sm mb-6">
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      <span className="text-white/90 text-sm font-medium tabular-nums">
        {count === 1 ? t("recentOrders.singular", { count }) : t("recentOrders.plural", { count })}
      </span>
    </div>
  );
}
