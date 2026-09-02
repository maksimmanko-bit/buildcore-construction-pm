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
  feature_flags jsonb not null default '{"safetyForm": true, "beforeAfterPhotos": true, "siteInspections": true, "changeOrders": true, "testBots": false}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  company_id uuid references public.companies(id) on delete set null,
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null default '',
  email text,
  avatar_path text,
  avatar_emoji text,
  role public.app_role not null default 'builder',
  trade text,
  phone text,
  availability_status text not null default 'available',
  is_active boolean not null default true,
  is_bot boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_avatar_emoji_length_check check (avatar_emoji is null or char_length(avatar_emoji) <= 16),
  constraint profiles_availability_status_check check (availability_status in ('available', 'not_available'))
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
  job_number text,
  name text not null,
  address text not null,
  addresses jsonb not null default '[]'::jsonb,
  contact_name text,
  contact_email text,
  contact_phone text,
  description text,
  status public.project_status not null default 'planning',
  created_by uuid references public.profiles(id),
  manager_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text not null,
  avatar_key text not null default 'excavator',
  unit_number text,
  notes text,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  constraint equipment_avatar_key_check check (avatar_key in ('excavator', 'trailer', 'truck', 'skid_steer', 'lift', 'concrete', 'tools'))
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
  address text,
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
  assigned_by uuid references public.profiles(id),
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
  annotation_history jsonb not null default '[]'::jsonb,
  photo_caption text,
  search_text text,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(file_name, '') || ' ' || coalesce(search_text, '') || ' ' || coalesce(photo_caption, ''))) stored,
  created_at timestamptz not null default now()
);

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

create index if not exists projects_company_idx on public.projects(company_id);
create unique index if not exists projects_company_job_number_unique_idx
  on public.projects (company_id, lower(trim(job_number)))
  where nullif(trim(job_number), '') is not null;
create index if not exists equipment_company_idx on public.equipment(company_id);
create index if not exists profiles_company_bot_idx on public.profiles(company_id, is_bot);
create index if not exists visits_company_date_idx on public.visits(company_id, visit_date);
create index if not exists visit_files_search_idx on public.visit_files using gin(search_vector);

create table if not exists public.visit_activity (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  activity_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists visit_activity_visit_idx on public.visit_activity(visit_id, created_at desc);
create index if not exists visit_activity_project_idx on public.visit_activity(project_id, created_at desc);
create index if not exists visit_notes_visit_idx on public.visit_notes(visit_id, created_at desc);

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
  order_number text,
  order_date date not null default current_date,
  order_time time not null default current_time,
  status text not null default 'requested',
  description text,
  proposed_work text,
  approved_by text,
  approval_signature text,
  created_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_orders_status_check check (status in ('requested', 'approved'))
);

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

alter table public.visit_files
  add column if not exists site_visit_id uuid references public.site_visits(id) on delete cascade,
  add column if not exists change_order_id uuid references public.change_orders(id) on delete cascade,
  add column if not exists folder_name text,
  add column if not exists folder_description text;

create index if not exists site_visits_company_date_idx on public.site_visits(company_id, visit_date);
create index if not exists site_visits_project_date_idx on public.site_visits(project_id, visit_date);
create index if not exists change_orders_company_date_idx on public.change_orders(company_id, order_date);
create index if not exists change_orders_project_date_idx on public.change_orders(project_id, order_date);
create unique index if not exists change_orders_project_order_number_idx on public.change_orders(project_id, order_number) where order_number is not null;
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_company_created_idx on public.notifications(company_id, created_at desc);
create index if not exists visit_files_site_visit_idx on public.visit_files(site_visit_id);
create index if not exists visit_files_change_order_idx on public.visit_files(change_order_id);

create table if not exists public.edit_locks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lock_key text not null,
  resource_type text not null,
  resource_id uuid,
  mode text not null default 'edit',
  locked_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, lock_key)
);

