# Severo, Lima & Conceicao - Atendimento via WhatsApp

MVP em Next.js, TypeScript, Supabase, Z-API e OpenAI para triagem juridica via WhatsApp.

## Configuracao

1. Crie um projeto no Supabase.
2. Rode `supabase/schema.sql` no SQL Editor.
3. Crie os usuarios em Supabase Auth.
4. Ajuste os UUIDs em `supabase/seed.sql` para os IDs reais de `auth.users` e rode o seed.
5. Configure as variaveis de ambiente:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
ZAPI_INSTANCE_ID=
ZAPI_TOKEN=
ZAPI_CLIENT_TOKEN=
ZAPI_BASE_URL=https://api.z-api.io
WEBHOOK_SECRET=
APP_URL=https://seu-dominio.vercel.app
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app
```

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse `/login` e entre com um usuario criado no Supabase Auth.

## Z-API

Configure o webhook da Z-API para:

```text
POST https://seu-dominio.vercel.app/api/webhooks/zapi?secret=WEBHOOK_SECRET
```

Tambem e possivel entrar em `/settings/integrations` como ADMIN e clicar em `Configurar webhooks`. O sistema configura:

- `update-webhook-received`
- `update-webhook-delivery`
- `update-webhook-message-status`
- `update-notify-sent-by-me`

Todos apontam para a mesma rota `/api/webhooks/zapi`. A Z-API exige HTTPS em producao.

O webhook normaliza telefone, salva contato, cria conversa, salva mensagens recebidas, salva mensagens enviadas pelo proprio numero e atualiza status de delivery/leitura. Ele so chama IA quando:

```text
ai_enabled = true
status = BOT_TRIAGEM
assigned_lawyer_id is null
```

Mensagens enviadas pelo proprio numero conectado ao WhatsApp entram como `SYSTEM`, `OUTBOUND`, colocam a conversa em `EM_ATENDIMENTO` e desligam a IA.

## Supabase Realtime

O `schema.sql` adiciona `contacts`, `conversations` e `messages` na publicacao `supabase_realtime`. Com isso, `/conversations` e `/conversations/[id]` assinam mudancas do banco e atualizam automaticamente quando a Z-API envia um webhook ou quando alguem responde pelo painel.

## Economia de IA

O sistema tenta classificar por palavras-chave antes da OpenAI. Exemplos como INSS, rescisao e divorcio sao direcionados sem gastar tokens. A IA usa somente as ultimas 6 mensagens, texto limitado, `temperature 0.2` e resposta curta em JSON. Troque `OPENAI_MODEL` para um modelo mais barato disponivel na sua conta.

## Fluxo

- Previdenciario vai para Karine.
- Trabalhista vai para Luiz.
- Civil/Familia vai para Ana.
- Ao direcionar, assumir, responder manualmente ou encerrar, `ai_enabled` vira `false`.
- Se o cliente voltar depois de uma conversa encerrada, o webhook cria nova conversa com `ai_enabled = true`.

## Testes manuais

1. Envie uma mensagem real pelo WhatsApp conectado a Z-API.
2. Confira `contacts`, `conversations` e `messages` no Supabase.
3. Teste frases como "meu beneficio do INSS foi negado".
4. Verifique se a conversa foi atribuida a Karine e a IA foi desligada.
5. Entre no painel do advogado, assuma o atendimento e envie resposta.
6. Encerre a conversa e mande nova mensagem do mesmo telefone para confirmar nova triagem.

## Deploy Vercel

1. Envie o projeto para um repositorio Git.
2. Importe na Vercel.
3. Configure todas as variaveis de ambiente.
4. Rode o deploy.
5. Atualize a URL do webhook na Z-API para o dominio final.
