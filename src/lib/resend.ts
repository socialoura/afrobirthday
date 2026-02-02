type ResendSendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmailWithResend(input: ResendSendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("Resend not configured (missing RESEND_API_KEY or RESEND_FROM_EMAIL)");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error: ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`);
  }

  return res.json().catch(() => null);
}
