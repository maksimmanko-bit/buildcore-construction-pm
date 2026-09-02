create table if not exists public.client_error_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  message text not null,
  stack text,
  source text,
  path text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_error_logs_company_created_idx
  on public.client_error_logs(company_id, created_at desc);

alter table public.client_error_logs enable row level security;

drop policy if exists "members create client error logs" on public.client_error_logs;
create policy "members create client error logs"
  on public.client_error_logs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = client_error_logs.company_id
        and p.is_active = true
    )
  );

drop policy if exists "managers read client error logs" on public.client_error_logs;
create policy "managers read client error logs"
  on public.client_error_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = client_error_logs.company_id
        and p.role in ('owner', 'project_manager', 'office_manager')
        and p.is_active = true
    )
  );

grant select, insert on public.client_error_logs to authenticated;
