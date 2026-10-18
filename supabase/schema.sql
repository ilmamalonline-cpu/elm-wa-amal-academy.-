-- ============================================================
-- أكاديمية علم وعمل (Elm wa Amal Academy) — Database Schema
-- Articulation Correction & Phonetics Academy
-- ============================================================
-- HOW TO USE:
-- 1. Open your Supabase project -> SQL Editor -> New query
-- 2. Paste this ENTIRE file and click "Run"
-- (Already have a database made from the OLD schema? Don't run this file —
--  run supabase/migrations/20261018_security_and_logic_fixes.sql instead.)
-- 3. It is safe to run once on a fresh project. If you need to re-run it,
-- drop the tables first (see DROP block commented out at the bottom).
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type public.user_role as enum ('admin', 'teacher', 'student');
create type public.session_type as enum ('individual', 'group');
create type public.booking_status as enum ('confirmed', 'completed', 'cancelled', 'no_show');
create type public.recurrence_pattern as enum ('none', 'weekly', 'biweekly');

-- ============================================================
-- SHARED TRIGGER HELPERS
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1. PROFILES (mirrors auth.users — one row per person)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.user_role not null default 'student',
  phone text,
  avatar_url text,
  bio text,                          -- teacher public bio
  price_per_session numeric(10,2),   -- teacher rate (display-only in simulation mode)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

-- RLS-bypassing role lookup used inside policies (a policy on `profiles`
-- that queried `profiles` directly would recurse forever).
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---- auto-create a profile row whenever someone signs up ----
-- SECURITY NOTE: role is ALWAYS 'student' here, even if a client sends a
-- different role in signUp() metadata. This is deliberate — public signup
-- must never be able to self-grant teacher/admin. Admins promote accounts
-- afterward from the Admin Dashboard (see prevent_unauthorized_role_change
-- trigger below), which performs a normal UPDATE that this trigger allows.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'student'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- block self-escalation / self-reactivation ----
-- Fires for EVERY update to these columns, regardless of which key performed
-- it. Only an admin (or a caller with NO end-user JWT — the service role used
-- by app/api/admin/users/route.ts, or the SQL editor used to bootstrap the
-- first admin) may change role / is_active / email. A normal authenticated
-- request always carries auth.uid(), so it can't take the bypass.
create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_role public.user_role;
begin
  -- No end-user JWT => trusted backend (service role) or the SQL editor.
  if auth.uid() is null then
    return new;
  end if;

  select role into v_caller_role from public.profiles where id = auth.uid();

  if v_caller_role is distinct from 'admin' then
    if new.role is distinct from old.role then
      raise exception 'ONLY_ADMIN_CAN_CHANGE_ROLE';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'ONLY_ADMIN_CAN_CHANGE_ACTIVE';
    end if;
    if new.email is distinct from old.email then
      raise exception 'EMAIL_MANAGED_BY_AUTH';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_unauthorized_role_change();

alter table public.profiles enable row level security;

-- Own row; any teacher's row (the booking page lists teachers); and
-- teachers/admins can read everyone (they need student names).
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "profiles_select_teachers"
  on public.profiles for select to authenticated
  using (role = 'teacher');

create policy "profiles_select_staff"
  on public.profiles for select to authenticated
  using (public.current_user_role() in ('teacher', 'admin'));

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ============================================================
-- 2. STUDENT_PREFERENCES
-- ============================================================
create table public.student_preferences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.profiles(id) on delete cascade,
  preferred_days int[] not null default '{}',          -- 0=Sun .. 6=Sat
  preferred_hour_slots text[] not null default '{}',   -- e.g. {'08:00','17:00'}
  notes text,
  updated_at timestamptz not null default now()
);

create trigger student_preferences_set_updated_at
  before update on public.student_preferences
  for each row execute function public.set_updated_at();

alter table public.student_preferences enable row level security;

create policy "prefs_owner_all"
  on public.student_preferences for all
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

create policy "prefs_staff_select"
  on public.student_preferences for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher','admin')));


