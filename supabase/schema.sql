create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('ADMIN','LAWYER')),
  specialty text check (specialty in ('PREVIDENCIARIO','TRABALHISTA','CIVEL_FAMILIA')),
  created_at timestamptz default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  assigned_lawyer_id uuid references profiles(id) on delete set null,
  area text not null default 'INDEFINIDO' check (area in ('PREVIDENCIARIO','TRABALHISTA','CIVEL_FAMILIA','INDEFINIDO')),
  status text not null default 'BOT_TRIAGEM' check (status in ('BOT_TRIAGEM','AGUARDANDO_ADVOGADO','EM_ATENDIMENTO','ENCERRADO')),
  ai_enabled boolean not null default true,
  summary text,
  confidence numeric,
  unread_count integer not null default 0,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('CLIENT','BOT','LAWYER','SYSTEM')),
  sender_id uuid references profiles(id) on delete set null,
  content text not null,
  direction text not null check (direction in ('INBOUND','OUTBOUND')),
  media_type text check (media_type in ('TEXT','IMAGE','AUDIO','VIDEO','DOCUMENT')),
  media_url text,
  media_mime_type text,
  media_filename text,
  media_transcription text,
  zapi_message_id text,
  zapi_zaap_id text,
  delivery_status text check (delivery_status in ('QUEUED','SENT','RECEIVED','READ','READ_BY_ME','PLAYED','ERROR')),
  delivery_error text,
  created_at timestamptz default now()
);

create table if not exists ai_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  model text,
  input_tokens integer,
  output_tokens integer,
  cost_estimate numeric,
  classification text,
  confidence numeric,
  created_at timestamptz default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contacts_phone on contacts(phone);
create index if not exists idx_conversations_contact on conversations(contact_id);
create index if not exists idx_conversations_lawyer on conversations(assigned_lawyer_id);
create index if not exists idx_conversations_status on conversations(status);
create index if not exists idx_conversations_area on conversations(area);
create index if not exists idx_conversations_ai_enabled on conversations(ai_enabled);
create index if not exists idx_messages_conversation_created on messages(conversation_id, created_at);
create index if not exists idx_messages_zapi_message_id on messages(zapi_message_id);
create index if not exists idx_messages_zapi_zaap_id on messages(zapi_zaap_id);
create index if not exists idx_messages_media_type on messages(media_type);

do $$
begin
  begin
    alter publication supabase_realtime add table contacts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table conversations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table messages;
  exception when duplicate_object then null;
  end;
end;
$$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contacts_updated_at on contacts;
create trigger contacts_updated_at before update on contacts for each row execute function set_updated_at();

drop trigger if exists conversations_updated_at on conversations;
create trigger conversations_updated_at before update on conversations for each row execute function set_updated_at();

drop trigger if exists settings_updated_at on settings;
create trigger settings_updated_at before update on settings for each row execute function set_updated_at();

create or replace function current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

alter table profiles enable row level security;
alter table contacts enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table ai_logs enable row level security;
alter table settings enable row level security;

drop policy if exists profiles_select_own_or_admin on profiles;
create policy profiles_select_own_or_admin on profiles
for select using (id = auth.uid() or current_user_is_admin());

drop policy if exists profiles_admin_all on profiles;
create policy profiles_admin_all on profiles
for all using (current_user_is_admin()) with check (current_user_is_admin());

drop policy if exists contacts_admin_all on contacts;
create policy contacts_admin_all on contacts
for all using (current_user_is_admin()) with check (current_user_is_admin());

drop policy if exists contacts_lawyer_select_assigned on contacts;
create policy contacts_lawyer_select_assigned on contacts
for select using (
  exists (
    select 1 from conversations
    where conversations.contact_id = contacts.id
      and conversations.assigned_lawyer_id = auth.uid()
  )
);

drop policy if exists conversations_admin_all on conversations;
create policy conversations_admin_all on conversations
for all using (current_user_is_admin()) with check (current_user_is_admin());

drop policy if exists conversations_lawyer_select_assigned on conversations;
create policy conversations_lawyer_select_assigned on conversations
for select using (assigned_lawyer_id = auth.uid());

drop policy if exists conversations_lawyer_update_assigned on conversations;
create policy conversations_lawyer_update_assigned on conversations
for update using (assigned_lawyer_id = auth.uid())
with check (assigned_lawyer_id = auth.uid() and ai_enabled = false);

drop policy if exists messages_admin_all on messages;
create policy messages_admin_all on messages
for all using (current_user_is_admin()) with check (current_user_is_admin());

drop policy if exists messages_lawyer_select_assigned on messages;
create policy messages_lawyer_select_assigned on messages
for select using (
  exists (
    select 1 from conversations
    where conversations.id = messages.conversation_id
      and conversations.assigned_lawyer_id = auth.uid()
  )
);

drop policy if exists messages_lawyer_insert_assigned on messages;
create policy messages_lawyer_insert_assigned on messages
for insert with check (
  sender_type = 'LAWYER'
  and sender_id = auth.uid()
  and exists (
    select 1 from conversations
    where conversations.id = messages.conversation_id
      and conversations.assigned_lawyer_id = auth.uid()
  )
);

drop policy if exists ai_logs_admin_all on ai_logs;
create policy ai_logs_admin_all on ai_logs
for all using (current_user_is_admin()) with check (current_user_is_admin());

drop policy if exists ai_logs_lawyer_select_assigned on ai_logs;
create policy ai_logs_lawyer_select_assigned on ai_logs
for select using (
  exists (
    select 1 from conversations
    where conversations.id = ai_logs.conversation_id
      and conversations.assigned_lawyer_id = auth.uid()
  )
);

drop policy if exists settings_admin_all on settings;
create policy settings_admin_all on settings
for all using (current_user_is_admin()) with check (current_user_is_admin());
