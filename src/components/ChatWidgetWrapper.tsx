"use client";

import dynamic from "next/dynamic";
import { useSiteSettled } from "@/lib/useSiteSettled";

const ChatWidget = dynamic(() => import("@/components/ChatWidget"), {
  ssr: false,
  loading: () => null,
});

/** The chat bubble is never needed in the first seconds: load it once settled. */
export default function ChatWidgetWrapper() {
  const settled = useSiteSettled();
  return settled ? <ChatWidget /> : null;
}
