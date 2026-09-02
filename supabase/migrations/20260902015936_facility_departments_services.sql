-- ============================================================================
-- NiaCare — Facility departments, services, and doctor-department assignment
--
-- STATUS: NOT YET APPLIED to the live database as of this file's creation.
-- Extracted verbatim from supabase/schema.sql (byte-identical to that
-- section) so it can be reviewed and applied on its own.
--
-- DEPENDENCY: none. This migration does not depend on any of the other
-- currently-pending migrations (appointment pipeline,
-- fetch_patient_record_access_log, fetch_queue_position) — it only
-- references providers, provider_staff, doctor_profiles, is_admin(),
-- set_updated_at(), and log_audit_event(), all of which are already live.
-- It can be applied independently, in any order relative to those three.
--
-- WHAT THIS ADDS (all additive, nothing removed or renamed):
--   1. facility_departments — new table. A department belongs to exactly
--      one facility (provider_id not null, cascade on facility delete).
--      RLS: active departments are publicly viewable; inactive ones only
--      to admin, that facility's own active staff, or a doctor at that
--      facility. Insert/update restricted to admin or that facility's own
--      active staff. No delete policy — deactivate (is_active = false)
--      instead, per spec ("prefer deactivation").
--   2. facility_services — new table. department_id is nullable (a
--      service like "Emergency" need not map to one department). Same RLS
--      shape as facility_departments.
--   3. doctor_profiles.department_id — new nullable column (a single FK,
--      not a join table — see the in-file comment for why: mirrors the
--      existing one-doctor-one-facility model rather than guessing at a
--      multiplicity nothing else in the schema has yet).
--   4. assign_doctor_department() — a new function, not a broadened
--      doctor_profiles RLS policy. provider_staff has no other write
--      access to doctor_profiles; this function updates only
--      department_id, only for admin / the doctor's own facility staff /
--      the doctor themselves, and only into a department that actually
--      belongs to the doctor's own facility.
--
-- WHY THIS IS SAFE:
--   - Every CREATE TABLE uses IF NOT EXISTS; every trigger/policy is
--     dropped and re-created by name, so re-running this file is a no-op.
--   - Both new tables start empty — there is no existing data that could
--     violate the (provider_id, name) uniqueness constraint or any FK.
--   - RLS is enabled on both tables from creation; there is no window
--     where they exist without it.
--   - department/service management deliberately reuses the exact same
--     "active provider_staff at this provider_id" authorization check
--     already used throughout this schema (check_in_appointment,
--     call_patient, mark_appointment_no_show, etc.) rather than inventing
--     a new authorization model.
--
-- HOW TO APPLY: same process as the other pending migrations — Supabase
-- SQL Editor, after running the pre-flight checks below. Not executed by
-- the assistant that generated this file.
--
-- PRE-FLIGHT (read-only, run first):
--   select count(*) from information_schema.tables
--   where table_schema = 'public' and table_name in ('facility_departments', 'facility_services');
--   -- expect 0 (neither table exists yet); if not 0, stop and inspect
--   -- what's already there before applying.
--
-- POST-DEPLOY VERIFICATION:
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('facility_departments', 'facility_services');
--   -- expect both rows.
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'doctor_profiles' and column_name = 'department_id';
--   -- expect 1 row.
--   select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = 'assign_doctor_department';
--   -- expect 1 row.
-- ============================================================================

-- ============================================================================
-- FACILITY DEPARTMENTS — a department belongs to exactly one facility.
--
-- provider_staff.permissions (text[]) exists but is never read anywhere in
-- this codebase (checked — no RLS policy, no RPC, no frontend code
-- references it at all). Rather than invent fine-grained permission
-- checking on top of an unused column, department/service management here
-- uses the same coarse "any active staff member at this facility" gate
-- every other provider_staff-scoped RPC already uses (check_in_appointment,
-- call_patient, mark_appointment_no_show, etc.) — consistent with existing
-- precedent, not a new, weaker, or stricter standard.
-- ============================================================================
create table if not exists public.facility_departments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, name)
);

create index if not exists facility_departments_provider_id_idx on public.facility_departments(provider_id);

alter table public.facility_departments enable row level security;

-- Active departments are public (a patient browsing a facility profile
-- should see them without needing any relationship to that facility);
-- inactive ones are visible only to admin, that facility's own staff, or a
-- doctor who actually belongs to that facility — never to patients or
-- unrelated doctors/staff.
drop policy if exists "Facility departments are viewable" on public.facility_departments;
create policy "Facility departments are viewable"
  on public.facility_departments for select
  using (
    is_active
    or public.is_admin()
    or exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = facility_departments.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or exists (
      select 1 from public.doctor_profiles dp
      where dp.provider_id = facility_departments.provider_id and dp.user_id = auth.uid()
    )
  );

drop policy if exists "Facility departments are manageable by facility staff or admin" on public.facility_departments;
create policy "Facility departments are manageable by facility staff or admin"
  on public.facility_departments for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = facility_departments.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
  );

drop policy if exists "Facility departments are updatable by facility staff or admin" on public.facility_departments;
create policy "Facility departments are updatable by facility staff or admin"
  on public.facility_departments for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = facility_departments.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = facility_departments.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
  );

