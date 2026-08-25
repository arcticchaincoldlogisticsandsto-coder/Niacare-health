-- Provision the NiaCare platform administrator by email.
-- Run in Supabase SQL Editor after this email has been created in
-- Authentication -> Users (or registered through the NiaCare app).

insert into public.profiles (
  id, user_category, role, status, full_name, email
)
select
  u.id,
  'locals',
  'admin',
  'active',
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
  u.email
from auth.users u
where lower(u.email) = 'arcticchaincoldlogisticsandsto@gmail.com'
on conflict (id) do update
set role = 'admin',
    status = 'active',
    email = excluded.email;

-- Confirm the account was provisioned. It should return one admin row.
select p.id, p.email, p.role, p.status
from public.profiles p
where lower(p.email) = 'arcticchaincoldlogisticsandsto@gmail.com';
