"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AiStatusBadge } from "@/components/AiStatusBadge";
import { MessageBubble } from "@/components/MessageBubble";
import { StatusBadge } from "@/components/StatusBadge";
import type { Area, ConversationStatus, Message, Profile } from "@/lib/types";

type ConversationDetail = {
  id: string;
  area: Area;
  status: ConversationStatus;
  ai_enabled: boolean;
  summary: string | null;
  assigned_lawyer_id: string | null;
  contacts: { name: string | null; phone: string } | null;
  profiles: { name: string } | null;
};

export function ChatWindow({
  conversation,
  messages,
  profile,
  lawyers,
}: {
  conversation: ConversationDetail;
  messages: Message[];
  profile: Profile;
  lawyers: Profile[];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  async function post(path: string, body?: unknown) {
    setBusy(true);
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    router.refresh();
  }

  async function send() {
    if (!content.trim()) return;
    await post(`/api/conversations/${conversation.id}/send`, { content });
    setContent("");
  }

  return (
    <div className="relative">
      <section className="panel mx-auto flex h-[calc(100vh-118px)] min-h-[620px] max-w-5xl flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="border-b border-[#d8deec] bg-navy px-5 py-4 text-left text-white transition hover:bg-navyDark"
        >
          <p className="truncate text-base font-semibold">{conversation.contacts?.name || "Cliente sem nome"}</p>
        </button>
        <div className="flex-1 space-y-3 overflow-y-auto bg-[#eef1f8] px-4 py-5 sm:px-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
        <div className="border-t border-[#d8deec] bg-white p-3">
          <div className="mx-auto flex max-w-4xl gap-2">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={2}
              className="min-h-12 flex-1 resize-none rounded border border-[#d8deec] bg-[#f8f9fc] px-3 py-2 text-sm outline-none transition focus:border-navy focus:bg-white"
              placeholder="Responder cliente"
            />
            <button disabled={busy || !content.trim()} onClick={send} className="rounded bg-navy px-5 py-2 text-sm font-medium text-white transition hover:bg-navyDark disabled:opacity-50">
              Enviar
            </button>
          </div>
        </div>
      </section>
      {detailsOpen && (
        <div className="fixed inset-0 z-40 bg-navy/25 backdrop-blur-sm" onClick={() => setDetailsOpen(false)}>
          <aside
            className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl shadow-navy/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-navy px-5 py-5 text-white">
              <button type="button" onClick={() => setDetailsOpen(false)} className="mb-4 rounded px-2 py-1 text-sm text-white/80 hover:bg-white/10">
                Fechar
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-semibold text-navy">
                  {(conversation.contacts?.name || conversation.contacts?.phone || "C").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{conversation.contacts?.name || "Cliente sem nome"}</p>
                  <p className="text-sm text-white/70">{conversation.contacts?.phone}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={conversation.status} />
                <AiStatusBadge enabled={conversation.ai_enabled} />
              </div>
              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-ink">Area</dt>
                  <dd className="mt-1 text-steel">{conversation.area}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink">Responsavel</dt>
                  <dd className="mt-1 text-steel">{conversation.profiles?.name || "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink">Resumo da IA</dt>
                  <dd className="mt-1 leading-relaxed text-steel">{conversation.summary || "Ainda sem resumo."}</dd>
                </div>
              </dl>
              <div className="mt-7 grid gap-2">
                <button disabled={busy} onClick={() => post(`/api/conversations/${conversation.id}/assume`)} className="rounded bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navyDark">
                  Assumir atendimento
                </button>
                <button disabled={busy} onClick={() => post(`/api/conversations/${conversation.id}/close`)} className="rounded border border-[#d8deec] px-3 py-2 text-sm font-medium text-ink hover:bg-navySoft">
                  Encerrar atendimento
                </button>
                <button disabled={busy} onClick={() => post(`/api/conversations/${conversation.id}/disable-ai`)} className="rounded border border-[#d8deec] px-3 py-2 text-sm font-medium text-ink hover:bg-navySoft">
                  Desligar IA
                </button>
                {profile.role === "ADMIN" && (
                  <>
                    <button disabled={busy || conversation.status !== "BOT_TRIAGEM"} onClick={() => post(`/api/conversations/${conversation.id}/enable-ai`)} className="rounded border border-[#d8deec] px-3 py-2 text-sm font-medium text-ink hover:bg-navySoft disabled:opacity-50">
                      Reativar IA
                    </button>
                    <select
                      className="rounded border border-[#d8deec] px-3 py-2 text-sm"
                      defaultValue=""
                      onChange={(event) => event.target.value && post(`/api/conversations/${conversation.id}/reclassify`, { area: event.target.value })}
                    >
                      <option value="">Reclassificar area</option>
                      <option value="PREVIDENCIARIO">Previdenciario</option>
                      <option value="TRABALHISTA">Trabalhista</option>
                      <option value="CIVEL_FAMILIA">Civil/Familia</option>
                      <option value="INDEFINIDO">Indefinido</option>
                    </select>
                    <select
                      className="rounded border border-[#d8deec] px-3 py-2 text-sm"
                      defaultValue=""
                      onChange={(event) => event.target.value && post(`/api/conversations/${conversation.id}/transfer`, { lawyer_id: event.target.value })}
                    >
                      <option value="">Transferir advogado</option>
                      {lawyers.map((lawyer) => (
                        <option key={lawyer.id} value={lawyer.id}>
                          {lawyer.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
