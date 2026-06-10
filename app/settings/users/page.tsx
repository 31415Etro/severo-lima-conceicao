import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export default async function UsersSettingsPage() {
  const profile = await requireProfile();
  if (profile.role !== "ADMIN") redirect("/dashboard");
  const supabase = createAdminClient();
  const { data: profiles } = await supabase.from("profiles").select("*").order("name");

  return (
    <AppShell profile={profile}>
      <h1 className="text-2xl font-semibold text-navy">Usuarios</h1>
      <p className="mt-1 text-sm text-steel">Crie usuarios no Supabase Auth e depois vincule os profiles pelo SQL ou por uma tela administrativa futura.</p>
      <div className="panel mt-4 overflow-hidden">
        {(profiles || []).map((user) => (
          <div key={user.id} className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-4">
            <span className="font-medium">{user.name}</span>
            <span className="text-sm text-steel">{user.email}</span>
            <span className="text-sm text-steel">{user.role}</span>
            <span className="text-sm text-steel">{user.specialty || "-"}</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
