import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api-auth";
import { updateZapiWebhook } from "@/lib/zapi";

function buildWebhookUrl(request: NextRequest) {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const secret = process.env.WEBHOOK_SECRET;
  const url = new URL("/api/webhooks/zapi", appUrl);
  if (secret) url.searchParams.set("secret", secret);
  return url.toString();
}

export async function POST(request: NextRequest) {
  const auth = await requireApiProfile();
  if ("response" in auth) return auth.response;
  if (auth.profile.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const webhookUrl = buildWebhookUrl(request);
  if (!webhookUrl.startsWith("https://") && !webhookUrl.startsWith("http://localhost")) {
    return NextResponse.json({ error: "Z-API requires HTTPS webhook URLs in production." }, { status: 400 });
  }

  const results = {
    received: await updateZapiWebhook("update-webhook-received", { value: webhookUrl }),
    delivery: await updateZapiWebhook("update-webhook-delivery", { value: webhookUrl }),
    messageStatus: await updateZapiWebhook("update-webhook-message-status", { value: webhookUrl }),
    notifySentByMe: await updateZapiWebhook("update-notify-sent-by-me", { notifySentByMe: true }),
  };

  const failed = Object.entries(results).filter(([, result]) => !result.ok);
  if (failed.length > 0) {
    return NextResponse.json({ ok: false, webhookUrl, results }, { status: 502 });
  }

  return NextResponse.json({ ok: true, webhookUrl, results });
}