create index if not exists edit_locks_company_expires_idx on public.edit_locks(company_id, expires_at);

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

  insert into public.profiles (id, company_id, full_name, email, role, phone, is_active)
  values (
    current_user_id,
    new_company_id,
    coalesce(nullif(trim(full_name), ''), split_part(coalesce((select email from auth.users where id = current_user_id), 'Owner'), '@', 1)),
    (select email from auth.users where id = current_user_id),
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
          email = current_email,
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

  insert into public.profiles (id, company_id, full_name, email, role, is_active)
  values (
    current_user_id,
    new_company_id,
    coalesce(nullif(trim(matching_invite.full_name), ''), split_part(current_email, '@', 1)),
    current_email,
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

create or replace function public.request_employee_access()
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  current_email_confirmed_at timestamptz;
  meta jsonb;
  existing_profile public.profiles;
  target_company_id uuid;
  first_name_value text;
  last_name_value text;
  phone_value text;
  created_profile public.profiles;
begin
  if current_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select lower(email), email_confirmed_at, raw_user_meta_data
    into current_email, current_email_confirmed_at, meta
  from auth.users
  where id = current_user_id;

  if current_email_confirmed_at is null then
    raise exception 'Please verify your email before requesting access.';
  end if;

  select *
    into existing_profile
  from public.profiles
  where id = current_user_id;

  if found then
    update public.profiles
      set email = current_email
    where id = current_user_id
    returning * into existing_profile;
    return existing_profile;
  end if;

  select id
    into target_company_id
  from public.companies
  order by created_at
  limit 1;

  if target_company_id is null then
    raise exception 'Company is not configured yet. Ask the Owner to sign in first.';
  end if;

  first_name_value := nullif(trim(coalesce(meta->>'first_name', '')), '');
  last_name_value := nullif(trim(coalesce(meta->>'last_name', '')), '');
  phone_value := nullif(trim(coalesce(meta->>'phone', '')), '');

  insert into public.profiles (id, company_id, first_name, last_name, full_name, email, phone, role, is_active)
  values (
    current_user_id,
    target_company_id,
    coalesce(first_name_value, split_part(current_email, '@', 1)),
    coalesce(last_name_value, ''),
    trim(coalesce(first_name_value, split_part(current_email, '@', 1)) || ' ' || coalesce(last_name_value, '')),
    current_email,
    phone_value,
    'builder',
    false
  )
  returning * into created_profile;

  return created_profile;
end;
$$;

revoke all on function public.request_employee_access() from public;
revoke all on function public.request_employee_access() from anon;
grant execute on function public.request_employee_access() to authenticated;

create or replace function public.can_manage()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('owner', 'project_manager', 'office_manager');
$$;

create or replace function public.protect_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = new.id and not public.can_manage() then
    if new.company_id is distinct from old.company_id
      or new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.trade is distinct from old.trade
      or new.availability_status is distinct from old.availability_status
      or new.claimed_by is distinct from old.claimed_by
      or new.claimed_at is distinct from old.claimed_at then
      raise exception 'Only managers can update role, trade, access, and availability fields.';
    end if;
  end if;

  return new;
end;
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

drop trigger if exists touch_site_visits_updated_at on public.site_visits;
create trigger touch_site_visits_updated_at
before update on public.site_visits
for each row execute function public.touch_updated_at();

drop trigger if exists touch_change_orders_updated_at on public.change_orders;
create trigger touch_change_orders_updated_at
before update on public.change_orders
for each row execute function public.touch_updated_at();

drop trigger if exists protect_profile_self_update_trigger on public.profiles;
create trigger protect_profile_self_update_trigger
before update on public.profiles
for each row execute function public.protect_profile_self_update();

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
  select concat('project-', p.id), 'project', p.name, coalesce(p.job_number, '') || ' · ' || p.address,
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
alter table public.visit_notes enable row level security;
alter table public.visit_activity enable row level security;
alter table public.site_visits enable row level security;
alter table public.change_orders enable row level security;
alter table public.notifications enable row level security;

alter table public.visits replica identity full;
alter table public.visit_people replica identity full;
alter table public.visit_equipment replica identity full;
alter table public.visit_activity replica identity full;
alter table public.visit_notes replica identity full;
alter table public.visit_files replica identity full;
alter table public.site_visits replica identity full;
alter table public.change_orders replica identity full;
alter table public.notifications replica identity full;
alter table public.companies replica identity full;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['companies', 'visits', 'visit_people', 'visit_equipment', 'visit_activity', 'visit_notes', 'visit_files', 'site_visits', 'change_orders', 'notifications']
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

drop policy if exists "company members read company" on public.companies;
create policy "company members read company" on public.companies
for select to authenticated
using (id = public.current_company_id());

drop policy if exists "managers update company settings" on public.companies;
create policy "managers update company settings" on public.companies
for update to authenticated
using (id = public.current_company_id() and public.can_manage())
with check (id = public.current_company_id() and public.can_manage());

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

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
for update to authenticated
using (id = auth.uid() and company_id = public.current_company_id())
with check (id = auth.uid() and company_id = public.current_company_id());

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

drop policy if exists "members update own visit files" on public.visit_files;
create policy "members update own visit files" on public.visit_files
for update to authenticated
using (company_id = public.current_company_id() and (uploaded_by = auth.uid() or public.can_manage()))
with check (company_id = public.current_company_id() and (uploaded_by = auth.uid() or public.can_manage()));

drop policy if exists "members delete own visit files" on public.visit_files;
create policy "members delete own visit files" on public.visit_files
for delete to authenticated
using (company_id = public.current_company_id() and (uploaded_by = auth.uid() or public.can_manage()));

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

drop policy if exists "members read visit activity" on public.visit_activity;
create policy "members read visit activity" on public.visit_activity
for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "members add visit activity" on public.visit_activity;
create policy "members add visit activity" on public.visit_activity
for insert to authenticated
with check (company_id = public.current_company_id());

drop policy if exists "managers delete visit activity" on public.visit_activity;
create policy "managers delete visit activity" on public.visit_activity
for delete to authenticated
using (company_id = public.current_company_id() and public.can_manage());

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
drop policy if exists "active members write change orders" on public.change_orders;
create policy "active members write change orders" on public.change_orders
for all to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

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

grant select, insert, update, delete on public.site_visits to authenticated;
grant select, insert, update, delete on public.change_orders to authenticated;
grant select, insert, update, delete on public.visit_notes to authenticated;
grant select, insert, update on public.notifications to authenticated;

alter table public.edit_locks enable row level security;

drop policy if exists "managers read edit locks" on public.edit_locks;
create policy "managers read edit locks" on public.edit_locks
for select to authenticated
using (company_id = public.current_company_id() and public.can_manage());

create or replace function public.acquire_edit_lock(
  p_lock_key text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_mode text default 'edit',
  p_hold_seconds integer default 20
)
returns table (
  acquired boolean,
  holder_id uuid,
  holder_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_company uuid := public.current_company_id();
  safe_hold_seconds integer := greatest(1, least(coalesce(p_hold_seconds, 20), 120));
  lock_row public.edit_locks;
begin
  if current_user_id is null or current_company is null then
    raise exception 'You must be signed in to lock records.';
  end if;

  if not public.can_manage() then
    raise exception 'Only Owner, PM, or Office Manager can edit records.';
  end if;

  if nullif(trim(p_lock_key), '') is null then
    raise exception 'Lock key is required.';
  end if;

  insert into public.edit_locks (
    company_id,
    lock_key,
    resource_type,
    resource_id,
    mode,
    locked_by,
    expires_at,
    released_at,
    updated_at
  )
  values (
    current_company,
    trim(p_lock_key),
    coalesce(nullif(trim(p_resource_type), ''), 'record'),
    p_resource_id,
    coalesce(nullif(trim(p_mode), ''), 'edit'),
    current_user_id,
    now() + make_interval(secs => safe_hold_seconds),
    null,
    now()
  )
  on conflict (company_id, lock_key)
  do update
    set resource_type = excluded.resource_type,
        resource_id = excluded.resource_id,
        mode = excluded.mode,
        locked_by = excluded.locked_by,
        expires_at = excluded.expires_at,
        released_at = null,
        updated_at = now()
  where public.edit_locks.expires_at <= now()
     or public.edit_locks.locked_by = current_user_id
  returning * into lock_row;

  if found then
    return query
      select true, lock_row.locked_by, coalesce(p.full_name, p.email, 'Another user'), lock_row.expires_at
      from public.profiles p
      where p.id = lock_row.locked_by;
    return;
  end if;

  return query
    select false, l.locked_by, coalesce(p.full_name, p.email, 'Another user'), l.expires_at
    from public.edit_locks l
    left join public.profiles p on p.id = l.locked_by
    where l.company_id = current_company
      and l.lock_key = trim(p_lock_key)
    limit 1;
end;
$$;

create or replace function public.release_edit_lock(
  p_lock_key text,
  p_release_hold_seconds integer default 10
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_company uuid := public.current_company_id();
  safe_hold_seconds integer := greatest(1, least(coalesce(p_release_hold_seconds, 10), 30));
begin
  if current_user_id is null or current_company is null then
    return;
  end if;

  update public.edit_locks
    set expires_at = now() + make_interval(secs => safe_hold_seconds),
        released_at = now(),
        updated_at = now()
  where company_id = current_company
    and lock_key = trim(p_lock_key)
    and locked_by = current_user_id;
end;
$$;

revoke all on function public.acquire_edit_lock(text, text, uuid, text, integer) from public;
revoke all on function public.acquire_edit_lock(text, text, uuid, text, integer) from anon;
grant execute on function public.acquire_edit_lock(text, text, uuid, text, integer) to authenticated;

revoke all on function public.release_edit_lock(text, integer) from public;
revoke all on function public.release_edit_lock(text, integer) from anon;
grant execute on function public.release_edit_lock(text, integer) to authenticated;

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

create or replace function public.delete_test_bots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_company uuid := public.current_company_id();
  deleted_count integer := 0;
begin
  if current_company is null or not public.can_manage() then
    raise exception 'Only Owner, PM, or Office Manager can delete test bots.';
  end if;

  delete from public.profiles
  where company_id = current_company
    and is_bot = true;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_test_bots() from public;
revoke all on function public.delete_test_bots() from anon;
grant execute on function public.delete_test_bots() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('visit-photos', 'visit-photos', false, 52428800, array['image/jpeg', 'image/png', 'image/webp']),
  ('profile-avatars', 'profile-avatars', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
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
  bucket_id in ('visit-photos', 'project-documents', 'profile-avatars')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
);

drop policy if exists "company members upload storage objects" on storage.objects;
create policy "company members upload storage objects" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('visit-photos', 'project-documents', 'profile-avatars')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
);

drop policy if exists "managers update storage objects" on storage.objects;
create policy "managers update storage objects" on storage.objects
for update to authenticated
using (
  bucket_id in ('visit-photos', 'project-documents', 'profile-avatars')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
  and public.can_manage()
)
with check (
  bucket_id in ('visit-photos', 'project-documents', 'profile-avatars')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
  and public.can_manage()
);

drop policy if exists "company members update storage objects" on storage.objects;
create policy "company members update storage objects" on storage.objects
for update to authenticated
using (
  bucket_id in ('visit-photos', 'project-documents', 'profile-avatars')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
)
with check (
  bucket_id in ('visit-photos', 'project-documents', 'profile-avatars')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
);

drop policy if exists "company members delete storage objects" on storage.objects;
create policy "company members delete storage objects" on storage.objects
for delete to authenticated
using (
  bucket_id in ('visit-photos', 'project-documents', 'profile-avatars')
  and split_part(name, '/', 1)::uuid = public.current_company_id()
);

insert into public.owner_invites (email, company_name, full_name, is_active)
values ('maksim.manko@gmail.com', 'BuildCore Construction', 'Maksim Manko', true)
on conflict (email) do update
set company_name = excluded.company_name,
    full_name = excluded.full_name,
    is_active = excluded.is_active;

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
