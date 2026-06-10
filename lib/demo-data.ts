import type { Message, Profile } from "@/lib/types";

type DemoConversationRow = {
  id: string;
  area: "PREVIDENCIARIO" | "TRABALHISTA" | "CIVEL_FAMILIA" | "INDEFINIDO";
  status: "BOT_TRIAGEM" | "AGUARDANDO_ADVOGADO" | "EM_ATENDIMENTO" | "ENCERRADO";
  ai_enabled: boolean;
  unread_count: number;
  last_message_at: string;
  contacts: { name: string | null; phone: string };
  profiles: { name: string } | null;
  messages: { content: string; created_at: string }[];
};

export const demoLawyers: Profile[] = [
  {
    id: "demo-lawyer",
    name: "Karine Demo",
    email: "advogado@teste.com",
    role: "LAWYER",
    specialty: "PREVIDENCIARIO",
  },
];

export const demoConversations: DemoConversationRow[] = [
  {
    id: "demo-1",
    area: "PREVIDENCIARIO",
    status: "AGUARDANDO_ADVOGADO",
    ai_enabled: false,
    unread_count: 2,
    last_message_at: new Date().toISOString(),
    contacts: { name: "Maria Aparecida", phone: "5511999990001" },
    profiles: { name: "Karine Demo" },
    messages: [
      {
        content: "Meu beneficio do INSS foi negado e preciso de ajuda.",
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "demo-2",
    area: "PREVIDENCIARIO",
    status: "EM_ATENDIMENTO",
    ai_enabled: false,
    unread_count: 0,
    last_message_at: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    contacts: { name: "Joao Pereira", phone: "5511988880002" },
    profiles: { name: "Karine Demo" },
    messages: [
      {
        content: "Enviei os documentos que voce pediu.",
        created_at: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
      },
    ],
  },
  {
    id: "demo-3",
    area: "PREVIDENCIARIO",
    status: "AGUARDANDO_ADVOGADO",
    ai_enabled: false,
    unread_count: 1,
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    contacts: { name: "Carlos Souza", phone: "5511977770003" },
    profiles: { name: "Karine Demo" },
    messages: [
      {
        content: "Quero saber sobre aposentadoria por idade.",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      },
    ],
  },
];

export const demoConversationDetail = {
  id: "demo-1",
  area: "PREVIDENCIARIO",
  status: "AGUARDANDO_ADVOGADO",
  ai_enabled: false,
  summary: "Cliente relata beneficio do INSS negado e deseja orientacao inicial com advogado previdenciario.",
  assigned_lawyer_id: "demo-lawyer",
  contacts: { name: "Maria Aparecida", phone: "5511999990001" },
  profiles: { name: "Karine Demo" },
} as const;

export const demoMessages: Message[] = [
  {
    id: "demo-msg-1",
    conversation_id: "demo-1",
    sender_type: "CLIENT",
    sender_id: null,
    content: "Oi, boa tarde.",
    direction: "INBOUND",
    delivery_status: "RECEIVED",
    created_at: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
  },
  {
    id: "demo-msg-2",
    conversation_id: "demo-1",
    sender_type: "BOT",
    sender_id: null,
    content:
      "Ola! Voce esta falando com o atendimento do Severo, Lima & Conceicao. Para te direcionar corretamente, me informe seu nome e conte brevemente qual e o seu caso.",
    direction: "OUTBOUND",
    delivery_status: "READ",
    created_at: new Date(Date.now() - 1000 * 60 * 21).toISOString(),
  },
  {
    id: "demo-msg-3",
    conversation_id: "demo-1",
    sender_type: "CLIENT",
    sender_id: null,
    content: "Meu nome e Maria. Meu beneficio do INSS foi negado e eu nao sei o que fazer.",
    direction: "INBOUND",
    delivery_status: "RECEIVED",
    created_at: new Date(Date.now() - 1000 * 60 * 19).toISOString(),
  },
  {
    id: "demo-msg-4",
    conversation_id: "demo-1",
    sender_type: "BOT",
    sender_id: null,
    content:
      "Obrigado pelas informacoes. Pelo que voce relatou, seu caso parece estar relacionado a area previdenciaria. Vou direcionar seu atendimento para a Karine, responsavel por essa area. Ela dara continuidade por aqui.",
    direction: "OUTBOUND",
    delivery_status: "READ",
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "demo-msg-5",
    conversation_id: "demo-1",
    sender_type: "CLIENT",
    sender_id: null,
    content: "Certo. Tenho a carta de indeferimento e alguns exames tambem.",
    direction: "INBOUND",
    delivery_status: "RECEIVED",
    created_at: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
  },
];
