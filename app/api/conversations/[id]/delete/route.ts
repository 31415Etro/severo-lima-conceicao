import { NextResponse } from "next/server";
import { requireApiProfile, loadConversationForApi } from "@/lib/api-auth";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile();
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const loaded = await loadConversationForApi(id, auth.profile);
  if ("response" in loaded) return loaded.response;

  const { error } = await loaded.admin.from("conversations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete conversation" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
