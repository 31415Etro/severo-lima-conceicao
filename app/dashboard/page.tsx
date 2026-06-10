import { AppShell } from "@/components/AppShell";
import { DashboardCards } from "@/components/DashboardCards";
import { requireProfile } from "@/lib/auth";
import { demoConversations } from "@/lib/demo-data";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DashboardPage() {
  const profile = await requireProfile();

  if (profile.id === "demo-lawyer") {
    const rows = demoConversations;
    const counts = {
      total: rows.length,
      triage: rows.filter((row) => row.status === "BOT_TRIAGEM").length,
      waiting: rows.filter((row) => row.status === "AGUARDANDO_ADVOGADO").length,
      active: rows.filter((row) => row.status === "EM_ATENDIMENTO").length,
      closed: rows.filter((row) => row.status === "ENCERRADO").length,
    };
    return (
      <AppShell profile={profile}>
        <h1 className="mb-4 text-2xl font-semibold text-navy">Dashboard</h1>
        <DashboardCards counts={counts} />
      </AppShell>
    );
  }

  const supabase = createAdminClient();
  let query = supabase.from("conversations").select("status,assigned_lawyer_id");
  if (profile.role !== "ADMIN") query = query.eq("assigned_lawyer_id", profile.id);
  const { data } = await query;
  const rows = data || [];

  const counts = {
    total: rows.length,
    triage: rows.filter((row) => row.status === "BOT_TRIAGEM").length,
    waiting: rows.filter((row) => row.status === "AGUARDANDO_ADVOGADO").length,
    active: rows.filter((row) => row.status === "EM_ATENDIMENTO").length,
    closed: rows.filter((row) => row.status === "ENCERRADO").length,
  };

  return (
    <AppShell profile={profile}>
      <h1 className="mb-4 text-2xl font-semibold text-navy">Dashboard</h1>
      <DashboardCards counts={counts} />
    </AppShell>
  );
}
