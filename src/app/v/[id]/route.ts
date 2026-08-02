import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notReadyPage() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Video not ready yet — AfroBirthday</title>
<meta name="robots" content="noindex, nofollow" />
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#1F2121; color:#fff; font-family:system-ui,-apple-system,sans-serif; text-align:center; padding:24px; }
  .card { max-width:480px; }
  h1 { font-size:1.5rem; margin-bottom:.75rem; }
  p { color:rgba(255,255,255,.7); line-height:1.5; }
  a { color:#FF6B35; text-decoration:none; font-weight:600; }
</style>
</head>
<body>
  <div class="card">
    <h1>Your video isn't ready yet</h1>
    <p>We're still working on it — you'll receive an email as soon as it's delivered.</p>
    <p>Questions? <a href="mailto:support@afrobirthday.com">support@afrobirthday.com</a></p>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return notReadyPage();
  }

  const order = await getOrderById(id);
  if (!order || !order.final_video_url) {
    return notReadyPage();
  }

  return NextResponse.redirect(order.final_video_url, 302);
}
