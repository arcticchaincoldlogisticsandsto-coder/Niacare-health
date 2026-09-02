-- NiaCare: repair an older database and grant one existing account admin access.
-- One-paste script for the Supabase SQL Editor.
--
-- BEFORE RUNNING: edit the email on the line marked below to the account
-- you want promoted to admin. That account must already exist (signed up
-- through the app, or created under Authentication -> Users) — this script
-- does not create a new login, only promotes an existing public.profiles row.

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
-- PROMOTE YOUR ACCOUNT
-- --------------------------------------------------------------------------
update public.profiles
set role = 'admin', status = 'active'
where id = (
  select id from auth.users
  where lower(email) = lower('niacare46@gmail.com')
);

-- Verify: should return exactly one row, role = 'admin', status = 'active'.
-- If it returns zero rows, niacare46@gmail.com didn't match any auth.users
-- account, or that account has no public.profiles row yet (sign up through
-- the app first, then re-run just this UPDATE).
select id, full_name, email, role, status
from public.profiles
where lower(email) = lower('niacare46@gmail.com');
