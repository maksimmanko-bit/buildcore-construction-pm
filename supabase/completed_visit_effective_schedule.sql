create or replace function public.visit_effective_end_time(
  visit_date date,
  start_time time,
  end_time time,
  status public.visit_status,
  completed_at timestamptz
)
returns time
language sql
stable
set search_path = public
as $$
  select case
    when status = 'completed'
      and completed_at is not null
      and (completed_at at time zone 'America/Winnipeg')::date = visit_date
    then least(
      '23:45'::time,
      greatest(start_time + interval '15 minutes', (completed_at at time zone 'America/Winnipeg')::time)::time
    )
    else end_time
  end;
$$;

create or replace function public.assert_person_available()
returns trigger
language plpgsql
as $$
declare
  conflict_count integer;
begin
  select count(*)
    into conflict_count
  from public.visit_people existing
  join public.visits existing_visit on existing_visit.id = existing.visit_id
  join public.visits new_visit on new_visit.id = new.visit_id
  where existing.profile_id = new.profile_id
    and existing.visit_id <> new.visit_id
    and existing_visit.status <> 'cancelled'
    and new_visit.status <> 'cancelled'
    and existing_visit.visit_date = new_visit.visit_date
    and existing_visit.start_time < public.visit_effective_end_time(new_visit.visit_date, new_visit.start_time, new_visit.end_time, new_visit.status, new_visit.completed_at)
    and new_visit.start_time < public.visit_effective_end_time(existing_visit.visit_date, existing_visit.start_time, existing_visit.end_time, existing_visit.status, existing_visit.completed_at);

  if conflict_count > 0 then
    raise exception 'This employee is already assigned during this time.';
  end if;

  return new;
end;
$$;

create or replace function public.assert_equipment_available()
returns trigger
language plpgsql
as $$
declare
  conflict_count integer;
begin
  select count(*)
    into conflict_count
  from public.visit_equipment existing
  join public.visits existing_visit on existing_visit.id = existing.visit_id
  join public.visits new_visit on new_visit.id = new.visit_id
  where existing.equipment_id = new.equipment_id
    and existing.visit_id <> new.visit_id
    and existing_visit.status <> 'cancelled'
    and new_visit.status <> 'cancelled'
    and existing_visit.visit_date = new_visit.visit_date
    and existing_visit.start_time < public.visit_effective_end_time(new_visit.visit_date, new_visit.start_time, new_visit.end_time, new_visit.status, new_visit.completed_at)
    and new_visit.start_time < public.visit_effective_end_time(existing_visit.visit_date, existing_visit.start_time, existing_visit.end_time, existing_visit.status, existing_visit.completed_at);

  if conflict_count > 0 then
    raise exception 'This equipment is already booked during this time.';
  end if;

  return new;
end;
$$;

create or replace function public.assert_visit_schedule_available()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  if exists (
    select 1
    from public.visit_people current_people
    join public.visit_people other_people on other_people.profile_id = current_people.profile_id
    join public.visits other_visit on other_visit.id = other_people.visit_id
    where current_people.visit_id = new.id
      and other_people.visit_id <> new.id
      and other_visit.status <> 'cancelled'
      and other_visit.visit_date = new.visit_date
      and other_visit.start_time < public.visit_effective_end_time(new.visit_date, new.start_time, new.end_time, new.status, new.completed_at)
      and new.start_time < public.visit_effective_end_time(other_visit.visit_date, other_visit.start_time, other_visit.end_time, other_visit.status, other_visit.completed_at)
  ) then
    raise exception 'This employee is already assigned during this time.';
  end if;

  if exists (
    select 1
    from public.visit_equipment current_equipment
    join public.visit_equipment other_equipment on other_equipment.equipment_id = current_equipment.equipment_id
    join public.visits other_visit on other_visit.id = other_equipment.visit_id
    where current_equipment.visit_id = new.id
      and other_equipment.visit_id <> new.id
      and other_visit.status <> 'cancelled'
      and other_visit.visit_date = new.visit_date
      and other_visit.start_time < public.visit_effective_end_time(new.visit_date, new.start_time, new.end_time, new.status, new.completed_at)
      and new.start_time < public.visit_effective_end_time(other_visit.visit_date, other_visit.start_time, other_visit.end_time, other_visit.status, other_visit.completed_at)
  ) then
    raise exception 'This equipment is already booked during this time.';
  end if;

  return new;
end;
$$;
