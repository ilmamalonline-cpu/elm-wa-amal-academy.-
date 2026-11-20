-- No application workflow deletes follow-up, lesson, assignment, or teacher
-- records. Prevent direct client DELETE while retaining SELECT/INSERT/UPDATE,
-- existing RLS policies, rows, and service-role administrative capabilities.
begin;

revoke delete on table public.academy_learning_plans from public, anon, authenticated;
revoke delete on table public.academy_practice_entries from public, anon, authenticated;
revoke delete on table public.academy_individual_lessons from public, anon, authenticated;
revoke delete on table public.academy_teacher_assignments from public, anon, authenticated;
revoke delete on table public.academy_teachers from public, anon, authenticated;

do $$
declare
  v_table text;
  v_role text;
begin
  foreach v_table in array array[
    'public.academy_learning_plans',
    'public.academy_practice_entries',
    'public.academy_individual_lessons',
    'public.academy_teacher_assignments',
    'public.academy_teachers'
  ] loop
    foreach v_role in array array['anon', 'authenticated'] loop
      if pg_catalog.has_table_privilege(v_role, v_table, 'DELETE') then
        raise exception 'Client role % retains DELETE privilege on %', v_role, v_table;
      end if;
    end loop;
  end loop;
end;
$$;

commit;
