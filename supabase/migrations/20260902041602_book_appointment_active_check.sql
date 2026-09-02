-- ============================================================================
-- NiaCare — book_appointment(): reject bookings against an inactive
-- facility or inactive doctor.
--
-- STATUS: NOT YET APPLIED to the live database as of this file's creation.
--
-- IMPORTANT DIFFERENCE FROM THE OTHER PENDING MIGRATIONS: book_appointment()
-- is ALREADY LIVE and already in active use (it is NOT one of the pending,
-- not-yet-deployed functions). This migration REPLACES its body — same
-- name, same signature (CREATE OR REPLACE, so no client code needs to
-- change) — adding two new checks near the top. Applying this migration
-- changes real, already-live behavior: a booking attempt against a
-- deactivated facility or a deactivated doctor will start being rejected
-- with a clear error where it previously would have silently succeeded.
-- Every other migration in this directory only adds new, previously-absent
-- objects; this one modifies an existing one. Review accordingly.
--
-- WHY: reviewed while auditing facility/doctor activation — providers and
-- doctor_profiles both already have is_active, and the UI already lets an
-- admin deactivate either one, but nothing enforced that a deactivated
-- facility/doctor stop receiving NEW bookings. The existing RLS policy on
-- appointments ("Appointments are manageable by owner") does not check
-- providers.is_active or doctor_profiles.is_active at all, so this had to
-- be added inside the RPC itself, per spec ("implement it at the
-- RPC/database level, not only in the UI").
--
-- WHAT IS NOT CHANGED: the function's signature, its schedule-slot
-- reservation logic (the ON CONFLICT ... WHERE is_booked = false upsert),
-- its notification call, and its authorization check are all byte-for-byte
-- identical to the current live version. Only two new IF blocks were
-- inserted, both purely rejecting (raising an exception) — neither can
-- cause an otherwise-valid booking to succeed differently than before.
--
-- PRE-FLIGHT (read-only, run first):
--   select count(*) from public.providers where is_active = false;
--   select count(*) from public.doctor_profiles where is_active = false;
--   -- Informational only — tells you how many facilities/doctors would
--   -- start rejecting new bookings once this is applied. Neither query
--   -- blocks applying the migration; review the results before deciding
--   -- whether any of those facilities/doctors should be reactivated first
--   -- if the deactivation was unintentional.
--
-- POST-DEPLOY VERIFICATION:
--   select prosrc from pg_proc
--   where pronamespace = 'public'::regnamespace and proname = 'book_appointment';
--   -- expect: the returned text contains
--   --   "This facility is not currently accepting new appointments"
--   --   and "This doctor is not currently accepting new appointments".
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
