-- The publishable-key request didn't map to the `anon` policy role as expected;
-- broaden the insert policy to `public` (covers anon + authenticated) instead.
drop policy if exists "Public can join waitlist" on public.waitlist;
create policy "Public can join waitlist"
on public.waitlist
for insert
to public
with check (true);
