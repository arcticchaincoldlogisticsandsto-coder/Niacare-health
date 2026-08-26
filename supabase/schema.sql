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

drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
  on public.profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

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
-- PRESCRIPTIONS
-- ============================================================================
create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
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
  using (auth.uid() = patient_id);

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
    'emergency_dispatches'
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