-- ============================================================
-- 3. TEACHER_AVAILABILITY
-- ============================================================
-- IMPORTANT date convention:
-- week_start_date = the SUNDAY of that week
-- day_of_week = 0 (Sun) .. 6 (Sat), matching JS Date.getDay()
-- => an exact calendar date = week_start_date + day_of_week (days)
create table public.teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_duration_minutes int not null default 60,
  session_type public.session_type not null default 'individual',
  max_students_group int not null default 1,
  is_booked boolean not null default false,
  -- soft-close: a slot that ever had a booking can't be deleted (FK restrict)
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint valid_time_range check (end_time > start_time),
  unique (teacher_id, week_start_date, day_of_week, start_time)
);

create index teacher_availability_teacher_idx on public.teacher_availability(teacher_id);
create index teacher_availability_week_idx on public.teacher_availability(week_start_date);
create index teacher_availability_open_idx on public.teacher_availability(is_booked) where is_booked = false;

alter table public.teacher_availability enable row level security;

create policy "availability_select_authenticated"
  on public.teacher_availability for select
  to authenticated
  using (true);

create policy "availability_owner_all"
  on public.teacher_availability for all
  to authenticated
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

create policy "availability_admin_all"
  on public.teacher_availability for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ============================================================
-- 4. BOOKINGS
-- ============================================================
-- NOTE: there is NO direct insert/update policy for students/teachers on
-- this table. All writes go through the security-definer functions below
-- (book_slot, cancel_booking) so the is_booked flag on teacher_availability
-- can never drift out of sync with reality, and two students can never
-- win the same slot in a race condition (the slot row is row-locked with
-- `for update` for the duration of the booking transaction).
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  availability_slot_id uuid not null references public.teacher_availability(id) on delete restrict,

  session_type public.session_type not null,
  scheduled_date date not null,
  day_of_week int not null,
  time_slot time not null,
  duration_minutes int not null default 60,

  status public.booking_status not null default 'confirmed',

  zoom_meeting_id text,
  zoom_join_url text,
  -- NOTE: no zoom_start_url column on purpose. It is the HOST link and RLS can't
  -- hide a single column from a student reading their own row. The app fetches
  -- a fresh start link on demand for the teacher (/api/bookings/start).

  is_recurring boolean not null default false,
  recurrence_pattern public.recurrence_pattern not null default 'none',
  recurrence_end_date date,
  -- Reserved for a future "generate per-week child bookings" feature.
  -- The current app represents a whole recurring subscription with a
  -- SINGLE booking row (day_of_week + recurrence_pattern + end_date) and
  -- computes each future occurrence's date on the fly — see
  -- getNextOccurrenceDate() in lib/utils/datetime.ts — rather than
  -- writing one row per week. This column is always null for now.
  parent_booking_id uuid references public.bookings(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_student_idx on public.bookings(student_id);
create index bookings_teacher_idx on public.bookings(teacher_id);
create index bookings_date_idx on public.bookings(scheduled_date);
create index bookings_status_idx on public.bookings(status);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;

create policy "bookings_select_student"
  on public.bookings for select
  to authenticated
  using (auth.uid() = student_id);

create policy "bookings_select_teacher"
  on public.bookings for select
  to authenticated
  using (auth.uid() = teacher_id);

create policy "bookings_select_admin"
  on public.bookings for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Note: the booking-creation route attaches zoom_meeting_id/join_url
-- using the SERVICE ROLE client (bypasses RLS entirely) right
-- after this row is created under the student's own session via
-- book_slot() above — see app/api/bookings/create/route.ts. The policy
-- below is for a human admin manually fixing a broken Zoom link from the
-- Admin Dashboard through their own authenticated session.
create policy "bookings_update_zoom_fields_admin"
  on public.bookings for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ============================================================
-- 5. SESSION_FEEDBACK
-- ============================================================
create table public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  -- which occurrence this is for (a weekly subscription has one per week)
  session_date date not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  articulation_notes text,
  tajweed_errors jsonb not null default '[]',   -- [{letter, error_type, correction}]
  homework text,
  rating int check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (booking_id, session_date)
);

create index session_feedback_student_idx on public.session_feedback(student_id);

alter table public.session_feedback enable row level security;

-- Read-only for teacher/student/admin. Writes go ONLY through
-- submit_session_feedback() below, which checks the caller really is the
-- booking's teacher (a bare `teacher_id = auth.uid()` policy let any
-- logged-in user write feedback for any booking).
create policy "feedback_teacher_select"
  on public.session_feedback for select
  to authenticated
  using (auth.uid() = teacher_id);

