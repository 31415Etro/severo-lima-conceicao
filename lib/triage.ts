import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyByKeywords,
  INITIAL_BOT_MESSAGE,
  isRoutableArea,
  normalizeText,
  OUT_OF_SCOPE_MESSAGE,
  ROUTING_MESSAGES,
  UNKNOWN_AREA_MESSAGE,
} from "@/lib/classifier";
import { classifyWithOpenAI } from "@/lib/openai";
import { sendWhatsAppMessage } from "@/lib/zapi";
import type { Area, Conversation } from "@/lib/types";

type RoutableArea = "PREVIDENCIARIO" | "TRABALHISTA" | "CIVEL_FAMILIA";

export async function getLawyerByArea(area: Area) {
  if (area === "INDEFINIDO" || area === "FORA_ESCOPO") return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,name,email,role,specialty")
    .eq("role", "LAWYER")
    .eq("specialty", area)
    .maybeSingle();
  return data;
}

async function getLawyerMentioned(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const words = normalized.split(" ");

  const supabase = createAdminClient();
  const { data: lawyers } = await supabase.from("profiles").select("id,name,email,role,specialty").eq("role", "LAWYER");
  return (lawyers || []).find((lawyer) => {
    const normalizedName = normalizeText(String(lawyer.name || ""));
    const firstName = normalizedName.split(" ")[0];
    return Boolean(firstName && firstName.length >= 3 && (normalized.includes(normalizedName) || words.includes(firstName)));
  });
}

async function saveBotMessage(
  conversationId: string,
  content: string,
  zapi?: { messageId?: string; zaapId?: string; id?: string },
  error?: string
) {
  const supabase = createAdminClient();
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "BOT",
    direction: "OUTBOUND",
    content,
    media_type: "TEXT",
    zapi_message_id: zapi?.messageId || zapi?.id || null,
    zapi_zaap_id: zapi?.zaapId || null,
    delivery_status: error ? "ERROR" : zapi ? "QUEUED" : null,
    delivery_error: error || null,
  });
}

function splitBotReply(message: string) {
  const normalized = message
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const blocks = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks.slice(0, 3);

  if (normalized.length <= 160) return [normalized];
  const sentences = normalized.match(/[^.!?]+[.!?]+/g)?.map((part) => part.trim()).filter(Boolean) || [normalized];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const last = chunks[chunks.length - 1];
    if (last && `${last} ${sentence}`.length <= 160) {
      chunks[chunks.length - 1] = `${last} ${sentence}`;
    } else {
      chunks.push(sentence);
    }
  }
  return chunks.slice(0, 3);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendAndSaveBotMessages(conversationId: string, phone: string | null | undefined, message: string) {
  const chunks = splitBotReply(message);
  for (const [index, chunk] of chunks.entries()) {
    if (index > 0 && phone) await wait(700);
    const result = phone ? await sendWhatsAppMessage(phone, chunk) : null;
    await saveBotMessage(conversationId, chunk, result?.ok ? result.data : undefined, result && !result.ok ? result.error : undefined);
  }
}

function textForTriage(message: { content: unknown; media_type?: unknown; media_transcription?: unknown }) {
  const content = String(message.content || "").trim();
  const mediaTranscription = String(message.media_transcription || "").trim();
  if (!mediaTranscription) return content;

  if (message.media_type === "AUDIO") return `Áudio do cliente transcrito: ${mediaTranscription}`;
  if (message.media_type === "IMAGE") {
    const caption = content && content !== "Imagem recebida." ? `Legenda do cliente: ${content}\n` : "";
    return `${caption}Imagem recebida: ${mediaTranscription}`;
  }
  return [content, mediaTranscription].filter(Boolean).join("\n");
}

function botAlreadyAskedIntro(messages: { content: unknown; sender_type: unknown }[]) {
  return messages.some((message) => {
    if (message.sender_type !== "BOT") return false;
    const content = normalizeText(String(message.content || ""));
    return (
      content.includes("sou a clara") ||
      content.includes("pode me dizer seu nome") ||
      content.includes("poderia me informar seu nome") ||
      content.includes("se voce ja e cliente") ||
      content.includes("se for um novo caso")
    );
  });
}

function botAlreadyAskedArea(messages: { content: unknown; sender_type: unknown }[]) {
  return messages.some((message) => {
    if (message.sender_type !== "BOT") return false;
    const content = normalizeText(String(message.content || ""));
    return content.includes("inss ou aposentadoria") && content.includes("trabalho") && content.includes("civil");
  });
}

