import type { Area } from "@/lib/types";

export const INITIAL_BOT_MESSAGE =
  "Olá! Eu sou a Clara, assistente virtual do escritório Severo, Lima & Conceição. Vou te ajudar no primeiro atendimento e direcionar seu caso para o advogado responsável. Para começar, poderia me informar seu nome e contar brevemente o que aconteceu?";

export const UNKNOWN_AREA_MESSAGE =
  "Entendi. Para eu te direcionar corretamente, seu caso envolve INSS ou aposentadoria, uma questão de trabalho/emprego, ou uma situação cível/familiar como divórcio, contrato, cobrança ou consumidor?";

export const ALREADY_ASSIGNED_MESSAGE =
  "Seu atendimento ja foi direcionado para o responsavel pela area. Em breve ele dara continuidade por aqui.";

export const ROUTING_MESSAGES: Record<Exclude<Area, "INDEFINIDO">, string> = {
  PREVIDENCIARIO:
    "Obrigada pelas informações. Pelo que você relatou, seu caso parece estar relacionado à área previdenciária. Vou direcionar seu atendimento para a Karine, responsável por essa área. Ela dará continuidade por aqui.",
  TRABALHISTA:
    "Obrigada pelas informações. Pelo que você relatou, seu caso parece estar relacionado à área trabalhista. Vou direcionar seu atendimento para o Luiz, responsável por essa área. Ele dará continuidade por aqui.",
  CIVEL_FAMILIA:
    "Obrigada pelas informações. Pelo que você relatou, seu caso parece estar relacionado à área cível ou de família. Vou direcionar seu atendimento para a Ana, responsável por essa área. Ela dará continuidade por aqui.",
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
    "afastamento",
    "incapacidade",
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
    "verbas trabalhistas",
    "problema com empregador",
    "problemas com empregador",
    "empregador",
  ],
  CIVEL_FAMILIA: [
    "divorcio",
    "guarda",
    "pensao alimenticia",
    "visita",
    "visitas",
    "filho",
    "filhos",
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
