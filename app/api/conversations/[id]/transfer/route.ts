import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile, loadConversationForApi } from "@/lib/api-auth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile();
  if ("response" in auth) return auth.response;
  if (auth.profile.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const loaded = await loadConversationForApi(id, auth.profile);
  if ("response" in loaded) return loaded.response;
  const body = await request.json().catch(() => null);
  const lawyerId = String(body?.lawyer_id || "");
  if (!lawyerId) return NextResponse.json({ error: "lawyer_id is required" }, { status: 400 });

  await loaded.admin
    .from("conversations")
    .update({
      assigned_lawyer_id: lawyerId,
      status: "AGUARDANDO_ADVOGADO",
      ai_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
