-- NiaCare: repair an older database and grant one existing account admin access.
-- Run this in Supabase SQL Editor. It is safe to run before choosing an admin.
-- Then run the separate promotion query at the end using a real user UUID.

alter table public.profiles
  add column if not exists role text not null default 'patient'
    check (role in ('patient', 'doctor', 'provider_staff', 'admin')),
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended'));

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.role = 'admin'
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Administrators can manage all operational records. Patient/doctor/staff
-- policies remain in place; this adds the administrator path only.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'providers', 'doctor_profiles', 'provider_staff',
    'appointments', 'medical_records', 'prescriptions', 'personal_files',
    'bills', 'bill_items', 'payments', 'doctor_schedule',
    'emergency_dispatches'
  ]
  loop
    execute format('drop policy if exists "Admins have full access" on public.%I', target_table);
    execute format(
      'create policy "Admins have full access" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      target_table
    );
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- PROMOTE YOUR ACCOUNT (run these two queries separately after the script).
-- 1. Copy your UUID from the result of this query:
--    select id, email, created_at from auth.users order by created_at desc;
--
-- 2. Replace ONLY the UUID below, keeping its quotes and ::uuid cast:
--    update public.profiles
--    set role = 'admin', status = 'active'
--    where id = '00000000-0000-0000-0000-000000000000'::uuid;
--
-- 3. Verify:
--    select id, full_name, role, status from public.profiles
--    where id = 'YOUR-REAL-UUID-HERE'::uuid;