-- No delete policy anywhere: per spec, "prefer deactivation" — a department
-- can be deactivated (is_active = false) by facility staff/admin, but
-- deletion (which would cascade into facility_services and null out
-- doctor_profiles.department_id) is left to a human running SQL directly
-- with full knowledge of what depends on it, not exposed as an app action.

drop trigger if exists set_facility_departments_updated_at on public.facility_departments;
create trigger set_facility_departments_updated_at
  before update on public.facility_departments
  for each row execute function public.set_updated_at();

-- ============================================================================
-- FACILITY SERVICES — department_id is nullable: a service like "Emergency"
-- or "Pharmacy" may not map to one department, per spec ("Do not make
-- department_id mandatory if some services operate across departments").
-- ============================================================================
create table if not exists public.facility_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  department_id uuid references public.facility_departments(id) on delete set null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, name)
);

create index if not exists facility_services_provider_id_idx on public.facility_services(provider_id);
create index if not exists facility_services_department_id_idx on public.facility_services(department_id);

alter table public.facility_services enable row level security;

drop policy if exists "Facility services are viewable" on public.facility_services;
create policy "Facility services are viewable"
  on public.facility_services for select
  using (
    is_active
    or public.is_admin()
    or exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = facility_services.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or exists (
      select 1 from public.doctor_profiles dp
      where dp.provider_id = facility_services.provider_id and dp.user_id = auth.uid()
    )
  );

drop policy if exists "Facility services are manageable by facility staff or admin" on public.facility_services;
create policy "Facility services are manageable by facility staff or admin"
  on public.facility_services for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = facility_services.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
  );

drop policy if exists "Facility services are updatable by facility staff or admin" on public.facility_services;
create policy "Facility services are updatable by facility staff or admin"
  on public.facility_services for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = facility_services.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = facility_services.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
  );

drop trigger if exists set_facility_services_updated_at on public.facility_services;
create trigger set_facility_services_updated_at
  before update on public.facility_services
  for each row execute function public.set_updated_at();

-- ============================================================================
-- DOCTOR → DEPARTMENT — a single nullable column, not a join table.
--
-- Chosen deliberately after inspecting the existing model: doctor_profiles
-- is already one-doctor-one-facility (provider_id), so "one doctor, one
-- department at that facility" mirrors the existing architecture rather
-- than introducing a new multiplicity the rest of the schema doesn't have.
-- If NiaCare later needs a doctor to belong to multiple departments at once
-- (e.g. a physician covering both Internal Medicine and Cardiology), that
-- needs a real join table (doctor_department_memberships or similar) —
-- documented here as a future decision, not guessed at now.
-- ============================================================================
alter table public.doctor_profiles
  add column if not exists department_id uuid references public.facility_departments(id) on delete set null;

-- assign_doctor_department() — deliberately a function, not a broadened
-- doctor_profiles RLS policy. provider_staff currently has NO update access
-- to doctor_profiles at all (only the doctor themselves or an admin can
-- update that table — see "Doctors can update own profile" /
-- "Admins can manage doctor profiles" above); granting a blanket new
-- provider_staff UPDATE policy on all of doctor_profiles would let facility
-- staff rewrite a doctor's bio/fees/specialty too, well beyond "assign to a
-- department". This function does exactly one thing: validates the caller
-- is admin, the doctor's own facility staff, or the doctor themselves, and
-- that the target department (if any) actually belongs to the SAME
-- facility as the doctor — then updates only department_id.
create or replace function public.assign_doctor_department(p_doctor_profile_id uuid, p_department_id uuid default null)
returns public.doctor_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor public.doctor_profiles;
  v_dept public.facility_departments;
begin
  select * into v_doctor from public.doctor_profiles where id = p_doctor_profile_id;
  if v_doctor.id is null then
    raise exception 'Doctor profile not found.' using errcode = 'P0002';
  end if;

  if not (
    public.is_admin()
    or v_doctor.user_id = auth.uid()
    or exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = v_doctor.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
  ) then
    raise exception 'Not authorized to assign this doctor to a department.' using errcode = '42501';
  end if;

  if p_department_id is not null then
    select * into v_dept from public.facility_departments where id = p_department_id;
    if v_dept.id is null then
      raise exception 'Department not found.' using errcode = 'P0002';
    end if;
    if v_dept.provider_id is distinct from v_doctor.provider_id then
      raise exception 'That department belongs to a different facility.' using errcode = '22023';
    end if;
  end if;

  update public.doctor_profiles
  set department_id = p_department_id
  where id = p_doctor_profile_id
  returning * into v_doctor;

  perform public.log_audit_event(
    'DOCTOR_PROFILE_UPDATED', 'doctor_profiles', v_doctor.id, null,
    jsonb_build_object('department_id', p_department_id, 'action', 'department_assigned')
  );

  return v_doctor;
end;
$$;

revoke all on function public.assign_doctor_department(uuid, uuid) from public;
grant execute on function public.assign_doctor_department(uuid, uuid) to authenticated;
