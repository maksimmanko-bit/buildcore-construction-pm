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
