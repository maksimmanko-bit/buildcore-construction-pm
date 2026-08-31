alter table public.visit_activity
  alter column visit_id drop not null;

create table if not exists public.visit_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  author_id uuid references public.profiles(id),
  note_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.visit_files
  add column if not exists note_id uuid references public.visit_notes(id) on delete cascade;

create index if not exists visit_notes_visit_idx on public.visit_notes(visit_id, created_at desc);
create index if not exists visit_files_note_idx on public.visit_files(note_id);

alter table public.visit_notes enable row level security;
alter table public.visit_notes replica identity full;

drop policy if exists "members read visit notes" on public.visit_notes;
create policy "members read visit notes" on public.visit_notes
for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "active members add visit notes" on public.visit_notes;
create policy "active members add visit notes" on public.visit_notes
for insert to authenticated
with check (company_id = public.current_company_id() and author_id = auth.uid());

drop policy if exists "authors and managers update visit notes" on public.visit_notes;
create policy "authors and managers update visit notes" on public.visit_notes
for update to authenticated
using (company_id = public.current_company_id() and (author_id = auth.uid() or public.can_manage()))
with check (company_id = public.current_company_id() and (author_id = auth.uid() or public.can_manage()));

drop policy if exists "authors and managers delete visit notes" on public.visit_notes;
create policy "authors and managers delete visit notes" on public.visit_notes
for delete to authenticated
using (company_id = public.current_company_id() and (author_id = auth.uid() or public.can_manage()));

grant select, insert, update, delete on public.visit_notes to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'visit_notes'
  ) then
    alter publication supabase_realtime add table public.visit_notes;
  end if;
end $$;

create or replace function public.create_test_bots(bot_count integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_company uuid := public.current_company_id();
  safe_count integer := greatest(0, least(coalesce(bot_count, 0), 100));
  trades text[] := array['Demo/Asbestos', 'Drywall/Mud/Taping/Flooring', 'General Construction', 'Management', 'Shop/Trucking'];
  first_names text[] := array['Liam','Noah','Oliver','Ethan','Lucas','Mason','Logan','Jacob','William','James','Benjamin','Henry','Jack','Owen','Leo','Daniel','Samuel','Carter','Hudson','Wyatt','Emma','Olivia','Ava','Charlotte','Sophia','Mia','Amelia','Harper','Evelyn','Abigail','Emily','Ella','Grace','Chloe','Nora'];
  last_names text[] := array['Anderson','Campbell','MacDonald','Singh','Patel','Brown','Wilson','Taylor','Martin','Thompson','White','Clark','Lewis','Walker','Hall','Allen','Young','King','Wright','Scott','Green','Baker','Adams','Nelson','Carter','Mitchell','Roberts','Turner','Phillips','Parker'];
  first_name text;
  last_name text;
  bot_id uuid;
  i integer;
begin
  if current_company is null or not public.can_manage() then
    raise exception 'Only Owner, PM, or Office Manager can create test bots.';
  end if;

  for i in 1..safe_count loop
    first_name := first_names[(floor(random() * array_length(first_names, 1))::integer) + 1];
    last_name := last_names[(floor(random() * array_length(last_names, 1))::integer) + 1];
    bot_id := gen_random_uuid();
    insert into public.profiles (id, company_id, first_name, last_name, full_name, email, role, trade, phone, availability_status, is_active, is_bot)
    values (
      bot_id,
      current_company,
      first_name,
      last_name,
      first_name || ' ' || last_name,
      null,
      'builder',
      trades[((i - 1) % array_length(trades, 1)) + 1],
      '(204) 555-' || lpad((1000 + i)::text, 4, '0'),
      'available',
      true,
      true
    );
  end loop;

  return safe_count;
end;
$$;

revoke all on function public.create_test_bots(integer) from public;
revoke all on function public.create_test_bots(integer) from anon;
grant execute on function public.create_test_bots(integer) to authenticated;
