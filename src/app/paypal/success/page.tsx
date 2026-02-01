import { Suspense } from "react";
import PayPalSuccessClient from "./PayPalSuccessClient";

export default function PayPalSuccessPage() {
  return (
    <Suspense>
      <PayPalSuccessClient />
    </Suspense>
  );
}
