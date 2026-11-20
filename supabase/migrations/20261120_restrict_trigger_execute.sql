-- Rebind the registration guard to the reviewed owner-only trigger function.
-- The previous release migration creates or replaces this function first.
begin;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'academy_enforce_registration_mode'
      and p.prorettype = 'trigger'::regtype
      and pg_catalog.pg_get_functiondef(p.oid) like '%ACADEMY_REGISTRATION_OWNER_ONLY%'
  ) then
    raise exception 'Reviewed owner-only registration trigger function is missing.';
  end if;
end;
$$;

drop trigger if exists academy_enforce_registration_mode on auth.users;
create trigger academy_enforce_registration_mode
  before insert on auth.users
  for each row execute function public.academy_enforce_registration_mode();

-- Trigger functions are invoked by PostgreSQL triggers, not as public API RPCs.
revoke execute on function public.academy_teacher_outcome_only() from public, anon, authenticated;
commit;
