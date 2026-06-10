import { AppShell } from "@/components/AppShell";
import { ConversationList } from "@/components/ConversationList";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { requireProfile } from "@/lib/auth";
import { demoConversations } from "@/lib/demo-data";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; area?: string; lawyer?: string; ai?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;

  if (profile.id === "demo-lawyer") {
    return (
      <AppShell profile={profile}>
        <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="rounded-lg bg-navy px-5 py-5 text-white shadow-lg shadow-navy/15">
            <p className="text-xs uppercase tracking-[0.18em] text-white/65">Inbox</p>
            <h1 className="mt-1 text-2xl font-semibold">Conversas</h1>
            <p className="mt-1 text-sm text-white/75">Conversas direcionadas para voce.</p>
          </div>
          <div className="panel p-4 text-sm text-steel">
            Usuario demo: <strong>advogado@teste.com</strong>
          </div>
        </div>
        <ConversationList conversations={demoConversations as never} />
      </AppShell>
    );
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("conversations")
    .select("id,area,status,ai_enabled,unread_count,last_message_at,contacts(name,phone),profiles(name),messages(content,created_at)")
    .order("last_message_at", { ascending: false });

  if (profile.role !== "ADMIN") query = query.eq("assigned_lawyer_id", profile.id);
  if (params.status) query = query.eq("status", params.status);
  if (params.area) query = query.eq("area", params.area);
  if (params.lawyer && profile.role === "ADMIN") query = query.eq("assigned_lawyer_id", params.lawyer);
  if (params.ai === "on") query = query.eq("ai_enabled", true);
  if (params.ai === "off") query = query.eq("ai_enabled", false);

  const { data } = await query;
  const { data: lawyers } = await supabase.from("profiles").select("id,name").eq("role", "LAWYER").order("name");

  return (
    <AppShell profile={profile}>
      <RealtimeRefresh />
      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="rounded-lg bg-navy px-5 py-5 text-white shadow-lg shadow-navy/15">
          <p className="text-xs uppercase tracking-[0.18em] text-white/65">Inbox</p>
          <h1 className="mt-1 text-2xl font-semibold">Conversas</h1>
          <p className="mt-1 text-sm text-white/75">
            {profile.role === "ADMIN" ? "Todas as conversas do escritorio." : "Conversas direcionadas para voce."}
          </p>
        </div>
        <form className="panel grid gap-2 p-3 sm:grid-cols-4">
          <select name="status" defaultValue={params.status || ""} className="rounded border border-line px-3 py-2 text-sm">
            <option value="">Status</option>
            <option value="BOT_TRIAGEM">Triagem</option>
            <option value="AGUARDANDO_ADVOGADO">Aguardando</option>
            <option value="EM_ATENDIMENTO">Em atendimento</option>
            <option value="ENCERRADO">Encerrado</option>
          </select>
          <select name="area" defaultValue={params.area || ""} className="rounded border border-line px-3 py-2 text-sm">
            <option value="">Area</option>
            <option value="PREVIDENCIARIO">Previdenciario</option>
            <option value="TRABALHISTA">Trabalhista</option>
            <option value="CIVEL_FAMILIA">Civil/Familia</option>
            <option value="INDEFINIDO">Indefinido</option>
          </select>
          {profile.role === "ADMIN" && (
            <select name="lawyer" defaultValue={params.lawyer || ""} className="rounded border border-line px-3 py-2 text-sm">
              <option value="">Advogado</option>
              {(lawyers || []).map((lawyer) => (
                <option key={lawyer.id} value={lawyer.id}>{lawyer.name}</option>
              ))}
            </select>
          )}
          <select name="ai" defaultValue={params.ai || ""} className="rounded border border-line px-3 py-2 text-sm">
            <option value="">IA</option>
            <option value="on">Ligada</option>
            <option value="off">Desligada</option>
          </select>
          <button className="rounded bg-navy px-4 py-2 text-sm font-medium text-white sm:col-span-4">Filtrar</button>
        </form>
      </div>
      <ConversationList conversations={(data || []) as never} />
    </AppShell>
  );
}
