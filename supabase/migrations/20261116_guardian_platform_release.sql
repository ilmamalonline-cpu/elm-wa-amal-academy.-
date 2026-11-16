-- أكاديمية علم وعمل: guardian-first platform release
-- Safe rollout: additive only. Existing academy_guardians and academy_children
-- are never dropped, truncated, renamed, or replaced by this migration.
-- Apply to preview first. The signup gate defaults to owner_only in every DB;
-- production is opened explicitly only after preview verification.

begin;

create table if not exists public.academy_learning_plans (
  child_id uuid primary key references public.academy_children(id) on delete cascade,
  guardian_id uuid not null references public.academy_guardians(id) on delete cascade,
  goal text not null check (length(trim(goal)) between 1 and 500),
  weekly_target_minutes integer not null check (weekly_target_minutes between 1 and 840),
  updated_at timestamptz not null default now(),
  constraint academy_learning_plans_guardian_child_key unique (guardian_id, child_id)
);

create table if not exists public.academy_practice_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  child_id uuid not null references public.academy_children(id) on delete cascade,
  guardian_id uuid not null references public.academy_guardians(id) on delete cascade,
  activity text not null check (length(trim(activity)) between 1 and 120),
  minutes integer not null check (minutes between 1 and 240),
  practiced_on date not null check (practiced_on >= date '2000-01-01'),
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists academy_practice_entries_guardian_date_idx
  on public.academy_practice_entries(guardian_id, practiced_on desc);

create table if not exists public.academy_teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 200),
  time_zone text not null,
  status text not null default 'suspended' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.academy_teacher_assignments (
  teacher_id uuid not null references public.academy_teachers(id) on delete cascade,
  child_id uuid not null references public.academy_children(id) on delete cascade,
  status text not null default 'inactive' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  primary key (teacher_id, child_id)
);

create table if not exists public.academy_individual_lessons (
  id uuid primary key default extensions.gen_random_uuid(),
  teacher_id uuid not null,
  child_id uuid not null,
  subject text not null check (subject in ('quran', 'nur_al_bayan', 'tajweed')),
  starts_at timestamptz not null check (isfinite(starts_at)),
  ends_at timestamptz not null check (isfinite(ends_at)),
  time_zone text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  outcome text check (outcome is null or outcome in ('attended_completed', 'attended_incomplete', 'absent')),
  follow_up_note text not null default '',
  constraint academy_individual_lessons_time_range check (ends_at > starts_at),
  constraint academy_individual_lessons_teacher_id_child_id_fkey
    foreign key (teacher_id, child_id)
    references public.academy_teacher_assignments(teacher_id, child_id)
    on delete restrict
);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.academy_individual_lessons'::regclass
      and c.conname = 'academy_individual_lessons_cancelled_outcome_check'
  ) then
    alter table public.academy_individual_lessons
      add constraint academy_individual_lessons_cancelled_outcome_check
      check (status <> 'cancelled' or outcome is null);
  end if;
end;
$$;

create index if not exists academy_lessons_child_starts_idx
  on public.academy_individual_lessons(child_id, starts_at);
create index if not exists academy_lessons_teacher_starts_idx
  on public.academy_individual_lessons(teacher_id, starts_at);

-- The admin table is separate from guardian profiles: one login remains one
-- human account, and children never receive credentials or independent login.
create table if not exists public.academy_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_platform_settings (
  id boolean primary key default true check (id is true),
  signup_mode text not null default 'owner_only'
    check (signup_mode in ('owner_only', 'open', 'closed')),
  owner_email text not null default 'abdelrahmanbakri113@gmail.com',
  updated_at timestamptz not null default now()
);

insert into public.academy_platform_settings (id, signup_mode, owner_email)
values (true, 'owner_only', 'abdelrahmanbakri113@gmail.com')
on conflict (id) do nothing;

-- Teacher invitations are email-bound, single-use and store only a SHA-256
-- token hash. The raw link is shown once to the admin and is never emailed.
create table if not exists public.academy_teacher_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  invited_email text not null check (length(trim(invited_email)) between 3 and 320),
  display_name text not null check (length(trim(display_name)) between 1 and 200),
  token_hash text not null unique,
  created_by uuid not null references public.academy_admins(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_user_id uuid unique references auth.users(id) on delete set null,
  constraint academy_teacher_invites_expiry_check check (expires_at > created_at)
);

alter table public.academy_learning_plans enable row level security;
alter table public.academy_practice_entries enable row level security;
alter table public.academy_teachers enable row level security;
alter table public.academy_teacher_assignments enable row level security;
alter table public.academy_individual_lessons enable row level security;
alter table public.academy_admins enable row level security;
alter table public.academy_platform_settings enable row level security;
alter table public.academy_teacher_invites enable row level security;

