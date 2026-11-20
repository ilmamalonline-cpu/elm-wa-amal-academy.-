-- Family accounts have no user-facing delete workflow. Prevent direct deletes
-- from erasing child profiles, learning plans, practice history or lesson rows.
-- No rows or foreign keys are changed by this migration.
begin;

drop policy if exists academy_children_delete_own on public.academy_children;
drop policy if exists academy_guardians_delete_own on public.academy_guardians;

revoke delete on table public.academy_children from public, anon, authenticated;
revoke delete on table public.academy_guardians from public, anon, authenticated;

do $$
declare
  v_authenticated_oid oid;
begin
  select r.oid into v_authenticated_oid from pg_catalog.pg_roles r where r.rolname = 'authenticated';
  if exists (
    select 1
    from pg_catalog.pg_policy p
    where p.polrelid in ('public.academy_children'::regclass, 'public.academy_guardians'::regclass)
      and p.polcmd in ('d', '*')
      and (0 = any(p.polroles) or v_authenticated_oid = any(p.polroles))
  ) then
    raise exception 'A remaining authenticated DELETE policy can erase guardian or child records.';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.academy_children', 'DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'public.academy_guardians', 'DELETE') then
    raise exception 'Authenticated DELETE privilege remains on guardian or child records.';
  end if;
end;
$$;

commit;
