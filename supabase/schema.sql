-- Build Dispatch PM - Supabase setup
-- Paste this file into Supabase SQL Editor and run it once.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$ begin
  create type public.app_role as enum ('owner', 'project_manager', 'office_manager', 'builder');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.visit_status as enum ('planned', 'on_site', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.visit_file_type as enum ('safety_form', 'before_photo', 'completion_photo', 'annotated_photo', 'project_document');
exception when duplicate_object then null;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province text not null default 'Manitoba',
  country text not null default 'Canada',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  full_name text not null default '',
  role public.app_role not null default 'builder',
  trade text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_invites (
  email text primary key,
  company_name text not null default 'BuildCore Construction',
  full_name text not null default '',
  is_active boolean not null default true,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  description text,
  status public.project_status not null default 'planning',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text not null,
  unit_number text,
  notes text,
  status text not null default 'available',
  created_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assigned_role text,
  primary key (project_id, profile_id)
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  visit_date date not null,
  start_time time not null,
  end_time time not null,
  status public.visit_status not null default 'planned',
  is_first_visit boolean not null default false,
  arrived_at timestamptz,
  completed_at timestamptz,
  work_scope text,
  completion_notes text,
  office_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists public.visit_people (
  visit_id uuid not null references public.visits(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (visit_id, profile_id)
);

create table if not exists public.visit_equipment (
  visit_id uuid not null references public.visits(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  primary key (visit_id, equipment_id)
);

create table if not exists public.visit_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  bucket_id text not null,
  storage_path text not null,
  file_name text not null,
  file_type public.visit_file_type not null,
  file_kind text not null default 'photo',
  mime_type text,
  annotation_json jsonb,
  search_text text,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(file_name, '') || ' ' || coalesce(search_text, ''))) stored,
  created_at timestamptz not null default now()
);

create index if not exists projects_company_idx on public.projects(company_id);
create index if not exists equipment_company_idx on public.equipment(company_id);
create index if not exists visits_company_date_idx on public.visits(company_id, visit_date);
create index if not exists visit_files_search_idx on public.visit_files using gin(search_vector);

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.create_company_for_current_user(
  company_name text,
  full_name text default '',
  phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  existing_profile public.profiles;
  new_company_id uuid;
  created_profile public.profiles;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a company.';
  end if;

  select * into existing_profile
  from public.profiles
  where id = current_user_id;

  if found then
    return existing_profile;
  end if;

  if nullif(trim(company_name), '') is null then
    raise exception 'Company name is required.';
  end if;

  insert into public.companies (name)
  values (trim(company_name))
  returning id into new_company_id;

  insert into public.profiles (id, company_id, full_name, role, phone, is_active)
  values (
    current_user_id,
    new_company_id,
    coalesce(nullif(trim(full_name), ''), split_part(coalesce((select email from auth.users where id = current_user_id), 'Owner'), '@', 1)),
    'owner',
    nullif(trim(phone), ''),
    true
  )
  returning * into created_profile;

  return created_profile;
end;
$$;

revoke all on function public.create_company_for_current_user(text, text, text) from public;
revoke all on function public.create_company_for_current_user(text, text, text) from anon;
grant execute on function public.create_company_for_current_user(text, text, text) to authenticated;

create or replace function public.claim_owner_invite()
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  current_email_confirmed_at timestamptz;
  matching_invite public.owner_invites;
  existing_profile public.profiles;
  new_company_id uuid;
  created_profile public.profiles;
begin
  if current_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select lower(email), email_confirmed_at
    into current_email, current_email_confirmed_at
  from auth.users
  where id = current_user_id;

  if current_email_confirmed_at is null then
    raise exception 'Please verify your email before claiming owner access.';
  end if;

  select *
    into matching_invite
  from public.owner_invites
  where email = current_email
    and is_active = true
  limit 1;

  if not found then
    raise exception 'This email is not invited for Owner access.';
  end if;

  select *
    into existing_profile
  from public.profiles
  where id = current_user_id;

  if found then
    update public.profiles
      set role = 'owner',
          is_active = true
    where id = current_user_id
    returning * into existing_profile;

    update public.owner_invites
      set claimed_by = current_user_id,
          claimed_at = coalesce(claimed_at, now())
    where email = current_email;

    return existing_profile;
  end if;

  insert into public.companies (name)
  values (matching_invite.company_name)
  returning id into new_company_id;

  insert into public.profiles (id, company_id, full_name, role, is_active)
  values (
    current_user_id,
    new_company_id,
    coalesce(nullif(trim(matching_invite.full_name), ''), split_part(current_email, '@', 1)),
    'owner',
    true
  )
  returning * into created_profile;

  update public.owner_invites
    set claimed_by = current_user_id,
        claimed_at = now()
  where email = current_email;

  return created_profile;
end;
$$;

revoke all on function public.claim_owner_invite() from public;
revoke all on function public.claim_owner_invite() from anon;
grant execute on function public.claim_owner_invite() to authenticated;

create or replace function public.can_manage()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('owner', 'project_manager', 'office_manager');
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_projects_updated_at on public.projects;
create trigger touch_projects_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

create or replace view public.visit_schedule_view
with (security_invoker = true) as
select
  v.*,
  coalesce(array_agg(distinct vp.profile_id) filter (where vp.profile_id is not null), '{}') as people_ids,
  coalesce(array_agg(distinct ve.equipment_id) filter (where ve.equipment_id is not null), '{}') as equipment_ids
from public.visits v
left join public.visit_people vp on vp.visit_id = v.id
left join public.visit_equipment ve on ve.visit_id = v.id
group by v.id;

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
    and existing_visit.start_time < new_visit.end_time
    and new_visit.start_time < existing_visit.end_time;

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
    and existing_visit.start_time < new_visit.end_time
    and new_visit.start_time < existing_visit.end_time;

  if conflict_count > 0 then
    raise exception 'This equipment is already booked during this time.';
  end if;

  return new;
end;
$$;

drop trigger if exists visit_people_no_conflicts on public.visit_people;
create trigger visit_people_no_conflicts
before insert or update on public.visit_people
for each row execute function public.assert_person_available();

drop trigger if exists visit_equipment_no_conflicts on public.visit_equipment;
create trigger visit_equipment_no_conflicts
before insert or update on public.visit_equipment
for each row execute function public.assert_equipment_available();

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
      and other_visit.start_time < new.end_time
      and new.start_time < other_visit.end_time
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
      and other_visit.start_time < new.end_time
      and new.start_time < other_visit.end_time
  ) then
    raise exception 'This equipment is already booked during this time.';
  end if;

  return new;
end;
$$;

drop trigger if exists visits_no_conflicts_on_update on public.visits;
create trigger visits_no_conflicts_on_update
before update of visit_date, start_time, end_time, status on public.visits
for each row execute function public.assert_visit_schedule_available();

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
  select concat('project-', p.id), 'project', p.name, p.address,
    left(coalesce(p.description, ''), 220), null::text
  from public.projects p
  where p.company_id = public.current_company_id()
    and (p.name ilike '%' || search_query || '%'
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

  select concat('file-', vf.id), 'file', vf.file_name, p.name,
    ts_headline('english', coalesce(vf.search_text, vf.file_name), plainto_tsquery('english', search_query), 'MaxWords=22, MinWords=8'),
    vf.file_kind
  from public.visit_files vf
  join public.projects p on p.id = vf.project_id
  where vf.company_id = public.current_company_id()
    and (vf.search_vector @@ plainto_tsquery('english', search_query)
      or vf.file_name ilike '%' || search_query || '%')
  limit 30;
$$;

alter table public.companies enable row level security;
alter table public.owner_invites enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.equipment enable row level security;
alter table public.project_members enable row level security;
alter table public.visits enable row level security;
alter table public.visit_people enable row level security;
alter table public.visit_equipment enable row level security;
alter table public.visit_files enable row level security;

drop policy if exists "company members read company" on public.companies;
create policy "company members read company" on public.companies
for select to authenticated
using (id = public.current_company_id());

drop policy if exists "own profile visible" on public.profiles;
create policy "own profile visible" on public.profiles
for select to authenticated
using (id = auth.uid() or company_id = public.current_company_id());

drop policy if exists "user creates own profile" on public.profiles;
create policy "user creates own profile" on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists "managers update profiles" on public.profiles;
create policy "managers update profiles" on public.profiles
for update to authenticated
using (company_id = public.current_company_id() and public.can_manage())
with check (company_id = public.current_company_id() and public.can_manage());

drop policy if exists "members read projects" on public.projects;
create policy "members read projects" on public.projects
for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "managers write projects" on public.projects;
create policy "managers write projects" on public.projects
for all to authenticated
using (company_id = public.current_company_id() and public.can_manage())
with check (company_id = public.current_company_id() and public.can_manage());

drop policy if exists "members read equipment" on public.equipment;
create policy "members read equipment" on public.equipment
for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "managers write equipment" on public.equipment;
create policy "managers write equipment" on public.equipment
for all to authenticated
using (company_id = public.current_company_id() and public.can_manage())
with check (company_id = public.current_company_id() and public.can_manage());

drop policy if exists "members read visits" on public.visits;
create policy "members read visits" on public.visits
for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "managers write visits" on public.visits;
create policy "managers write visits" on public.visits
for all to authenticated
using (company_id = public.current_company_id() and public.can_manage())
with check (company_id = public.current_company_id() and public.can_manage());

drop policy if exists "builders update assigned visits" on public.visits;
create policy "builders update assigned visits" on public.visits
for update to authenticated
using (
  company_id = public.current_company_id()
  and exists (
    select 1 from public.visit_people vp
    where vp.visit_id = visits.id and vp.profile_id = auth.uid()
  )
)
with check (company_id = public.current_company_id());

drop policy if exists "members read visit people" on public.visit_people;
create policy "members read visit people" on public.visit_people
for select to authenticated
using (
  exists (
    select 1 from public.visits v
    where v.id = visit_people.visit_id and v.company_id = public.current_company_id()
  )
);

drop policy if exists "managers write visit people" on public.visit_people;
create policy "managers write visit people" on public.visit_people
for all to authenticated
using (public.can_manage())
with check (public.can_manage());

drop policy if exists "members read visit equipment" on public.visit_equipment;
create policy "members read visit equipment" on public.visit_equipment
for select to authenticated
using (
  exists (
    select 1 from public.visits v
    where v.id = visit_equipment.visit_id and v.company_id = public.current_company_id()
  )
);

drop policy if exists "managers write visit equipment" on public.visit_equipment;
create policy "managers write visit equipment" on public.visit_equipment
for all to authenticated
using (public.can_manage())
with check (public.can_manage());

drop policy if exists "members read visit files" on public.visit_files;
create policy "members read visit files" on public.visit_files
for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "members add visit files" on public.visit_files;
create policy "members add visit files" on public.visit_files
for insert to authenticated
with check (company_id = public.current_company_id());

drop policy if exists "managers update visit files" on public.visit_files;
create policy "managers update visit files" on public.visit_files
for update to authenticated
using (company_id = public.current_company_id() and public.can_manage())
with check (company_id = public.current_company_id() and public.can_manage());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('visit-photos', 'visit-photos', false, 52428800, array['image/jpeg', 'image/png', 'image/webp']),
  ('project-documents', 'project-documents', false, 104857600, array[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ])
on conflict (id) do nothing;

drop policy if exists "company members read storage objects" on storage.objects;
create policy "company members read storage objects" on storage.objects
for select to authenticated
using (
  bucket_id in ('visit-photos', 'project-documents')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
);

drop policy if exists "company members upload storage objects" on storage.objects;
create policy "company members upload storage objects" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('visit-photos', 'project-documents')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
);

drop policy if exists "managers update storage objects" on storage.objects;
create policy "managers update storage objects" on storage.objects
for update to authenticated
using (
  bucket_id in ('visit-photos', 'project-documents')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
  and public.can_manage()
)
with check (
  bucket_id in ('visit-photos', 'project-documents')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
  and public.can_manage()
);

insert into public.owner_invites (email, company_name, full_name, is_active)
values ('maksim.manko@gmail.com', 'BuildCore Construction', 'Maksim Manko', true)
on conflict (email) do update
set company_name = excluded.company_name,
    full_name = excluded.full_name,
    is_active = excluded.is_active;
