-- ============================================================
-- Migration: security + logic fixes   (run ONCE on an EXISTING database)
-- ============================================================
-- Fresh project? Don't run this — supabase/schema.sql already contains
-- everything below. This file is only for databases created from the OLD
-- schema.sql.
--
-- How: Supabase -> SQL Editor -> paste this whole file -> Run.
-- It is wrapped in a transaction, so if any statement fails nothing is
-- applied and you can fix the error and re-run.
--
-- Deploy the new app code first (or right after): the old code still reads
-- bookings.zoom_start_url and calls mark_booking_completed(), both removed here.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. RLS-bypassing helper (avoids "infinite recursion in policy")
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 1. profiles: only admins may change role / is_active / email
-- ------------------------------------------------------------
-- Before: only `role` was guarded, so a suspended user could re-activate
-- themselves with a direct API call (profiles_update_own lets you update
-- your own row), and could edit the email column away from auth.users.
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

-- ------------------------------------------------------------
-- 2. profiles: stop every user from reading every profile
-- ------------------------------------------------------------
-- Before: `using (true)` let any logged-in student read all emails/phones.
-- Now: your own row; any teacher's row (needed by the booking page);
-- and teachers/admins can read everyone (they need student names).
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_teachers" on public.profiles;
drop policy if exists "profiles_select_staff" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "profiles_select_teachers"
  on public.profiles for select to authenticated
  using (role = 'teacher');

create policy "profiles_select_staff"
  on public.profiles for select to authenticated
  using (public.current_user_role() in ('teacher', 'admin'));

-- ------------------------------------------------------------
-- 3. teacher_availability: soft-close
-- ------------------------------------------------------------
-- A slot that ever had a booking can't be DELETEd (bookings FK is
-- `on delete restrict`, even for cancelled bookings), so closing it now
-- sets is_closed instead.
alter table public.teacher_availability
  add column if not exists is_closed boolean not null default false;

-- ------------------------------------------------------------
-- 4. bookings: the Zoom HOST link must not live in a student-readable row
-- ------------------------------------------------------------
-- RLS filters rows, not columns, so students could read zoom_start_url of
-- their own bookings (host access to the meeting). The app now fetches a
-- fresh start link on demand for the teacher (/api/bookings/start).
alter table public.bookings drop column if exists zoom_start_url;

-- ------------------------------------------------------------
-- 5. session_feedback: one row per SESSION, writable only via RPC
-- ------------------------------------------------------------
alter table public.session_feedback add column if not exists session_date date;

update public.session_feedback f
   set session_date = b.scheduled_date
  from public.bookings b
 where b.id = f.booking_id and f.session_date is null;

alter table public.session_feedback alter column session_date set not null;

-- was: unique (booking_id) => a weekly subscription could only ever get ONE feedback
alter table public.session_feedback drop constraint if exists session_feedback_booking_id_key;
alter table public.session_feedback drop constraint if exists session_feedback_booking_id_session_date_key;
alter table public.session_feedback
  add constraint session_feedback_booking_id_session_date_key unique (booking_id, session_date);

-- was: feedback_teacher_all  (only checked teacher_id = auth.uid(), so ANY
-- logged-in user could insert "feedback" for any booking/student)
drop policy if exists "feedback_teacher_all" on public.session_feedback;
drop policy if exists "feedback_teacher_select" on public.session_feedback;
create policy "feedback_teacher_select"
  on public.session_feedback for select to authenticated
  using (auth.uid() = teacher_id);

-- ------------------------------------------------------------
-- 6. RPC: book_slot (validated)
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
-- 7. RPC: cancel_booking (only a CONFIRMED booking can be cancelled)
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
-- 8. RPC: submit_session_feedback (replaces direct insert + mark_booking_completed)
-- ------------------------------------------------------------
-- * only the booking's own teacher can write feedback for it
-- * one feedback per session date (weekly subscriptions get one per week)
-- * the booking is marked completed only when it is a one-off, or when the
--   feedback is for the LAST occurrence of a recurring series
drop function if exists public.mark_booking_completed(uuid);

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
-- 9. RPC: get_admin_stats — "today" in Cairo, not the DB's UTC date
-- ------------------------------------------------------------
-- (dropped first: CREATE OR REPLACE can't change a function's return column types)
drop function if exists public.get_admin_stats();

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
-- 10. Function privileges: signed-in users only (not anon / PUBLIC)
-- ------------------------------------------------------------
revoke all on function public.book_slot(uuid, boolean, public.recurrence_pattern, date) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.submit_session_feedback(uuid, date, text, jsonb, text, int) from public, anon;
revoke all on function public.get_admin_stats() from public, anon;

grant execute on function public.book_slot(uuid, boolean, public.recurrence_pattern, date) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.submit_session_feedback(uuid, date, text, jsonb, text, int) to authenticated;
grant execute on function public.get_admin_stats() to authenticated;

-- ------------------------------------------------------------
-- 11. OPTIONAL data repair — leave commented unless you need it
-- ------------------------------------------------------------
-- The old code marked a whole recurring subscription `completed` after its
-- FIRST feedback. To revive subscriptions that are still within their end
-- date, uncomment and run:
--
-- update public.bookings
--    set status = 'confirmed'
--  where is_recurring
--    and status = 'completed'
--    and (recurrence_end_date is null
--         or recurrence_end_date >= (now() at time zone 'Africa/Cairo')::date);

commit;
