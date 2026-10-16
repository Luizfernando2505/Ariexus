-- Fase 2: análises de oferta e limites de uso.
-- Rode uma vez no SQL Editor do Supabase (ou com `supabase db push`), depois da 0001.

-- Limites por plano. Só o servidor (migrações) altera; usuários só leem.
create table public.plan_limits (
  plano text primary key check (plano in ('beta', 'starter', 'pro', 'scale')),
  analises_mes int not null check (analises_mes >= 0),
  leituras_hora int not null check (leituras_hora >= 0)
);

insert into public.plan_limits (plano, analises_mes, leituras_hora) values
  ('beta', 10, 30),
  ('starter', 5, 30),
  ('pro', 12, 30),
  ('scale', 20, 30);

alter table public.plan_limits enable row level security;
revoke all on public.plan_limits from anon;
revoke insert, update, delete, truncate on public.plan_limits from authenticated;
create policy "limites: leitura" on public.plan_limits for select to authenticated using (true);

-- Cada leitura de página e cada análise gasta uma unidade. Só a função registrar_uso grava aqui.
create table public.usage_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('leitura', 'analise')),
  created_at timestamptz not null default now()
);

create index usage_events_owner_kind_created_idx on public.usage_events (owner_id, kind, created_at desc);

alter table public.usage_events enable row level security;
revoke all on public.usage_events from anon;
revoke insert, update, delete, truncate on public.usage_events from authenticated;
create policy "uso: ler o próprio" on public.usage_events
  for select to authenticated using (owner_id = (select auth.uid()));

-- Início da janela de cada tipo: análises contam no mês (horário de Brasília), leituras na última hora.
create function public.inicio_da_janela(p_kind text) returns timestamptz
language sql stable set search_path = '' as $$
  select case p_kind
    when 'analise' then date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
    else now() - interval '1 hour'
  end
$$;

-- Confere o limite e registra o uso numa só operação.
-- O trava por usuário impede que duas abas ao mesmo tempo passem do limite.
create function public.registrar_uso(p_kind text)
returns table (permitido boolean, usados int, limite int)
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_limite int;
  v_usados int;
begin
  if v_user is null then
    raise exception 'sessão necessária' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('leitura', 'analise') then
    raise exception 'tipo de uso inválido' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('registrar_uso:' || v_user::text, 0));

  select case when p_kind = 'analise' then l.analises_mes else l.leituras_hora end
    into v_limite
    from public.profiles p
    join public.plan_limits l on l.plano = p.plano
   where p.id = v_user;
  v_limite := coalesce(v_limite, 0);

  select count(*)::int into v_usados
    from public.usage_events e
   where e.owner_id = v_user
     and e.kind = p_kind
     and e.created_at >= public.inicio_da_janela(p_kind);

  if v_usados >= v_limite then
    return query select false, v_usados, v_limite;
    return;
  end if;

  insert into public.usage_events (owner_id, kind) values (v_user, p_kind);
  return query select true, v_usados + 1, v_limite;
end;
$$;

revoke all on function public.registrar_uso(text) from public, anon;
grant execute on function public.registrar_uso(text) to authenticated;

-- Uso atual, para mostrar na tela. Lê com as permissões de quem chama (RLS vale).
create function public.consultar_uso()
returns table (analises_usadas int, analises_limite int, leituras_usadas int, leituras_limite int)
language sql stable security invoker set search_path = '' as $$
  select
    (select count(*)::int from public.usage_events e
      where e.owner_id = auth.uid() and e.kind = 'analise' and e.created_at >= public.inicio_da_janela('analise')),
    coalesce(l.analises_mes, 0),
    (select count(*)::int from public.usage_events e
      where e.owner_id = auth.uid() and e.kind = 'leitura' and e.created_at >= public.inicio_da_janela('leitura')),
    coalesce(l.leituras_hora, 0)
  from public.profiles p
  left join public.plan_limits l on l.plano = p.plano
  where p.id = auth.uid()
$$;

revoke all on function public.consultar_uso() from public, anon;
grant execute on function public.consultar_uso() to authenticated;

-- Análises salvas no projeto. Não são editadas depois de criadas: uma nova análise é uma nova linha.
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null check (char_length(url) <= 2048),
  url_final text not null check (char_length(url_final) <= 2048),
  entrada jsonb not null,
  status text not null check (status in ('concluida', 'somente_leitura')),
  modo text not null check (modo in ('desligado', 'simulado', 'anthropic')),
  pagina jsonb not null check (pg_column_size(pagina) <= 20000),
  texto_pagina text not null check (char_length(texto_pagina) <= 60000),
  resultado jsonb check (pg_column_size(resultado) <= 100000),
  modelo text check (char_length(modelo) <= 100),
  tokens_entrada int check (tokens_entrada >= 0),
  tokens_saida int check (tokens_saida >= 0),
  custo_usd numeric(10, 6) check (custo_usd >= 0),
  created_at timestamptz not null default now(),
  -- Análise concluída sempre tem resultado; leitura sem IA nunca tem.
  check ((status = 'concluida') = (resultado is not null)),
  check ((status = 'somente_leitura') = (modo = 'desligado'))
);

create index analyses_project_created_idx on public.analyses (project_id, created_at desc);
create index analyses_owner_idx on public.analyses (owner_id);

alter table public.analyses enable row level security;
revoke all on public.analyses from anon;
revoke update, truncate on public.analyses from authenticated;

create policy "análises: ler as próprias" on public.analyses
  for select to authenticated using (owner_id = (select auth.uid()));

-- Só cria análise como dono e dentro de um projeto que também é seu.
create policy "análises: criar no próprio projeto" on public.analyses
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.projects p
       where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

create policy "análises: excluir as próprias" on public.analyses
  for delete to authenticated using (owner_id = (select auth.uid()));
