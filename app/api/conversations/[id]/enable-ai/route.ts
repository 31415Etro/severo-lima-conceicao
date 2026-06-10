import { NextResponse } from "next/server";
import { requireApiProfile, loadConversationForApi } from "@/lib/api-auth";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile();
  if ("response" in auth) return auth.response;
  if (auth.profile.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const loaded = await loadConversationForApi(id, auth.profile);
  if ("response" in loaded) return loaded.response;
  if (loaded.conversation.status !== "BOT_TRIAGEM") {
    return NextResponse.json({ error: "AI can only be enabled during bot triage." }, { status: 400 });
  }

  await loaded.admin.from("conversations").update({ ai_enabled: true, updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ ok: true });
}
