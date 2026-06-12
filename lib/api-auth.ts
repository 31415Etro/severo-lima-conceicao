import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_PROFILE } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export async function requireApiProfile(): Promise<{ profile: Profile } | { response: NextResponse }> {
  const cookieStore = await cookies();
  if (cookieStore.get("demo_session")?.value === "lawyer") return { profile: DEMO_PROFILE };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return { response: NextResponse.json({ error: "Profile not found" }, { status: 403 }) };

  return { profile: profile as Profile };
}

export async function loadConversationForApi(id: string, profile: Profile) {
  const admin = createAdminClient();
  const { data: conversation } = await admin.from("conversations").select("*").eq("id", id).single();
  if (!conversation) return { response: NextResponse.json({ error: "Conversation not found" }, { status: 404 }) };
  const sharedUnassigned = !conversation.assigned_lawyer_id && ["INDEFINIDO", "FORA_ESCOPO"].includes(conversation.area);
  if (profile.role !== "ADMIN" && conversation.assigned_lawyer_id !== profile.id && !sharedUnassigned) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { conversation, admin };
}
