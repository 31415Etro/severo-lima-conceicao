import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/zapi";
import { classifyAndReply } from "@/lib/triage";

function extractPayload(payload: Record<string, unknown>) {
  const fromMe = payload.fromMe === true || payload.fromMe === "true";
  const phone = String(payload.phone || payload.senderPhone || payload.from || payload.chatId || "");
  const text =
    String(payload.text || "") ||
    String((payload as { message?: { text?: string } }).message?.text || "") ||
    String((payload as { textMessage?: { message?: string } }).textMessage?.message || "");
  const messageId = String(payload.messageId || payload.id || "");
  const zaapId = String(payload.zaapId || "");
  const senderName = String(payload.senderName || payload.pushName || "");
  const type = String(payload.type || "");
  const status = String(payload.status || "");
  const error = typeof payload.error === "string" ? payload.error : null;
  const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : [];
  return { fromMe, phone: normalizePhone(phone), text: text.trim().slice(0, 4000), messageId, zaapId, senderName, type, status, error, ids };
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
    const { data: created } = await supabase
      .from("conversations")
      .insert({
        contact_id: contactId,
        ai_enabled: !outboundFromOwnNumber,
        status: outboundFromOwnNumber ? "EM_ATENDIMENTO" : "BOT_TRIAGEM",
        assigned_lawyer_id: null,
        area: "INDEFINIDO",
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

  if (!parsed.phone || parsed.text.length < 1) return NextResponse.json({ error: "Invalid Z-API payload" }, { status: 400 });

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: contact } = await supabase
    .from("contacts")
    .upsert({ phone: parsed.phone, name: parsed.senderName || null, updated_at: now }, { onConflict: "phone" })
    .select("*")
    .single();

  if (!contact) return NextResponse.json({ error: "Could not save contact" }, { status: 500 });

  const conversation = await getOrCreateConversation(supabase, contact.id, now, parsed.fromMe);

  if (!conversation) return NextResponse.json({ error: "Could not create conversation" }, { status: 500 });

  const existingMessage = await findExistingMessage(supabase, parsed.messageId, parsed.zaapId);
  if (existingMessage) return NextResponse.json({ ok: true, ignored: "duplicate" });

  if (parsed.fromMe) {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_type: "SYSTEM",
      direction: "OUTBOUND",
      content: parsed.text,
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
    content: parsed.text,
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
  if (parsed.text.length < 2) return NextResponse.json({ ok: true, ai: "short_skip" });

  await classifyAndReply(conversation.id);
  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
