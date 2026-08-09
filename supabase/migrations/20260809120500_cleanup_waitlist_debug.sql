-- Remove the temporary debug helper and test rows used while diagnosing the
-- public waitlist RLS setup.
drop function if exists public.debug_waitlist_rls();
delete from public.waitlist where email = 'claude-rls-test@example.com';
