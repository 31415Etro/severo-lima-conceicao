import Link from "next/link";
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
  return (
    <div className="panel overflow-hidden">
      {conversations.map((conversation) => (
        <Link
          href={`/conversations/${conversation.id}`}
          key={conversation.id}
          className="group flex gap-4 border-b border-[#e4e8f2] px-4 py-4 transition hover:bg-navySoft"
        >
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
      ))}
      {conversations.length === 0 && <p className="p-6 text-sm text-steel">Nenhuma conversa encontrada.</p>}
    </div>
  );
}