-- Authenticated access is still constrained by RLS. Settings are intentionally
-- not granted to clients; only the auth trigger and database owner read them.
grant select, insert, update, delete on public.academy_learning_plans to authenticated;
grant select, insert, update, delete on public.academy_practice_entries to authenticated;
grant select, insert, update, delete on public.academy_teachers to authenticated;
grant select, insert, update, delete on public.academy_teacher_assignments to authenticated;
grant select, insert, update, delete on public.academy_individual_lessons to authenticated;
grant select, insert on public.academy_admins to authenticated;
grant select, insert on public.academy_teacher_invites to authenticated;

create or replace function public.academy_is_owner_account()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from auth.users u
    join public.academy_platform_settings s on s.id is true
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and lower(u.email) = lower(s.owner_email)
  )
$$;

create or replace function public.academy_is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and exists (select 1 from public.academy_admins a where a.id = auth.uid())
$$;

create or replace function public.academy_enforce_registration_mode()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_mode text;
  v_owner_email text;
begin
  select s.signup_mode, s.owner_email into v_mode, v_owner_email
  from public.academy_platform_settings s
  where s.id is true;

  if not found or v_mode = 'closed' then
    raise exception 'ACADEMY_REGISTRATION_CLOSED' using errcode = 'P0001';
  end if;

  if v_mode = 'owner_only'
     and lower(coalesce(new.email, '')) <> lower(coalesce(v_owner_email, '')) then
    raise exception 'ACADEMY_REGISTRATION_OWNER_ONLY' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Conditional creation is safe on both the existing preview and production
-- projects (neither existing trigger is removed or replaced).
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = 'auth.users'::regclass
      and t.tgname = 'academy_enforce_registration_mode'
      and not t.tgisinternal
  ) then
    create trigger academy_enforce_registration_mode
      before insert on auth.users
      for each row execute function public.academy_enforce_registration_mode();
  end if;
end;
$$;

create or replace function public.academy_teacher_time_zone_guard()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'valid IANA time zone required' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.academy_children_check_birth_year()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.birth_year > extract(year from current_date)::integer then
    raise exception 'birth_year must not be in the future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.academy_practice_entries_check_date()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.practiced_on > current_date then
    raise exception 'practiced_on must not be in the future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.academy_learning_plans_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.academy_individual_lesson_assignment_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.status = 'scheduled' and not exists (
    select 1
    from public.academy_teacher_assignments a
    join public.academy_teachers t on t.id = a.teacher_id
    where a.teacher_id = new.teacher_id
      and a.child_id = new.child_id
      and a.status = 'active'
      and t.status = 'active'
    for share of a, t
  ) then
    raise exception 'active teacher assignment required' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Teachers may record outcomes only. They cannot change a scheduled lesson's
