alter table public.change_orders
  add column if not exists proposed_work text;

do $$
begin
  update public.change_orders
  set status = case when status = 'completed' then 'approved' else 'requested' end
  where status is null or status not in ('requested', 'approved');
end $$;

alter table public.change_orders
  alter column status set default 'requested';

alter table public.change_orders
  drop constraint if exists change_orders_status_check,
  add constraint change_orders_status_check check (status in ('requested', 'approved'));

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  change_order_id uuid references public.change_orders(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_company_created_idx on public.notifications(company_id, created_at desc);

alter table public.notifications enable row level security;
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
for select to authenticated
using (company_id = public.current_company_id() and recipient_id = auth.uid());

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications
for update to authenticated
using (company_id = public.current_company_id() and recipient_id = auth.uid())
with check (company_id = public.current_company_id() and recipient_id = auth.uid());

drop policy if exists "active members create company notifications" on public.notifications;
create policy "active members create company notifications" on public.notifications
for insert to authenticated
with check (company_id = public.current_company_id() and actor_id = auth.uid());

grant select, insert, update on public.notifications to authenticated;

create or replace function public.global_search(search_query text)
returns table (
  id text,
  type text,
  title text,
  subtitle text,
  snippet text,
  file_kind text
)
language sql
stable
security definer
set search_path = public
as $$
  select concat('project-', p.id), 'project', p.name, coalesce(p.job_number, '') || ' / ' || p.address,
    left(coalesce(p.job_number, '') || ' ' || coalesce(p.description, ''), 220), null::text
  from public.projects p
  where p.company_id = public.current_company_id()
    and (p.job_number ilike '%' || search_query || '%'
      or p.name ilike '%' || search_query || '%'
      or p.address ilike '%' || search_query || '%'
      or p.contact_name ilike '%' || search_query || '%'
      or p.contact_email ilike '%' || search_query || '%'
      or p.contact_phone ilike '%' || search_query || '%'
      or p.description ilike '%' || search_query || '%')

  union all

  select concat('person-', pr.id), 'person', pr.full_name, pr.trade,
    pr.phone, null::text
  from public.profiles pr
  where pr.company_id = public.current_company_id()
    and (pr.full_name ilike '%' || search_query || '%'
      or pr.trade ilike '%' || search_query || '%'
      or pr.phone ilike '%' || search_query || '%'
      or pr.role::text ilike '%' || search_query || '%')

  union all

  select concat('equipment-', e.id), 'equipment', e.name, e.type,
    coalesce(e.unit_number, '') || ' ' || coalesce(e.notes, ''), null::text
  from public.equipment e
  where e.company_id = public.current_company_id()
    and (e.name ilike '%' || search_query || '%'
      or e.type ilike '%' || search_query || '%'
      or e.unit_number ilike '%' || search_query || '%'
      or e.notes ilike '%' || search_query || '%')

  union all

  select concat('visit-', v.id), 'visit', p.name, v.visit_date::text,
    left(coalesce(v.work_scope, '') || ' ' || coalesce(v.completion_notes, '') || ' ' || coalesce(v.office_notes, ''), 220), null::text
  from public.visits v
  join public.projects p on p.id = v.project_id
  where v.company_id = public.current_company_id()
    and (v.work_scope ilike '%' || search_query || '%'
      or v.completion_notes ilike '%' || search_query || '%'
      or v.office_notes ilike '%' || search_query || '%'
      or p.name ilike '%' || search_query || '%')

  union all

  select concat('siteVisit-', sv.id), 'siteVisit', p.name, 'Site Inspection / ' || sv.visit_date::text,
    left(coalesce(sv.description, '') || ' ' || coalesce(p.address, ''), 220), null::text
  from public.site_visits sv
  join public.projects p on p.id = sv.project_id
  where sv.company_id = public.current_company_id()
    and (sv.description ilike '%' || search_query || '%'
      or p.name ilike '%' || search_query || '%'
      or p.address ilike '%' || search_query || '%')

  union all

  select concat('changeOrder-', co.id), 'changeOrder', p.name, coalesce(co.order_number, 'Change Order') || ' / ' || co.order_date::text,
    left(coalesce(co.description, '') || ' ' || coalesce(co.proposed_work, '') || ' ' || coalesce(co.approved_by, '') || ' ' || coalesce(co.order_number, '') || ' ' || coalesce(p.address, ''), 220), null::text
  from public.change_orders co
  join public.projects p on p.id = co.project_id
  where co.company_id = public.current_company_id()
    and (co.description ilike '%' || search_query || '%'
      or co.proposed_work ilike '%' || search_query || '%'
      or co.approved_by ilike '%' || search_query || '%'
      or co.order_number ilike '%' || search_query || '%'
      or p.name ilike '%' || search_query || '%'
      or p.address ilike '%' || search_query || '%')

  union all

  select concat('file-', vf.id), 'file', vf.file_name, p.name,
    ts_headline('english', coalesce(vf.photo_caption, '') || ' ' || coalesce(vf.search_text, vf.file_name), plainto_tsquery('english', search_query), 'MaxWords=22, MinWords=8'),
    vf.file_kind
  from public.visit_files vf
  join public.projects p on p.id = vf.project_id
  where vf.company_id = public.current_company_id()
    and (vf.search_vector @@ plainto_tsquery('english', search_query)
      or vf.file_name ilike '%' || search_query || '%')
  limit 30;
$$;
