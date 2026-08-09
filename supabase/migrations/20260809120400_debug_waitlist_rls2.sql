create or replace function public.debug_waitlist_rls()
returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'current_role', current_setting('role', true),
    'session_user', session_user,
    'jwt_role', current_setting('request.jwt.claim.role', true),
    'rls_enabled', (select relrowsecurity from pg_class where oid='public.waitlist'::regclass),
    'policies', (select jsonb_agg(jsonb_build_object('name',polname,'cmd',polcmd,'roles',polroles::regrole[]::text[],'permissive',polpermissive,'qual',pg_get_expr(polqual,polrelid),'withcheck',pg_get_expr(polwithcheck,polrelid))) from pg_policy where polrelid='public.waitlist'::regclass)
  );
$$;
grant execute on function public.debug_waitlist_rls() to anon;
