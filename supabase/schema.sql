-- NiaCare Health — initial Supabase schema
-- Run this once in the Supabase Dashboard → SQL Editor (or `supabase db push` if you use the CLI).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.

-- ============================================================================
-- PROFILES — one row per authenticated user, keyed to auth.users
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_category text not null check (user_category in ('locals', 'internationals')),
  role text not null default 'patient' check (role in ('patient', 'doctor', 'provider_staff', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  full_name text not null,
  age text,
  gender text,
  blood_type text,
  dob date,
  phone text,
  email text,

  -- Locals only
  doc_type text check (doc_type in ('nida', 'insurance', 'birth_cert')),
  nida_number text,
  insurance_provider text,
  insurance_number text,
  birth_cert_id text,

  -- Internationals only
  passport_number text,
  nationality text,
  country_code text,
  travel_insurance_provider text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `create table if not exists` does not update an older profiles table. These
-- migrations keep an existing project compatible with the current role model.
alter table public.profiles
  add column if not exists role text not null default 'patient'
    check (role in ('patient', 'doctor', 'provider_staff', 'admin')),
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended'));

alter table public.profiles enable row level security;

-- SECURITY DEFINER prevents recursive RLS evaluation when a policy needs to
-- determine whether the signed-in user is an administrator.
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

-- Shared trigger helpers are defined early because later tables attach these
-- triggers as they are created. Keeping them here makes a brand-new database
-- run reliable instead of depending on functions left over from an older run.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, patient_id, metadata)
  values (
    auth.uid(),
    upper(TG_TABLE_NAME) || '_' || TG_OP,
    TG_TABLE_NAME,
    new.id,
    new.patient_id,
    '{}'::jsonb
  );
  return new;
end;
$$;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Provider staff can read patient profiles they serve" on public.profiles;
create policy "Provider staff can read patient profiles they serve"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.is_admin()
  );

-- Doctor/staff names are legitimately directory-public (a patient must be
-- able to see who they're booking before any appointment exists between
-- them), unlike patient or admin profiles which stay private.
drop policy if exists "Clinical staff profiles are publicly viewable" on public.profiles;
create policy "Clinical staff profiles are publicly viewable"
  on public.profiles for select
  using (auth.role() = 'authenticated' and role in ('doctor', 'provider_staff'));

drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
  on public.profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- SECURITY: "Profiles are updatable/insertable by owner" above only
-- restrict WHICH ROW a user can touch (their own), not WHICH VALUES —
-- RLS predicates can't express "this column may only be this value unless
-- you're an admin" on their own. Without this trigger, any signed-in user
-- could run `supabase.from('profiles').update({ role: 'admin' })`, and —
-- confirmed live, more severely — a BRAND-NEW user could self-INSERT their
-- own first profile row with role: 'admin' directly, since the original
-- fix only guarded UPDATE. This single trigger now covers both: on INSERT,
-- a real end-user session may only create their own row as the safe
-- defaults (patient/pending); on UPDATE, role/status may only change via
-- an admin session. auth.uid() is null for SQL-editor/migration/service-
-- role execution (no end-user JWT), so the bootstrap block below and
-- api/invite-staff.ts (service-role) are unaffected either way.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if auth.uid() is not null
       and (new.role is distinct from 'patient' or new.status is distinct from 'pending')
       and not public.is_admin() then
      raise exception 'New accounts must start as a pending patient; only an administrator can set role or status.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if auth.uid() is not null
     and (new.role is distinct from old.role or new.status is distinct from old.status)
     and not public.is_admin() then
    raise exception 'Only an administrator can change role or status.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role_escalation on public.profiles;
create trigger guard_profile_role_escalation
  before insert or update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- ============================================================================
-- PROVIDERS — hospitals, clinics, and affiliated facilities
-- ============================================================================
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  type text not null,
  address text,
  phone text,
  emergency_phone text,
  email text,
  nhif_enabled boolean not null default false,
  lat double precision,
  lng double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.providers enable row level security;

drop policy if exists "Providers are viewable by authenticated users" on public.providers;
create policy "Providers are viewable by authenticated users"
  on public.providers for select
  using (auth.role() = 'authenticated');

drop policy if exists "Providers are manageable by admins" on public.providers;
create policy "Providers are manageable by admins"
  on public.providers for all
  using (public.is_admin());

-- ============================================================================
-- DOCTOR PROFILES — extends profiles for medical practitioners
-- ============================================================================
create table if not exists public.doctor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider_id uuid references public.providers(id) on delete set null,
  mct_registration text unique,
  specialty text not null,
  sub_specialty text,
  consultation_fee_tzs integer not null default 0,
  telehealth_fee_tzs integer not null default 0,
  home_visit_fee_tzs integer not null default 0,
  languages text[] not null default '{}',
  bio text,
  rating numeric(2,1) not null default 5.0,
  reviews_count integer not null default 0,
  experience_years integer,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.doctor_profiles enable row level security;

drop policy if exists "Doctor profiles are publicly viewable" on public.doctor_profiles;
create policy "Doctor profiles are publicly viewable"
  on public.doctor_profiles for select
  using (true);

drop policy if exists "Doctors can update own profile" on public.doctor_profiles;
create policy "Doctors can update own profile"
  on public.doctor_profiles for update
  using (auth.uid() = user_id);

drop policy if exists "Admins can manage doctor profiles" on public.doctor_profiles;
create policy "Admins can manage doctor profiles"
  on public.doctor_profiles for all
  using (public.is_admin());

-- ============================================================================
-- PROVIDER STAFF — links users to a facility with permissions
-- ============================================================================
create table if not exists public.provider_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  job_title text not null,
  department text,
  permissions text[] not null default '{}',
  is_active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_staff enable row level security;

drop policy if exists "Staff can view own record" on public.provider_staff;
create policy "Staff can view own record"
  on public.provider_staff for select
  using (auth.uid() = user_id);

-- SECURITY DEFINER bypasses RLS so this lookup doesn't re-trigger the policy
-- below (a raw self-join on provider_staff from within its own policy causes
-- 42P17 infinite recursion).
create or replace function public.my_provider_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select provider_id from public.provider_staff where user_id = auth.uid() limit 1;
$$;
revoke all on function public.my_provider_id() from public;
grant execute on function public.my_provider_id() to authenticated;

drop policy if exists "Staff can view colleagues at same provider" on public.provider_staff;
create policy "Staff can view colleagues at same provider"
  on public.provider_staff for select
  using (provider_id = public.my_provider_id());

drop policy if exists "Admins can manage provider staff" on public.provider_staff;
create policy "Admins can manage provider staff"
  on public.provider_staff for all
  using (public.is_admin());

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

-- ============================================================================
-- APPOINTMENTS
-- ============================================================================
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid references public.providers(id) on delete set null,
  doctor_profile_id uuid references public.doctor_profiles(id) on delete set null,
  ticket_number text not null,
  doctor_id text,
  doctor_name text not null,
  doctor_specialty text not null,
  hospital_name text not null,
  hospital_location text,
  room_number text,
  consultation_type text not null check (consultation_type in ('in_person', 'telehealth', 'home_visit')),
  appointment_date date not null,
  time_slot text not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'in_queue', 'completed', 'cancelled')),
  queue_number text,
  reason text,
  symptoms_note text,
  insurance_provider text,
  insurance_covered boolean not null default false,
  co_pay_amount_tzs integer not null default 0,
  patient_name text,
  patient_phone text,
  created_at timestamptz not null default now()
);

-- Compatibility migration for databases created before provider/doctor roles.
alter table public.appointments
  add column if not exists provider_id uuid references public.providers(id) on delete set null,
  add column if not exists doctor_profile_id uuid references public.doctor_profiles(id) on delete set null;

alter table public.appointments enable row level security;

