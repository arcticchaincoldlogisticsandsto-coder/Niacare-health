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

-- SECURITY: "Profiles are updatable by owner" above only restricts WHICH ROW
-- a user can touch (their own), not WHICH COLUMNS — RLS predicates can't
-- express "this column may change only for admins" on their own, so without
-- this trigger any signed-in patient could run
-- `supabase.from('profiles').update({ role: 'admin' })` from the browser and
-- self-promote. auth.uid() is null for SQL-editor/migration/service-role
-- execution (no end-user session), so the bootstrap block below and admin
-- tooling are unaffected — only a real authenticated non-admin session is
-- blocked from changing role/status.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
  before update on public.profiles
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
  add column if not exists created_by uuid references auth.users(id) on delete set null;

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

drop policy if exists "Medical records are insertable by clinical staff" on public.medical_records;
create policy "Medical records are insertable by clinical staff"
  on public.medical_records for insert
  with check (
    auth.uid() = patient_id
    or exists (
      select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.is_active = true
    )
    or exists (
      select 1 from public.provider_staff ps where ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

drop policy if exists "Medical records are updatable by clinical staff" on public.medical_records;
create policy "Medical records are updatable by clinical staff"
  on public.medical_records for update
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.is_active = true
    )
    or exists (
      select 1 from public.provider_staff ps where ps.user_id = auth.uid() and ps.is_active = true
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

drop policy if exists "Prescriptions are manageable by patient and clinical staff" on public.prescriptions;
create policy "Prescriptions are manageable by patient and clinical staff"
  on public.prescriptions for all
  using (
    auth.uid() = patient_id
    or auth.uid() = created_by
    or exists (
      select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.is_active = true
    )
    or exists (
      select 1 from public.provider_staff ps where ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  )
  with check (
    auth.uid() = patient_id
    or auth.uid() = created_by
    or exists (
      select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.is_active = true
    )
    or exists (
      select 1 from public.provider_staff ps where ps.user_id = auth.uid() and ps.is_active = true
    )
    or public.is_admin()
  );

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

drop policy if exists "Bills are updatable by staff" on public.bills;
create policy "Bills are updatable by staff"
  on public.bills for update
  using (
    auth.uid() = patient_id
    or exists (
      select 1 from public.appointments a
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where a.id = bills.appointment_id and ps.user_id = auth.uid()
    )
    or public.is_admin()
  );

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

drop policy if exists "Payments are insertable by patient and staff" on public.payments;
create policy "Payments are insertable by patient and staff"
  on public.payments for insert
  with check (
    auth.uid() = patient_id
    or exists (
      select 1 from public.bills b
      join public.appointments a on a.id = b.appointment_id
      join public.provider_staff ps on ps.provider_id = a.provider_id
      where b.id = payments.bill_id and ps.user_id = auth.uid()
    )
    or public.is_admin()
  );

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
begin
  if auth.uid() is null or auth.uid() <> p_patient_id then
    raise exception 'Not authorized to book this appointment.' using errcode = '42501';
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

alter table public.audit_logs enable row level security;

drop policy if exists "Audit logs are viewable by admins only" on public.audit_logs;
create policy "Audit logs are viewable by admins only"
  on public.audit_logs for select
  using (public.is_admin());

create or replace function public.log_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_patient_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, patient_id, metadata)
  values (auth.uid(), p_action, p_resource_type, p_resource_id, p_patient_id, p_metadata);
end;
$$;

revoke all on function public.log_audit_event(text, text, uuid, uuid, jsonb) from public;
grant execute on function public.log_audit_event(text, text, uuid, uuid, jsonb) to authenticated;

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

-- Generic append-only audit trigger for clinical/financial/emergency tables:
-- one row per insert/update, tagged with the acting user and a best-effort
-- patient_id (present as a real column on every table it's attached to).
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
    'emergency_dispatches', 'encounters', 'vitals', 'diagnoses'
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

