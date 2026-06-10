import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const DEMO_PROFILE: Profile = {
  id: "demo-lawyer",
  name: "Karine Demo",
  email: "advogado@teste.com",
  role: "LAWYER",
  specialty: "PREVIDENCIARIO",
};

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const cookieStore = await cookies();
  if (cookieStore.get("demo_session")?.value === "lawyer") return DEMO_PROFILE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data as Profile | null;
}

export async function requireProfile() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  return profile;
}

export function canAccessConversation(
  profile: Pick<Profile, "id" | "role">,
  assignedLawyerId: string | null
) {
  return profile.role === "ADMIN" || assignedLawyerId === profile.id;
}
