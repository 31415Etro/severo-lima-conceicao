"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AiStatusBadge } from "@/components/AiStatusBadge";
import { StatusBadge } from "@/components/StatusBadge";
import type { Area, ConversationStatus } from "@/lib/types";

type Row = {
  id: string;
  area: Area;
  status: ConversationStatus;
  ai_enabled: boolean;
  unread_count?: number;
  last_message_at: string;
  contacts: { name: string | null; phone: string } | null;
  profiles: { name: string } | null;
  messages?: { content: string; created_at: string }[];
};

export function ConversationList({ conversations }: { conversations: Row[] }) {
  const router = useRouter();

  async function resetConversation(id: string) {
    if (!confirm("Resetar esta conversa? O histórico atual será apagado e a IA voltará como cliente novo.")) return;
    const response = await fetch(`/api/conversations/${id}/reset`, { method: "POST" });
    if (!response.ok) {
      alert("Não foi possível resetar a conversa.");
      return;
    }
    router.refresh();
  }

  async function deleteConversation(id: string) {
    if (!confirm("Apagar esta conversa e todas as mensagens dela no banco?")) return;
    const response = await fetch(`/api/conversations/${id}/delete`, { method: "DELETE" });
    if (!response.ok) {
      alert("Não foi possível apagar a conversa.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="panel overflow-hidden">
      {conversations.map((conversation) => (
        <div key={conversation.id} className="group flex gap-4 border-b border-[#e4e8f2] px-4 py-4 transition hover:bg-navySoft">
          <Link href={`/conversations/${conversation.id}`} className="flex min-w-0 flex-1 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white shadow-md shadow-navy/20">
              {(conversation.contacts?.name || conversation.contacts?.phone || "C").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink group-hover:text-navy">{conversation.contacts?.name || "Cliente sem nome"}</p>
                  <p className="mt-0.5 text-xs text-steel">{conversation.contacts?.phone}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-steel">{new Date(conversation.last_message_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  {!!conversation.unread_count && (
                    <span className="mt-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-navy px-1.5 text-xs font-semibold text-white shadow-sm">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              </div>
              <p className={`mt-1 truncate text-sm ${conversation.unread_count ? "font-semibold text-navy" : "text-steel"}`}>
                {conversation.messages?.[0]?.content || "Sem mensagens"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={conversation.status} />
                <AiStatusBadge enabled={conversation.ai_enabled} />
                <span className="rounded border border-[#c8d0e6] bg-white px-2 py-1 text-xs font-medium text-navy">{conversation.area}</span>
              </div>
            </div>
          </Link>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={() => resetConversation(conversation.id)}
              className="rounded border border-[#c8d0e6] bg-white px-3 py-2 text-xs font-semibold text-navy transition hover:bg-navySoft"
            >
              Resetar
            </button>
            <button
              type="button"
              onClick={() => deleteConversation(conversation.id)}
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              Apagar
            </button>
          </div>
        </div>
      ))}
      {conversations.length === 0 && <p className="p-6 text-sm text-steel">Nenhuma conversa encontrada.</p>}
    </div>
  );
}
