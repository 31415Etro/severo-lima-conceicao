alter table conversations
  drop constraint if exists conversations_area_check;

alter table conversations
  add constraint conversations_area_check
  check (area in ('PREVIDENCIARIO','TRABALHISTA','CIVEL_FAMILIA','INDEFINIDO','FORA_ESCOPO'));
