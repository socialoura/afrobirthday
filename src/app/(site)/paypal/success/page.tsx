import { Suspense } from "react";
import PayPalSuccessClient from "./PayPalSuccessClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment Successful",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function PayPalSuccessPage() {
  return (
    <Suspense>
      <PayPalSuccessClient />
    </Suspense>
  );
}
