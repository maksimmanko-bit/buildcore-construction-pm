create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_name text not null,
  contact_person text,
  phone text,
  email text,
  trade text not null default 'Other',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subcontractors_company_name_check check (length(trim(company_name)) > 0),
  constraint subcontractors_trade_check check (length(trim(trade)) > 0)
);

create table if not exists public.visit_subcontractors (
  visit_id uuid not null references public.visits(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  status text not null default 'planned',
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (visit_id, subcontractor_id),
  constraint visit_subcontractors_status_check check (status in ('planned', 'confirmed', 'completed'))
);

create index if not exists subcontractors_company_trade_idx on public.subcontractors(company_id, trade, company_name);
create index if not exists visit_subcontractors_subcontractor_idx on public.visit_subcontractors(subcontractor_id);

drop trigger if exists touch_subcontractors_updated_at on public.subcontractors;
create trigger touch_subcontractors_updated_at
before update on public.subcontractors
for each row execute function public.touch_updated_at();

drop trigger if exists touch_visit_subcontractors_updated_at on public.visit_subcontractors;
create trigger touch_visit_subcontractors_updated_at
before update on public.visit_subcontractors
for each row execute function public.touch_updated_at();

create or replace view public.visit_schedule_view
with (security_invoker = true) as
select
  v.id,
  v.company_id,
  v.project_id,
  v.visit_date,
  v.start_time,
  v.end_time,
  v.status,
  v.is_first_visit,
  v.arrived_at,
  v.completed_at,
  v.work_scope,
  v.completion_notes,
  v.office_notes,
  v.created_by,
  v.created_at,
  coalesce(vp.people_ids, '{}'::uuid[]) as people_ids,
  coalesce(ve.equipment_ids, '{}'::uuid[]) as equipment_ids,
  coalesce(vs.subcontractor_ids, '{}'::uuid[]) as subcontractor_ids,
  coalesce(vs.subcontractors, '[]'::jsonb) as subcontractors,
  v.address,
  v.assigned_by
from public.visits v
left join lateral (
  select array_agg(distinct profile_id) as people_ids
  from public.visit_people
  where visit_id = v.id
) vp on true
left join lateral (
  select array_agg(distinct equipment_id) as equipment_ids
  from public.visit_equipment
  where visit_id = v.id
) ve on true
left join lateral (
  select
    array_agg(distinct s.id) as subcontractor_ids,
    jsonb_agg(
      jsonb_build_object(
        'subcontractor_id', s.id,
        'company_name', s.company_name,
        'contact_person', s.contact_person,
        'phone', s.phone,
        'email', s.email,
        'trade', s.trade,
        'notes', s.notes,
        'status', visit_subcontractors.status
      )
      order by s.company_name
    ) as subcontractors
  from public.visit_subcontractors
  join public.subcontractors s on s.id = visit_subcontractors.subcontractor_id
  where visit_subcontractors.visit_id = v.id
) vs on true;

alter table public.subcontractors enable row level security;
alter table public.visit_subcontractors enable row level security;
alter table public.subcontractors replica identity full;
alter table public.visit_subcontractors replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.subcontractors;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.visit_subcontractors;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

drop policy if exists "members read subcontractors" on public.subcontractors;
create policy "members read subcontractors" on public.subcontractors
for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "managers write subcontractors" on public.subcontractors;
create policy "managers write subcontractors" on public.subcontractors
for all to authenticated
using (company_id = public.current_company_id() and public.can_manage())
with check (company_id = public.current_company_id() and public.can_manage());

drop policy if exists "members read visit subcontractors" on public.visit_subcontractors;
create policy "members read visit subcontractors" on public.visit_subcontractors
for select to authenticated
using (
  exists (
    select 1
    from public.visits v
    join public.subcontractors s on s.id = visit_subcontractors.subcontractor_id
    where v.id = visit_subcontractors.visit_id
      and v.company_id = public.current_company_id()
      and s.company_id = public.current_company_id()
  )
);

drop policy if exists "managers write visit subcontractors" on public.visit_subcontractors;
create policy "managers write visit subcontractors" on public.visit_subcontractors
for all to authenticated
using (
  public.can_manage()
  and exists (
    select 1
    from public.visits v
    join public.subcontractors s on s.id = visit_subcontractors.subcontractor_id
    where v.id = visit_subcontractors.visit_id
      and v.company_id = public.current_company_id()
      and s.company_id = public.current_company_id()
  )
)
with check (
  public.can_manage()
  and exists (
    select 1
    from public.visits v
    join public.subcontractors s on s.id = visit_subcontractors.subcontractor_id
    where v.id = visit_subcontractors.visit_id
      and v.company_id = public.current_company_id()
      and s.company_id = public.current_company_id()
  )
);

grant select, insert, update, delete on public.subcontractors to authenticated;
grant select, insert, update, delete on public.visit_subcontractors to authenticated;

create or replace function public.create_subcontractor_confirmation_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  requester public.profiles;
  inserted_count integer := 0;
  winnipeg_today date := (now() at time zone 'America/Winnipeg')::date;
  reminder_day_start timestamptz := date_trunc('day', now() at time zone 'America/Winnipeg') at time zone 'America/Winnipeg';
begin
  select *
  into requester
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1;

  if requester.id is null or requester.role = 'builder' then
    return 0;
  end if;

  with planned_subcontractors as (
    select
      v.id as visit_id,
      v.company_id,
      v.project_id,
      v.visit_date,
      p.name as project_name,
      s.company_name,
      s.trade,
      ('Subcontractor not confirmed: ' || s.company_name || ' for ' || p.name || ' tomorrow.') as message
    from public.visits v
    join public.projects p on p.id = v.project_id
    join public.visit_subcontractors vs on vs.visit_id = v.id
    join public.subcontractors s on s.id = vs.subcontractor_id
    where v.company_id = requester.company_id
      and s.company_id = requester.company_id
      and v.status <> 'cancelled'
      and v.visit_date = winnipeg_today + 1
      and vs.status = 'planned'
  ),
  manager_recipients as (
    select
      ps.*,
      pr.id as recipient_id
    from planned_subcontractors ps
    join public.profiles pr
      on pr.company_id = ps.company_id
     and pr.is_active = true
     and pr.role <> 'builder'
  )
  insert into public.notifications (
    company_id,
    recipient_id,
    actor_id,
    project_id,
    visit_id,
    type,
    title,
    message
  )
  select
    r.company_id,
    r.recipient_id,
    requester.id,
    r.project_id,
    r.visit_id,
    'subcontractor_not_confirmed',
    'Subcontractor not confirmed',
    r.message
  from manager_recipients r
  where not exists (
    select 1
    from public.notifications n
    where n.company_id = r.company_id
      and n.recipient_id = r.recipient_id
      and n.visit_id = r.visit_id
      and n.type = 'subcontractor_not_confirmed'
      and n.message = r.message
      and n.created_at >= reminder_day_start
  );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.create_subcontractor_confirmation_reminders() from public;
grant execute on function public.create_subcontractor_confirmation_reminders() to authenticated;