drop policy if exists "Appointments are manageable by owner" on public.appointments;
create policy "Appointments are manageable by owner"
  on public.appointments for all
  using (
    auth.uid() = patient_id
    or exists (
      select 1 from public.doctor_profiles dp where dp.id = appointments.doctor_profile_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.provider_staff ps where ps.provider_id = appointments.provider_id and ps.user_id = auth.uid()
    )
    or public.is_admin()
  )
  with check (
    auth.uid() = patient_id
    or exists (
      select 1 from public.doctor_profiles dp where dp.id = appointments.doctor_profile_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.provider_staff ps where ps.provider_id = appointments.provider_id and ps.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- This policy is defined only after appointments, doctor_profiles, and
-- provider_staff exist, so a new project can run the complete schema once.
drop policy if exists "Provider staff can read patient profiles they serve" on public.profiles;
create policy "Provider staff can read patient profiles they serve"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.is_admin()
    or exists (
      select 1 from public.appointments a
      where a.patient_id = profiles.id
      and (
        exists (
          select 1 from public.doctor_profiles dp
          where dp.id = a.doctor_profile_id and dp.user_id = auth.uid()
        )
        or exists (
          select 1 from public.provider_staff ps
          where ps.provider_id = a.provider_id and ps.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- MEDICAL RECORDS
-- ============================================================================
create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  category text not null check (category in ('lab', 'radiology', 'consultation', 'vaccine', 'prescription')),
  hospital_name text,
  doctor_name text,
  record_date date,
  department text,
  status text check (status in ('verified', 'clear', 'normal', 'pending')),
  summary_en text,
  summary_sw text,
  details jsonb,
  pdf_file_name text,
  created_at timestamptz not null default now()
);

alter table public.medical_records
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  -- Same optional anatomical tagging already added to diagnoses (Phase 9's
  -- body map) — extended here so an imaging record ('radiology' category)
  -- can also connect to a body region, per the imaging<->body-map
  -- requirement. Nullable, non-diagnostic, purely a documentation/
  -- visualization aid, exactly like its diagnoses counterpart.
  add column if not exists body_region text,
  add column if not exists body_side text check (body_side in ('left', 'right', 'bilateral', 'midline'));

alter table public.medical_records enable row level security;

drop policy if exists "Medical records are viewable by owner" on public.medical_records;
create policy "Medical records are viewable by owner"
  on public.medical_records for select
  using (
    auth.uid() = patient_id
    or auth.uid() = created_by
    or exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.id = medical_records.appointment_id and ps.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- SECURITY: patients may only self-insert a 'consultation' record (the real
-- shape CheckoutProcedureModal creates after a self-service checkout) — not
-- 'lab' / 'radiology' / 'vaccine' / 'prescription', which would let a patient
-- forge a fake clinical result into their own timeline, indistinguishable
-- from a real one issued by a clinician.
drop policy if exists "Medical records are insertable by clinical staff" on public.medical_records;
create policy "Medical records are insertable by clinical staff"
  on public.medical_records for insert
  with check (
    (auth.uid() = patient_id and category = 'consultation')
    or exists (
      select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.is_active = true
    )
    or exists (
      select 1 from public.provider_staff ps where ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

-- SECURITY: the previous version let ANY active doctor or provider-staff
-- account update ANY patient's medical record, with no check that they ever
-- treated that patient (only auth.uid() = created_by was self-scoped). Now
-- scoped the same way medical_records SELECT already is: a real appointment
-- connecting that clinician/facility to this specific patient.
drop policy if exists "Medical records are updatable by clinical staff" on public.medical_records;
create policy "Medical records are updatable by clinical staff"
  on public.medical_records for update
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.appointments a
      join public.doctor_profiles dp on dp.id = a.doctor_profile_id
      where a.patient_id = medical_records.patient_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.patient_id = medical_records.patient_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

-- ============================================================================
-- CLINICAL ENCOUNTERS — the structured record of a single doctor visit:
-- chief complaint, vitals, diagnosis, notes. Prescriptions below link to an
-- encounter once one exists, instead of only floating off an appointment.
-- ============================================================================
create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  doctor_profile_id uuid references public.doctor_profiles(id) on delete set null,
  provider_id uuid references public.providers(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  encounter_type text not null default 'consultation',
  status text not null default 'in_progress' check (status in ('draft', 'in_progress', 'completed', 'cancelled')),
  chief_complaint text,
  history_note text,
  examination_note text,
  clinical_notes text,
  follow_up_note text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.encounters enable row level security;

drop policy if exists "Encounters are viewable by patient and clinical staff" on public.encounters;
create policy "Encounters are viewable by patient and clinical staff"
  on public.encounters for select
  using (
    auth.uid() = patient_id
    or exists (select 1 from public.doctor_profiles dp where dp.id = encounters.doctor_profile_id and dp.user_id = auth.uid())
    or exists (select 1 from public.provider_staff ps where ps.provider_id = encounters.provider_id and ps.user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Encounters are manageable by the treating doctor" on public.encounters;
create policy "Encounters are manageable by the treating doctor"
  on public.encounters for all
  using (
    exists (select 1 from public.doctor_profiles dp where dp.id = encounters.doctor_profile_id and dp.user_id = auth.uid() and dp.is_active = true)
    or public.is_admin()
  )
  with check (
    exists (select 1 from public.doctor_profiles dp where dp.id = encounters.doctor_profile_id and dp.user_id = auth.uid() and dp.is_active = true)
    or public.is_admin()
  );

drop trigger if exists set_encounters_updated_at on public.encounters;
create trigger set_encounters_updated_at
  before update on public.encounters
  for each row execute function public.set_updated_at();

create table if not exists public.vitals (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  temperature_c numeric(4, 1),
  heart_rate integer,
  respiratory_rate integer,
  spo2 integer,
  systolic_bp integer,
  diastolic_bp integer,
  weight_kg numeric(5, 1),
  height_cm numeric(5, 1),
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

alter table public.vitals enable row level security;

drop policy if exists "Vitals are viewable by patient and clinical staff" on public.vitals;
create policy "Vitals are viewable by patient and clinical staff"
  on public.vitals for select
  using (
    exists (
      select 1 from public.encounters e where e.id = vitals.encounter_id and (
        e.patient_id = auth.uid()
        or exists (select 1 from public.doctor_profiles dp where dp.id = e.doctor_profile_id and dp.user_id = auth.uid())
        or exists (select 1 from public.provider_staff ps where ps.provider_id = e.provider_id and ps.user_id = auth.uid())
      )
    )
    or public.is_admin()
  );

-- Vitals are recorded by whoever is at the bedside — the treating doctor OR
-- provider staff (e.g. a nurse) at that encounter's facility, not doctors
-- exclusively (unlike diagnoses, which require clinical diagnostic authority).
drop policy if exists "Vitals are insertable by clinical staff" on public.vitals;
create policy "Vitals are insertable by clinical staff"
  on public.vitals for insert
  with check (
    exists (
      select 1 from public.encounters e where e.id = vitals.encounter_id and (
        exists (select 1 from public.doctor_profiles dp where dp.id = e.doctor_profile_id and dp.user_id = auth.uid() and dp.is_active = true)
        or exists (select 1 from public.provider_staff ps where ps.provider_id = e.provider_id and ps.user_id = auth.uid() and ps.is_active = true)
      )
    )
    or public.is_admin()
  );

create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  doctor_profile_id uuid references public.doctor_profiles(id) on delete set null,
  diagnosis text not null,
  code text,
  diagnosis_type text not null default 'primary' check (diagnosis_type in ('primary', 'secondary', 'differential')),
  notes text,
  created_at timestamptz not null default now()
);

-- Optional anatomical tagging for the interactive body map (spec section
-- 27) — a documentation/visualization aid, never a diagnostic input, so
-- both columns stay nullable and free of any clinical-decision logic.
alter table public.diagnoses
  add column if not exists body_region text,
  add column if not exists body_side text check (body_side in ('left', 'right', 'bilateral', 'midline'));

alter table public.diagnoses enable row level security;

drop policy if exists "Diagnoses are viewable by patient and clinical staff" on public.diagnoses;
create policy "Diagnoses are viewable by patient and clinical staff"
  on public.diagnoses for select
  using (
    auth.uid() = patient_id
    or exists (select 1 from public.doctor_profiles dp where dp.id = diagnoses.doctor_profile_id and dp.user_id = auth.uid())
    or public.is_admin()
  );

-- Only an authorized, active doctor may record a clinical diagnosis — this
-- is the one clinical action this schema does not extend to provider staff.
drop policy if exists "Diagnoses are insertable by the treating doctor" on public.diagnoses;
create policy "Diagnoses are insertable by the treating doctor"
  on public.diagnoses for insert
  with check (
    exists (select 1 from public.doctor_profiles dp where dp.id = diagnoses.doctor_profile_id and dp.user_id = auth.uid() and dp.is_active = true)
    or public.is_admin()
  );

-- ============================================================================
-- PRESCRIPTIONS
-- ============================================================================
create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  encounter_id uuid references public.encounters(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  medication_name text not null,
  dosage_instructions text,
  prescribed_by text,
  is_sos boolean not null default false,
  days_remaining integer,
  taken_today boolean not null default false,
  refill_requested boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.prescriptions
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists encounter_id uuid references public.encounters(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.prescriptions enable row level security;

-- SECURITY: this was previously one `for all` policy where `auth.uid() =
-- patient_id` satisfied SELECT *and* UPDATE *and* DELETE — a patient could
-- silently rewrite medication_name/dosage_instructions on their own real
-- prescription, or delete it outright, via a raw client call (the app UI
-- only ever touches taken_today/refill_requested, but RLS is what actually
-- has to stop a modified/malicious client, not the UI). It also let ANY
-- active doctor or provider-staff account read/edit/delete ANY patient's
-- prescriptions with no treatment relationship required. Split into four
-- scoped policies: patients get read-only access plus two narrow RPCs below
-- for the two fields they legitimately touch; clinical staff access is now
-- scoped to patients they actually have an appointment/encounter with.
drop policy if exists "Prescriptions are manageable by patient and clinical staff" on public.prescriptions;
drop policy if exists "Prescriptions are viewable by patient and treating staff" on public.prescriptions;
drop policy if exists "Prescriptions are insertable by clinical staff" on public.prescriptions;
drop policy if exists "Prescriptions are updatable by treating clinical staff" on public.prescriptions;
drop policy if exists "Prescriptions are deletable by prescriber or admin" on public.prescriptions;

create policy "Prescriptions are viewable by patient and treating staff"
  on public.prescriptions for select
  using (
    auth.uid() = patient_id
    or auth.uid() = created_by
    or exists (
      select 1 from public.appointments a
      join public.doctor_profiles dp on dp.id = a.doctor_profile_id
      where a.patient_id = prescriptions.patient_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.encounters e
      join public.doctor_profiles dp on dp.id = e.doctor_profile_id
      where e.patient_id = prescriptions.patient_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.patient_id = prescriptions.patient_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

create policy "Prescriptions are insertable by clinical staff"
  on public.prescriptions for insert
  with check (
    exists (select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.is_active = true)
    or exists (select 1 from public.provider_staff ps where ps.user_id = auth.uid() and ps.is_active = true)
    or public.is_admin()
  );

create policy "Prescriptions are updatable by treating clinical staff"
  on public.prescriptions for update
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.appointments a
      join public.doctor_profiles dp on dp.id = a.doctor_profile_id
      where a.patient_id = prescriptions.patient_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.encounters e
      join public.doctor_profiles dp on dp.id = e.doctor_profile_id
      where e.patient_id = prescriptions.patient_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.patient_id = prescriptions.patient_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  )
  with check (
    auth.uid() = created_by
    or exists (
      select 1 from public.appointments a
      join public.doctor_profiles dp on dp.id = a.doctor_profile_id
      where a.patient_id = prescriptions.patient_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.encounters e
      join public.doctor_profiles dp on dp.id = e.doctor_profile_id
      where e.patient_id = prescriptions.patient_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.patient_id = prescriptions.patient_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

create policy "Prescriptions are deletable by prescriber or admin"
  on public.prescriptions for delete
  using (auth.uid() = created_by or public.is_admin());

-- Patients update exactly two self-service fields (taken_today,
-- refill_requested) through these SECURITY DEFINER functions instead of a
-- raw table UPDATE, so RLS never has to grant them open column access.
create or replace function public.set_prescription_taken(p_id uuid, p_taken boolean)
returns public.prescriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prescriptions;
begin
  select * into v_row from public.prescriptions where id = p_id;
  if v_row.id is null then
    raise exception 'Prescription not found.' using errcode = 'P0002';
  end if;
  if auth.uid() is null or auth.uid() <> v_row.patient_id then
    raise exception 'Not authorized to update this prescription.' using errcode = '42501';
  end if;

  update public.prescriptions set taken_today = p_taken where id = p_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.set_prescription_taken(uuid, boolean) from public;
grant execute on function public.set_prescription_taken(uuid, boolean) to authenticated;

create or replace function public.request_prescription_refill(p_id uuid)
returns public.prescriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prescriptions;
begin
  select * into v_row from public.prescriptions where id = p_id;
  if v_row.id is null then
    raise exception 'Prescription not found.' using errcode = 'P0002';
  end if;
  if auth.uid() is null or auth.uid() <> v_row.patient_id then
    raise exception 'Not authorized to update this prescription.' using errcode = '42501';
  end if;

  update public.prescriptions set refill_requested = true where id = p_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.request_prescription_refill(uuid) from public;
grant execute on function public.request_prescription_refill(uuid) to authenticated;

-- ============================================================================
-- LABORATORY — a doctor orders a test, provider staff (lab techs) progress
-- it through collection/processing, then enter the result. The patient only
-- ever sees a completed result, never an in-progress one.
-- ============================================================================
create table if not exists public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  doctor_profile_id uuid references public.doctor_profiles(id) on delete set null,
  provider_id uuid references public.providers(id) on delete set null,
  encounter_id uuid references public.encounters(id) on delete set null,
  test_name text not null,
  notes text,
  status text not null default 'ordered' check (status in ('ordered', 'collected', 'processing', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lab_orders enable row level security;

drop policy if exists "Lab orders are viewable by patient and clinical staff" on public.lab_orders;
create policy "Lab orders are viewable by patient and clinical staff"
  on public.lab_orders for select
  using (
    auth.uid() = patient_id
    or exists (select 1 from public.doctor_profiles dp where dp.id = lab_orders.doctor_profile_id and dp.user_id = auth.uid())
    or exists (select 1 from public.provider_staff ps where ps.provider_id = lab_orders.provider_id and ps.user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Lab orders are insertable by the ordering doctor" on public.lab_orders;
create policy "Lab orders are insertable by the ordering doctor"
  on public.lab_orders for insert
  with check (
    exists (select 1 from public.doctor_profiles dp where dp.id = lab_orders.doctor_profile_id and dp.user_id = auth.uid() and dp.is_active = true)
    or public.is_admin()
  );

-- Status progression (collected/processing/completed) is lab-tech work, not
-- the ordering doctor's -- provider staff at the same facility can update it.
drop policy if exists "Lab orders are updatable by clinical staff" on public.lab_orders;
create policy "Lab orders are updatable by clinical staff"
  on public.lab_orders for update
  using (
    exists (select 1 from public.doctor_profiles dp where dp.id = lab_orders.doctor_profile_id and dp.user_id = auth.uid())
    or exists (select 1 from public.provider_staff ps where ps.provider_id = lab_orders.provider_id and ps.user_id = auth.uid() and ps.is_active = true)
    or public.is_admin()
  );

drop trigger if exists set_lab_orders_updated_at on public.lab_orders;
create trigger set_lab_orders_updated_at
  before update on public.lab_orders
  for each row execute function public.set_updated_at();

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  lab_order_id uuid not null unique references public.lab_orders(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  result_value text,
  reference_range text,
  interpretation text not null default 'normal' check (interpretation in ('normal', 'abnormal', 'critical')),
  summary text,
  entered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.lab_results enable row level security;

drop policy if exists "Lab results are viewable by patient and clinical staff" on public.lab_results;
create policy "Lab results are viewable by patient and clinical staff"
  on public.lab_results for select
  using (
    auth.uid() = patient_id
    or exists (
      select 1 from public.lab_orders lo
      where lo.id = lab_results.lab_order_id
      and (
        exists (select 1 from public.doctor_profiles dp where dp.id = lo.doctor_profile_id and dp.user_id = auth.uid())
        or exists (select 1 from public.provider_staff ps where ps.provider_id = lo.provider_id and ps.user_id = auth.uid())
      )
    )
    or public.is_admin()
  );

drop policy if exists "Lab results are insertable by clinical staff" on public.lab_results;
create policy "Lab results are insertable by clinical staff"
  on public.lab_results for insert
  with check (
    exists (
      select 1 from public.lab_orders lo
      where lo.id = lab_results.lab_order_id
      and (
        exists (select 1 from public.doctor_profiles dp where dp.id = lo.doctor_profile_id and dp.user_id = auth.uid())
        or exists (select 1 from public.provider_staff ps where ps.provider_id = lo.provider_id and ps.user_id = auth.uid() and ps.is_active = true)
      )
    )
    or public.is_admin()
  );

-- Entering a result marks the order completed in the same transaction, so
-- the two can never drift out of sync (a result existing with a
-- non-"completed" parent order, or vice versa).
create or replace function public.complete_lab_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lab_orders set status = 'completed' where id = new.lab_order_id;
  return new;
end;
$$;

drop trigger if exists mark_lab_order_completed on public.lab_results;
create trigger mark_lab_order_completed
  after insert on public.lab_results
  for each row execute function public.complete_lab_order();

drop trigger if exists audit_lab_orders_change on public.lab_orders;
create trigger audit_lab_orders_change
  after insert on public.lab_orders
  for each row execute function public.audit_row_change();

drop trigger if exists audit_lab_results_change on public.lab_results;
create trigger audit_lab_results_change
  after insert on public.lab_results
  for each row execute function public.audit_row_change();

-- ============================================================================
-- PROVIDER OPERATIONS — tasks, inventory, and internal facility messages for
-- provider staff. Messages here are a facility-wide bulletin (one thread per
-- facility), not 1:1 direct messaging between two specific staff members.
-- ============================================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  patient_id uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  due_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

drop policy if exists "Tasks are manageable by staff at the same facility" on public.tasks;
create policy "Tasks are manageable by staff at the same facility"
  on public.tasks for all
  using (provider_id = public.my_provider_id() or public.is_admin())
  with check (provider_id = public.my_provider_id() or public.is_admin());

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  name text not null,
  quantity integer not null default 0,
  minimum_quantity integer not null default 0,
  unit text not null default 'units',
  updated_at timestamptz not null default now()
);

alter table public.inventory_items enable row level security;

drop policy if exists "Inventory is manageable by staff at the same facility" on public.inventory_items;
create policy "Inventory is manageable by staff at the same facility"
  on public.inventory_items for all
  using (provider_id = public.my_provider_id() or public.is_admin())
  with check (provider_id = public.my_provider_id() or public.is_admin());

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

create table if not exists public.facility_messages (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.facility_messages enable row level security;

drop policy if exists "Facility messages are viewable by staff at that facility" on public.facility_messages;
create policy "Facility messages are viewable by staff at that facility"
  on public.facility_messages for select
  using (provider_id = public.my_provider_id() or public.is_admin());

drop policy if exists "Facility messages are postable by staff at that facility" on public.facility_messages;
create policy "Facility messages are postable by staff at that facility"
  on public.facility_messages for insert
  with check (provider_id = public.my_provider_id() or public.is_admin());

-- ============================================================================
-- PERSONAL FILES — patient-uploaded / saved documents vault
-- ============================================================================
create table if not exists public.personal_files (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null check (
    category in ('hospital_report', 'lab_result', 'vaccine_cert', 'prescription', 'scan_image', 'custom_upload')
  ),
  date_added text,
  facility text,
  source text not null check (source in ('hospital_sync', 'user_upload', 'downloaded_pdf')),
  file_size text,
  record_id text,
  pdf_file_name text,
  notes text,
  file_url text,
  is_encrypted boolean not null default true,
  starred boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.personal_files enable row level security;

drop policy if exists "Personal files are manageable by owner" on public.personal_files;
create policy "Personal files are manageable by owner"
  on public.personal_files for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

-- ============================================================================
-- BILLS — generated when an appointment is booked, settled via checkout
-- ============================================================================
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  invoice_number text not null,
  facility text not null,
  department text,
  bill_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'settled', 'processing')),
  items jsonb not null default '[]'::jsonb,
  total_tzs integer not null default 0,
  total_usd integer not null default 0,
  settlement_method text,
  settlement_ref text,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.bills enable row level security;

drop policy if exists "Bills are viewable by patient and staff" on public.bills;
create policy "Bills are viewable by patient and staff"
  on public.bills for select
  using (
    auth.uid() = patient_id
    or exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.id = bills.appointment_id and ps.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- SECURITY (spec TEST 3): there was no INSERT policy on bills at all — under
-- RLS that silently denies every insert, so insertBill() (called from the
-- patient's own session right after booking) was very likely failing on
-- every booking. Patients may insert their own bill, but only pre-settled.
drop policy if exists "Bills are insertable by patient and staff" on public.bills;
create policy "Bills are insertable by patient and staff"
  on public.bills for insert
  with check (
    (auth.uid() = patient_id and status = 'pending')
    or exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.id = bills.appointment_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

-- SECURITY (spec TEST 3, "patient marks bill as paid"): `auth.uid() =
-- patient_id` here previously satisfied UPDATE too, so any signed-in patient
-- could call `supabase.from('bills').update({status:'settled',...})`
-- directly from the browser and it would succeed — completely bypassing
-- settleBill()/the payment step. Patients no longer get direct UPDATE at
-- all; the simulated "pay" action now goes through
-- settle_bill_as_patient() below, which inserts a real payments row and
-- lets the existing settle_bill_from_completed_payment trigger do the
-- settlement, instead of trusting the client to set the status column.
drop policy if exists "Bills are updatable by staff" on public.bills;
create policy "Bills are updatable by staff"
  on public.bills for update
  using (
    exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.id = bills.appointment_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

-- Patient-facing "pay this bill" (still simulated — no real payment gateway
-- is wired up yet, see project notes) goes through this function instead of
-- a raw UPDATE, so the trust boundary is a validated server-side function
-- rather than an open column grant. Swapping the caller of this insert for
-- a real payment-provider webhook handler later is a drop-in change.
create or replace function public.settle_bill_as_patient(
  p_bill_id uuid,
  p_method text,
  p_ref text
)
returns public.bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.bills;
begin
  select * into v_bill from public.bills where id = p_bill_id;
  if v_bill.id is null then
    raise exception 'Bill not found.' using errcode = 'P0002';
  end if;
  if auth.uid() is null or auth.uid() <> v_bill.patient_id then
    raise exception 'Not authorized to settle this bill.' using errcode = '42501';
  end if;
  if v_bill.status = 'settled' then
    raise exception 'This bill has already been settled.' using errcode = '22023';
  end if;
  if p_method not in ('insurance', 'cash', 'mobile_money', 'bank_transfer', 'card') then
    raise exception 'Invalid payment method.' using errcode = '22023';
  end if;

  insert into public.payments (bill_id, patient_id, method, amount_tzs, status, provider_ref, processed_by)
  values (p_bill_id, v_bill.patient_id, p_method, v_bill.total_tzs, 'completed', p_ref, auth.uid());

  select * into v_bill from public.bills where id = p_bill_id;
  return v_bill;
end;
$$;

revoke all on function public.settle_bill_as_patient(uuid, text, text) from public;
grant execute on function public.settle_bill_as_patient(uuid, text, text) to authenticated;

-- ============================================================================
-- BILL ITEMS — line items for each bill, for auditability
-- ============================================================================
create table if not exists public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  description text not null,
  quantity integer not null default 1,
  unit_price_tzs integer not null default 0,
  total_tzs integer not null default 0,
  category text not null default 'service' check (category in ('service', 'medication', 'lab', 'radiology', 'procedure', 'supply')),
  created_at timestamptz not null default now()
);

alter table public.bill_items enable row level security;

drop policy if exists "Bill items are viewable by patient and staff" on public.bill_items;
create policy "Bill items are viewable by patient and staff"
  on public.bill_items for select
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_items.bill_id and (
        b.patient_id = auth.uid()
        or exists (
          select 1 from public.appointments a
          join public.provider_staff ps on ps.provider_id = a.provider_id
          where a.id = b.appointment_id and ps.user_id = auth.uid()
        )
        or public.is_admin()
      )
    )
  );

drop policy if exists "Bill items are manageable by provider staff" on public.bill_items;
create policy "Bill items are manageable by provider staff"
  on public.bill_items for all
  using (
    exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = bill_items.bill_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = bill_items.bill_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

create or replace function public.sync_bill_total_from_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_bill_id := old.bill_id;
  else
    v_bill_id := new.bill_id;
  end if;

  update public.bills b
  set
    total_tzs = coalesce((
      select sum(bi.total_tzs)::integer from public.bill_items bi where bi.bill_id = v_bill_id
    ), 0),
    items = coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'description', bi.description,
          'quantity', bi.quantity,
          'unit_price_tzs', bi.unit_price_tzs,
          'total_tzs', bi.total_tzs,
          'category', bi.category
        )
        order by bi.created_at
      )
      from public.bill_items bi where bi.bill_id = v_bill_id
    ), '[]'::jsonb)
  where b.id = v_bill_id;

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_bill_items_total on public.bill_items;
create trigger sync_bill_items_total
  after insert or update or delete on public.bill_items
  for each row execute function public.sync_bill_total_from_items();

-- ============================================================================
-- PAYMENTS — settlement transactions for bills
-- ============================================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('insurance', 'cash', 'mobile_money', 'bank_transfer', 'card')),
  amount_tzs integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  provider_ref text,
  transaction_metadata jsonb not null default '{}'::jsonb,
  processed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

drop policy if exists "Payments are viewable by patient and staff" on public.payments;
create policy "Payments are viewable by patient and staff"
  on public.payments for select
  using (
    auth.uid() = patient_id
    or auth.uid() = processed_by
    or exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = payments.bill_id and ps.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- SECURITY: `auth.uid() = patient_id` here let a patient insert a payments
-- row with status: 'completed' directly — which the settle_bill_from_
-- completed_payment trigger below then used to mark their own bill settled,
-- a second route to the exact TEST 3 forgery this policy set out to allow.
-- It also went unaudited (audit_payments_change only fires on UPDATE).
-- Patients now settle a bill exclusively through settle_bill_as_patient(),
-- a SECURITY DEFINER function that performs this same insert server-side
-- after validating the bill actually belongs to them and isn't already
-- settled — so direct insert is staff/admin only.
drop policy if exists "Payments are insertable by patient and staff" on public.payments;
drop policy if exists "Payments are insertable by staff" on public.payments;
create policy "Payments are insertable by staff"
  on public.payments for insert
  with check (
    exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = payments.bill_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

drop policy if exists "Payments are updatable by provider staff" on public.payments;
create policy "Payments are updatable by provider staff"
  on public.payments for update
  using (
    auth.uid() = processed_by
    or exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = payments.bill_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  )
  with check (
    auth.uid() = processed_by
    or exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = payments.bill_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

create or replace function public.settle_bill_from_completed_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' then
    update public.bills
    set
      status = 'settled',
      settlement_method = new.method,
      settlement_ref = coalesce(new.provider_ref, new.id::text),
      settled_at = coalesce(settled_at, now())
    where id = new.bill_id
      and status is distinct from 'settled';
  end if;
  return new;
end;
$$;

drop trigger if exists settle_bill_after_payment on public.payments;
create trigger settle_bill_after_payment
  after insert or update of status on public.payments
  for each row execute function public.settle_bill_from_completed_payment();

-- ============================================================================
-- DOCTOR SCHEDULE — real booked/available slots per doctor per day
-- ============================================================================
create table if not exists public.doctor_schedule (
  id uuid primary key default gen_random_uuid(),
  doctor_profile_id uuid not null references public.doctor_profiles(id) on delete cascade,
  schedule_date date not null,
  time_slot text not null,
  is_booked boolean not null default false,
  appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (doctor_profile_id, schedule_date, time_slot)
);

alter table public.doctor_schedule enable row level security;

drop policy if exists "Doctor schedule is viewable by authenticated users" on public.doctor_schedule;
create policy "Doctor schedule is viewable by authenticated users"
  on public.doctor_schedule for select
  using (auth.role() = 'authenticated');

drop policy if exists "Doctors and staff can manage own schedule" on public.doctor_schedule;
create policy "Doctors and staff can manage own schedule"
  on public.doctor_schedule for all
  using (
    exists (
      select 1 from public.doctor_profiles dp where dp.id = doctor_schedule.doctor_profile_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.provider_staff ps
      join public.doctor_profiles dp on dp.provider_id = ps.provider_id
      where dp.id = doctor_schedule.doctor_profile_id and ps.user_id = auth.uid()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.doctor_profiles dp where dp.id = doctor_schedule.doctor_profile_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.provider_staff ps
      join public.doctor_profiles dp on dp.provider_id = ps.provider_id
      where dp.id = doctor_schedule.doctor_profile_id and ps.user_id = auth.uid()
    )
    or public.is_admin()
  );

create or replace function public.release_schedule_slot_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.doctor_profile_id is not null then
    update public.doctor_schedule
    set is_booked = false, appointment_id = null
    where appointment_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists release_schedule_slot_on_appointment_cancel on public.appointments;
create trigger release_schedule_slot_on_appointment_cancel
  after update of status on public.appointments
  for each row execute function public.release_schedule_slot_on_cancel();

-- ============================================================================
-- Defense-in-depth against double-booking a doctor's slot.
--
-- book_appointment() below already prevents this for any caller that goes
-- through it (the doctor_schedule unique constraint + a conditional
-- ON CONFLICT ... WHERE is_booked = false upsert makes reserving a slot
-- atomic — two concurrent callers can't both win it). But appointments' own
-- RLS policy ("manageable by owner", checked only on patient_id) does not
-- require booking to go through that RPC — a client could INSERT into
-- public.appointments directly with the anon key and bypass the schedule
-- reservation entirely. This partial unique index closes that gap at the
-- table itself: no two non-cancelled appointments for the same doctor can
-- ever share a date+time, regardless of insert path. Partial (excludes
-- cancelled appointments and legacy/static-directory rows with no real
-- doctor_profile_id) so a cancelled+rebooked slot, or the pre-real-doctors
-- static directory, is never blocked.
--
-- Verified safe before adding: a read-only check against the live database
-- found zero non-cancelled appointments with a real doctor_profile_id at
-- all, so there is no existing duplicate data this index could conflict
-- with. CREATE UNIQUE INDEX would fail loudly (not corrupt data) if that
-- ever changed before this ran.
create unique index if not exists appointments_doctor_slot_unique
  on public.appointments (doctor_profile_id, appointment_date, time_slot)
  where status <> 'cancelled' and doctor_profile_id is not null;

-- ============================================================================
-- book_appointment() — atomic, race-safe booking.
--
-- The client previously did a plain INSERT into appointments with no slot
-- reservation at all: two patients booking the same doctor/date/time_slot
-- simultaneously could both succeed. This function makes booking a single
-- transaction: reserve the doctor_schedule slot (when the appointment is
-- against a real, platform-registered doctor via doctor_profile_id) via
-- INSERT ... ON CONFLICT, which takes a row lock so concurrent callers can't
-- both win the same slot, then insert the appointment. If doctor_profile_id
-- is null (booking is against the static/legacy doctor directory, not a
-- real registered doctor), there is no real schedule resource to contend
-- for, so this only guarantees the same atomicity RLS already gave it.
-- ============================================================================
create or replace function public.book_appointment(
  p_patient_id uuid,
  p_ticket_number text,
  p_doctor_id text,
  p_doctor_name text,
  p_doctor_specialty text,
  p_hospital_name text,
  p_hospital_location text,
  p_room_number text,
  p_consultation_type text,
  p_appointment_date date,
  p_time_slot text,
  p_queue_number text,
  p_reason text,
  p_symptoms_note text,
  p_insurance_provider text,
  p_insurance_covered boolean,
  p_co_pay_amount_tzs integer,
  p_patient_name text,
  p_patient_phone text,
  p_provider_id uuid default null,
  p_doctor_profile_id uuid default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments;
  v_doctor_user_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_patient_id then
    raise exception 'Not authorized to book this appointment.' using errcode = '42501';
  end if;

  -- A deactivated facility/doctor must not receive new bookings. Checked
  -- here, not only in the UI, per spec — a raw RPC call (or a UI bug) must
  -- not be able to bypass this. Only checked when a real provider/doctor is
  -- attached (p_provider_id/p_doctor_profile_id are both nullable — the
  -- pre-real-doctors static directory path has neither).
  if p_provider_id is not null and not exists (
    select 1 from public.providers where id = p_provider_id and is_active = true
  ) then
    raise exception 'This facility is not currently accepting new appointments.' using errcode = '22023';
  end if;

  if p_doctor_profile_id is not null and not exists (
    select 1 from public.doctor_profiles where id = p_doctor_profile_id and is_active = true
  ) then
    raise exception 'This doctor is not currently accepting new appointments.' using errcode = '22023';
  end if;

  if p_doctor_profile_id is not null then
    insert into public.doctor_schedule (doctor_profile_id, schedule_date, time_slot, is_booked)
    values (p_doctor_profile_id, p_appointment_date, p_time_slot, true)
    on conflict (doctor_profile_id, schedule_date, time_slot)
    do update set is_booked = true
    where doctor_schedule.is_booked = false;

    if not found then
      raise exception 'This time slot is no longer available.' using errcode = '23505';
    end if;
  end if;

  insert into public.appointments (
    patient_id, provider_id, doctor_profile_id, ticket_number, doctor_id, doctor_name,
    doctor_specialty, hospital_name, hospital_location, room_number, consultation_type,
    appointment_date, time_slot, status, queue_number, reason, symptoms_note,
    insurance_provider, insurance_covered, co_pay_amount_tzs, patient_name, patient_phone
  ) values (
    p_patient_id, p_provider_id, p_doctor_profile_id, p_ticket_number, p_doctor_id, p_doctor_name,
    p_doctor_specialty, p_hospital_name, p_hospital_location, p_room_number, p_consultation_type,
    p_appointment_date, p_time_slot, 'confirmed', p_queue_number, p_reason, p_symptoms_note,
    p_insurance_provider, p_insurance_covered, p_co_pay_amount_tzs, p_patient_name, p_patient_phone
  )
  returning * into v_appointment;

  if p_doctor_profile_id is not null then
    update public.doctor_schedule
    set appointment_id = v_appointment.id
    where doctor_profile_id = p_doctor_profile_id
      and schedule_date = p_appointment_date
      and time_slot = p_time_slot;

    select user_id into v_doctor_user_id from public.doctor_profiles where id = p_doctor_profile_id;
    if v_doctor_user_id is not null then
      perform public.create_notification(
        v_doctor_user_id, 'appointments', 'New appointment booked',
        coalesce(p_patient_name, 'A patient') || ' — ' || p_appointment_date || ' at ' || p_time_slot,
        'appointments', v_appointment.id
      );
    end if;
  end if;

  return v_appointment;
end;
$$;

revoke all on function public.book_appointment(
  uuid, text, text, text, text, text, text, text, text, date, text, text, text, text, text,
  boolean, integer, text, text, uuid, uuid
) from public;
grant execute on function public.book_appointment(
  uuid, text, text, text, text, text, text, text, text, date, text, text, text, text, text,
  boolean, integer, text, text, uuid, uuid
) to authenticated;

-- ============================================================================
-- APPOINTMENT STATUS PIPELINE — reception check-in + patient
-- arrival + queue management (NiaCare "reduce waiting and congestion" phase).
--
-- Existing model before this block: 'confirmed' -> 'in_queue' -> 'completed'
-- (the last transition was never actually wired to any code path — nothing
-- ever set status = 'completed'), plus 'cancelled'. That's too coarse for
-- the real patient journey (self-arrival, reception confirmation, being
-- called, consultation in progress) and had no no-show state at all.
--
-- New, additive pipeline (old values kept, 4 added):
--   confirmed -> arrived -> in_queue -> called -> in_consultation -> completed
--                                                                  \-> (cancelled / no_show can occur earlier)
-- 'in_queue' is kept as the canonical "waiting in queue" state rather than
-- adding a redundant new 'waiting' label — it already meant exactly that.
--
-- Columns added mirror this pipeline so reception/doctor UIs (which cannot
-- read audit_logs — that table is admin-only) can show real timestamps
-- without a privileged join; audit_logs still gets a row for every
-- transition below via the existing log_audit_event(), for the
-- admin-facing compliance trail.
-- ============================================================================
alter table public.appointments
  add column if not exists patient_arrived_at timestamptz,
  add column if not exists arrival_confirmed_at timestamptz,
  add column if not exists arrival_confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists called_at timestamptz,
  add column if not exists consultation_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists no_show_at timestamptz,
  add column if not exists no_show_by uuid references auth.users(id) on delete set null,
  add column if not exists no_show_reason text;

-- Verified safe before altering: a read-only check against the live
-- database found only 'confirmed' and 'cancelled' in use across the 2
-- appointment rows that currently exist, both already inside the new set.
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('confirmed', 'arrived', 'in_queue', 'called', 'in_consultation', 'completed', 'cancelled', 'no_show'));

-- ----------------------------------------------------------------------------
-- patient_arrive_appointment() — the patient's own self-check-in from the
-- app ("I'm here"). Deliberately does NOT assign a queue number: per spec,
-- a queue number must never be shown until the backend actually assigns
-- one, which only happens once reception confirms the arrival (below).
--
-- Check-in window: doctor_schedule.time_slot is free text ("10:30 AM"), not
-- a real time column, so a reliable minute-level window can't be computed
-- server-side without parsing that text. The rule actually enforced here is
-- date-level: only today's own confirmed appointment can be self-checked-in
-- — not a future date, not a past one, not another patient's, not an
-- already-cancelled/completed/no-show one. This is the real, implementable
-- rule given the schema, not the finer-grained window the spec describes
-- conceptually.
-- ----------------------------------------------------------------------------
create or replace function public.patient_arrive_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if v_appt.id is null then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;

  if auth.uid() is null or auth.uid() <> v_appt.patient_id then
    raise exception 'Not authorized to check in this appointment.' using errcode = '42501';
  end if;

  if v_appt.status <> 'confirmed' then
    raise exception 'This appointment cannot be checked in from its current status.' using errcode = '22023';
  end if;

  if v_appt.appointment_date <> current_date then
    raise exception 'Check-in is only available on the day of your appointment.' using errcode = '22023';
  end if;

  update public.appointments
  set status = 'arrived', patient_arrived_at = now()
  where id = p_appointment_id
  returning * into v_appt;

  perform public.log_audit_event(
    'APPOINTMENT_PATIENT_ARRIVED', 'appointments', v_appt.id, v_appt.patient_id,
    jsonb_build_object('provider_id', v_appt.provider_id)
  );

  return v_appt;
end;
$$;

revoke all on function public.patient_arrive_appointment(uuid) from public;
grant execute on function public.patient_arrive_appointment(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- check_in_appointment() — reception confirms the patient is physically
-- present and assigns the real queue number, atomically. Now accepts a
-- 'confirmed' appointment too (a walk-up patient reception checks in
-- directly, who never used the app's self-check-in) as well as 'arrived'
-- (the patient already self-declared via the app) — either way this step,
-- not patient_arrive_appointment(), is what actually assigns the queue
-- number, per spec ("do not display a queue number until the backend has
-- actually assigned one").
-- ----------------------------------------------------------------------------
create or replace function public.check_in_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
  v_next_num integer;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if v_appt.id is null then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;

  if not (
    exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = v_appt.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  ) then
    raise exception 'Not authorized to check in this appointment.' using errcode = '42501';
  end if;

  if v_appt.status not in ('confirmed', 'arrived') then
    raise exception 'Only a confirmed or arrived appointment can be checked in.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(coalesce(v_appt.provider_id::text, 'none') || v_appt.appointment_date::text));

  select count(*) + 1 into v_next_num
  from public.appointments
  where provider_id is not distinct from v_appt.provider_id
    and appointment_date = v_appt.appointment_date
    and queue_number is not null;

  update public.appointments
  set status = 'in_queue',
      queue_number = 'A' || lpad(v_next_num::text, 3, '0'),
      arrival_confirmed_at = now(),
      arrival_confirmed_by = auth.uid()
  where id = p_appointment_id
  returning * into v_appt;

  perform public.create_notification(
    v_appt.patient_id, 'appointments', 'You have been checked in',
    'Queue number ' || v_appt.queue_number || ' — ' || v_appt.doctor_name, 'appointments', v_appt.id
  );

  perform public.log_audit_event(
    'APPOINTMENT_ARRIVAL_CONFIRMED', 'appointments', v_appt.id, v_appt.patient_id,
    jsonb_build_object('provider_id', v_appt.provider_id, 'queue_number', v_appt.queue_number)
  );

  return v_appt;
end;
$$;

revoke all on function public.check_in_appointment(uuid) from public;
grant execute on function public.check_in_appointment(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- call_patient() — reception or the treating doctor calls the next
-- patient. Only from 'in_queue' (must have a real queue position first).
-- ----------------------------------------------------------------------------
create or replace function public.call_patient(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if v_appt.id is null then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;

  if not (
    exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = v_appt.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or exists (
      select 1 from public.doctor_profiles dp where dp.id = v_appt.doctor_profile_id and dp.user_id = auth.uid()
    )
    or public.is_admin()
  ) then
    raise exception 'Not authorized to call this patient.' using errcode = '42501';
  end if;

  if v_appt.status <> 'in_queue' then
    raise exception 'Only a patient currently in the queue can be called.' using errcode = '22023';
  end if;

  update public.appointments
  set status = 'called', called_at = now()
  where id = p_appointment_id
  returning * into v_appt;

  perform public.create_notification(
    v_appt.patient_id, 'appointments', 'Your appointment is ready',
    v_appt.doctor_name || ' is ready to see you. Please proceed to the consultation area.',
    'appointments', v_appt.id
  );

  perform public.log_audit_event(
    'APPOINTMENT_PATIENT_CALLED', 'appointments', v_appt.id, v_appt.patient_id,
    jsonb_build_object('provider_id', v_appt.provider_id)
  );

  return v_appt;
end;
$$;

revoke all on function public.call_patient(uuid) from public;
grant execute on function public.call_patient(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- start_consultation() — the treating doctor begins seeing the patient.
-- Called alongside (not instead of) the existing encounters.startEncounter()
-- client call — encounters already carries the real clinical workflow; this
-- only keeps appointments.status in sync so reception/patient views (which
-- read appointments, not encounters) reflect it. Allowed from 'in_queue' too
-- (a doctor pulling the next patient without reception having called them
-- first — a real small clinic workflow) as well as 'called'.
-- ----------------------------------------------------------------------------
create or replace function public.start_consultation(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if v_appt.id is null then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;

  if not (
    exists (
      select 1 from public.doctor_profiles dp where dp.id = v_appt.doctor_profile_id and dp.user_id = auth.uid()
    )
    or public.is_admin()
  ) then
    raise exception 'Not authorized to start this consultation.' using errcode = '42501';
  end if;

  if v_appt.status not in ('in_queue', 'called') then
    raise exception 'Only a waiting or called patient can start a consultation.' using errcode = '22023';
  end if;

  update public.appointments
  set status = 'in_consultation', consultation_started_at = now()
  where id = p_appointment_id
  returning * into v_appt;

  perform public.log_audit_event(
    'APPOINTMENT_CONSULTATION_STARTED', 'appointments', v_appt.id, v_appt.patient_id,
    jsonb_build_object('provider_id', v_appt.provider_id)
  );

  return v_appt;
end;
$$;

revoke all on function public.start_consultation(uuid) from public;
grant execute on function public.start_consultation(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- complete_appointment_visit() — marks the appointment itself completed.
-- Named distinctly from encounters' own 'completed' status (different
-- table, different concept) — called alongside encounters.completeEncounter()
-- when that encounter has a real appointment_id, so appointments.status
-- (what reception/patient views read) stays in sync with the encounter
-- (what the Health Journey already reads — no change needed there).
-- ----------------------------------------------------------------------------
create or replace function public.complete_appointment_visit(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if v_appt.id is null then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;

  if not (
    exists (
      select 1 from public.doctor_profiles dp where dp.id = v_appt.doctor_profile_id and dp.user_id = auth.uid()
    )
    or public.is_admin()
  ) then
    raise exception 'Not authorized to complete this appointment.' using errcode = '42501';
  end if;

  if v_appt.status <> 'in_consultation' then
    raise exception 'Only an appointment currently in consultation can be completed.' using errcode = '22023';
  end if;

  update public.appointments
  set status = 'completed', completed_at = now()
  where id = p_appointment_id
  returning * into v_appt;

  perform public.create_notification(
    v_appt.patient_id, 'appointments', 'Appointment completed',
    'Your visit with ' || v_appt.doctor_name || ' is complete.', 'appointments', v_appt.id
  );

  perform public.log_audit_event(
    'APPOINTMENT_COMPLETED', 'appointments', v_appt.id, v_appt.patient_id,
    jsonb_build_object('provider_id', v_appt.provider_id)
  );

  return v_appt;
end;
$$;

revoke all on function public.complete_appointment_visit(uuid) from public;
grant execute on function public.complete_appointment_visit(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- mark_appointment_no_show() — reception marks a patient absent.
--
-- Proposed rule (no configured grace-period exists anywhere in this schema,
-- so this is the smallest defensible rule derivable from the data model,
-- not an invented precise minute threshold): a no-show can only be marked
-- (a) on or after the appointment's own date — never for a future visit —
-- and (b) while the appointment is still 'confirmed' or 'arrived', i.e. the
-- patient never actually reached the queue. Once reception has confirmed
-- arrival (in_queue) or later, the patient plainly did show up, so no-show
-- no longer applies. This prevents the "arbitrary immediate no-show
-- marking" the spec explicitly warns against, without inventing a specific
-- number of minutes nobody has configured.
-- ----------------------------------------------------------------------------
create or replace function public.mark_appointment_no_show(p_appointment_id uuid, p_reason text default null)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if v_appt.id is null then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;

  if not (
    exists (
      select 1 from public.provider_staff ps
      where ps.provider_id = v_appt.provider_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  ) then
    raise exception 'Not authorized to mark this appointment as no-show.' using errcode = '42501';
  end if;

  if v_appt.status not in ('confirmed', 'arrived') then
    raise exception 'Only a confirmed or arrived appointment that has not reached the queue can be marked no-show.' using errcode = '22023';
  end if;

  if v_appt.appointment_date > current_date then
    raise exception 'A future appointment cannot be marked no-show yet.' using errcode = '22023';
  end if;

  update public.appointments
  set status = 'no_show', no_show_at = now(), no_show_by = auth.uid(), no_show_reason = p_reason
  where id = p_appointment_id
  returning * into v_appt;

  perform public.log_audit_event(
    'APPOINTMENT_NO_SHOW', 'appointments', v_appt.id, v_appt.patient_id,
    jsonb_build_object('provider_id', v_appt.provider_id, 'reason', p_reason)
  );

  return v_appt;
end;
$$;

revoke all on function public.mark_appointment_no_show(uuid, text) from public;
grant execute on function public.mark_appointment_no_show(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- fetch_queue_position() — patient-facing "how many people are ahead of me"
-- for the queue status strip.
--
-- Fixes a real gap found while reviewing this: the client-side version of
-- this query (still in src/lib/queue.ts before this function existed) reads
-- public.appointments directly, and this table's only RLS policy is
-- "own row, or treating doctor, or facility staff, or admin" — a patient
-- querying other patients' rows for the same provider/date to count how
-- many are ahead of them would get zero rows back, silently. That made
-- "patients ahead" and "now serving" always come back 0/empty for every
-- patient, every time, well before this change. This function returns only
-- an aggregate count and other patients' ticket numbers (never names,
-- phones, reasons, or any clinical field) via SECURITY DEFINER, which is
-- the narrow fix — not a broadened table-level RLS policy, which would let
-- any signed-in patient read full appointment rows for a whole facility.
-- ----------------------------------------------------------------------------
create or replace function public.fetch_queue_position(
  p_provider_id uuid,
  p_appointment_date date,
  p_my_queue_number text
)
returns table (
  patients_ahead integer,
  now_serving text,
  currently_serving text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::integer from public.appointments a
     where a.provider_id is not distinct from p_provider_id
       and a.appointment_date = p_appointment_date
       and a.status = 'in_queue'
       and a.queue_number is not null
       and a.queue_number < p_my_queue_number),
    (select a.queue_number from public.appointments a
     where a.provider_id is not distinct from p_provider_id
       and a.appointment_date = p_appointment_date
       and a.status = 'in_queue'
       and a.queue_number is not null
     order by a.queue_number asc
     limit 1),
    (select a.queue_number from public.appointments a
     where a.provider_id is not distinct from p_provider_id
       and a.appointment_date = p_appointment_date
       and a.status in ('called', 'in_consultation')
       and a.queue_number is not null
     order by a.called_at desc nulls last
     limit 1);
end;
$$;

revoke all on function public.fetch_queue_position(uuid, date, text) from public;
grant execute on function public.fetch_queue_position(uuid, date, text) to authenticated;

-- ============================================================================
-- EMERGENCY DISPATCHES — deliberately insertable without auth ("bypass login"
-- emergency dispatch is a real product requirement: you don't gate an
-- ambulance call behind a login screen). patient_id is filled in when the
-- caller happens to be signed in, but is nullable for anonymous dispatches.
-- ============================================================================
create table if not exists public.emergency_dispatches (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references auth.users(id) on delete set null,
  condition text not null,
  latitude double precision,
  longitude double precision,
  address text,
  dispatch_ref text not null,
  status text not null default 'dispatched' check (status in ('dispatched', 'cancelled')),
  -- Nearest facility + real driving distance/ETA, computed via a road-network
  -- routing engine (OSRM) at the moment of dispatch — not illustrative numbers.
  target_facility text,
  facility_distance_km double precision,
  facility_eta_min integer,
  created_at timestamptz not null default now()
);

alter table public.emergency_dispatches
  add column if not exists target_facility text,
  add column if not exists facility_distance_km double precision,
  add column if not exists facility_eta_min integer;

alter table public.emergency_dispatches enable row level security;

drop policy if exists "Anyone can create a dispatch" on public.emergency_dispatches;
create policy "Anyone can create a dispatch"
  on public.emergency_dispatches for insert
  with check (true);

drop policy if exists "Owners can view their dispatches" on public.emergency_dispatches;
create policy "Owners can view their dispatches"
  on public.emergency_dispatches for select
  using (auth.uid() = patient_id or public.is_admin());

-- Widen the lifecycle beyond dispatched/cancelled so the admin operations
-- console can reflect real dispatch progress (a status this schema didn't
-- previously have anywhere to go, since there was no UPDATE policy at all).
alter table public.emergency_dispatches drop constraint if exists emergency_dispatches_status_check;
alter table public.emergency_dispatches add constraint emergency_dispatches_status_check
  check (status in ('dispatched', 'requested', 'accepted', 'assigned', 'en_route', 'arrived', 'transporting', 'completed', 'cancelled'));

-- Status changes must be server-authorized, not left to whoever created the
-- dispatch (an unauthenticated caller in the emergency case) — admin-only
-- for now, since there is no real per-facility dispatcher account model yet.
drop policy if exists "Admins can update dispatch status" on public.emergency_dispatches;
create policy "Admins can update dispatch status"
  on public.emergency_dispatches for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- AUDIT LOGS — append-only. Writable ONLY via public.log_audit_event() (which
-- always stamps actor_id from auth.uid(), never a client-supplied value) or
-- the trigger below — never a raw client insert, and never updatable/
-- deletable by anyone, including admins, once written. RLS has no insert/
-- update/delete policy at all, which combined with RLS being enabled means
-- those operations are denied outright for ordinary callers; the two writers
-- are SECURITY DEFINER and bypass RLS deliberately.
-- ============================================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  patient_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- facility_id: a real column, not fragile client-side metadata.provider_id
-- parsing (which some but not all existing log_audit_event() calls happen
-- to set, inconsistently, inside a jsonb blob with no index). Nullable —
-- most audit events (record access, role changes) aren't facility-scoped
-- at all, so this is never mandatory.
alter table public.audit_logs
  add column if not exists facility_id uuid references public.providers(id) on delete set null;

create index if not exists audit_logs_facility_id_idx on public.audit_logs(facility_id);

alter table public.audit_logs enable row level security;

drop policy if exists "Audit logs are viewable by admins only" on public.audit_logs;
create policy "Audit logs are viewable by admins only"
  on public.audit_logs for select
  using (public.is_admin());

-- p_facility_id appended as a new, optional, defaulted last parameter.
-- IMPORTANT: this must be a DROP + CREATE, not a plain CREATE OR REPLACE —
-- log_audit_event(text, text, uuid, uuid, jsonb) is already live and in
-- active use throughout this schema. Postgres treats a different
-- parameter LIST as a different function identity, so CREATE OR REPLACE
-- alone would leave the old 5-arg version in place and add this as a
-- second, overloaded function — which breaks PostgREST's RPC dispatch
-- (it cannot choose between two overloads whose only difference is a
-- trailing default parameter, and returns PGRST203 "could not choose the
-- best candidate function" for exactly the calls this app already makes).
-- Dropping the old 5-arg signature first, then creating the 6-arg
-- replacement, leaves exactly one function — every existing 5-argument
-- caller (positional SQL calls throughout this file, and the frontend's
-- named-argument logAuditEvent() calls) continues to work unchanged
-- because the 6th parameter defaults to null.
drop function if exists public.log_audit_event(text, text, uuid, uuid, jsonb);

create or replace function public.log_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_patient_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_facility_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, patient_id, metadata, facility_id)
  values (auth.uid(), p_action, p_resource_type, p_resource_id, p_patient_id, p_metadata, p_facility_id);
end;
$$;

revoke all on function public.log_audit_event(text, text, uuid, uuid, jsonb, uuid) from public;
grant execute on function public.log_audit_event(text, text, uuid, uuid, jsonb, uuid) to authenticated;

-- Role/status changes are security-critical, so they're logged from inside
-- the same trigger that guards them — this can't be forgotten by whichever
-- code path performs the change, unlike a call the app remembers to make.
create or replace function public.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.audit_logs (actor_id, action, resource_type, resource_id, patient_id, metadata)
    values (auth.uid(), 'ROLE_CHANGED', 'profiles', new.id, new.id, jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, resource_type, resource_id, patient_id, metadata)
    values (
      auth.uid(),
      case when new.status = 'suspended' then 'USER_DISABLED' else 'STATUS_CHANGED' end,
      'profiles', new.id, new.id, jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_profile_role_change on public.profiles;
create trigger audit_profile_role_change
  after update on public.profiles
  for each row execute function public.audit_role_change();

drop trigger if exists audit_encounters_insert on public.encounters;
create trigger audit_encounters_insert
  after insert on public.encounters
  for each row execute function public.audit_row_change();

drop trigger if exists audit_medical_records_change on public.medical_records;
create trigger audit_medical_records_change
  after insert on public.medical_records
  for each row execute function public.audit_row_change();

drop trigger if exists audit_prescriptions_change on public.prescriptions;
create trigger audit_prescriptions_change
  after insert on public.prescriptions
  for each row execute function public.audit_row_change();

drop trigger if exists audit_diagnoses_change on public.diagnoses;
create trigger audit_diagnoses_change
  after insert on public.diagnoses
  for each row execute function public.audit_row_change();

drop trigger if exists audit_emergency_dispatches_insert on public.emergency_dispatches;
create trigger audit_emergency_dispatches_insert
  after insert on public.emergency_dispatches
  for each row execute function public.audit_row_change();

drop trigger if exists audit_emergency_dispatches_update on public.emergency_dispatches;
create trigger audit_emergency_dispatches_update
  after update on public.emergency_dispatches
  for each row execute function public.audit_row_change();

drop trigger if exists audit_payments_change on public.payments;
create trigger audit_payments_change
  after update on public.payments
  for each row execute function public.audit_row_change();

-- ============================================================================
-- RECORD ACCESS REQUESTS — patient-controlled, time-limited record sharing.
--
-- The existing clinical-staff SELECT policies on medical_records/
-- prescriptions/lab_results/diagnoses are scoped to a real treatment
-- relationship (an appointment/encounter connecting that doctor to that
-- patient) — correct for routine care, but it means a doctor with no prior
-- relationship (a referral, a second opinion, continuity of care from a
-- different facility) has no way to see anything, ever. This table +ework
-- is that path: a doctor requests access by an identifier the patient
-- actually shared with them (NIDA or phone — never a free browse of the
-- patient directory), the patient explicitly allows or declines it from
-- their own session, and an approval is time-limited, not permanent.
-- ============================================================================
create table if not exists public.record_access_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requester_doctor_profile_id uuid references public.doctor_profiles(id) on delete set null,
  reason text not null,
  scopes text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'revoked', 'expired')),
  responded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.record_access_requests enable row level security;

drop policy if exists "Access requests are viewable by patient and requester" on public.record_access_requests;
create policy "Access requests are viewable by patient and requester"
  on public.record_access_requests for select
  using (auth.uid() = patient_id or auth.uid() = requested_by or public.is_admin());

-- No direct INSERT/UPDATE policy — every write goes through the two
-- SECURITY DEFINER functions below, which is what stops a doctor from
-- self-approving their own request or a client from inventing patient_id.

-- Resolves a patient by an identifier they shared out-of-band with the
-- requesting doctor (their NIDA number or phone — the same fields already
-- shown on their Digital Health Passport), never by browsing the patient
-- directory. Deliberately returns the same generic error whether the
-- identifier doesn't exist or doesn't belong to a patient, so this can't be
-- used to probe which NIDA/phone numbers are registered on the platform.
create or replace function public.request_record_access(
  p_identifier_type text,
  p_identifier_value text,
  p_reason text,
  p_scopes text[]
)
returns public.record_access_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_doctor_profile_id uuid;
  v_row public.record_access_requests;
begin
  if not exists (select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.is_active = true) then
    raise exception 'Only an active doctor can request patient record access.' using errcode = '42501';
  end if;

  if p_identifier_type = 'nida' then
    select id into v_patient_id from public.profiles where nida_number = p_identifier_value and role = 'patient';
  elsif p_identifier_type = 'phone' then
    select id into v_patient_id from public.profiles where phone = p_identifier_value and role = 'patient';
  else
    raise exception 'Unsupported identifier type.' using errcode = '22023';
  end if;

  if v_patient_id is null then
    raise exception 'No patient matches that identifier.' using errcode = 'P0002';
  end if;

  select id into v_doctor_profile_id from public.doctor_profiles where user_id = auth.uid();

  insert into public.record_access_requests (patient_id, requested_by, requester_doctor_profile_id, reason, scopes)
  values (v_patient_id, auth.uid(), v_doctor_profile_id, p_reason, p_scopes)
  returning * into v_row;

  perform public.log_audit_event('RECORD_ACCESS_REQUESTED', 'record_access_requests', v_row.id, v_patient_id,
    jsonb_build_object('scopes', p_scopes));

  return v_row;
end;
$$;

revoke all on function public.request_record_access(text, text, text, text[]) from public;
grant execute on function public.request_record_access(text, text, text, text[]) to authenticated;

-- Only the patient the request is about may approve/decline it — this is
-- the consent step. Approving stamps a real expiry (default 7 days, capped
-- at 90) rather than trusting a client-supplied value.
create or replace function public.respond_to_access_request(
  p_request_id uuid,
  p_approve boolean,
  p_days integer default 7
)
returns public.record_access_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.record_access_requests;
  v_days integer;
begin
  select * into v_row from public.record_access_requests where id = p_request_id;
  if v_row.id is null then
    raise exception 'Access request not found.' using errcode = 'P0002';
  end if;
  if auth.uid() is null or auth.uid() <> v_row.patient_id then
    raise exception 'Not authorized to respond to this request.' using errcode = '42501';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'This request has already been responded to.' using errcode = '22023';
  end if;

  v_days := greatest(1, least(coalesce(p_days, 7), 90));

  update public.record_access_requests
  set status = case when p_approve then 'approved' else 'declined' end,
      responded_at = now(),
      expires_at = case when p_approve then now() + (v_days || ' days')::interval else null end
  where id = p_request_id
  returning * into v_row;

  perform public.log_audit_event(
    case when p_approve then 'RECORD_ACCESS_GRANTED' else 'RECORD_ACCESS_DECLINED' end,
    'record_access_requests', v_row.id, v_row.patient_id, jsonb_build_object('scopes', v_row.scopes)
  );

  perform public.create_notification(
    v_row.requested_by, 'access',
    case when p_approve then 'Record access approved' else 'Record access declined' end,
    case when p_approve then 'The patient approved your request. Access expires ' || to_char(v_row.expires_at, 'YYYY-MM-DD') || '.' else 'The patient declined your request.' end,
    'record_access_requests', v_row.id
  );

  return v_row;
end;
$$;

revoke all on function public.respond_to_access_request(uuid, boolean, integer) from public;
grant execute on function public.respond_to_access_request(uuid, boolean, integer) to authenticated;

-- Lets a patient end an already-approved grant early, before its expiry.
create or replace function public.revoke_access_grant(p_request_id uuid)
returns public.record_access_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.record_access_requests;
begin
  select * into v_row from public.record_access_requests where id = p_request_id;
  if v_row.id is null then
    raise exception 'Access request not found.' using errcode = 'P0002';
  end if;
  if auth.uid() is null or auth.uid() <> v_row.patient_id then
    raise exception 'Not authorized to revoke this grant.' using errcode = '42501';
  end if;
  if v_row.status <> 'approved' then
    raise exception 'Only an approved grant can be revoked.' using errcode = '22023';
  end if;

  update public.record_access_requests set status = 'revoked' where id = p_request_id
  returning * into v_row;

  perform public.log_audit_event('RECORD_ACCESS_REVOKED', 'record_access_requests', v_row.id, v_row.patient_id, '{}'::jsonb);

  return v_row;
end;
$$;

revoke all on function public.revoke_access_grant(uuid) from public;
grant execute on function public.revoke_access_grant(uuid) to authenticated;

-- Shared read-time check used by the policy extensions below: is there a
-- currently-valid (approved, not expired) grant covering this scope? Live
-- expiry check against now(), not just the stored status, so an approved
-- grant stops working the instant it expires without needing a background
-- job to flip its status.
create or replace function public.has_record_access_grant(p_patient_id uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.record_access_requests rar
    where rar.patient_id = p_patient_id
      and rar.requested_by = auth.uid()
      and rar.status = 'approved'
      and rar.expires_at > now()
      and p_scope = any(rar.scopes)
  );
$$;

revoke all on function public.has_record_access_grant(uuid, text) from public;
grant execute on function public.has_record_access_grant(uuid, text) to authenticated;

-- Extend existing read policies with the new grant path — additive only
-- (drop + recreate the same policy with one more OR branch), every existing
-- condition is preserved unchanged.
drop policy if exists "Medical records are viewable by owner" on public.medical_records;
create policy "Medical records are viewable by owner"
  on public.medical_records for select
  using (
    auth.uid() = patient_id
    or auth.uid() = created_by
    or exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.id = medical_records.appointment_id and ps.user_id = auth.uid()
    )
    or public.has_record_access_grant(medical_records.patient_id, 'medical_records')
    or public.is_admin()
  );

drop policy if exists "Prescriptions are viewable by patient and treating staff" on public.prescriptions;
create policy "Prescriptions are viewable by patient and treating staff"
  on public.prescriptions for select
  using (
    auth.uid() = patient_id
    or auth.uid() = created_by
    or exists (
      select 1 from public.appointments a
      join public.doctor_profiles dp on dp.id = a.doctor_profile_id
      where a.patient_id = prescriptions.patient_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.encounters e
      join public.doctor_profiles dp on dp.id = e.doctor_profile_id
      where e.patient_id = prescriptions.patient_id and dp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.patient_id = prescriptions.patient_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.has_record_access_grant(prescriptions.patient_id, 'prescriptions')
    or public.is_admin()
  );

drop policy if exists "Lab results are viewable by patient and clinical staff" on public.lab_results;
create policy "Lab results are viewable by patient and clinical staff"
  on public.lab_results for select
  using (
    auth.uid() = patient_id
    or exists (
      select 1 from public.lab_orders lo
      where lo.id = lab_results.lab_order_id
      and (
        exists (select 1 from public.doctor_profiles dp where dp.id = lo.doctor_profile_id and dp.user_id = auth.uid())
        or exists (select 1 from public.provider_staff ps where ps.provider_id = lo.provider_id and ps.user_id = auth.uid())
      )
    )
    or public.has_record_access_grant(lab_results.patient_id, 'lab_results')
    or public.is_admin()
  );

drop policy if exists "Diagnoses are viewable by patient and clinical staff" on public.diagnoses;
create policy "Diagnoses are viewable by patient and clinical staff"
  on public.diagnoses for select
  using (
    auth.uid() = patient_id
    or exists (select 1 from public.doctor_profiles dp where dp.id = diagnoses.doctor_profile_id and dp.user_id = auth.uid())
    or public.has_record_access_grant(diagnoses.patient_id, 'diagnoses')
    or public.is_admin()
  );

-- No generic audit_row_change() trigger here — request_record_access(),
-- respond_to_access_request(), and revoke_access_grant() above already log
-- a specific, richer event (with scopes) for every state change; a trigger
-- would just double up on every insert.

-- ============================================================================
-- fetch_patient_record_access_log() — a minimal, patient-safe read path
-- into audit_logs for the "who accessed my records" screen.
--
-- audit_logs itself stays admin-only (its RLS is NOT touched or widened —
-- this function reads it via SECURITY DEFINER instead, the same pattern
-- already used elsewhere in this schema for a narrow authorized read). Two
-- deliberate restrictions keep this from becoming a second, looser way to
-- read the whole table: (a) it always filters to `patient_id = auth.uid()`
-- — a caller can only ever get their own rows, no parameter can widen that;
-- (b) it excludes the caller's own actions (`actor_id is distinct from
-- patient_id`) and only returns a fixed allow-list of "someone accessed my
-- clinical data" action types — not every audit_logs row concerning this
-- patient (e.g. appointment/queue events aren't clinical record access and
-- are deliberately left out), and never the raw `metadata` column.
-- ============================================================================
create or replace function public.fetch_patient_record_access_log(p_limit integer default 30)
returns table (
  id uuid,
  actor_name text,
  action text,
  accessed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  return query
  select al.id, coalesce(p.full_name, 'Care team member') as actor_name, al.action, al.created_at
  from public.audit_logs al
  left join public.profiles p on p.id = al.actor_id
  where al.patient_id = auth.uid()
    and al.actor_id is distinct from al.patient_id
    and al.action in ('CLINICAL_RECORD_ACCESSED', 'MEDICAL_RECORD_VIEWED', 'IMAGING_ACCESSED', 'LAB_RESULT_VIEWED')
  order by al.created_at desc
  limit greatest(1, least(p_limit, 100));
end;
$$;

revoke all on function public.fetch_patient_record_access_log(integer) from public;
grant execute on function public.fetch_patient_record_access_log(integer) to authenticated;

-- ============================================================================
-- NOTIFICATIONS — real, per-user notification feed. Writable only via
-- create_notification() (called from the RPCs/triggers below, never
-- directly by a client), which is what stops the "New evening!" bell icon
-- from ever showing a hardcoded unread dot again — every notification here
-- corresponds to something that actually happened.
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'general' check (
    category in ('appointments', 'reminders', 'results', 'follow_up', 'payments', 'messages', 'access', 'general')
  ),
  title text not null,
  body text,
  linked_entity_type text,
  linked_entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Notifications are viewable by owner" on public.notifications;
create policy "Notifications are viewable by owner"
  on public.notifications for select
  using (auth.uid() = user_id or public.is_admin());

-- Marking read/unread is the one field a user may touch directly — low
-- enough stakes (it only affects what the owner sees on their own feed)
-- that a dedicated RPC would be pure ceremony, unlike bills/prescriptions.
drop policy if exists "Notifications are updatable by owner" on public.notifications;
create policy "Notifications are updatable by owner"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.create_notification(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text default null,
  p_linked_entity_type text default null,
  p_linked_entity_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, category, title, body, linked_entity_type, linked_entity_id)
  values (p_user_id, p_category, p_title, p_body, p_linked_entity_type, p_linked_entity_id);
end;
$$;

revoke all on function public.create_notification(uuid, text, text, text, text, uuid) from public;
grant execute on function public.create_notification(uuid, text, text, text, text, uuid) to authenticated;

-- ============================================================================
-- MESSAGING — real patient <-> doctor/facility conversations. A conversation
-- can only be opened between two accounts with a genuine relationship (an
-- appointment/encounter connecting them, or an approved record-access
-- grant from Phase 10) — reusing the exact relationship checks already
-- trusted throughout this schema, not a new, separate trust boundary.
-- ============================================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (patient_id, staff_user_id)
);

alter table public.conversations enable row level security;

drop policy if exists "Conversations are viewable by participants" on public.conversations;
create policy "Conversations are viewable by participants"
  on public.conversations for select
  using (auth.uid() = patient_id or auth.uid() = staff_user_id or public.is_admin());

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

drop policy if exists "Messages are viewable by conversation participants" on public.messages;
create policy "Messages are viewable by conversation participants"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and (c.patient_id = auth.uid() or c.staff_user_id = auth.uid())
    )
    or public.is_admin()
  );

-- A participant may mark a message they received as read — the same
-- low-stakes reasoning as notifications above.
drop policy if exists "Messages are updatable by conversation participants" on public.messages;
create policy "Messages are updatable by conversation participants"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and (c.patient_id = auth.uid() or c.staff_user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and (c.patient_id = auth.uid() or c.staff_user_id = auth.uid())
    )
  );

-- No direct INSERT policy on either table — opening a conversation and
-- sending a message both go through the SECURITY DEFINER functions below,
-- which is what enforces "a real relationship must exist" and "only a
-- participant may post here" without trusting the client for either.
create or replace function public.start_conversation(p_other_party_user_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_staff_user_id uuid;
  v_caller_role text;
  v_row public.conversations;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();

  if v_caller_role = 'patient' then
    v_patient_id := auth.uid();
    v_staff_user_id := p_other_party_user_id;
  else
    v_patient_id := p_other_party_user_id;
    v_staff_user_id := auth.uid();
  end if;

  if not (
    exists (
      select 1 from public.appointments a
      left join public.doctor_profiles dp on dp.id = a.doctor_profile_id
      where a.patient_id = v_patient_id
        and (
          dp.user_id = v_staff_user_id
          or exists (select 1 from public.provider_staff ps where ps.provider_id = a.provider_id and ps.user_id = v_staff_user_id)
        )
    )
    or exists (
      select 1 from public.encounters e
      join public.doctor_profiles dp on dp.id = e.doctor_profile_id
      where e.patient_id = v_patient_id and dp.user_id = v_staff_user_id
    )
    or public.has_record_access_grant(v_patient_id, 'medical_records')
    or public.is_admin()
  ) then
    raise exception 'No care relationship exists between these accounts.' using errcode = '42501';
  end if;

  insert into public.conversations (patient_id, staff_user_id)
  values (v_patient_id, v_staff_user_id)
  on conflict (patient_id, staff_user_id) do update set patient_id = excluded.patient_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.start_conversation(uuid) from public;
grant execute on function public.start_conversation(uuid) to authenticated;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convo public.conversations;
  v_recipient uuid;
  v_sender_role text;
  v_row public.messages;
begin
  select * into v_convo from public.conversations where id = p_conversation_id;
  if v_convo.id is null then
    raise exception 'Conversation not found.' using errcode = 'P0002';
  end if;
  if auth.uid() is null or (auth.uid() <> v_convo.patient_id and auth.uid() <> v_convo.staff_user_id) then
    raise exception 'Not a participant in this conversation.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'Message cannot be empty.' using errcode = '22023';
  end if;

  v_recipient := case when auth.uid() = v_convo.patient_id then v_convo.staff_user_id else v_convo.patient_id end;
  select role into v_sender_role from public.profiles where id = auth.uid();

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, auth.uid(), p_body)
  returning * into v_row;

  update public.conversations set last_message_at = now() where id = p_conversation_id;

  perform public.create_notification(
    v_recipient, 'messages',
    case when v_sender_role = 'patient' then 'New message from a patient' else 'New message from your care team' end,
    left(p_body, 120), 'conversations', p_conversation_id
  );

  return v_row;
end;
$$;

revoke all on function public.send_message(uuid, text) from public;
grant execute on function public.send_message(uuid, text) to authenticated;

-- New clinical results/prescriptions notify the patient automatically —
-- these fire regardless of which path created the row (doctor console,
-- lab tech entry, etc.), so the notification can't be forgotten by one
-- call site the way an app-level "remember to also notify" step could be.
create or replace function public.notify_patient_of_new_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_TABLE_NAME = 'lab_results' then
    perform public.create_notification(new.patient_id, 'results', 'Lab result available', new.summary, 'lab_results', new.id);
  elsif TG_TABLE_NAME = 'prescriptions' then
    perform public.create_notification(new.patient_id, 'reminders', 'New prescription added', new.medication_name, 'prescriptions', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_patient_lab_result on public.lab_results;
create trigger notify_patient_lab_result
  after insert on public.lab_results
  for each row execute function public.notify_patient_of_new_row();

drop trigger if exists notify_patient_prescription on public.prescriptions;
create trigger notify_patient_prescription
  after insert on public.prescriptions
  for each row execute function public.notify_patient_of_new_row();

-- ============================================================================
-- REFERRALS — a doctor sending a patient to a specialist/facility for
-- continuity of care. Creation is gated the same way conversations are: the
-- referring doctor must have a genuine relationship with the patient
-- (an appointment or encounter), not a raw client insert naming any
-- patient_id it likes.
-- ============================================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  referring_doctor_profile_id uuid not null references public.doctor_profiles(id) on delete cascade,
  destination_provider_id uuid references public.providers(id) on delete set null,
  destination_specialty text not null,
  reason text not null,
  urgency text not null default 'routine' check (urgency in ('routine', 'urgent', 'emergency')),
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'completed', 'cancelled')),
  linked_appointment_id uuid references public.appointments(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.referrals enable row level security;

drop policy if exists "Referrals are viewable by patient and involved staff" on public.referrals;
create policy "Referrals are viewable by patient and involved staff"
  on public.referrals for select
  using (
    auth.uid() = patient_id
    or exists (select 1 from public.doctor_profiles dp where dp.id = referrals.referring_doctor_profile_id and dp.user_id = auth.uid())
    or exists (select 1 from public.provider_staff ps where ps.provider_id = referrals.destination_provider_id and ps.user_id = auth.uid())
    or public.is_admin()
  );

-- No direct INSERT/UPDATE policy — see create_referral()/update_referral_status().

create or replace function public.create_referral(
  p_patient_id uuid,
  p_destination_provider_id uuid,
  p_destination_specialty text,
  p_reason text,
  p_urgency text default 'routine'
)
returns public.referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_profile_id uuid;
  v_row public.referrals;
begin
  select id into v_doctor_profile_id from public.doctor_profiles where user_id = auth.uid() and is_active = true;
  if v_doctor_profile_id is null then
    raise exception 'Only an active doctor can create a referral.' using errcode = '42501';
  end if;

  if not (
    exists (select 1 from public.appointments a where a.patient_id = p_patient_id and a.doctor_profile_id = v_doctor_profile_id)
    or exists (select 1 from public.encounters e where e.patient_id = p_patient_id and e.doctor_profile_id = v_doctor_profile_id)
  ) then
    raise exception 'No care relationship exists with this patient.' using errcode = '42501';
  end if;

  insert into public.referrals (patient_id, referring_doctor_profile_id, destination_provider_id, destination_specialty, reason, urgency)
  values (p_patient_id, v_doctor_profile_id, p_destination_provider_id, p_destination_specialty, p_reason, coalesce(p_urgency, 'routine'))
  returning * into v_row;

  perform public.create_notification(
    p_patient_id, 'follow_up', 'New referral to ' || p_destination_specialty,
    p_reason, 'referrals', v_row.id
  );
  perform public.log_audit_event('REFERRAL_CREATED', 'referrals', v_row.id, p_patient_id,
    jsonb_build_object('specialty', p_destination_specialty, 'urgency', v_row.urgency));

  return v_row;
end;
$$;

revoke all on function public.create_referral(uuid, uuid, text, text, text) from public;
grant execute on function public.create_referral(uuid, uuid, text, text, text) to authenticated;

-- Status progression (scheduled once a follow-up appointment exists,
-- completed, or cancelled) — updatable by the referring doctor or staff at
-- the destination facility, not the patient (the patient's own action of
-- booking the follow-up appointment is a separate, existing flow; this just
-- tracks the referral's own lifecycle).
create or replace function public.update_referral_status(
  p_referral_id uuid,
  p_status text,
  p_linked_appointment_id uuid default null
)
returns public.referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.referrals;
begin
  select * into v_row from public.referrals where id = p_referral_id;
  if v_row.id is null then
    raise exception 'Referral not found.' using errcode = 'P0002';
  end if;

  if not (
    exists (select 1 from public.doctor_profiles dp where dp.id = v_row.referring_doctor_profile_id and dp.user_id = auth.uid())
    or exists (select 1 from public.provider_staff ps where ps.provider_id = v_row.destination_provider_id and ps.user_id = auth.uid())
    or public.is_admin()
  ) then
    raise exception 'Not authorized to update this referral.' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'scheduled', 'completed', 'cancelled') then
    raise exception 'Invalid status.' using errcode = '22023';
  end if;

  update public.referrals
  set status = p_status,
      linked_appointment_id = coalesce(p_linked_appointment_id, linked_appointment_id),
      updated_at = now()
  where id = p_referral_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_referral_status(uuid, text, uuid) from public;
grant execute on function public.update_referral_status(uuid, text, uuid) to authenticated;

-- ============================================================================
-- CLAIMS — insurance claim tracking per bill (spec section 45/46:
-- "Insurance section: ... Claims"). Deliberately additive, not a rewrite of
-- the existing insurance fields on profiles/bills/appointments — those stay
-- exactly as they are (membership/coverage display), this only adds the one
-- thing that was genuinely missing: a claim's own lifecycle once a facility
-- actually submits one to an insurer for an insurance-covered bill.
-- ============================================================================
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  insurance_provider text not null,
  claim_amount_tzs integer not null default 0,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'approved', 'rejected', 'paid')),
  reference_number text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.claims enable row level security;

drop policy if exists "Claims are viewable by patient and billing staff" on public.claims;
create policy "Claims are viewable by patient and billing staff"
  on public.claims for select
  using (
    auth.uid() = patient_id
    or exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = claims.bill_id and ps.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- Submitting and updating a claim is billing-staff administrative work, not
-- a patient-facing action or a client-trusted financial mutation the way
-- settle_bill_as_patient() is — RLS alone is the right-sized boundary here,
-- scoped to staff at the bill's own facility.
drop policy if exists "Claims are insertable by billing staff" on public.claims;
create policy "Claims are insertable by billing staff"
  on public.claims for insert
  with check (
    exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = claims.bill_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

drop policy if exists "Claims are updatable by billing staff" on public.claims;
create policy "Claims are updatable by billing staff"
  on public.claims for update
  using (
    exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = claims.bill_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = claims.bill_id and ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

drop trigger if exists set_claims_updated_at on public.claims;
create trigger set_claims_updated_at
  before update on public.claims
  for each row execute function public.set_updated_at();

-- ============================================================================
-- WEBAUTHN CREDENTIALS — real FIDO2/WebAuthn public-key credentials
-- (fingerprint / Face ID / Windows Hello via the device's platform
-- authenticator), registered and verified through api/webauthn-*.ts.
-- ============================================================================
create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_type text,
  backed_up boolean not null default false,
  transports text[],
  nickname text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.webauthn_credentials enable row level security;

drop policy if exists "WebAuthn credentials are manageable by owner" on public.webauthn_credentials;
create policy "WebAuthn credentials are manageable by owner"
  on public.webauthn_credentials for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

-- One pending challenge per patient — written by webauthn-*-options.ts,
-- consumed and deleted by webauthn-*-verify.ts. Serverless functions are
-- stateless between invocations, so the in-flight WebAuthn challenge has to
-- live somewhere between the "options" and "verify" calls.
create table if not exists public.webauthn_challenges (
  patient_id uuid primary key references auth.users(id) on delete cascade,
  challenge text not null,
  updated_at timestamptz not null default now()
);

alter table public.webauthn_challenges enable row level security;

drop policy if exists "WebAuthn challenges are manageable by owner" on public.webauthn_challenges;
create policy "WebAuthn challenges are manageable by owner"
  on public.webauthn_challenges for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

-- ============================================================================
-- STORAGE — private bucket for real personal-file uploads (bytes, not just
-- metadata). Files are stored under a path prefixed with the owner's user id
-- (e.g. "<uid>/<uuid>-filename.pdf"), which the RLS policies below enforce so
-- a patient can only read/write/delete objects inside their own folder.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('personal-files', 'personal-files', false, 26214400) -- 25MB
on conflict (id) do nothing;

drop policy if exists "Personal files are uploadable by owner" on storage.objects;
create policy "Personal files are uploadable by owner"
  on storage.objects for insert
  with check (
    bucket_id = 'personal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Personal files are readable by owner" on storage.objects;
create policy "Personal files are readable by owner"
  on storage.objects for select
  using (
    bucket_id = 'personal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Personal files are deletable by owner" on storage.objects;
create policy "Personal files are deletable by owner"
  on storage.objects for delete
  using (
    bucket_id = 'personal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- DATA INTEGRITY GUARDS — re-runnable constraints that keep production data
-- realistic: no negative money/stock, plausible vitals, sane coordinates, and
-- unique operational references where duplicates would confuse staff.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'providers_lat_lng_valid') then
    alter table public.providers add constraint providers_lat_lng_valid
      check ((lat is null or lat between -90 and 90) and (lng is null or lng between -180 and 180)) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'doctor_profiles_money_nonnegative') then
    alter table public.doctor_profiles add constraint doctor_profiles_money_nonnegative
      check (
        consultation_fee_tzs >= 0
        and telehealth_fee_tzs >= 0
        and home_visit_fee_tzs >= 0
        and reviews_count >= 0
        and (experience_years is null or experience_years >= 0)
        and rating between 0 and 5
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'appointments_amounts_nonnegative') then
    alter table public.appointments add constraint appointments_amounts_nonnegative
      check (co_pay_amount_tzs >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'vitals_plausible_ranges') then
    alter table public.vitals add constraint vitals_plausible_ranges
      check (
        (temperature_c is null or temperature_c between 25 and 45)
        and (heart_rate is null or heart_rate between 20 and 250)
        and (respiratory_rate is null or respiratory_rate between 5 and 80)
        and (spo2 is null or spo2 between 0 and 100)
        and (systolic_bp is null or systolic_bp between 40 and 260)
        and (diastolic_bp is null or diastolic_bp between 20 and 180)
        and (weight_kg is null or weight_kg between 0 and 400)
        and (height_cm is null or height_cm between 20 and 260)
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bills_totals_nonnegative') then
    alter table public.bills add constraint bills_totals_nonnegative
      check (total_tzs >= 0 and total_usd >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bill_items_amounts_valid') then
    alter table public.bill_items add constraint bill_items_amounts_valid
      check (quantity > 0 and unit_price_tzs >= 0 and total_tzs >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_amount_nonnegative') then
    alter table public.payments add constraint payments_amount_nonnegative
      check (amount_tzs >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'emergency_dispatches_coordinates_valid') then
    alter table public.emergency_dispatches add constraint emergency_dispatches_coordinates_valid
      check (
        (latitude is null or latitude between -90 and 90)
        and (longitude is null or longitude between -180 and 180)
        and (facility_distance_km is null or facility_distance_km >= 0)
        and (facility_eta_min is null or facility_eta_min >= 0)
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inventory_quantities_nonnegative') then
    alter table public.inventory_items add constraint inventory_quantities_nonnegative
      check (quantity >= 0 and minimum_quantity >= 0) not valid;
  end if;
end $$;

create unique index if not exists appointments_ticket_number_unique
  on public.appointments (ticket_number);

create unique index if not exists bills_invoice_number_unique
  on public.bills (invoice_number);

create unique index if not exists emergency_dispatches_dispatch_ref_unique
  on public.emergency_dispatches (dispatch_ref);

-- ============================================================================
-- SEED PROVIDERS — affiliated hospitals and clinics in Tanzania
-- ============================================================================
insert into public.providers (id, name, region, type, address, phone, emergency_phone, nhif_enabled, lat, lng)
values
  ('11111111-1111-1111-1111-111111111111', 'Muhimbili National Hospital (MNH)', 'Dar es Salaam (Upanga)', 'National Referral Hospital', 'Upanga, Dar es Salaam', '+255 22 215 1367', '+255 22 215 1367', true, -6.80773, 39.27221),
  ('22222222-2222-2222-2222-222222222222', 'The Aga Khan Hospital Dar es Salaam', 'Dar es Salaam (Ocean Road)', 'Private Tertiary Hospital (JCI Accredited)', 'Ocean Road, Dar es Salaam', '+255 22 211 5151', '+255 22 211 5151', true, -6.803487, 39.287841),
  ('33333333-3333-3333-3333-333333333333', 'KCMC Referral Hospital', 'Moshi / Kilimanjaro', 'Zonal Referral Hospital', 'Moshi, Kilimanjaro', '+255 27 275 4377', '+255 27 275 4377', true, -3.33488, 37.34038),
  ('44444444-4444-4444-4444-444444444444', 'Bugando Medical Centre (BMC)', 'Mwanza (Lake Zone)', 'Zonal Referral Hospital', 'Mwanza', '+255 28 250 0513', '+255 28 250 0513', true, -2.51667, 32.9),
  ('55555555-5555-5555-5555-555555555555', 'TMJ Hospital', 'Dar es Salaam (Mikocheni)', 'Private Specialized Hospital', 'Mikocheni, Dar es Salaam', '+255 22 277 5511', '+255 22 277 5511', true, -6.765, 39.25),
  ('66666666-6666-6666-6666-666666666666', 'Mnazi Mmoja Referral Hospital', 'Zanzibar (Unguja)', 'Regional Teaching Hospital', 'Stone Town, Zanzibar', '+255 24 223 1071', '+255 24 223 1071', true, -6.1659, 39.199),
  ('77777777-7777-7777-7777-777777777777', 'Mwananyamala Regional Referral Hospital', 'Dar es Salaam (Kinondoni)', 'Regional Referral Hospital', 'Kinondoni, Dar es Salaam', '+255 22 277 4422', '+255 22 277 4422', true, -6.8, 39.25),
  ('88888888-8888-8888-8888-888888888888', 'Regency Medical Centre', 'Dar es Salaam (Upanga)', 'Private Multispecialty Hospital', 'Upanga, Dar es Salaam', '+255 22 215 0500', '+255 22 215 0500', true, -6.81, 39.28)
on conflict (id) do update set
  name = excluded.name,
  region = excluded.region,
  type = excluded.type,
  address = excluded.address,
  phone = excluded.phone,
  emergency_phone = excluded.emergency_phone,
  nhif_enabled = excluded.nhif_enabled,
  lat = excluded.lat,
  lng = excluded.lng;

-- ============================================================================
-- updated_at auto-touch trigger for profiles and provider tables
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_providers_updated_at on public.providers;
create trigger set_providers_updated_at
  before update on public.providers
  for each row execute function public.set_updated_at();

drop trigger if exists set_doctor_profiles_updated_at on public.doctor_profiles;
create trigger set_doctor_profiles_updated_at
  before update on public.doctor_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_provider_staff_updated_at on public.provider_staff;
create trigger set_provider_staff_updated_at
  before update on public.provider_staff
  for each row execute function public.set_updated_at();

-- ============================================================================
-- AUTO-CREATE EMPTY DOCTOR PROFILE ROW WHEN A DOCTOR USER IS INVITED
-- (controlled by Supabase Edge Function or admin workflow; trigger is useful
-- when using SQL INSERT-only staff invite flow).
-- ============================================================================
create or replace function public.ensure_doctor_profile()
returns trigger as $$
begin
  insert into public.doctor_profiles (user_id, specialty)
  values (new.user_id, coalesce(new.department, 'General Practice'))
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql;

drop trigger if exists ensure_doctor_profile_after_staff_insert on public.provider_staff;
create trigger ensure_doctor_profile_after_staff_insert
  after insert on public.provider_staff
  for each row
  when (new.job_title ilike '%doctor%' or new.job_title ilike '%physician%' or new.job_title ilike '%specialist%')
  execute function public.ensure_doctor_profile();

-- ============================================================================
-- ADMINISTRATOR ACCESS + FIRST-ADMIN BOOTSTRAP
-- Adds a full-access administrator path without removing the role-specific
-- policies above. On an empty project, the latest registered profile becomes
-- the first active administrator. Re-running this never replaces an existing
-- administrator.
-- ============================================================================
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'providers', 'doctor_profiles', 'provider_staff',
    'appointments', 'medical_records', 'prescriptions', 'personal_files',
    'bills', 'bill_items', 'payments', 'doctor_schedule',
    'emergency_dispatches', 'encounters', 'vitals', 'diagnoses',
    'lab_orders', 'lab_results', 'tasks', 'inventory_items', 'facility_messages',
    'record_access_requests', 'notifications', 'conversations', 'messages', 'referrals', 'claims'
  ]
  loop
    execute format('drop policy if exists "Admins have full access" on public.%I', target_table);
    execute format(
      'create policy "Admins have full access" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      target_table
    );
  end loop;

  if not exists (select 1 from public.profiles where role = 'admin') then
    update public.profiles
    set role = 'admin', status = 'active'
    where id = (
      select id from public.profiles order by created_at desc nulls last limit 1
    );
  end if;
end $$;

-- ============================================================================
-- EMERGENCY LIVE STATUS — see migrations/20260902070000_emergency_live_status.sql
-- for the full rationale. Patient-facing dispatch tracking, best-effort
-- facility resolution, real (in-app only, no SMS/push) notifications, and
-- facility-staff visibility scoped to their own provider.
-- ============================================================================
alter table public.emergency_dispatches
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists target_provider_id uuid references public.providers(id);

drop trigger if exists set_emergency_dispatches_updated_at on public.emergency_dispatches;
create trigger set_emergency_dispatches_updated_at
  before update on public.emergency_dispatches
  for each row execute function public.set_updated_at();

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('appointments', 'reminders', 'results', 'follow_up', 'payments', 'messages', 'access', 'general', 'emergency'));

create or replace function public.resolve_dispatch_provider()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_facility is not null then
    select p.id into new.target_provider_id
    from public.providers p
    where regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g')
        = regexp_replace(lower(new.target_facility), '[^a-z0-9]', '', 'g')
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists resolve_emergency_dispatch_provider on public.emergency_dispatches;
create trigger resolve_emergency_dispatch_provider
  before insert on public.emergency_dispatches
  for each row execute function public.resolve_dispatch_provider();

create or replace function public.notify_emergency_dispatch_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff record;
begin
  if new.target_provider_id is not null then
    for v_staff in
      select user_id from public.provider_staff
      where provider_id = new.target_provider_id and is_active = true
    loop
      perform public.create_notification(
        v_staff.user_id, 'emergency',
        'Incoming emergency dispatch',
        format('%s — ref %s', new.condition, new.dispatch_ref),
        'emergency_dispatches', new.id
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_emergency_dispatch_created on public.emergency_dispatches;
create trigger notify_emergency_dispatch_created
  after insert on public.emergency_dispatches
  for each row execute function public.notify_emergency_dispatch_created();

create or replace function public.notify_emergency_dispatch_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.patient_id is not null then
    perform public.create_notification(
      new.patient_id, 'emergency',
      'Emergency dispatch update',
      format('Your dispatch %s is now: %s', new.dispatch_ref, new.status),
      'emergency_dispatches', new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_emergency_dispatch_status_change on public.emergency_dispatches;
create trigger notify_emergency_dispatch_status_change
  after update on public.emergency_dispatches
  for each row execute function public.notify_emergency_dispatch_status_change();

drop policy if exists "Facility staff can view their facility's dispatches" on public.emergency_dispatches;
create policy "Facility staff can view their facility's dispatches"
  on public.emergency_dispatches for select
  using (
    target_provider_id is not null
    and exists (
      select 1 from public.provider_staff ps
      where ps.user_id = auth.uid() and ps.provider_id = emergency_dispatches.target_provider_id and ps.is_active
    )
  );

create or replace function public.cancel_own_dispatch(p_dispatch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.emergency_dispatches
  set status = 'cancelled'
  where id = p_dispatch_id
    and patient_id = auth.uid()
    and status in ('dispatched', 'requested');
end;
$$;

revoke all on function public.cancel_own_dispatch(uuid) from public;
grant execute on function public.cancel_own_dispatch(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.emergency_dispatches;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