-- subject, time, child, teacher or status; administrators can manage schedules.
create or replace function public.academy_teacher_outcome_only()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is not null and not public.academy_is_admin() then
    if new.id is distinct from old.id
       or new.teacher_id is distinct from old.teacher_id
       or new.child_id is distinct from old.child_id
       or new.subject is distinct from old.subject
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at
       or new.time_zone is distinct from old.time_zone
       or new.status is distinct from old.status
       or new.created_at is distinct from old.created_at then
      raise exception 'teachers may update lesson outcomes only' using errcode = '42501';
    end if;

    if (new.outcome is distinct from old.outcome
        or new.follow_up_note is distinct from old.follow_up_note)
       and old.ends_at > now() then
      raise exception 'session outcomes may only be recorded after the session ends' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.academy_guardian_session_summaries(
  p_child_id uuid,
  p_offset integer default 0
)
returns table (
  id uuid,
  child_id uuid,
  subject text,
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text,
  status text,
  outcome text,
  follow_up_note text
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or p_offset is null or p_offset < 0 or p_offset > 10000 then
    return;
  end if;

  return query
  select l.id, l.child_id, l.subject, l.starts_at, l.ends_at, l.time_zone,
         l.status, l.outcome, l.follow_up_note
  from public.academy_individual_lessons l
  join public.academy_children c on c.id = l.child_id
    and c.guardian_id = auth.uid()
  where l.child_id = p_child_id
  order by l.starts_at, l.id
  limit 51 offset p_offset;
end;
$$;

create or replace function public.academy_teacher_roster()
returns table (child_id uuid, child_name text, scheduled_lessons bigint)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then return; end if;

  return query
  select c.id, c.display_name,
         count(l.id) filter (where l.status = 'scheduled' and l.ends_at >= now())::bigint
  from public.academy_teacher_assignments a
  join public.academy_teachers t on t.id = a.teacher_id and t.status = 'active'
  join public.academy_children c on c.id = a.child_id
  left join public.academy_individual_lessons l
    on l.teacher_id = a.teacher_id and l.child_id = a.child_id
  where a.teacher_id = auth.uid() and a.status = 'active'
  group by c.id, c.display_name
  order by c.display_name;
end;
$$;

create or replace function public.academy_accept_teacher_invite(
  p_token text,
  p_time_zone text default 'Africa/Cairo'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_invite public.academy_teacher_invites;
  v_hash text;
begin
  if v_user_id is null or length(coalesce(p_token, '')) < 32 then
    raise exception 'INVALID_TEACHER_INVITE' using errcode = 'P0001';
  end if;

  select lower(u.email), u.email_confirmed_at
    into v_email, v_confirmed_at
  from auth.users u where u.id = v_user_id;

  if v_email is null or v_confirmed_at is null then
    raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode = 'P0001';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_time_zone) then
    raise exception 'INVALID_TIME_ZONE' using errcode = 'P0001';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select i.* into v_invite
  from public.academy_teacher_invites i
  where i.token_hash = v_hash
    and lower(i.invited_email) = v_email
    and i.accepted_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'INVALID_OR_EXPIRED_TEACHER_INVITE' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.academy_teachers t where t.id = v_user_id) then
    raise exception 'TEACHER_ACCOUNT_ALREADY_EXISTS' using errcode = 'P0001';
  end if;

  insert into public.academy_teachers (id, display_name, time_zone, status)
  values (v_user_id, v_invite.display_name, p_time_zone, 'active');

  update public.academy_teacher_invites
    set accepted_at = now(), accepted_user_id = v_user_id
  where id = v_invite.id;

  return true;
end;
$$;

-- Triggers are added only when absent; the existing preview trigger names and
-- behavior are preserved. Production receives the same protections.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.academy_children'::regclass and tgname = 'academy_children_birth_year_guard' and not tgisinternal) then
    create trigger academy_children_birth_year_guard before insert or update on public.academy_children for each row execute function public.academy_children_check_birth_year();
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.academy_learning_plans'::regclass and tgname = 'academy_learning_plans_updated_at' and not tgisinternal) then
    create trigger academy_learning_plans_updated_at before update on public.academy_learning_plans for each row execute function public.academy_learning_plans_touch_updated_at();
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.academy_practice_entries'::regclass and tgname = 'academy_practice_entries_date_guard' and not tgisinternal) then
    create trigger academy_practice_entries_date_guard before insert or update on public.academy_practice_entries for each row execute function public.academy_practice_entries_check_date();
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.academy_teachers'::regclass and tgname = 'academy_teachers_time_zone' and not tgisinternal) then
    create trigger academy_teachers_time_zone before insert or update on public.academy_teachers for each row execute function public.academy_teacher_time_zone_guard();
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.academy_individual_lessons'::regclass and tgname = 'academy_lessons_assignment' and not tgisinternal) then
    create trigger academy_lessons_assignment before insert or update on public.academy_individual_lessons for each row execute function public.academy_individual_lesson_assignment_guard();
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.academy_individual_lessons'::regclass and tgname = 'academy_lessons_teacher_outcome_only' and not tgisinternal) then
    create trigger academy_lessons_teacher_outcome_only before update on public.academy_individual_lessons for each row execute function public.academy_teacher_outcome_only();
  end if;
end;
$$;

