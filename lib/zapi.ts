type ZapiMessageResponse = {
  zaapId?: string;
  messageId?: string;
  id?: string;
};

type ZapiResult = { ok: true; data?: ZapiMessageResponse } | { ok: false; error: string };
type ZapiConfigResult = { ok: true; data?: unknown } | { ok: false; error: string; data?: unknown };

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function getZapiBaseUrl() {
  const configured = process.env.ZAPI_BASE_URL || "https://api.z-api.io";
  return configured.includes("/instances/") ? configured.split("/instances/")[0] : configured.replace(/\/$/, "");
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<ZapiResult> {
  const baseUrl = getZapiBaseUrl();
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!instanceId || !token || !clientToken) {
    return { ok: false, error: "Z-API environment variables are missing." };
  }

  try {
    const response = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify({ phone: normalizePhone(phone), message }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: "Z-API rejected the message." };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Could not send WhatsApp message." };
  }
}

export async function updateZapiWebhook(path: string, body: Record<string, unknown>): Promise<ZapiConfigResult> {
  const baseUrl = getZapiBaseUrl();
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!instanceId || !token || !clientToken) {
    return { ok: false, error: "Z-API environment variables are missing." };
  }

  try {
    const response = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: "Z-API webhook configuration failed.", data };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Could not configure Z-API webhook." };
  }
}
