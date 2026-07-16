-- Delete non-admin messages older than 24 hours, hourly. Admin conversations
-- (matches involving ADMIN_USER_ID) are excluded and kept indefinitely.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'delete-old-messages',
  '0 * * * *',
  $$
    delete from public.messages
    where created_at < now() - interval '24 hours'
    and match_id not in (
      select id from public.matches
      where user_a = '678c8f5c-3695-4da1-8eb7-dec72f5539ca'
         or user_b = '678c8f5c-3695-4da1-8eb7-dec72f5539ca'
    )
  $$
);
