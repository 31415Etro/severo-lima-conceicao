import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeImageFromUrl, transcribeAudioFromUrl } from "@/lib/openai";
import { normalizePhone } from "@/lib/zapi";
import { classifyAndReply } from "@/lib/triage";

function readText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);

  const object = value as Record<string, unknown>;
  const candidates = [
    object.message,
    object.text,
    object.body,
    object.content,
    object.value,
    object.caption,
  ];

  for (const candidate of candidates) {
    const text = readText(candidate);
    if (text) return text;
  }

  return "";
}

function extractPayload(payload: Record<string, unknown>) {
  const fromMe = payload.fromMe === true || payload.fromMe === "true";
  const phone = String(payload.phone || payload.senderPhone || payload.from || payload.chatId || "");
  const text =
    readText(payload.text) ||
    readText(payload.message) ||
    readText(payload.textMessage) ||
    readText(payload.caption) ||
    readText(payload.image) ||
    readText(payload.audio) ||
    readText(payload.video) ||
    readText(payload.document);
  const messageId = String(payload.messageId || payload.id || "");
  const zaapId = String(payload.zaapId || "");
  const senderName = String(payload.senderName || payload.pushName || "");
  const type = String(payload.type || "");
  const status = String(payload.status || "");
  const error = typeof payload.error === "string" ? payload.error : null;
  const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : [];
  const media = extractMedia(payload);
  return { fromMe, phone: normalizePhone(phone), text: text.trim().slice(0, 4000), messageId, zaapId, senderName, type, status, error, ids, media };
}

function isOfficeName(value: string) {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "e")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.includes("severo") && normalized.includes("lima") && normalized.includes("conceicao");
}

function cleanContactName(senderName: string) {
  const name = senderName.trim();
  if (!name || isOfficeName(name)) return null;
  return name.slice(0, 120);
}

function readFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function findMediaUrl(source: Record<string, unknown>) {
  return readFirstString(
    source.url,
    source.mediaUrl,
    source.media_url,
    source.downloadUrl,
    source.fileUrl,
    source.audioUrl,
    source.imageUrl,
    source.videoUrl,
    source.documentUrl,
    source.thumbnailUrl
  );
}

function inferMediaType(source: Record<string, unknown>, fallbackType: string) {
  const declared = [
    fallbackType,
    source.type,
    source.mediaType,
    source.messageType,
    source.mimeType,
    source.mimetype,
    source.contentType,
  ]
    .map((value) => String(value || "").toUpperCase())
    .join(" ");

  if (declared.includes("IMAGE") || declared.includes("IMG") || declared.includes("JPEG") || declared.includes("PNG") || declared.includes("WEBP")) return "IMAGE";
  if (declared.includes("AUDIO") || declared.includes("PTT") || declared.includes("OGG") || declared.includes("OPUS") || declared.includes("MP3") || declared.includes("WAV")) return "AUDIO";
  if (declared.includes("VIDEO") || declared.includes("MP4")) return "VIDEO";
  if (declared.includes("DOCUMENT") || declared.includes("PDF") || declared.includes("FILE")) return "DOCUMENT";
  if (readFirstString(source.imageUrl, source.thumbnailUrl)) return "IMAGE";
  if (readFirstString(source.audioUrl)) return "AUDIO";
  if (readFirstString(source.videoUrl)) return "VIDEO";
  if (readFirstString(source.documentUrl, source.fileUrl, source.downloadUrl)) return "DOCUMENT";
  return "DOCUMENT";
}

function extractMedia(payload: Record<string, unknown>) {
  const sources = [
    { type: "IMAGE", data: asObject(payload.image) },
    { type: "AUDIO", data: asObject(payload.audio) },
    { type: "VIDEO", data: asObject(payload.video) },
    { type: "DOCUMENT", data: asObject(payload.document) },
    { type: "IMAGE", data: asObject(payload.imageMessage) },
    { type: "AUDIO", data: asObject(payload.audioMessage) },
    { type: "VIDEO", data: asObject(payload.videoMessage) },
    { type: "DOCUMENT", data: asObject(payload.documentMessage) },
    { type: String(payload.type || payload.mediaType || payload.messageType || "").toUpperCase(), data: payload },
  ];

  for (const source of sources) {
    const url = findMediaUrl(source.data);
    if (!url) continue;
    const normalizedType = inferMediaType(source.data, source.type);
    return {
      type: normalizedType as "IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT",
      url,
      mimeType: readFirstString(source.data.mimeType, source.data.mimetype, source.data.contentType),
      filename: readFirstString(source.data.fileName, source.data.filename, source.data.name),
      caption: readText(source.data.caption) || readText(payload.caption),
    };
  }

  return null;
}

async function findExistingMessage(supabase: ReturnType<typeof createAdminClient>, messageId: string, zaapId: string) {
  const filters = [];
  if (messageId) filters.push(`zapi_message_id.eq.${messageId}`);
  if (zaapId) filters.push(`zapi_zaap_id.eq.${zaapId}`);
  if (filters.length === 0) return null;

  const { data } = await supabase.from("messages").select("*").or(filters.join(",")).limit(1).maybeSingle();
  return data;
}

async function updateMessageDelivery(payload: ReturnType<typeof extractPayload>) {
  const supabase = createAdminClient();
  const messageIds = [
    payload.messageId,
    payload.zaapId,
    ...payload.ids,
  ].filter(Boolean);

  for (const id of messageIds) {
    await supabase
      .from("messages")
      .update({
        delivery_status: payload.error ? "ERROR" : payload.status || "SENT",
        delivery_error: payload.error,
      })
      .or(`zapi_message_id.eq.${id},zapi_zaap_id.eq.${id}`);
  }
}

