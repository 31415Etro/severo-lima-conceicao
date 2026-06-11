import { NextResponse } from "next/server";
import { requireApiProfile, loadConversationForApi } from "@/lib/api-auth";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile();
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const loaded = await loadConversationForApi(id, auth.profile);
  if ("response" in loaded) return loaded.response;

  const contactId = loaded.conversation.contact_id;
  const { error: deleteError } = await loaded.admin.from("conversations").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: "Could not delete conversation" }, { status: 500 });

  const { data: created, error: createError } = await loaded.admin
    .from("conversations")
    .insert({
      contact_id: contactId,
      assigned_lawyer_id: null,
      area: "INDEFINIDO",
      status: "BOT_TRIAGEM",
      ai_enabled: true,
      summary: null,
      confidence: null,
      unread_count: 0,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createError || !created) return NextResponse.json({ error: "Could not create fresh conversation" }, { status: 500 });
  return NextResponse.json({ ok: true, conversationId: created.id });
}