create policy "feedback_student_select"
  on public.session_feedback for select
  to authenticated
  using (auth.uid() = student_id);

create policy "feedback_admin_select"
  on public.session_feedback for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ============================================================
-- RPCs (all SECURITY DEFINER; they use auth.uid(), never a client-sent id)
-- ============================================================

-- ------------------------------------------------------------
-- RPC: book_slot (validated)
-- ------------------------------------------------------------
create or replace function public.book_slot(
  p_slot_id uuid,
  p_recurring boolean default false,
  p_recurrence_pattern public.recurrence_pattern default 'none',
  p_recurrence_end_date date default null
)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_slot public.teacher_availability;
  v_booking public.bookings;
  v_current_bookings int := 0;
  v_first_date date;
  v_pattern public.recurrence_pattern := 'none';
  v_end date := null;
begin
  if v_student_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not exists (select 1 from public.profiles where id = v_student_id and is_active) then
    raise exception 'ACCOUNT_DISABLED';
  end if;

  select * into v_slot
  from public.teacher_availability
  where id = p_slot_id
  for update;

  if not found or v_slot.is_closed then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if not exists (select 1 from public.profiles where id = v_slot.teacher_id and is_active) then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if v_slot.is_booked then
    raise exception 'SLOT_ALREADY_BOOKED';
  end if;

  -- Reject slots that have already started (slot times are Cairo wall-clock).
  v_first_date := v_slot.week_start_date + v_slot.day_of_week;
  if ((v_first_date + v_slot.start_time) at time zone 'Africa/Cairo') <= now() then
    raise exception 'SLOT_IN_PAST';
  end if;

  -- Same student can't take two seats in the same slot.
  if exists (
    select 1 from public.bookings
    where availability_slot_id = p_slot_id
      and student_id = v_student_id
      and status = 'confirmed'
  ) then
    raise exception 'ALREADY_BOOKED_BY_YOU';
  end if;

  if v_slot.session_type = 'group' then
    select count(*) into v_current_bookings
    from public.bookings
    where availability_slot_id = p_slot_id and status = 'confirmed';

    if v_current_bookings >= v_slot.max_students_group then
      raise exception 'SLOT_FULL';
    end if;
  end if;

  if p_recurring then
    if v_slot.session_type <> 'individual'
       or p_recurrence_pattern = 'none'
       or p_recurrence_end_date is null
       or p_recurrence_end_date < v_first_date
       or p_recurrence_end_date > v_first_date + 366 then
      raise exception 'INVALID_RECURRENCE';
    end if;
    v_pattern := p_recurrence_pattern;
    v_end := p_recurrence_end_date;
  end if;

  insert into public.bookings (
    student_id, teacher_id, availability_slot_id,
    session_type, scheduled_date, day_of_week, time_slot, duration_minutes,
    status, is_recurring, recurrence_pattern, recurrence_end_date
  ) values (
    v_student_id, v_slot.teacher_id, p_slot_id,
    v_slot.session_type, v_first_date, v_slot.day_of_week,
    v_slot.start_time, v_slot.slot_duration_minutes,
    'confirmed', p_recurring, v_pattern, v_end
  )
  returning * into v_booking;

  if v_slot.session_type = 'individual' or (v_current_bookings + 1) >= v_slot.max_students_group then
    update public.teacher_availability set is_booked = true where id = p_slot_id;
  end if;

  return v_booking;
end;
$$;

-- ------------------------------------------------------------
-- RPC: cancel_booking (only a CONFIRMED booking can be cancelled)
-- ------------------------------------------------------------
-- Before: no status check, so re-cancelling an already-cancelled booking
-- re-opened the slot even if another student had since booked it.
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_role public.user_role;
  v_booking public.bookings;
begin
  if v_caller is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  select role into v_caller_role from public.profiles where id = v_caller;

  if v_caller is distinct from v_booking.student_id
     and v_caller is distinct from v_booking.teacher_id
     and v_caller_role is distinct from 'admin' then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception 'BOOKING_NOT_CANCELLABLE';
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id
  returning * into v_booking;

  update public.teacher_availability set is_booked = false where id = v_booking.availability_slot_id;

  return v_booking;
end;
$$;