async function getOrCreateConversation(
  supabase: ReturnType<typeof createAdminClient>,
  contactId: string,
  now: string,
  outboundFromOwnNumber: boolean
) {
  const { data: latestConversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestConversation || latestConversation.status === "ENCERRADO") {
    const returningToResponsible = !outboundFromOwnNumber && latestConversation?.assigned_lawyer_id;
    const { data: created } = await supabase
      .from("conversations")
      .insert({
        contact_id: contactId,
        ai_enabled: !outboundFromOwnNumber && !returningToResponsible,
        status: outboundFromOwnNumber ? "EM_ATENDIMENTO" : returningToResponsible ? "AGUARDANDO_ADVOGADO" : "BOT_TRIAGEM",
        assigned_lawyer_id: returningToResponsible ? latestConversation.assigned_lawyer_id : null,
        area: returningToResponsible ? latestConversation.area : "INDEFINIDO",
        summary: returningToResponsible ? "Cliente retornou por WhatsApp; conversa direcionada automaticamente ao responsável anterior." : null,
        last_message_at: now,
      })
      .select("*")
      .single();
    return created;
  }

  return latestConversation;
}

export async function POST(request: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET;
  const receivedSecret = request.headers.get("x-webhook-secret") || request.nextUrl.searchParams.get("secret");
  if (secret && receivedSecret !== secret) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = extractPayload(payload);

  if (parsed.type === "DeliveryCallback" || parsed.type === "MessageStatusCallback") {
    await updateMessageDelivery(parsed);
    return NextResponse.json({ ok: true, event: parsed.type });
  }

  if (!parsed.phone || (parsed.text.length < 1 && !parsed.media)) return NextResponse.json({ error: "Invalid Z-API payload" }, { status: 400 });

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const contactName = cleanContactName(parsed.senderName);

  const { data: existingContact } = await supabase.from("contacts").select("*").eq("phone", parsed.phone).maybeSingle();
  let contact = existingContact;

  if (contact) {
    const shouldReplaceName = contactName && (!contact.name || isOfficeName(String(contact.name)));
    const shouldClearOfficeName = !contactName && contact.name && isOfficeName(String(contact.name));
    const { data } = await supabase
      .from("contacts")
      .update({
        name: shouldReplaceName ? contactName : shouldClearOfficeName ? null : contact.name,
        updated_at: now,
      })
      .eq("id", contact.id)
      .select("*")
      .single();
    contact = data;
  } else {
    const { data } = await supabase
      .from("contacts")
      .insert({ phone: parsed.phone, name: contactName, updated_at: now })
      .select("*")
      .single();
    contact = data;
  }

  if (!contact) return NextResponse.json({ error: "Could not save contact" }, { status: 500 });

  const conversation = await getOrCreateConversation(supabase, contact.id, now, parsed.fromMe);

  if (!conversation) return NextResponse.json({ error: "Could not create conversation" }, { status: 500 });

  const existingMessage = await findExistingMessage(supabase, parsed.messageId, parsed.zaapId);
  if (existingMessage) return NextResponse.json({ ok: true, ignored: "duplicate" });

  let messageContent = parsed.text;
  let mediaTranscription: string | null = null;

  if (parsed.media?.type === "AUDIO") {
    mediaTranscription = await transcribeAudioFromUrl(parsed.media.url);
    messageContent = "Áudio recebido.";
  } else if (parsed.media?.type === "IMAGE") {
    const description = await describeImageFromUrl(parsed.media.url, parsed.media.caption || parsed.text);
    mediaTranscription = description;
    messageContent = parsed.media.caption || parsed.text || "Imagem recebida.";
  } else if (parsed.media && !messageContent) {
    messageContent = `${parsed.media.type === "DOCUMENT" ? "Documento" : "Arquivo"} recebido${parsed.media.filename ? `: ${parsed.media.filename}` : "."}`;
  }

  if (parsed.fromMe) {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_type: "SYSTEM",
      direction: "OUTBOUND",
      content: messageContent,
      media_type: parsed.media?.type || "TEXT",
      media_url: parsed.media?.url || null,
      media_mime_type: parsed.media?.mimeType || null,
      media_filename: parsed.media?.filename || null,
      media_transcription: mediaTranscription,
      zapi_message_id: parsed.messageId || null,
      zapi_zaap_id: parsed.zaapId || null,
      delivery_status: "SENT",
    });

    await supabase
      .from("conversations")
      .update({ status: "EM_ATENDIMENTO", ai_enabled: false, last_message_at: now, updated_at: now })
      .eq("id", conversation.id);

    return NextResponse.json({ ok: true, event: "sent_by_me" });
  }

  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_type: "CLIENT",
    direction: "INBOUND",
    content: messageContent,
    media_type: parsed.media?.type || "TEXT",
    media_url: parsed.media?.url || null,
    media_mime_type: parsed.media?.mimeType || null,
    media_filename: parsed.media?.filename || null,
    media_transcription: mediaTranscription,
    zapi_message_id: parsed.messageId || null,
    zapi_zaap_id: parsed.zaapId || null,
    delivery_status: "RECEIVED",
  });

  await supabase
    .from("conversations")
    .update({
      last_message_at: now,
      updated_at: now,
      unread_count: Number(conversation.unread_count || 0) + 1,
    })
    .eq("id", conversation.id);

  if (!conversation.ai_enabled) return NextResponse.json({ ok: true, ai: "disabled" });
  if (conversation.status !== "BOT_TRIAGEM") return NextResponse.json({ ok: true, ai: "status_skip" });
  if (conversation.assigned_lawyer_id) return NextResponse.json({ ok: true, ai: "assigned_skip" });
  if (messageContent.length < 2) return NextResponse.json({ ok: true, ai: "short_skip" });

  await classifyAndReply(conversation.id);
  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
