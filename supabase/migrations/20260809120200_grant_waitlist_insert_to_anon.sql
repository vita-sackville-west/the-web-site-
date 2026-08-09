-- RLS policy alone isn't enough — Postgres also requires a table-level GRANT.
-- The waitlist table was likely only ever granted to `authenticated`, so anon
-- inserts were rejected before the policy was even evaluated.
grant insert on public.waitlist to anon;
