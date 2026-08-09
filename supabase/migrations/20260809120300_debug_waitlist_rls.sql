create or replace function public.debug_waitlist_rls()
returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'rls_enabled', (select relrowsecurity from pg_class where oid='public.waitlist'::regclass),
    'policies', (select jsonb_agg(jsonb_build_object('name',polname,'cmd',polcmd,'roles',polroles::regrole[]::text[],'permissive',polpermissive)) from pg_policy where polrelid='public.waitlist'::regclass),
    'grants', (select jsonb_agg(jsonb_build_object('grantee',grantee,'privilege',privilege_type)) from information_schema.role_table_grants where table_name='waitlist')
  );
$$;
grant execute on function public.debug_waitlist_rls() to anon;
