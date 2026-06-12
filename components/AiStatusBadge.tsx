export function AiStatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-medium border ${
        enabled ? "bg-navySoft text-navy border-[#c8d0e6]" : "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      Clara {enabled ? "ativa" : "pausada"}
    </span>
  );
}
