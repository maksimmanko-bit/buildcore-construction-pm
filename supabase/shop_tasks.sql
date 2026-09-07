alter table public.visits
add column if not exists ticket_kind text not null default 'project';

update public.visits
set ticket_kind = 'project'
where ticket_kind is null;

alter table public.visits
alter column project_id drop not null;

alter table public.visit_activity
alter column project_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'visits_ticket_kind_check'
      and conrelid = 'public.visits'::regclass
  ) then
    alter table public.visits
    add constraint visits_ticket_kind_check
    check (ticket_kind in ('project', 'shop'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'visits_project_required_for_project_tickets_check'
      and conrelid = 'public.visits'::regclass
  ) then
    alter table public.visits
    add constraint visits_project_required_for_project_tickets_check
    check (
      (ticket_kind = 'project' and project_id is not null)
      or
      (ticket_kind = 'shop' and project_id is null)
    );
  end if;
end $$;

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
  v.assigned_by,
  v.ticket_kind
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
