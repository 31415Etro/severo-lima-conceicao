type Counts = {
  total: number;
  triage: number;
  waiting: number;
  active: number;
  closed: number;
};

const ITEMS: { key: keyof Counts; label: string }[] = [
  { key: "total", label: "Total de conversas" },
  { key: "triage", label: "Em triagem" },
  { key: "waiting", label: "Aguardando advogado" },
  { key: "active", label: "Em atendimento" },
  { key: "closed", label: "Encerradas" },
];

export function DashboardCards({ counts }: { counts: Counts }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {ITEMS.map((item) => (
        <div key={item.key} className="panel p-4">
          <p className="text-sm text-steel">{item.label}</p>
          <p className="mt-3 text-3xl font-semibold text-navy">{counts[item.key]}</p>
        </div>
      ))}
    </div>
  );
}
