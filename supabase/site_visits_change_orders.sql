create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  visit_date date not null default current_date,
  start_time time not null default '07:00',
  end_time time not null default '17:00',
  status text not null default 'planned',
  description text,
  created_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_visits_status_check check (status in ('planned', 'completed', 'cancelled')),
  constraint site_visits_time_check check (start_time < end_time)
);

create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  order_date date not null default current_date,
  order_time time not null default current_time,
  status text not null default 'planned',
  description text,
  approved_by text,
  approval_signature text,
  created_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_orders_status_check check (status in ('planned', 'completed', 'cancelled'))
);

alter table public.visit_files
  add column if not exists site_visit_id uuid references public.site_visits(id) on delete cascade,
  add column if not exists change_order_id uuid references public.change_orders(id) on delete cascade,
  add column if not exists folder_name text,
  add column if not exists folder_description text;

create index if not exists site_visits_company_date_idx on public.site_visits(company_id, visit_date);
create index if not exists site_visits_project_date_idx on public.site_visits(project_id, visit_date);
create index if not exists change_orders_company_date_idx on public.change_orders(company_id, order_date);
create index if not exists change_orders_project_date_idx on public.change_orders(project_id, order_date);
create index if not exists visit_files_site_visit_idx on public.visit_files(site_visit_id);
create index if not exists visit_files_change_order_idx on public.visit_files(change_order_id);

drop trigger if exists touch_site_visits_updated_at on public.site_visits;
create trigger touch_site_visits_updated_at
before update on public.site_visits
for each row execute function public.touch_updated_at();

drop trigger if exists touch_change_orders_updated_at on public.change_orders;
create trigger touch_change_orders_updated_at
before update on public.change_orders
for each row execute function public.touch_updated_at();

alter table public.site_visits enable row level security;
alter table public.change_orders enable row level security;
alter table public.site_visits replica identity full;
alter table public.change_orders replica identity full;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['site_visits', 'change_orders']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

drop policy if exists "members read site visits" on public.site_visits;
create policy "members read site visits" on public.site_visits
for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "non builders write site visits" on public.site_visits;
create policy "non builders write site visits" on public.site_visits
for all to authenticated
using (company_id = public.current_company_id() and public.current_role() <> 'builder')
with check (company_id = public.current_company_id() and public.current_role() <> 'builder');

drop policy if exists "members read change orders" on public.change_orders;
create policy "members read change orders" on public.change_orders
for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "non builders write change orders" on public.change_orders;
create policy "non builders write change orders" on public.change_orders
for all to authenticated
using (company_id = public.current_company_id() and public.current_role() <> 'builder')
with check (company_id = public.current_company_id() and public.current_role() <> 'builder');

grant select, insert, update, delete on public.site_visits to authenticated;
grant select, insert, update, delete on public.change_orders to authenticated;

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

  select concat('siteVisit-', sv.id), 'siteVisit', p.name, 'Site Visit / ' || sv.visit_date::text,
    left(coalesce(sv.description, '') || ' ' || coalesce(p.address, ''), 220), null::text
  from public.site_visits sv
  join public.projects p on p.id = sv.project_id
  where sv.company_id = public.current_company_id()
    and (sv.description ilike '%' || search_query || '%'
      or p.name ilike '%' || search_query || '%'
      or p.address ilike '%' || search_query || '%')

  union all

  select concat('changeOrder-', co.id), 'changeOrder', p.name, 'Change Order / ' || co.order_date::text,
    left(coalesce(co.description, '') || ' ' || coalesce(co.approved_by, '') || ' ' || coalesce(p.address, ''), 220), null::text
  from public.change_orders co
  join public.projects p on p.id = co.project_id
  where co.company_id = public.current_company_id()
    and (co.description ilike '%' || search_query || '%'
      or co.approved_by ilike '%' || search_query || '%'
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
