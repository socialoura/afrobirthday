import type { CurrencyCode } from "@/lib/utils";

type PayPalEnv = "sandbox" | "live";

// Intersection between the currencies displayed by AfroBirthday and the
// currencies accepted by PayPal Checkout. Unsupported local currencies keep
// the historical USD fallback instead of making PayPal reject the order.
const PAYPAL_SUPPORTED_CURRENCIES = new Set<CurrencyCode>([
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "BRL",
  "MXN",
  "CNY",
  "JPY",
]);

export function isPayPalSupportedCurrency(currency: CurrencyCode): boolean {
  return PAYPAL_SUPPORTED_CURRENCIES.has(currency);
}

function getPayPalEnv(): PayPalEnv {
  const env = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();
  return env === "live" ? "live" : "sandbox";
}

function getPayPalBaseUrl() {
  return getPayPalEnv() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal token request failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function createPayPalOrder(input: {
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  returnUrl: string;
  cancelUrl: string;
}) {
  const accessToken = await getPayPalAccessToken();

  const res = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.orderId,
          custom_id: input.orderId,
          amount: {
            currency_code: input.currency,
            value: input.amount.toFixed(input.currency === "JPY" ? 0 : 2),
          },
        },
      ],
      application_context: {
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        user_action: "PAY_NOW",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal create order failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    id: string;
    links?: Array<{ href: string; rel: string; method?: string }>;
  };

  const approveUrl = data.links?.find((l) => l.rel === "approve")?.href;
  if (!approveUrl) {
    throw new Error("PayPal order missing approve link");
  }

  return { paypalOrderId: data.id, approveUrl };
}

type PayPalOrderPayload = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: {
      captures?: Array<{
        id: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
};

export type PayPalOrderSummary = {
  /** PayPal order status: CREATED, APPROVED, COMPLETED, ... */
  status: string | null;
  captureId: string | null;
  captureStatus: string | null;
  /** Our order id, from custom_id / reference_id. */
  orderId: string | null;
  currency: string | null;
  amount: number | null;
};

function summarizePayPalOrder(data: PayPalOrderPayload): PayPalOrderSummary {
  const purchaseUnit = data.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];
  const amount = capture?.amount ?? purchaseUnit?.amount;
  return {
    status: data.status ?? null,
    captureId: capture?.id ?? null,
    captureStatus: capture?.status ?? null,
    orderId: purchaseUnit?.custom_id ?? purchaseUnit?.reference_id ?? null,
    currency: amount?.currency_code ?? null,
    amount: amount?.value != null ? Number(amount.value) : null,
  };
}

export async function getPayPalOrder(paypalOrderId: string): Promise<PayPalOrderSummary> {
  const accessToken = await getPayPalAccessToken();

  const res = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal get order failed: ${res.status} ${text}`);
  }

  return summarizePayPalOrder((await res.json()) as PayPalOrderPayload);
}

/**
 * Captures an approved order. A second capture (page refresh, webhook racing
 * the return page, retry after a crash) gets 422 ORDER_ALREADY_CAPTURED from
 * PayPal: that is not a failure, so the existing capture is returned instead.
 */
export async function capturePayPalOrder(paypalOrderId: string): Promise<PayPalOrderSummary> {
  const accessToken = await getPayPalAccessToken();

  const res = await fetch(
    `${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        // Makes concurrent/retried captures of the same order idempotent.
        "PayPal-Request-Id": `capture-${paypalOrderId}`,
      },
    }
  );

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    if (res.status === 422 && text.includes("ORDER_ALREADY_CAPTURED")) {
      return getPayPalOrder(paypalOrderId);
    }
    throw new Error(`PayPal capture failed: ${res.status} ${text}`);
  }

  return summarizePayPalOrder(JSON.parse(text) as PayPalOrderPayload);
}

/**
 * Verifies a webhook delivery with PayPal's verify-webhook-signature API.
 * Requires PAYPAL_WEBHOOK_ID (shown next to the webhook in the developer
 * dashboard).
 */
export async function verifyPayPalWebhook(
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("PAYPAL_WEBHOOK_ID is not configured");
    return false;
  }
  const accessToken = await getPayPalAccessToken();
  const res = await fetch(`${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