function isRepeatedPrompt(reply: string, askedIntro: boolean, askedArea: boolean) {
  const content = normalizeText(reply);
  if (askedIntro && (content.includes("sou a clara") || content.includes("pode me dizer seu nome") || content.includes("poderia me informar seu nome"))) {
    return true;
  }
  if (askedArea && content.includes("inss ou aposentadoria") && content.includes("trabalho")) return true;
  return false;
}

function botAlreadySentReply(messages: { content: unknown; sender_type: unknown }[], reply: string) {
  const normalizedReply = normalizeText(reply);
  if (!normalizedReply) return true;
  return messages.some((message) => message.sender_type === "BOT" && normalizeText(String(message.content || "")) === normalizedReply);
}

function formatConversationForAi(message: { content: unknown; sender_type: unknown; media_type?: unknown; media_transcription?: unknown }) {
  const content = textForTriage(message);
  if (!content) return "";
  if (message.sender_type === "CLIENT") return `CLIENTE: ${content}`;
  if (message.sender_type === "BOT") return `CLARA: ${content}`;
  if (message.sender_type === "LAWYER") return `ADVOGADO: ${content}`;
  return `EQUIPE: ${content}`;
}

function buildConversationMemory(conversation: Conversation, messages: { content: unknown; sender_type: unknown }[]) {
  const lastBot = [...messages].reverse().find((message) => message.sender_type === "BOT");
  const lastClient = [...messages].reverse().find((message) => message.sender_type === "CLIENT");
  const botQuestions = messages
    .filter((message) => message.sender_type === "BOT")
    .map((message) => String(message.content || "").trim())
    .filter(Boolean)
    .slice(-3);

  return [
    "CONTEXTO DA CONVERSA:",
    `Status atual: ${conversation.status}`,
    `Área atual: ${conversation.area}`,
    `IA ligada: ${conversation.ai_enabled ? "sim" : "não"}`,
    `Resumo interno atual: ${conversation.summary || "ainda sem resumo"}`,
    `Última fala do cliente: ${lastClient ? String(lastClient.content || "").trim() : "nenhuma"}`,
    `Última resposta da Clara: ${lastBot ? String(lastBot.content || "").trim() : "nenhuma"}`,
    botQuestions.length ? `Perguntas recentes já feitas pela Clara: ${botQuestions.join(" | ")}` : "Perguntas recentes já feitas pela Clara: nenhuma",
    "Use esse contexto para continuar a conversa sem reiniciar, sem repetir perguntas e sem ignorar o que já aconteceu.",
  ].join("\n");
}

