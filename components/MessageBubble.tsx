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
        {message.media_type === "IMAGE" && message.media_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={message.media_url} alt={message.media_filename || "Imagem enviada"} className="mb-2 max-h-80 rounded object-contain" />
        )}
        {message.media_type === "AUDIO" && message.media_url && (
          <audio controls src={message.media_url} className="mb-2 w-full min-w-64" />
        )}
        {message.media_type === "VIDEO" && message.media_url && (
          <video controls src={message.media_url} className="mb-2 max-h-80 rounded" />
        )}
        {message.media_type === "DOCUMENT" && message.media_url && (
          <a href={message.media_url} target="_blank" rel="noreferrer" className={`mb-2 block rounded border px-3 py-2 ${outgoing ? "border-white/25 text-white" : "border-[#d8deec] text-navy"}`}>
            {message.media_filename || "Abrir documento"}
          </a>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.media_transcription && message.media_type === "AUDIO" && (
          <p className={`mt-2 rounded px-3 py-2 text-xs ${outgoing ? "bg-white/10 text-blue-50" : "bg-navySoft text-steel"}`}>
            Transcrição: {message.media_transcription}
          </p>
        )}
        <p className={`mt-1 text-[11px] ${outgoing ? "text-blue-100" : "text-slate-400"}`}>
          {new Date(message.created_at).toLocaleString("pt-BR")} · {message.sender_type}
          {outgoing && message.delivery_status ? ` · ${message.delivery_status}` : ""}
        </p>
      </div>
    </div>
  );
}
