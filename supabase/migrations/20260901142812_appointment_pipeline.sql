-- ============================================================================
-- NiaCare — Appointment status pipeline (check-in / queue / consultation)
--
-- STATUS: NOT YET APPLIED to the live database as of this file's creation.
-- This file was extracted verbatim from supabase/schema.sql (the project's
-- single source-of-truth schema file) so it can be reviewed and applied on
-- its own, without re-running the rest of schema.sql. The content below is
-- byte-for-byte identical to the corresponding section of schema.sql — see
-- that file for the same objects in context with everything else.
--
-- WHAT THIS ADDS (all additive, nothing removed or renamed):
--   1. appointments_doctor_slot_unique — a partial unique index closing a
--      double-booking gap (a raw insert could bypass book_appointment()'s
--      own doctor_schedule-based protection). book_appointment() itself is
--      NOT modified.
--   2. 9 new nullable timestamp/actor columns on public.appointments.
--   3. appointments_status_check extended from 4 values to 8 (arrived,
--      called, in_consultation, no_show added; confirmed/in_queue/
--      completed/cancelled kept exactly as they were).
--   4. A new function patient_arrive_appointment().
--   5. check_in_appointment() replaced with an updated body (same name,
--      same signature — now also accepts 'arrived' as a valid starting
--      status, in addition to the existing 'confirmed').
--   6. Three new functions: call_patient(), start_consultation(),
--      complete_appointment_visit().
--   7. A new function mark_appointment_no_show().
--
-- WHY THIS IS SAFE:
--   - Every ALTER TABLE ... ADD COLUMN uses IF NOT EXISTS.
--   - The status check constraint is dropped and re-added by name
--     (appointments_status_check) rather than blindly appended, so
--     re-running this file is a no-op the second time.
--   - The unique index uses IF NOT EXISTS and is PARTIAL (excludes
--     cancelled rows and rows with no real doctor_profile_id), so it only
--     ever rejects a genuine live double-booking, never legitimate
--     cancel-and-rebook.
--   - Every function is CREATE OR REPLACE with an unchanged signature
--     (check_in_appointment) or a brand-new name — nothing is dropped.
--   - Every function is SECURITY DEFINER with SET search_path = public
--     and an explicit authorization check as its first real statement
--     (patient-only, provider-staff-at-the-same-facility, treating-doctor,
--     or admin — see each function body below) before touching any row.
--   - Pre-flight data was checked against the live database before this
--     was written (see the deployment README next to this file): 2 total
--     appointment rows existed, using only 'confirmed'/'cancelled', and
--     zero non-cancelled appointments had a real doctor_profile_id — so
--     neither the constraint change nor the unique index had any existing
--     row to conflict with at the time of writing. Re-run the pre-flight
--     queries in the README immediately before applying, since data may
--     have changed since.
--
-- HOW TO APPLY: see supabase/migrations/README.md in this same directory
-- for the exact Supabase SQL Editor steps and the post-deploy verification
-- queries. This file makes no network calls and was not executed by the
-- assistant that generated it — applying it is a manual, deliberate step.
-- ============================================================================

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
