-- NiaCare Health — initial Supabase schema
-- Run this once in the Supabase Dashboard → SQL Editor (or `supabase db push` if you use the CLI).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.

-- ============================================================================
-- PROFILES — one row per authenticated patient, keyed to auth.users
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_category text not null check (user_category in ('locals', 'internationals')),
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

alter table public.profiles enable row level security;

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

-- ============================================================================
-- APPOINTMENTS
-- ============================================================================
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  ticket_number text not null,
  doctor_id text not null,
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

alter table public.appointments enable row level security;

drop policy if exists "Appointments are manageable by owner" on public.appointments;
create policy "Appointments are manageable by owner"
  on public.appointments for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

-- ============================================================================
-- MEDICAL RECORDS
-- ============================================================================
create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
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

alter table public.medical_records enable row level security;

drop policy if exists "Medical records are viewable by owner" on public.medical_records;
create policy "Medical records are viewable by owner"
  on public.medical_records for select
  using (auth.uid() = patient_id);

drop policy if exists "Medical records are insertable by owner" on public.medical_records;
create policy "Medical records are insertable by owner"
  on public.medical_records for insert
  with check (auth.uid() = patient_id);

-- ============================================================================
-- PRESCRIPTIONS
-- ============================================================================
create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  medication_name text not null,
  dosage_instructions text,
  prescribed_by text,
  is_sos boolean not null default false,
  days_remaining integer,
  taken_today boolean not null default false,
  refill_requested boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.prescriptions enable row level security;

drop policy if exists "Prescriptions are manageable by owner" on public.prescriptions;
create policy "Prescriptions are manageable by owner"
  on public.prescriptions for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

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

drop policy if exists "Bills are manageable by owner" on public.bills;
create policy "Bills are manageable by owner"
  on public.bills for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

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
  created_at timestamptz not null default now()
);

alter table public.emergency_dispatches enable row level security;

drop policy if exists "Anyone can create a dispatch" on public.emergency_dispatches;
create policy "Anyone can create a dispatch"
  on public.emergency_dispatches for insert
  with check (true);

drop policy if exists "Owners can view their dispatches" on public.emergency_dispatches;
create policy "Owners can view their dispatches"
  on public.emergency_dispatches for select
  using (auth.uid() = patient_id);

-- ============================================================================
-- updated_at auto-touch trigger for profiles
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
