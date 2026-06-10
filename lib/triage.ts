import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyByKeywords,
  INITIAL_BOT_MESSAGE,
  isRoutableArea,
  normalizeText,
  ROUTING_MESSAGES,
  UNKNOWN_AREA_MESSAGE,
} from "@/lib/classifier";
import { classifyWithOpenAI } from "@/lib/openai";
import { sendWhatsAppMessage } from "@/lib/zapi";
import type { Area, Conversation } from "@/lib/types";

export async function getLawyerByArea(area: Area) {
  if (area === "INDEFINIDO") return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,name,email,role,specialty")
    .eq("role", "LAWYER")
    .eq("specialty", area)
    .maybeSingle();
  return data;
}

async function saveBotMessage(
  conversationId: string,
  content: string,
  zapi?: { messageId?: string; zaapId?: string; id?: string }
) {
  const supabase = createAdminClient();
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "BOT",
    direction: "OUTBOUND",
    content,
    zapi_message_id: zapi?.messageId || zapi?.id || null,
    zapi_zaap_id: zapi?.zaapId || null,
    delivery_status: zapi ? "QUEUED" : null,
  });
}

async function routeConversation(conversation: Conversation, area: Exclude<Area, "INDEFINIDO">, confidence: number, summary: string) {
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
  const reply = ROUTING_MESSAGES[area];
  const result = contact?.phone ? await sendWhatsAppMessage(contact.phone, reply) : null;
  await saveBotMessage(conversation.id, reply, result?.ok ? result.data : undefined);
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
    .select("content,sender_type,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(6);

  const ordered = (messages || []).reverse();
  const joined = ordered.map((message) => String(message.content || "")).join("\n").trim();
  if (joined.length < 2) return;

  const keyword = classifyByKeywords(joined);
  if (isRoutableArea(keyword.area) && keyword.confidence >= 0.8) {
    await supabase.from("ai_logs").insert({
      conversation_id: conversationId,
      model: "keywords",
      classification: keyword.area,
      confidence: keyword.confidence,
      cost_estimate: 0,
    });
    await routeConversation(current, keyword.area, keyword.confidence, joined.slice(0, 1000));
    return;
  }

  const clientMessages = ordered.filter((message) => message.sender_type === "CLIENT");
  const normalizedJoined = normalizeText(joined);
  const simpleGreeting = ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite"].includes(normalizedJoined);
  if (clientMessages.length <= 1 && (simpleGreeting || joined.length < 30)) {
    const { data: contact } = await supabase.from("contacts").select("phone").eq("id", current.contact_id).single();
    const result = contact?.phone ? await sendWhatsAppMessage(contact.phone, INITIAL_BOT_MESSAGE) : null;
    await saveBotMessage(conversationId, INITIAL_BOT_MESSAGE, result?.ok ? result.data : undefined);
    return;
  }

  let ai;
  try {
    ai = await classifyWithOpenAI(ordered.map((message) => `${message.sender_type}: ${message.content}`));
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
  const result = contact?.phone ? await sendWhatsAppMessage(contact.phone, reply) : null;
  await saveBotMessage(conversationId, reply, result?.ok ? result.data : undefined);
}
