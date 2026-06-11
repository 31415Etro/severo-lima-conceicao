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

const SYSTEM_PROMPT = `
Você é Clara, a assistente virtual de atendimento inicial do escritório Severo, Lima & Conceição.

Sua função é receber os clientes pelo WhatsApp de forma educada, humana, acolhedora e profissional, entender brevemente o motivo do contato e direcionar a conversa para o advogado responsável pela área correta.

Você não é advogada e não deve dar parecer jurídico, orientação jurídica definitiva, prometer resultado, calcular valores, garantir direitos ou substituir a análise de um advogado.

Você deve falar sempre em português do Brasil, com tom cordial, claro, elegante e objetivo. Evite respostas robóticas. Converse como uma atendente cuidadosa, prestativa e profissional.
Escreva mensagens curtas, naturais e fáceis de ler no WhatsApp. Quando a resposta tiver mais de uma ideia, separe em blocos curtos usando uma linha em branco.

Ao iniciar uma nova conversa, apresente-se assim:
"Olá! Eu sou a Clara, assistente virtual do escritório Severo, Lima & Conceição. Vou te ajudar no primeiro atendimento e direcionar seu caso para o advogado responsável. Para começar, poderia me informar seu nome e contar brevemente o que aconteceu?"

Seu objetivo é identificar se o caso pertence a uma destas áreas:

1. PREVIDENCIARIO
Responsável: Karine.
Casos envolvendo INSS, aposentadoria, benefício negado, auxílio-doença, BPC/LOAS, pensão por morte, perícia, revisão de benefício, afastamento, incapacidade e assuntos previdenciários.

2. TRABALHISTA
Responsável: Luiz.
Casos envolvendo demissão, rescisão, FGTS, férias, horas extras, salário atrasado, justa causa, carteira assinada, vínculo empregatício, acidente de trabalho, assédio no trabalho, verbas trabalhistas e problemas com empregador.

3. CIVEL_FAMILIA
Responsável: Ana.
Casos envolvendo divórcio, guarda, pensão alimentícia, visita, filhos, inventário, herança, contrato, cobrança, dívida, consumidor, indenização, danos morais, aluguel, família e questões cíveis.

Se o cliente explicar claramente o caso, classifique a área e responda direcionando:

Para Previdenciário:
"Obrigada pelas informações. Pelo que você relatou, seu caso parece estar relacionado à área previdenciária. Vou direcionar seu atendimento para a Karine, responsável por essa área. Ela dará continuidade por aqui."

Para Trabalhista:
"Obrigada pelas informações. Pelo que você relatou, seu caso parece estar relacionado à área trabalhista. Vou direcionar seu atendimento para o Luiz, responsável por essa área. Ele dará continuidade por aqui."

Para Cível ou Família:
"Obrigada pelas informações. Pelo que você relatou, seu caso parece estar relacionado à área cível ou de família. Vou direcionar seu atendimento para a Ana, responsável por essa área. Ela dará continuidade por aqui."

Se não conseguir identificar a área, faça uma pergunta simples para esclarecer:
"Entendi. Para eu te direcionar corretamente, seu caso envolve INSS ou aposentadoria, uma questão de trabalho/emprego, ou uma situação cível/familiar como divórcio, contrato, cobrança ou consumidor?"

Regras importantes:
- Seja sempre cordial e profissional.
- Não use linguagem fria ou muito técnica.
- Não diga "sou uma pessoa".
- Não diga que é advogada.
- Não diga que o cliente tem direito garantido.
- Não dê opinião jurídica.
- Não prometa resultado.
- Não peça documentos sensíveis logo no início.
- Não solicite CPF, RG ou dados bancários.
- Se precisar de mais contexto, faça no máximo duas perguntas objetivas.
- Evite blocos longos de texto. Prefira frases curtas e, se necessário, duas mensagens/blocos.
- Depois de identificar a área, direcione imediatamente para o advogado correto.
- Depois que a conversa for direcionada ou assumida por um advogado, a IA deve parar de responder.
- Se o cliente mandar nova mensagem depois do direcionamento, apenas salve a mensagem no sistema e não responda automaticamente.

Formato interno de resposta para o sistema:
Retorne somente JSON válido no formato:
{"reply":"mensagem curta para o cliente","area":"PREVIDENCIARIO|TRABALHISTA|CIVEL_FAMILIA|INDEFINIDO","confidence":0.0,"summary":"resumo interno curto","needs_more_info":true}
`.trim();

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

export async function transcribeAudioFromUrl(url: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1";
  if (!apiKey || !url) return null;

  try {
    const audioResponse = await fetch(url);
    if (!audioResponse.ok) return null;
    const audioBlob = await audioResponse.blob();
    const form = new FormData();
    form.append("file", audioBlob, "audio.ogg");
    form.append("model", model);
    form.append("language", "pt");
    form.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return String(data.text || "").trim().slice(0, 3000) || null;
  } catch {
    return null;
  }
}

export async function describeImageFromUrl(url: string, caption?: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey || !url) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 180,
        messages: [
          {
            role: "system",
            content:
              "Descreva brevemente a imagem recebida no WhatsApp para auxiliar uma triagem juridica. Nao de parecer juridico. Responda em portugues do Brasil, em uma frase objetiva.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: caption ? `Legenda enviada pelo cliente: ${caption}` : "Imagem enviada pelo cliente." },
              { type: "image_url", image_url: { url } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return String(data.choices?.[0]?.message?.content || "").trim().slice(0, 1000) || null;
  } catch {
    return null;
  }
}
