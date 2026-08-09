-- Allow anonymous visitors to join the waitlist from the public waitlist page,
-- without needing to be signed in (the onboarding waitlist checkbox already
-- inserts here as an authenticated user; this adds the same ability for anon).
create policy "Public can join waitlist"
on public.waitlist
for insert
to anon
with check (true);
