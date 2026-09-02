create or replace function public.create_active_ticket_end_of_day_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  requester public.profiles;
  inserted_count integer := 0;
  winnipeg_now timestamp := now() at time zone 'America/Winnipeg';
  reminder_day_start timestamptz := date_trunc('day', now() at time zone 'America/Winnipeg') at time zone 'America/Winnipeg';
begin
  select *
  into requester
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1;

  if requester.id is null then
    return 0;
  end if;

  if winnipeg_now::time < time '18:00' then
    return 0;
  end if;

  with active_visits as (
    select
      v.id as visit_id,
      v.company_id,
      v.project_id,
      v.visit_date,
      v.work_scope,
      p.name as project_name
    from public.visits v
    join public.projects p on p.id = v.project_id
    where v.company_id = requester.company_id
      and v.status = 'on_site'
      and v.visit_date <= winnipeg_now::date
  ),
  manager_recipients as (
    select
      av.visit_id,
      av.company_id,
      av.project_id,
      av.visit_date,
      av.work_scope,
      av.project_name,
      pr.id as recipient_id
    from active_visits av
    join public.profiles pr
      on pr.company_id = av.company_id
     and pr.is_active = true
     and pr.role <> 'builder'
  ),
  assigned_recipients as (
    select
      av.visit_id,
      av.company_id,
      av.project_id,
      av.visit_date,
      av.work_scope,
      av.project_name,
      vp.profile_id as recipient_id
    from active_visits av
    join public.visit_people vp on vp.visit_id = av.visit_id
    join public.profiles pr
      on pr.id = vp.profile_id
     and pr.is_active = true
  ),
  recipients as (
    select distinct * from manager_recipients
    union
    select distinct * from assigned_recipients
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
    'active_ticket_end_of_day',
    'Ticket still active',
    r.project_name || ' is still Active after 6:00 PM Winnipeg time.'
  from recipients r
  where not exists (
    select 1
    from public.notifications n
    where n.company_id = r.company_id
      and n.recipient_id = r.recipient_id
      and n.visit_id = r.visit_id
      and n.type = 'active_ticket_end_of_day'
      and n.created_at >= reminder_day_start
  );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.create_active_ticket_end_of_day_reminders() from public;
grant execute on function public.create_active_ticket_end_of_day_reminders() to authenticated;
