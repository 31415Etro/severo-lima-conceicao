import type { Message } from "@/lib/types";

export function MessageBubble({ message }: { message: Message }) {
  const outgoing = message.direction === "OUTBOUND";
  return (
    <div className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-lg px-4 py-2 text-sm shadow-sm ${
          outgoing ? "bg-navy text-white" : "bg-white border border-[#d8deec] text-ink"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <p className={`mt-1 text-[11px] ${outgoing ? "text-blue-100" : "text-slate-400"}`}>
          {new Date(message.created_at).toLocaleString("pt-BR")} · {message.sender_type}
          {outgoing && message.delivery_status ? ` · ${message.delivery_status}` : ""}
        </p>
      </div>
    </div>
  );
}
