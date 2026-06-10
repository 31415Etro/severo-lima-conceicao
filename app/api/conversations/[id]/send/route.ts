import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile, loadConversationForApi } from "@/lib/api-auth";
import { sendWhatsAppMessage } from "@/lib/zapi";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile();
  if ("response" in auth) return auth.response;
  if (auth.profile.id === "demo-lawyer") return NextResponse.json({ ok: true, demo: true });
  const { id } = await context.params;
  const loaded = await loadConversationForApi(id, auth.profile);
  if ("response" in loaded) return loaded.response;

  const body = await request.json().catch(() => null);
  const content = String(body?.content || "").trim().slice(0, 2000);
  if (!content) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  const { data: contact } = await loaded.admin
    .from("contacts")
    .select("phone")
    .eq("id", loaded.conversation.contact_id)
    .single();

  const result = await sendWhatsAppMessage(contact?.phone || "", content);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  const now = new Date().toISOString();
  await loaded.admin.from("messages").insert({
    conversation_id: id,
    sender_type: "LAWYER",
    sender_id: auth.profile.id,
    direction: "OUTBOUND",
    content,
    zapi_message_id: result.data?.messageId || result.data?.id || null,
    zapi_zaap_id: result.data?.zaapId || null,
    delivery_status: "QUEUED",
  });
  await loaded.admin
    .from("conversations")
    .update({ status: "EM_ATENDIMENTO", ai_enabled: false, unread_count: 0, last_message_at: now, updated_at: now })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
