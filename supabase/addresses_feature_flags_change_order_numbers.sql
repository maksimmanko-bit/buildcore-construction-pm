-- Incremental update for project addresses, ticket address selection, feature flags, and Change Order numbers.
-- Safe to run more than once.

alter table public.projects
  add column if not exists addresses jsonb not null default '[]'::jsonb;

alter table public.visits
  add column if not exists address text;

alter table public.change_orders
  add column if not exists order_number text;

with numbered as (
  select
    co.id,
    'CO-' || coalesce(nullif(p.job_number, ''), 'NO-JOB') || '-' ||
      row_number() over (partition by co.project_id order by co.created_at, co.id) as next_order_number
  from public.change_orders co
  join public.projects p on p.id = co.project_id
  where co.order_number is null
)
update public.change_orders co
set order_number = numbered.next_order_number
from numbered
where co.id = numbered.id;

create unique index if not exists change_orders_project_order_number_idx
  on public.change_orders(project_id, order_number)
  where order_number is not null;

update public.companies
set feature_flags = coalesce(feature_flags, '{}'::jsonb)
  || '{"siteInspections": true, "changeOrders": true}'::jsonb
where not (coalesce(feature_flags, '{}'::jsonb) ? 'siteInspections')
   or not (coalesce(feature_flags, '{}'::jsonb) ? 'changeOrders');

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
    left(coalesce(co.description, '') || ' ' || coalesce(co.approved_by, '') || ' ' || coalesce(co.order_number, '') || ' ' || coalesce(p.address, ''), 220), null::text
  from public.change_orders co
  join public.projects p on p.id = co.project_id
  where co.company_id = public.current_company_id()
    and (co.description ilike '%' || search_query || '%'
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

grant execute on function public.global_search(text) to authenticated;
