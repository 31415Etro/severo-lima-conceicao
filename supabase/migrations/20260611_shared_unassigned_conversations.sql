drop policy if exists conversations_lawyer_select_assigned on conversations;
create policy conversations_lawyer_select_assigned on conversations
for select using (
  assigned_lawyer_id = auth.uid()
  or (assigned_lawyer_id is null and area in ('INDEFINIDO','FORA_ESCOPO'))
);

drop policy if exists messages_lawyer_select_assigned on messages;
create policy messages_lawyer_select_assigned on messages
for select using (
  exists (
    select 1 from conversations
    where conversations.id = messages.conversation_id
      and (
        conversations.assigned_lawyer_id = auth.uid()
        or (conversations.assigned_lawyer_id is null and conversations.area in ('INDEFINIDO','FORA_ESCOPO'))
      )
  )
);

drop policy if exists ai_logs_lawyer_select_assigned on ai_logs;
create policy ai_logs_lawyer_select_assigned on ai_logs
for select using (
  exists (
    select 1 from conversations
    where conversations.id = ai_logs.conversation_id
      and (
        conversations.assigned_lawyer_id = auth.uid()
        or (conversations.assigned_lawyer_id is null and conversations.area in ('INDEFINIDO','FORA_ESCOPO'))
      )
  )
);
