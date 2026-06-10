import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile, loadConversationForApi } from "@/lib/api-auth";
import { getLawyerByArea } from "@/lib/triage";
import type { Area } from "@/lib/types";

const AREAS = new Set(["PREVIDENCIARIO", "TRABALHISTA", "CIVEL_FAMILIA", "INDEFINIDO"]);

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile();
  if ("response" in auth) return auth.response;
  if (auth.profile.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const loaded = await loadConversationForApi(id, auth.profile);
  if ("response" in loaded) return loaded.response;
  const body = await request.json().catch(() => null);
  const area = String(body?.area || "INDEFINIDO") as Area;
  if (!AREAS.has(area)) return NextResponse.json({ error: "Invalid area" }, { status: 400 });

  const lawyer = await getLawyerByArea(area);
  await loaded.admin
    .from("conversations")
    .update({
      area,
      assigned_lawyer_id: lawyer?.id || null,
      status: area === "INDEFINIDO" ? loaded.conversation.status : "AGUARDANDO_ADVOGADO",
      ai_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
