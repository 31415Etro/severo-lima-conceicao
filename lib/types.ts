export type Area = "PREVIDENCIARIO" | "TRABALHISTA" | "CIVEL_FAMILIA" | "INDEFINIDO";
export type ConversationStatus = "BOT_TRIAGEM" | "AGUARDANDO_ADVOGADO" | "EM_ATENDIMENTO" | "ENCERRADO";
export type Role = "ADMIN" | "LAWYER";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  specialty: Area | null;
};

export type Conversation = {
  id: string;
  contact_id: string;
  assigned_lawyer_id: string | null;
  area: Area;
  status: ConversationStatus;
  ai_enabled: boolean;
  summary: string | null;
  confidence: number | null;
  unread_count?: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_type: "CLIENT" | "BOT" | "LAWYER" | "SYSTEM";
  sender_id: string | null;
  content: string;
  direction: "INBOUND" | "OUTBOUND";
  zapi_message_id?: string | null;
  zapi_zaap_id?: string | null;
  delivery_status?: "QUEUED" | "SENT" | "RECEIVED" | "READ" | "READ_BY_ME" | "PLAYED" | "ERROR" | null;
  delivery_error?: string | null;
  created_at: string;
};
