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

export async function getPayPalOrder(paypalOrderId: string) {
  const accessToken = await getPayPalAccessToken();

  const res = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${paypalOrderId}`, {
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

  return (await res.json()) as unknown;
}

export async function capturePayPalOrder(paypalOrderId: string) {
  const accessToken = await getPayPalAccessToken();

  const res = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`PayPal capture failed: ${res.status} ${text}`);
  }

  const data = JSON.parse(text) as {
    status?: string;
    purchase_units?: Array<{
      reference_id?: string;
      custom_id?: string;
      payments?: {
        captures?: Array<{
          id: string;
          status?: string;
          amount?: { currency_code?: string; value?: string };
        }>;
      };
    }>;
  };

  const purchaseUnit = data.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];
  return {
    status: data.status ?? null,
    captureId: capture?.id ?? null,
    orderId: purchaseUnit?.custom_id ?? purchaseUnit?.reference_id ?? null,
    currency: capture?.amount?.currency_code ?? null,
    amount: capture?.amount?.value != null ? Number(capture.amount.value) : null,
    raw: data,
  };
}
