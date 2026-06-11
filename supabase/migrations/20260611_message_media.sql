alter table messages
  add column if not exists media_type text check (media_type in ('TEXT','IMAGE','AUDIO','VIDEO','DOCUMENT')),
  add column if not exists media_url text,
  add column if not exists media_mime_type text,
  add column if not exists media_filename text,
  add column if not exists media_transcription text;

create index if not exists idx_messages_media_type on messages(media_type);