-- ------------------------------------------------------------
-- RPC: submit_session_feedback (the ONLY way feedback gets written)
-- ------------------------------------------------------------
-- * only the booking's own teacher can write feedback for it
-- * one feedback per session date (weekly subscriptions get one per week)
-- * the booking is marked completed only when it is a one-off, or when the
--   feedback is for the LAST occurrence of a recurring series
create or replace function public.submit_session_feedback(
  p_booking_id uuid,
  p_session_date date,
  p_articulation_notes text default null,
  p_tajweed_errors jsonb default '[]'::jsonb,
  p_homework text default null,
  p_rating int default null
)
returns public.session_feedback
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_booking public.bookings;
  v_feedback public.session_feedback;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_step int;
  v_diff int;
begin
  if v_caller is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.teacher_id is distinct from v_caller then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception 'BOOKING_NOT_ACTIVE';
  end if;

  if p_session_date is null or p_session_date > v_today then
    raise exception 'SESSION_NOT_HELD_YET';
  end if;

  v_step := case when v_booking.recurrence_pattern = 'biweekly' then 14 else 7 end;

  if v_booking.is_recurring then
    v_diff := p_session_date - v_booking.scheduled_date;
    if v_diff < 0
       or v_diff % v_step <> 0
       or (v_booking.recurrence_end_date is not null and p_session_date > v_booking.recurrence_end_date) then
      raise exception 'INVALID_SESSION_DATE';
    end if;
  elsif p_session_date <> v_booking.scheduled_date then
    raise exception 'INVALID_SESSION_DATE';
  end if;

  if p_rating is not null and (p_rating < 1 or p_rating > 5) then
    raise exception 'INVALID_RATING';
  end if;

  if jsonb_typeof(coalesce(p_tajweed_errors, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'INVALID_PAYLOAD';
  end if;

  begin
    insert into public.session_feedback (
      booking_id, session_date, teacher_id, student_id,
      articulation_notes, tajweed_errors, homework, rating
    ) values (
      p_booking_id, p_session_date, v_booking.teacher_id, v_booking.student_id,
      p_articulation_notes, coalesce(p_tajweed_errors, '[]'::jsonb), p_homework, p_rating
    )
    returning * into v_feedback;
  exception when unique_violation then
    raise exception 'FEEDBACK_ALREADY_EXISTS';
  end;

  if (not v_booking.is_recurring)
     or (v_booking.recurrence_end_date is not null and p_session_date + v_step > v_booking.recurrence_end_date) then
    update public.bookings set status = 'completed' where id = p_booking_id;
  end if;

  return v_feedback;
end;
$$;

-- ------------------------------------------------------------
-- RPC: get_admin_stats — "today" in Cairo, not the DB's UTC date
-- ------------------------------------------------------------
create or replace function public.get_admin_stats()
returns table (
  active_teachers bigint,
  active_students bigint,
  sessions_today bigint,
  upcoming_confirmed bigint
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_role public.user_role;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  select
    (select count(*) from public.profiles where role = 'teacher' and is_active)::bigint,
    (select count(*) from public.profiles where role = 'student' and is_active)::bigint,
    (select count(*) from public.bookings where scheduled_date = v_today and status = 'confirmed')::bigint,
    (select count(*) from public.bookings where status = 'confirmed' and scheduled_date >= v_today)::bigint;
end;
$$;

-- ------------------------------------------------------------
-- Function privileges: signed-in users only (not anon / PUBLIC)
-- ------------------------------------------------------------
revoke all on function public.book_slot(uuid, boolean, public.recurrence_pattern, date) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.submit_session_feedback(uuid, date, text, jsonb, text, int) from public, anon;
revoke all on function public.get_admin_stats() from public, anon;

grant execute on function public.book_slot(uuid, boolean, public.recurrence_pattern, date) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.submit_session_feedback(uuid, date, text, jsonb, text, int) to authenticated;
grant execute on function public.get_admin_stats() to authenticated;

-- ============================================================
-- DONE. Next steps:
-- 1. Project Settings -> API -> copy the "service_role" key into
-- SUPABASE_SERVICE_ROLE_KEY in your .env.local (server-only, never
-- expose it to the browser).
-- 2. Authentication -> Providers -> make sure Email is enabled.
-- 3. Authentication -> URL Configuration -> add your Vercel domain
-- once deployed.
-- ============================================================