-- Guardian policies (identical to preview) are installed only on the new
-- tables in Production. Child ownership is enforced through auth.uid().
do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_learning_plans' and policyname = 'academy_learning_plans_guardian_all') then
    create policy academy_learning_plans_guardian_all on public.academy_learning_plans for all to authenticated
      using (guardian_id = auth.uid() and exists (select 1 from public.academy_children c where c.id = child_id and c.guardian_id = auth.uid()))
      with check (guardian_id = auth.uid() and exists (select 1 from public.academy_children c where c.id = child_id and c.guardian_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_practice_entries' and policyname = 'academy_practice_entries_guardian_all') then
    create policy academy_practice_entries_guardian_all on public.academy_practice_entries for all to authenticated
      using (guardian_id = auth.uid() and exists (select 1 from public.academy_children c where c.id = child_id and c.guardian_id = auth.uid()))
      with check (guardian_id = auth.uid() and exists (select 1 from public.academy_children c where c.id = child_id and c.guardian_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_teachers' and policyname = 'academy_teachers_read_self') then
    create policy academy_teachers_read_self on public.academy_teachers for select to authenticated using (id = auth.uid() and status = 'active');
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_teacher_assignments' and policyname = 'academy_teacher_assignments_read_self') then
    create policy academy_teacher_assignments_read_self on public.academy_teacher_assignments for select to authenticated
      using (teacher_id = auth.uid() and status = 'active' and exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.status = 'active'));
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_individual_lessons' and policyname = 'academy_lessons_teacher_read_assigned') then
    create policy academy_lessons_teacher_read_assigned on public.academy_individual_lessons for select to authenticated
      using (teacher_id = auth.uid() and exists (select 1 from public.academy_teacher_assignments a join public.academy_teachers t on t.id = a.teacher_id where a.teacher_id = academy_individual_lessons.teacher_id and a.child_id = academy_individual_lessons.child_id and a.status = 'active' and t.status = 'active'));
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_individual_lessons' and policyname = 'academy_lessons_teacher_update_outcomes') then
    create policy academy_lessons_teacher_update_outcomes on public.academy_individual_lessons for update to authenticated
      using (status = 'scheduled' and teacher_id = auth.uid() and exists (select 1 from public.academy_teacher_assignments a join public.academy_teachers t on t.id = a.teacher_id where a.teacher_id = academy_individual_lessons.teacher_id and a.child_id = academy_individual_lessons.child_id and a.status = 'active' and t.status = 'active'))
      with check (status = 'scheduled' and teacher_id = auth.uid() and exists (select 1 from public.academy_teacher_assignments a join public.academy_teachers t on t.id = a.teacher_id where a.teacher_id = academy_individual_lessons.teacher_id and a.child_id = academy_individual_lessons.child_id and a.status = 'active' and t.status = 'active'));
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_admins' and policyname = 'academy_admins_read_self') then
    create policy academy_admins_read_self on public.academy_admins for select to authenticated using (id = auth.uid() or public.academy_is_admin());
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_admins' and policyname = 'academy_admins_owner_bootstrap') then
    create policy academy_admins_owner_bootstrap on public.academy_admins for insert to authenticated with check (id = auth.uid() and public.academy_is_owner_account());
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_children' and policyname = 'academy_children_admin_read') then
    create policy academy_children_admin_read on public.academy_children for select to authenticated using (public.academy_is_admin());
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_teachers' and policyname = 'academy_teachers_admin_all') then
    create policy academy_teachers_admin_all on public.academy_teachers for all to authenticated using (public.academy_is_admin()) with check (public.academy_is_admin());
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_teacher_assignments' and policyname = 'academy_teacher_assignments_admin_all') then
    create policy academy_teacher_assignments_admin_all on public.academy_teacher_assignments for all to authenticated using (public.academy_is_admin()) with check (public.academy_is_admin());
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_individual_lessons' and policyname = 'academy_lessons_admin_all') then
    create policy academy_lessons_admin_all on public.academy_individual_lessons for all to authenticated using (public.academy_is_admin()) with check (public.academy_is_admin());
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_learning_plans' and policyname = 'academy_learning_plans_admin_read') then
    create policy academy_learning_plans_admin_read on public.academy_learning_plans for select to authenticated using (public.academy_is_admin());
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_practice_entries' and policyname = 'academy_practice_entries_admin_read') then
    create policy academy_practice_entries_admin_read on public.academy_practice_entries for select to authenticated using (public.academy_is_admin());
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_teacher_invites' and policyname = 'academy_teacher_invites_admin_read') then
    create policy academy_teacher_invites_admin_read on public.academy_teacher_invites for select to authenticated using (public.academy_is_admin());
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'academy_teacher_invites' and policyname = 'academy_teacher_invites_admin_insert') then
    create policy academy_teacher_invites_admin_insert on public.academy_teacher_invites for insert to authenticated with check (public.academy_is_admin() and created_by = auth.uid());
  end if;
end;
$$;

revoke all on function public.academy_is_owner_account() from public, anon;
revoke all on function public.academy_is_admin() from public, anon;
revoke all on function public.academy_enforce_registration_mode() from public, anon, authenticated;
revoke all on function public.academy_teacher_roster() from public, anon;
revoke all on function public.academy_accept_teacher_invite(text, text) from public, anon;
revoke all on function public.academy_guardian_session_summaries(uuid, integer) from public, anon;
grant execute on function public.academy_is_owner_account() to authenticated;
grant execute on function public.academy_is_admin() to authenticated;
grant execute on function public.academy_teacher_roster() to authenticated;
grant execute on function public.academy_accept_teacher_invite(text, text) to authenticated;
grant execute on function public.academy_guardian_session_summaries(uuid, integer) to authenticated;

commit;
