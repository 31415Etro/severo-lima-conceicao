import type { Area } from "@/lib/types";

export const INITIAL_BOT_MESSAGE =
  "Olá, tudo bem? Eu sou a Clara, do atendimento inicial do Severo, Lima & Conceição.\n\nVou te ajudar a direcionar seu caso para a pessoa certa. Para começar, pode me dizer seu nome e me contar, em poucas palavras, o que aconteceu?";

export const UNKNOWN_AREA_MESSAGE =
  "Entendi. Só para eu te encaminhar corretamente: o seu caso envolve INSS ou aposentadoria, trabalho ou emprego, ou uma questão cível ou familiar, como divórcio, contrato, cobrança ou consumidor?";

export const OUT_OF_SCOPE_MESSAGE =
  "Obrigada por explicar. No momento, o escritório Severo, Lima & Conceição atende casos nas áreas previdenciária, trabalhista, cível e de família.\n\nPelo que você relatou, sua demanda parece estar fora dessas áreas. Por isso, infelizmente não conseguimos seguir com esse atendimento por aqui.";

export const ALREADY_ASSIGNED_MESSAGE =
  "Seu atendimento já foi direcionado para o responsável pela área. Em breve ele dará continuidade por aqui.";

export type RoutableArea = Extract<Area, "PREVIDENCIARIO" | "TRABALHISTA" | "CIVEL_FAMILIA">;

export const ROUTING_MESSAGES: Record<RoutableArea, string> = {
  PREVIDENCIARIO:
    "Obrigada pelas informações. Pelo que você relatou, seu caso parece estar relacionado à área previdenciária.\n\nVou direcionar seu atendimento para a Karine, responsável por essa área. Ela dará continuidade por aqui.",
  TRABALHISTA:
    "Obrigada pelas informações. Pelo que você relatou, seu caso parece estar relacionado à área trabalhista.\n\nVou direcionar seu atendimento para o Luiz, responsável por essa área. Ele dará continuidade por aqui.",
  CIVEL_FAMILIA:
    "Obrigada pelas informações. Pelo que você relatou, seu caso parece estar relacionado à área cível ou de família.\n\nVou direcionar seu atendimento para a Ana, responsável por essa área. Ela dará continuidade por aqui.",
};

const KEYWORDS: Record<RoutableArea, string[]> = {
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

export function isRoutableArea(area: Area): area is RoutableArea {
  return area !== "INDEFINIDO" && area !== "FORA_ESCOPO";
}
