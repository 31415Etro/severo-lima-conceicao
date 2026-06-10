import type { ConversationStatus } from "@/lib/types";

const STYLES: Record<ConversationStatus, string> = {
  BOT_TRIAGEM: "bg-navySoft text-navy border-[#c8d0e6]",
  AGUARDANDO_ADVOGADO: "bg-amber-50 text-amber-700 border-amber-200",
  EM_ATENDIMENTO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ENCERRADO: "bg-slate-100 text-slate-600 border-slate-200",
};

const LABELS: Record<ConversationStatus, string> = {
  BOT_TRIAGEM: "Triagem",
  AGUARDANDO_ADVOGADO: "Aguardando",
  EM_ATENDIMENTO: "Em atendimento",
  ENCERRADO: "Encerrado",
};

export function StatusBadge({ status }: { status: ConversationStatus }) {
  return <span className={`rounded px-2 py-1 text-xs font-medium border ${STYLES[status]}`}>{LABELS[status]}</span>;
}