async function routeConversation(conversation: Conversation, area: RoutableArea, confidence: number, summary: string) {
  const supabase = createAdminClient();
  const lawyer = await getLawyerByArea(area);
  await supabase
    .from("conversations")
    .update({
      area,
      confidence,
      summary,
      assigned_lawyer_id: lawyer?.id || null,
      status: "AGUARDANDO_ADVOGADO",
      ai_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation.id);

  const { data: contact } = await supabase.from("contacts").select("phone").eq("id", conversation.contact_id).single();
  await sendAndSaveBotMessages(conversation.id, contact?.phone, ROUTING_MESSAGES[area]);
}

async function routeConversationToLawyer(conversation: Conversation, lawyer: { id: string; name: string; specialty: Area | null }, summary: string) {
  const supabase = createAdminClient();
  const area = isRoutableArea(lawyer.specialty || "INDEFINIDO") ? lawyer.specialty : "INDEFINIDO";
  await supabase
    .from("conversations")
    .update({
      area,
      confidence: 0.95,
      summary,
      assigned_lawyer_id: lawyer.id,
      status: "AGUARDANDO_ADVOGADO",
      ai_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation.id);

  const { data: contact } = await supabase.from("contacts").select("phone").eq("id", conversation.contact_id).single();
  await sendAndSaveBotMessages(
    conversation.id,
    contact?.phone,
    `Certo, vou direcionar seu atendimento para ${lawyer.name}.\n\nA continuidade será feita por aqui.`
  );
}

async function closeOutOfScopeConversation(conversation: Conversation, confidence: number, summary: string) {
  const supabase = createAdminClient();
  await supabase
    .from("conversations")
    .update({
      area: "FORA_ESCOPO",
      confidence,
      summary,
      assigned_lawyer_id: null,
      status: "ENCERRADO",
      ai_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation.id);

  const { data: contact } = await supabase.from("contacts").select("phone").eq("id", conversation.contact_id).single();
  await sendAndSaveBotMessages(conversation.id, contact?.phone, OUT_OF_SCOPE_MESSAGE);
}

export async function classifyAndReply(conversationId: string) {
  const supabase = createAdminClient();
  const { data: conversation } = await supabase.from("conversations").select("*").eq("id", conversationId).single();
  if (!conversation) return;

  const current = conversation as Conversation;
  if (!current.ai_enabled) return;
  if (current.status !== "BOT_TRIAGEM") return;
  if (current.assigned_lawyer_id) return;
  if (current.area !== "INDEFINIDO" && Number(current.confidence || 0) >= 0.75) return;

  const { data: messages } = await supabase
    .from("messages")
    .select("content,sender_type,created_at,media_type,media_transcription")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(24);

  const ordered = (messages || []).reverse();
  const clientMessages = ordered.filter((message) => message.sender_type === "CLIENT");
  const askedIntro = botAlreadyAskedIntro(ordered);
  const askedArea = botAlreadyAskedArea(ordered);
  const clientJoined = clientMessages.map(textForTriage).join("\n").trim();
  const latestClientText = textForTriage(clientMessages.at(-1) || { content: "" });
  if (clientJoined.length < 2) return;

  const mentionedLawyer = await getLawyerMentioned(latestClientText);
  if (mentionedLawyer) {
    await supabase.from("ai_logs").insert({
      conversation_id: conversationId,
      model: "lawyer-name",
      classification: mentionedLawyer.specialty || "INDEFINIDO",
      confidence: 0.95,
      cost_estimate: 0,
    });
    await routeConversationToLawyer(current, mentionedLawyer as { id: string; name: string; specialty: Area | null }, clientJoined.slice(0, 1000));
    return;
  }

  const latestKeyword = classifyByKeywords(latestClientText);
  if (isRoutableArea(latestKeyword.area) && latestKeyword.confidence >= 0.8) {
    await supabase.from("ai_logs").insert({
      conversation_id: conversationId,
      model: "keywords",
      classification: latestKeyword.area,
      confidence: latestKeyword.confidence,
      cost_estimate: 0,
    });
    await routeConversation(current, latestKeyword.area, latestKeyword.confidence, clientJoined.slice(0, 1000));
    return;
  }

  const keyword = classifyByKeywords(clientJoined);
  if (isRoutableArea(keyword.area) && keyword.confidence >= 0.8) {
    await supabase.from("ai_logs").insert({
      conversation_id: conversationId,
      model: "keywords",
      classification: keyword.area,
      confidence: keyword.confidence,
      cost_estimate: 0,
    });
    await routeConversation(current, keyword.area, keyword.confidence, clientJoined.slice(0, 1000));
    return;
  }

  const normalizedClientText = normalizeText(clientJoined);
  const simpleGreeting = ["oi", "ola", "bom dia", "boa tarde", "boa noite"].includes(normalizedClientText);
  if (clientMessages.length <= 1 && (simpleGreeting || clientJoined.length < 30)) {
    if (askedIntro) return;
    const { data: contact } = await supabase.from("contacts").select("phone").eq("id", current.contact_id).single();
    await sendAndSaveBotMessages(conversationId, contact?.phone, INITIAL_BOT_MESSAGE);
    return;
  }

  let ai;
  try {
    ai = await classifyWithOpenAI(
      [
        buildConversationMemory(current, ordered),
        ...ordered
        .map(formatConversationForAi)
        .filter(Boolean),
      ]
    );
  } catch {
    return;
  }

  await supabase.from("ai_logs").insert({
    conversation_id: conversationId,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input_tokens: ai.input_tokens,
    output_tokens: ai.output_tokens,
    cost_estimate: null,
    classification: ai.area,
    confidence: ai.confidence,
  });

  const { data: fresh } = await supabase.from("conversations").select("*").eq("id", conversationId).single();
  if (!fresh?.ai_enabled || fresh.status !== "BOT_TRIAGEM" || fresh.assigned_lawyer_id) return;

  if (isRoutableArea(ai.area) && ai.confidence >= 0.75 && !ai.needs_more_info) {
    await routeConversation(fresh as Conversation, ai.area, ai.confidence, ai.summary);
    return;
  }

  if (ai.area === "FORA_ESCOPO" && ai.confidence >= 0.7 && !ai.needs_more_info) {
    await closeOutOfScopeConversation(fresh as Conversation, ai.confidence, ai.summary);
    return;
  }

  await supabase
    .from("conversations")
    .update({
      area: ai.area,
      confidence: ai.confidence,
      summary: ai.summary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  const { data: contact } = await supabase.from("contacts").select("phone").eq("id", fresh.contact_id).single();
  const reply = ai.reply || UNKNOWN_AREA_MESSAGE;
  if (isRepeatedPrompt(reply, askedIntro, askedArea)) return;
  if (botAlreadySentReply(ordered, reply)) return;
  await sendAndSaveBotMessages(conversationId, contact?.phone, reply);
}
