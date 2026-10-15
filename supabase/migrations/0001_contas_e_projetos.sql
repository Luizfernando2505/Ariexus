-- Fase 1: perfis e projetos, cada usuário só enxerga o que é seu.
-- Rode uma vez no SQL Editor do Supabase (ou com `supabase db push`).

-- Perfil criado automaticamente para cada conta nova.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  perfil text check (perfil in ('afiliado', 'produtor', 'builder')),
  plano text not null default 'beta' check (plano in ('beta', 'starter', 'pro', 'scale')),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  kind text not null default 'campaign' check (kind in ('campaign', 'app')),
  form jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

-- updated_at sempre do servidor.
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- Ninguém troca o dono de um projeto.
create function public.keep_project_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'owner_id não pode mudar';
  end if;
  return new;
end;
$$;

create trigger projects_keep_owner before update on public.projects
  for each row execute function public.keep_project_owner();

-- Cria o perfil quando a conta nasce.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: a regra "cada um só vê o que é seu" mora no banco.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;

revoke all on public.profiles, public.projects from anon;

create policy "perfil: ler o próprio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "perfil: editar o próprio" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Plano só muda pelo servidor (pagamento, fase 5), nunca pelo usuário.
revoke update on public.profiles from authenticated;
grant update (perfil) on public.profiles to authenticated;

create policy "projetos: ler os próprios" on public.projects
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "projetos: criar como dono" on public.projects
  for insert to authenticated with check (owner_id = (select auth.uid()));

create policy "projetos: editar os próprios" on public.projects
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "projetos: excluir os próprios" on public.projects
  for delete to authenticated using (owner_id = (select auth.uid()));
