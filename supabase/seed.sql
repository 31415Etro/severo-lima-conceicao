-- Create these users first in Supabase Auth, then replace the UUID values below
-- with the corresponding auth.users.id values.

insert into profiles (id, name, email, role, specialty) values
  ('00000000-0000-0000-0000-000000000001', 'Karine', 'karine@example.com', 'LAWYER', 'PREVIDENCIARIO'),
  ('00000000-0000-0000-0000-000000000002', 'Luiz', 'luiz@example.com', 'LAWYER', 'TRABALHISTA'),
  ('00000000-0000-0000-0000-000000000003', 'Ana', 'ana@example.com', 'LAWYER', 'CIVEL_FAMILIA'),
  ('00000000-0000-0000-0000-000000000004', 'Admin', 'admin@example.com', 'ADMIN', null)
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  specialty = excluded.specialty;
