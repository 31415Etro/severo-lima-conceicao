import type { Area } from "@/lib/types";

export const INITIAL_BOT_MESSAGE =
  "Ola! Voce esta falando com o atendimento do Severo, Lima & Conceicao. Para te direcionar corretamente, me informe seu nome e conte brevemente qual e o seu caso.";

export const UNKNOWN_AREA_MESSAGE =
  "Entendi. Para te direcionar corretamente, seu caso envolve INSS/aposentadoria, trabalho/emprego ou uma questao civil/familiar como divorcio, contrato, cobranca ou consumidor?";

export const ALREADY_ASSIGNED_MESSAGE =
  "Seu atendimento ja foi direcionado para o responsavel pela area. Em breve ele dara continuidade por aqui.";

export const ROUTING_MESSAGES: Record<Exclude<Area, "INDEFINIDO">, string> = {
  PREVIDENCIARIO:
    "Obrigado pelas informacoes. Pelo que voce relatou, seu caso parece estar relacionado a area previdenciaria. Vou direcionar seu atendimento para a Karine, responsavel por essa area. Ela dara continuidade por aqui.",
  TRABALHISTA:
    "Obrigado pelas informacoes. Pelo que voce relatou, seu caso parece estar relacionado a area trabalhista. Vou direcionar seu atendimento para o Luiz, responsavel por essa area. Ele dara continuidade por aqui.",
  CIVEL_FAMILIA:
    "Obrigado pelas informacoes. Pelo que voce relatou, seu caso parece estar relacionado a area civil ou de familia. Vou direcionar seu atendimento para a Ana, responsavel por essa area. Ela dara continuidade por aqui.",
};

const KEYWORDS: Record<Exclude<Area, "INDEFINIDO">, string[]> = {
  PREVIDENCIARIO: [
    "inss",
    "aposentadoria",
    "aposentar",
    "beneficio",
    "beneficio negado",
    "auxilio",
    "loas",
    "bpc",
    "pensao por morte",
    "pericia",
    "previdencia",
    "previdenciario",
    "revisao de beneficio",
  ],
  TRABALHISTA: [
    "demissao",
    "fui mandado embora",
    "rescisao",
    "fgts",
    "ferias",
    "horas extras",
    "salario atrasado",
    "justa causa",
    "carteira assinada",
    "vinculo",
    "trabalhista",
    "patrao",
    "empresa nao pagou",
    "acidente de trabalho",
    "assedio no trabalho",
  ],
  CIVEL_FAMILIA: [
    "divorcio",
    "guarda",
    "pensao alimenticia",
    "visita",
    "filho",
    "inventario",
    "heranca",
    "contrato",
    "cobranca",
    "divida",
    "consumidor",
    "indenizacao",
    "danos morais",
    "aluguel",
    "familia",
    "separacao",
  ],
};

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyByKeywords(text: string): { area: Area; confidence: number; matched: string[] } {
  const normalized = normalizeText(text);
  const scores = Object.entries(KEYWORDS).map(([area, words]) => {
    const matched = words.filter((word) => normalized.includes(normalizeText(word)));
    return { area: area as Area, matched, score: matched.length };
  });

  const winner = scores.sort((a, b) => b.score - a.score)[0];
  if (!winner || winner.score === 0) return { area: "INDEFINIDO", confidence: 0, matched: [] };

  const confidence = winner.score >= 2 ? 0.92 : 0.82;
  return { area: winner.area, confidence, matched: winner.matched };
}

export function isRoutableArea(area: Area): area is Exclude<Area, "INDEFINIDO"> {
  return area !== "INDEFINIDO";
}
