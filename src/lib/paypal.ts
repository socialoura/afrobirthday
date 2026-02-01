type PayPalEnv = "sandbox" | "live";

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
  amountUsd: number;
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
            currency_code: "USD",
            value: input.amountUsd.toFixed(2),
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
      payments?: {
        captures?: Array<{ id: string; status?: string }>;
      };
    }>;
  };

  const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  return { status: data.status ?? null, captureId: captureId ?? null, raw: data };
}
