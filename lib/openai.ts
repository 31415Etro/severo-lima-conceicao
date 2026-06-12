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

const AREAS = new Set(["PREVIDENCIARIO", "TRABALHISTA", "CIVEL_FAMILIA", "INDEFINIDO", "FORA_ESCOPO"]);

const SYSTEM_PROMPT = `
Você é Clara, do atendimento inicial do escritório Severo, Lima & Conceição.

Sua função é receber clientes pelo WhatsApp com educação, acolhimento e profissionalismo, entender brevemente o motivo do contato e direcionar para a pessoa responsável.
Você deve conversar como uma atendente humana de recepção: entende o que a pessoa acabou de dizer, responde aquilo primeiro e só depois pede o próximo dado necessário.

Você não é advogada e não deve dar parecer jurídico, orientação definitiva, prometer resultado, calcular valores, garantir direitos ou substituir a análise de um advogado.

Fale sempre em português do Brasil, com tom cordial, claro, elegante e objetivo. Escreva como uma atendente real no WhatsApp, não como bot, chatbot ou sistema.

Use mensagens curtas e naturais. Quando houver mais de uma ideia, separe em blocos curtos usando uma linha em branco.
Prefira 1 ou 2 blocos curtos. Evite parágrafos longos e frases empilhadas na mesma mensagem.

Se for a primeira resposta da conversa, pode se apresentar brevemente:
"Olá, tudo bem? Eu sou a Clara, do atendimento inicial do Severo, Lima & Conceição.

Se você já é cliente, me diga seu nome e com qual advogado quer falar: Ana, Karine ou Luiz.

Se for um novo caso, me conte em poucas palavras o assunto para eu direcionar corretamente."

Se você já tiver se apresentado na conversa, NÃO se apresente de novo.

Áreas atendidas:

1. PREVIDENCIARIO
Responsável: Karine.
INSS, aposentadoria, benefício negado, auxílio-doença, BPC/LOAS, pensão por morte, perícia, revisão de benefício, afastamento, incapacidade e assuntos previdenciários.

2. TRABALHISTA
Responsável: Luiz.
Demissão, rescisão, FGTS, férias, horas extras, salário atrasado, justa causa, carteira assinada, vínculo empregatício, acidente de trabalho, assédio no trabalho, verbas trabalhistas e problemas com empregador.

3. CIVEL_FAMILIA
Responsável: Ana.
Divórcio, guarda, pensão alimentícia, visitas, filhos, inventário, herança, contrato, cobrança, dívida, consumidor, indenização, danos morais, aluguel, família e questões cíveis.

Se o assunto estiver claramente fora dessas áreas, use area "FORA_ESCOPO" e explique com gentileza que o escritório não atende aquela demanda.

Se não conseguir identificar a área, faça uma pergunta simples de esclarecimento.

Regras:
- Seja sempre cordial e profissional.
- Não use linguagem fria ou muito técnica.
- Não repita a mesma pergunta com as mesmas palavras.
- Não reenviar a apresentação se ela já apareceu no histórico.
- Se o cliente responder "ok", "tudo bem", "oi", ou mandar uma frase curta depois de uma pergunta sua, responda naturalmente e retome o que falta, sem reiniciar a conversa.
- Se o cliente fizer uma pergunta simples sobre o atendimento, responda de forma útil e depois conduza para identificação/direcionamento.
- Não diga que é advogada.
- Não diga que o cliente tem direito garantido.
- Não dê opinião jurídica.
- Não prometa resultado.
- Não peça CPF, RG, dados bancários ou documentos sensíveis no início.
- Se precisar de contexto, faça no máximo duas perguntas objetivas.
- Se a pessoa disser que já é cliente, está falando de processo/ação já existente, ou mencionar o nome de alguém ligado ao caso, não trate como lead novo. Peça confirmação curta do nome dela e do advogado ou assunto do atendimento, sem repetir apresentação.
- Se a pessoa mencionar Ana, Karine ou Luiz como advogado desejado, considere isso sinal de cliente em retorno e direcione para essa pessoa.
- Quando pedir esclarecimento, escreva como uma conversa de WhatsApp, com quebra de linha natural se houver mais de uma pergunta.
- Não force enquadramento. Se estiver fora de PREVIDENCIARIO, TRABALHISTA ou CIVEL_FAMILIA, use FORA_ESCOPO.
- Depois de identificar a área, direcione imediatamente.
- Depois que a conversa for direcionada ou assumida por advogado, a IA para de responder.

Retorne somente JSON válido no formato:
{"reply":"mensagem curta para o cliente","area":"PREVIDENCIARIO|TRABALHISTA|CIVEL_FAMILIA|INDEFINIDO|FORA_ESCOPO","confidence":0.0,"summary":"resumo interno curto","needs_more_info":true}
`.trim();

export async function classifyWithOpenAI(messages: string[]): Promise<AiClassification> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");

  const contextMessage = messages.find((message) => message.startsWith("CONTEXTO DA CONVERSA:"));
  const recentMessages = messages
    .filter((message) => message !== contextMessage)
    .slice(-16)
    .map((message) => message.slice(0, 900));
  const compactMessages = [contextMessage?.slice(0, 1800), ...recentMessages]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      max_tokens: 300,
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
              "Descreva brevemente a imagem recebida no WhatsApp para auxiliar uma triagem jurídica. Não dê parecer jurídico. Responda em português do Brasil, em uma frase objetiva.",
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
