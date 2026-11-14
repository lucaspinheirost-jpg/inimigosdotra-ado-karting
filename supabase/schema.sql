-- Inimigos do Traçado · banco no Supabase
-- Rode uma vez no SQL Editor do projeto. Pode rodar de novo sem estragar nada.
--
-- Quem pode o quê:
--   público (sem login) → só lê o painel
--   admin (login + e-mail na tabela admins) → lança provas, envia e apaga arquivos

-- ---------- documentos do painel (provas, resultados, voltas, folhas, config) ----------
create table if not exists public.docs (
  colecao text not null,
  id text not null,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (colecao, id)
);

-- ---------- administradores ----------
create table if not exists public.admins (
  email text primary key check (email = lower(email))
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- regras (RLS) ----------
alter table public.docs enable row level security;
alter table public.admins enable row level security;

drop policy if exists "docs: todos leem" on public.docs;
create policy "docs: todos leem" on public.docs for select to anon, authenticated using (true);
drop policy if exists "docs: admin cria" on public.docs;
create policy "docs: admin cria" on public.docs for insert to authenticated with check (public.is_admin());
drop policy if exists "docs: admin altera" on public.docs;
create policy "docs: admin altera" on public.docs for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "docs: admin apaga" on public.docs;
create policy "docs: admin apaga" on public.docs for delete to authenticated using (public.is_admin());
-- a tabela admins não tem nenhuma regra de acesso: ninguém lê nem altera pelo app (só pelo painel do Supabase)

-- ---------- tempo real (o painel atualiza sozinho quando o admin lança uma prova) ----------
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- ---------- arquivos das provas (folhas do kartódromo) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', true, 20971520)
on conflict (id) do update set public = true, file_size_limit = 20971520;

drop policy if exists "arquivos: admin envia" on storage.objects;
create policy "arquivos: admin envia" on storage.objects for insert to authenticated with check (bucket_id = 'arquivos' and public.is_admin());
drop policy if exists "arquivos: admin altera" on storage.objects;
create policy "arquivos: admin altera" on storage.objects for update to authenticated using (bucket_id = 'arquivos' and public.is_admin());
drop policy if exists "arquivos: admin apaga" on storage.objects;
create policy "arquivos: admin apaga" on storage.objects for delete to authenticated using (bucket_id = 'arquivos' and public.is_admin());
drop policy if exists "arquivos: admin lista" on storage.objects;
create policy "arquivos: admin lista" on storage.objects for select to authenticated using (bucket_id = 'arquivos' and public.is_admin());

-- ---------- quem é admin ----------
-- Troque pelo e-mail do administrador (em minúsculas) e rode. Depois crie o usuário com esse e-mail
-- em Authentication → Users → Add user (marque "Auto Confirm User").
-- insert into public.admins (email) values ('email.do.admin@exemplo.com') on conflict do nothing;
