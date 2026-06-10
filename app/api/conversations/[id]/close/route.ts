import { NextResponse } from "next/server";
import { requireApiProfile, loadConversationForApi } from "@/lib/api-auth";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile();
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const loaded = await loadConversationForApi(id, auth.profile);
  if ("response" in loaded) return loaded.response;

  await loaded.admin
    .from("conversations")
    .update({ status: "ENCERRADO", ai_enabled: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
