import type { Area } from "@/lib/types";

export type AiClassification = {
  reply: string;
  area: Area;
  confidence: number;
  summary: string;
  needs_more_info: boolean;
  input_tokens?: number;
  output_tokens?: number;
};

const AREAS = new Set(["PREVIDENCIARIO", "TRABALHISTA", "CIVEL_FAMILIA", "INDEFINIDO"]);

const SYSTEM_PROMPT =
  "Voce e o assistente de atendimento inicial do escritorio Severo, Lima & Conceicao. Sua funcao e acolher o cliente, entender brevemente o problema e direcionar para o advogado correto. Voce nao e advogado, nao da parecer juridico, nao promete resultado, nao calcula valores e nao afirma direitos garantidos. Voce deve ser educado, profissional, humano e objetivo. Classifique o caso em apenas uma area. PREVIDENCIARIO inclui INSS, aposentadoria, auxilio-doenca, BPC/LOAS, pensao por morte, beneficio negado, pericia, revisao de beneficio e assuntos relacionados a beneficios previdenciarios. TRABALHISTA inclui demissao, rescisao, FGTS, ferias, horas extras, salario atrasado, justa causa, vinculo empregaticio, acidente de trabalho, assedio no trabalho e verbas trabalhistas. CIVEL_FAMILIA inclui divorcio, guarda, pensao alimenticia, inventario, heranca, contrato, cobranca, consumidor, indenizacao, aluguel, danos morais e conflitos familiares ou civeis. Se nao tiver certeza, use INDEFINIDO e faca uma pergunta simples para esclarecer. Responda sempre em portugues do Brasil. Seja curto. Retorne somente JSON valido no formato {\"reply\":\"...\",\"area\":\"PREVIDENCIARIO|TRABALHISTA|CIVEL_FAMILIA|INDEFINIDO\",\"confidence\":0.0,\"summary\":\"...\",\"needs_more_info\":true}.";

export async function classifyWithOpenAI(messages: string[]): Promise<AiClassification> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");

  const compactMessages = messages
    .slice(-6)
    .map((message) => message.slice(0, 700))
    .join("\n")
    .slice(0, 3000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 240,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: compactMessages },
      ],
    }),
  });

  if (!response.ok) throw new Error("OpenAI request failed.");

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw) as AiClassification;
  const area = AREAS.has(parsed.area) ? parsed.area : "INDEFINIDO";

  return {
    reply: String(parsed.reply || "").slice(0, 700),
    area,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
    summary: String(parsed.summary || "").slice(0, 1000),
    needs_more_info: Boolean(parsed.needs_more_info),
    input_tokens: data.usage?.prompt_tokens,
    output_tokens: data.usage?.completion_tokens,
  };
}
