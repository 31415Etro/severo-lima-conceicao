import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ChatWindow } from "@/components/ChatWindow";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { requireProfile } from "@/lib/auth";
import { demoConversationDetail, demoLawyers, demoMessages } from "@/lib/demo-data";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;

  if (profile.id === "demo-lawyer") {
    if (id !== "demo-1") redirect("/conversations/demo-1");
    return (
      <AppShell profile={profile}>
        <ChatWindow conversation={demoConversationDetail as never} messages={demoMessages} profile={profile} lawyers={demoLawyers} />
      </AppShell>
    );
  }

  const supabase = createAdminClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*,contacts(name,phone),profiles(name)")
    .eq("id", id)
    .single();

  if (!conversation) notFound();
  if (profile.role !== "ADMIN" && conversation.assigned_lawyer_id !== profile.id) redirect("/conversations");

  await supabase.from("conversations").update({ unread_count: 0 }).eq("id", id);

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  const { data: lawyers } = await supabase.from("profiles").select("*").eq("role", "LAWYER").order("name");

  return (
    <AppShell profile={profile}>
      <RealtimeRefresh conversationId={id} />
      <ChatWindow conversation={conversation as never} messages={(messages || []) as never} profile={profile} lawyers={(lawyers || []) as never} />
    </AppShell>
  );
}
